import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHash } from 'crypto'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { runMigrations, type MigrationClient, type MigrationLogger } from '../lib/migrate'

type Row = {
  id: string
  checksum: string
  migration_name: string
  finished_at: Date | null
  rolled_back_at: Date | null
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

/** In-memory stand-in for a pg client: records every statement and serves `_prisma_migrations`. */
function fakeClient(existing: Row[] = [], failOn?: string) {
  const rows = [...existing]
  const statements: string[] = []
  const client: MigrationClient = {
    async query(text: string, values?: unknown[]) {
      statements.push(text.trim())
      if (failOn && text.includes(failOn)) throw new Error(`boom: ${failOn}`)
      if (/^SELECT .* FROM "_prisma_migrations"/s.test(text.trim())) return { rows }
      if (/^INSERT INTO "_prisma_migrations"/.test(text.trim())) {
        const [id, checksum, name] = values as string[]
        rows.push({ id, checksum, migration_name: name, finished_at: null, rolled_back_at: null })
      }
      if (/^UPDATE "_prisma_migrations" SET "finished_at"/.test(text.trim())) {
        const row = rows.find((r) => r.id === (values as string[])[0])
        if (row) row.finished_at = new Date()
      }
      return { rows: [] }
    },
  }
  return { client, rows, statements }
}

const silent = (): MigrationLogger => ({ info: vi.fn(), warn: vi.fn() })

let dir: string
function addMigration(name: string, sql: string) {
  mkdirSync(join(dir, name))
  writeFileSync(join(dir, name, 'migration.sql'), sql)
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bouncer-migrate-'))
  writeFileSync(join(dir, 'migration_lock.toml'), 'provider = "postgresql"\n')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('runMigrations', () => {
  it('applies pending migrations in folder-name order, each in its own transaction', async () => {
    addMigration('20260102000000_second', 'CREATE TABLE b (id int);')
    addMigration('20260101000000_first', 'CREATE TABLE a (id int);')
    const { client, rows, statements } = fakeClient()

    const applied = await runMigrations({ client, migrationsDir: dir, logger: silent() })

    expect(applied).toEqual(['20260101000000_first', '20260102000000_second'])
    const a = statements.indexOf('CREATE TABLE a (id int);')
    const b = statements.indexOf('CREATE TABLE b (id int);')
    expect(a).toBeGreaterThan(-1)
    expect(b).toBeGreaterThan(a)
    expect(statements[a - 1]).toBe('BEGIN')
    expect(statements[a + 1]).toMatch(/^UPDATE "_prisma_migrations" SET "finished_at"/)
    expect(statements[a + 2]).toBe('COMMIT')
    expect(rows.map((r) => [r.migration_name, r.checksum])).toEqual([
      ['20260101000000_first', sha('CREATE TABLE a (id int);')],
      ['20260102000000_second', sha('CREATE TABLE b (id int);')],
    ])
  })

  it('creates the Prisma-compatible bookkeeping table if missing', async () => {
    const { client, statements } = fakeClient()
    await runMigrations({ client, migrationsDir: dir, logger: silent() })
    const ddl = statements.find((s) => s.startsWith('CREATE TABLE IF NOT EXISTS "_prisma_migrations"'))
    expect(ddl).toBeDefined()
    for (const col of ['"id" VARCHAR(36) PRIMARY KEY', '"checksum" VARCHAR(64) NOT NULL', '"applied_steps_count" INTEGER NOT NULL DEFAULT 0']) {
      expect(ddl).toContain(col)
    }
  })

  it('skips migrations already applied with the same checksum', async () => {
    addMigration('20260101000000_first', 'CREATE TABLE a (id int);')
    const { client, statements } = fakeClient([
      { id: 'x', checksum: sha('CREATE TABLE a (id int);'), migration_name: '20260101000000_first', finished_at: new Date(), rolled_back_at: null },
    ])

    const applied = await runMigrations({ client, migrationsDir: dir, logger: silent() })

    expect(applied).toEqual([])
    expect(statements).not.toContain('CREATE TABLE a (id int);')
  })

  it('throws when an applied migration was modified (checksum mismatch)', async () => {
    addMigration('20260101000000_first', 'CREATE TABLE a (id bigint);')
    const { client } = fakeClient([
      { id: 'x', checksum: sha('CREATE TABLE a (id int);'), migration_name: '20260101000000_first', finished_at: new Date(), rolled_back_at: null },
    ])
    await expect(runMigrations({ client, migrationsDir: dir, logger: silent() })).rejects.toThrow(
      /20260101000000_first.*modified/,
    )
  })

  it('refuses to continue past a previously failed migration', async () => {
    addMigration('20260101000000_first', 'CREATE TABLE a (id int);')
    const { client, statements } = fakeClient([
      { id: 'x', checksum: sha('CREATE TABLE a (id int);'), migration_name: '20260101000000_first', finished_at: null, rolled_back_at: null },
    ])
    await expect(runMigrations({ client, migrationsDir: dir, logger: silent() })).rejects.toThrow(
      /20260101000000_first.*failed/,
    )
    expect(statements).not.toContain('CREATE TABLE a (id int);')
  })

  it('rolls back, records the error in logs and rethrows when a migration fails', async () => {
    addMigration('20260101000000_first', 'CREATE TABLE a (id int);')
    addMigration('20260102000000_broken', 'CREATE TABLE broken (;')
    const { client, statements } = fakeClient([], 'CREATE TABLE broken')

    await expect(runMigrations({ client, migrationsDir: dir, logger: silent() })).rejects.toThrow(/boom/)

    const broken = statements.indexOf('CREATE TABLE broken (;')
    expect(statements[broken + 1]).toBe('ROLLBACK')
    expect(statements.some((s) => /^UPDATE "_prisma_migrations" SET "logs"/.test(s))).toBe(true)
  })

  it('always takes and releases the advisory lock', async () => {
    addMigration('20260102000000_broken', 'CREATE TABLE broken (;')
    const { client, statements } = fakeClient([], 'CREATE TABLE broken')
    await expect(runMigrations({ client, migrationsDir: dir, logger: silent() })).rejects.toThrow()
    expect(statements[0]).toMatch(/^SELECT pg_advisory_lock\(/)
    expect(statements.at(-1)).toMatch(/^SELECT pg_advisory_unlock\(/)
  })

  it('surfaces the migration error even if releasing the lock also fails', async () => {
    addMigration('20260102000000_broken', 'CREATE TABLE broken (;')
    const { client } = fakeClient([], 'CREATE TABLE broken')
    const query = client.query.bind(client)
    client.query = async (text, values) => {
      if (text.startsWith('SELECT pg_advisory_unlock')) throw new Error('connection terminated')
      return query(text, values)
    }
    await expect(runMigrations({ client, migrationsDir: dir, logger: silent() })).rejects.toThrow(/boom/)
  })

  it('warns (but does not fail) about applied migrations missing on disk', async () => {
    const logger = silent()
    const { client } = fakeClient([
      { id: 'x', checksum: 'abc', migration_name: '20250101000000_gone', finished_at: new Date(), rolled_back_at: null },
    ])
    await expect(runMigrations({ client, migrationsDir: dir, logger })).resolves.toEqual([])
    expect(logger.warn).toHaveBeenCalled()
  })
})
