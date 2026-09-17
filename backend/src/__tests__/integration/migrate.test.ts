/**
 * Integration test for the built-in migration runner (src/lib/migrate.ts) against real Postgres.
 * Each case gets its own throwaway database, so the shared test DB is never touched. The Prisma
 * CLI (a devDependency) is the oracle: after our runner, `prisma migrate diff` must report no
 * drift from schema.prisma and `prisma migrate status` must consider the DB up to date.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'child_process'
import { randomBytes } from 'crypto'
import path from 'path'
import { Client } from 'pg'
import { runMigrations } from '../../lib/migrate'

const BACKEND_DIR = path.resolve(__dirname, '../../..')
const MIGRATIONS_DIR = path.join(BACKEND_DIR, 'prisma/migrations')
const BASE_URL = process.env.DATABASE_URL!
const silent = { info: () => {}, warn: () => {} }
const created: string[] = []

function urlFor(db: string) {
  const u = new URL(BASE_URL)
  u.pathname = `/${db}`
  return u.toString()
}

async function withClient<T>(url: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

async function createDatabase(): Promise<string> {
  const name = `bouncer_migrate_${randomBytes(4).toString('hex')}`
  await withClient(BASE_URL, (c) => c.query(`CREATE DATABASE "${name}"`))
  created.push(name)
  return urlFor(name)
}

function prisma(args: string[], url: string) {
  return execFileSync('npx', ['prisma', ...args], {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: url },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

const migrate = (url: string) =>
  withClient(url, (client) => runMigrations({ client, migrationsDir: MIGRATIONS_DIR, logger: silent }))

beforeAll(async () => {
  // Sanity: the base connection works (clear error instead of N confusing failures).
  await withClient(BASE_URL, (c) => c.query('SELECT 1'))
})

afterAll(async () => {
  await withClient(BASE_URL, async (c) => {
    for (const name of created) await c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
  })
})

describe('built-in migration runner (real Postgres)', () => {
  it('builds a fresh database identical to schema.prisma and Prisma sees it as up to date', async () => {
    const url = await createDatabase()

    const applied = await migrate(url)
    expect(applied.length).toBeGreaterThan(0)

    // Exit code 0 = no difference (2 would mean drift) — execFileSync throws on non-zero.
    prisma(['migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--exit-code'], url)
    expect(prisma(['migrate', 'status'], url)).toMatch(/up to date/i)

    // Idempotent: a second run applies nothing.
    expect(await migrate(url)).toEqual([])
  }, 120_000)

  it('applies nothing to a database already migrated by `prisma migrate deploy`', async () => {
    const url = await createDatabase()
    prisma(['migrate', 'deploy'], url)

    expect(await migrate(url)).toEqual([])
  }, 120_000)
})
