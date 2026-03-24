import "dotenv/config";
import { createApp } from "./app";
import { config } from "./config";
import { prisma } from "./prisma";
import { configurePassport } from "./passport";
import logger from "./lib/logger";

async function main() {
  await configurePassport();

  const app = createApp();

  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "Server started");
  });
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
