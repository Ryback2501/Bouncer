import "dotenv/config";
import path from "path";
import { Client } from "pg";
import { createApp } from "./app";
import { config } from "./config";
import { prisma } from "./prisma";
import { configurePassport } from "./passport";
import logger from "./lib/logger";
import { runMigrations } from "./lib/migrate";
import { scheduleAuditPrune } from "./services/auditService";

async function migrate() {
  const client = new Client({ connectionString: config.DATABASE_URL });
  await client.connect();
  try {
    await runMigrations({
      client,
      migrationsDir: path.resolve(config.MIGRATIONS_DIR),
      logger,
    });
  } finally {
    await client.end();
  }
}

async function main() {
  if (config.MIGRATE_ON_START) await migrate();

  await configurePassport();

  const app = createApp();

  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "Server started");
  });

  // Audit retention (B-16): drop events older than AUDIT_RETENTION_DAYS, now and daily.
  scheduleAuditPrune(config.AUDIT_RETENTION_DAYS);
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled rejection");
  process.exit(1);
});
