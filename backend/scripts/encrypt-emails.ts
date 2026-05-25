import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "../src/config";
import { encryptField, isEncrypted } from "../src/lib/fieldCrypto";

// One-off backfill that encrypts any plaintext User.email rows. Idempotent: rows already in the
// `enc:v1:` format are skipped, so it is safe to run more than once.
//
// Run AFTER deploying the encryption code, with ENCRYPTION_KEY set:
//   cd backend && npx tsx scripts/encrypt-emails.ts
async function main() {
  if (!config.ENCRYPTION_KEY) {
    console.error("ENCRYPTION_KEY is not set — nothing to encrypt.");
    process.exit(1);
  }

  // Non-extended client so we read/write the RAW column values (no transparent encrypt/decrypt).
  const adapter = new PrismaPg({ connectionString: config.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    let encrypted = 0;
    for (const u of users) {
      if (!u.email || isEncrypted(u.email)) continue;
      await prisma.user.update({ where: { id: u.id }, data: { email: encryptField(u.email) } });
      encrypted++;
    }
    console.log(`Backfill complete: ${encrypted} encrypted, ${users.length - encrypted} skipped.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
