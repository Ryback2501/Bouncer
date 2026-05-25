import { z } from "zod";

// Comma-separated email list → normalized lowercase array.
const csvEmails = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(16),
    FRONTEND_URL: z.string().url(),
    // Express "trust proxy" setting. Accepts a boolean, an integer hop count, or a
    // subnet/IP list (see Express docs). Defaults to trusting the first hop in production.
    TRUST_PROXY: z.string().optional(),
    // Allowlist of emails permitted to bootstrap the first global admin. Required in production.
    ADMIN_ALLOWED_EMAILS: csvEmails,

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().optional(),

    MICROSOFT_CLIENT_ID: z.string().optional(),
    MICROSOFT_CLIENT_SECRET: z.string().optional(),
    MICROSOFT_TENANT_ID: z.string().default("common"),
    MICROSOFT_CALLBACK_URL: z.string().optional(),

    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GITHUB_CALLBACK_URL: z.string().optional(),

    LINKEDIN_CLIENT_ID: z.string().optional(),
    LINKEDIN_CLIENT_SECRET: z.string().optional(),
    LINKEDIN_CALLBACK_URL: z.string().optional(),
  })
  // Production hardening: fail closed on weak/incomplete config.
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;

    if (env.SESSION_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SESSION_SECRET"],
        message: "must be at least 32 characters in production",
      });
    }

    const hasProvider =
      (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) ||
      (env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) ||
      (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) ||
      (env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET);
    if (!hasProvider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GOOGLE_CLIENT_ID"],
        message: "at least one OAuth provider (client id + secret) must be configured in production",
      });
    }

    if (env.ADMIN_ALLOWED_EMAILS.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ADMIN_ALLOWED_EMAILS"],
        message: "must be set in production to control who can bootstrap the global admin",
      });
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  for (const [field, issues] of Object.entries(parsed.error.flatten().fieldErrors)) {
    console.error(`  ${field}: ${(issues as string[]).join(", ")}`);
  }
  process.exit(1);
}

export const config = parsed.data;

// Advisory: encrypted transport to the database is strongly recommended in production.
if (config.NODE_ENV === "production" && !/sslmode=/i.test(config.DATABASE_URL)) {
  console.warn(
    "⚠️  DATABASE_URL has no sslmode; use sslmode=require (or verify-full) to encrypt DB traffic in production."
  );
}
