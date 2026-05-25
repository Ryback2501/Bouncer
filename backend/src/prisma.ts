import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { encryptField, decryptField } from "./lib/fieldCrypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

const base = new PrismaClient({ adapter });

// Encrypt a write payload's `email` in place. Handles both the direct (`email: "x"`) and the
// operator (`email: { set: "x" }`) forms Prisma accepts.
function encryptEmailInData(data: unknown): void {
  if (!data || typeof data !== "object") return;
  const d = data as { email?: unknown };
  if (typeof d.email === "string") {
    d.email = encryptField(d.email);
  } else if (d.email && typeof d.email === "object") {
    const op = d.email as { set?: unknown };
    if (typeof op.set === "string") op.set = encryptField(op.set);
  }
}

// Application-layer encryption of PII at rest: User.email is encrypted on write and decrypted on
// read everywhere this client is used (including nested relations and interactive transactions).
export const prisma = base.$extends({
  name: "encrypt-pii",
  query: {
    user: {
      async create({ args, query }) {
        encryptEmailInData(args.data);
        return query(args);
      },
      async update({ args, query }) {
        encryptEmailInData(args.data);
        return query(args);
      },
      async upsert({ args, query }) {
        encryptEmailInData(args.create);
        encryptEmailInData(args.update);
        return query(args);
      },
      async createMany({ args, query }) {
        if (Array.isArray(args.data)) args.data.forEach(encryptEmailInData);
        else encryptEmailInData(args.data);
        return query(args);
      },
      async updateMany({ args, query }) {
        encryptEmailInData(args.data);
        return query(args);
      },
    },
  },
  result: {
    user: {
      email: {
        needs: { email: true },
        compute(user) {
          return user.email == null ? null : decryptField(user.email);
        },
      },
    },
  },
});
