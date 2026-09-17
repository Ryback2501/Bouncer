import { createHash, randomUUID } from "crypto";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

// Applies `prisma/migrations/*/migration.sql` at startup without the Prisma CLI, so the runtime
// image doesn't have to ship it. Bookkeeping lives in Prisma's own `_prisma_migrations` table
// (same columns, checksum = sha256 of the SQL file), so databases migrated by `prisma migrate
// deploy` and by this runner are interchangeable and `prisma migrate dev/status` keep working.

export interface MigrationClient {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface MigrationLogger {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
}

interface AppliedRow {
  id: string;
  checksum: string;
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

// Arbitrary constant key shared by every Bouncer instance: concurrent replicas wait in line.
const LOCK_KEY = 72707369;

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) PRIMARY KEY NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
)`;

function readMigrations(migrationsDir: string) {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(migrationsDir, e.name, "migration.sql")))
    .map((e) => e.name)
    .sort()
    .map((name) => {
      const sql = readFileSync(join(migrationsDir, name, "migration.sql"), "utf8");
      return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    });
}

export async function runMigrations({
  client,
  migrationsDir,
  logger,
}: {
  client: MigrationClient;
  migrationsDir: string;
  logger: MigrationLogger;
}): Promise<string[]> {
  await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
  try {
    await client.query(CREATE_TABLE);
    const { rows } = await client.query(
      'SELECT "id", "checksum", "migration_name", "finished_at", "rolled_back_at" FROM "_prisma_migrations"'
    );
    // Rolled-back attempts are ignored, exactly like Prisma does.
    const applied = new Map(
      (rows as AppliedRow[]).filter((r) => r.rolled_back_at === null).map((r) => [r.migration_name, r])
    );

    const migrations = readMigrations(migrationsDir);
    const onDisk = new Set(migrations.map((m) => m.name));
    for (const name of applied.keys()) {
      if (!onDisk.has(name)) {
        logger.warn({ migration: name }, "Applied migration not found in migrations directory");
      }
    }

    const done: string[] = [];
    for (const m of migrations) {
      const row = applied.get(m.name);
      if (row) {
        if (row.finished_at === null) {
          throw new Error(
            `Migration ${m.name} failed in a previous run; resolve it (e.g. prisma migrate resolve) before starting`
          );
        }
        if (row.checksum !== m.checksum) {
          throw new Error(`Migration ${m.name} was modified after it was applied (checksum mismatch)`);
        }
        continue;
      }

      const id = randomUUID();
      await client.query(
        'INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "started_at", "applied_steps_count") VALUES ($1, $2, $3, now(), 0)',
        [id, m.checksum, m.name]
      );
      try {
        await client.query("BEGIN");
        await client.query(m.sql);
        await client.query(
          'UPDATE "_prisma_migrations" SET "finished_at" = now(), "applied_steps_count" = 1 WHERE "id" = $1',
          [id]
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        await client.query('UPDATE "_prisma_migrations" SET "logs" = $2 WHERE "id" = $1', [
          id,
          err instanceof Error ? err.message : String(err),
        ]);
        throw err;
      }
      logger.info({ migration: m.name }, "Applied migration");
      done.push(m.name);
    }

    logger.info({ applied: done.length, total: migrations.length }, "Database migrations up to date");
    return done;
  } finally {
    // Never let an unlock failure (e.g. the connection died) mask the real error. The lock is
    // session-scoped, so Postgres releases it anyway when the connection closes.
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch((err: unknown) => {
      logger.warn({ err }, "Failed to release migration advisory lock");
    });
  }
}
