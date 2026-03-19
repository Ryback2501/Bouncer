import "dotenv/config";
import { createApp } from "./app";
import { config } from "./config";
import { prisma } from "./prisma";
import { configurePassport } from "./passport";

async function main() {
  await configurePassport();

  const app = createApp();

  app.listen(config.PORT, () => {
    console.log(`🚀 Bouncer backend running on http://localhost:${config.PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
