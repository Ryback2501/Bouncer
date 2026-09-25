import { z } from "zod";
import { missingTrustProxyWarning } from "./lib/securityPolicy";

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

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(16),
    FRONTEND_URL: z.string().url(),
    // Express "trust proxy" setting. Accepts a boolean, an integer hop count, or a
    // subnet/IP list (see Express docs). Unset/empty: trust one hop iff FRONTEND_URL is https
    // (see lib/securityPolicy.ts).
    TRUST_PROXY: z.string().optional(),
    // Allowlist of emails permitted to bootstrap the first global admin. Required.
    ADMIN_ALLOWED_EMAILS: csvEmails,
    // Base64-encoded 32-byte key for encrypting PII (email) at rest. Required.
    // Generate: openssl rand -base64 32
    ENCRYPTION_KEY: z.string().optional(),
    // Local debugging only: put the internal error text into 500 responses. Off by default; no
    // NODE_ENV value turns it on.
    // Empty counts as unset and case is ignored: a debugging switch must never stop the app.
    EXPOSE_ERROR_DETAILS: z.preprocess(
      (v) => (typeof v === "string" && v.trim() !== "" ? v.trim().toLowerCase() : undefined),
      z
        .enum(["true", "false"])
        .default("false")
        .transform((v) => v === "true")
    ),
    // Filesystem path of the built SPA's `dist/` directory. When set, Express serves it as
    // static assets plus an HTML-accepting GET fallback to index.html (SPA client-side
    // routing). The production Docker image sets this to /app/public; leave unset to keep
    // a backend-only process (the integration test app does this).
    STATIC_DIR: z.string().optional(),
    // Apply pending prisma/migrations on startup (built-in runner, no Prisma CLI needed). On by
    // default in every NODE_ENV: the Docker image relies on it and is often run as development/test.
    MIGRATE_ON_START: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
    // Directory holding the `<timestamp>_<name>/migration.sql` folders. Relative to the cwd.
    MIGRATIONS_DIR: z.string().default("prisma/migrations"),

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
  // Fail closed on weak/incomplete config — in every NODE_ENV. These used to apply only in
  // production, and the image is routinely run as development/test (B-07).
  .superRefine((env, ctx) => {
    // Validate the encryption key shape whenever it is provided (dev or prod).
    if (env.ENCRYPTION_KEY !== undefined) {
      let len = 0;
      try {
        len = Buffer.from(env.ENCRYPTION_KEY, "base64").length;
      } catch {
        len = 0;
      }
      if (len !== 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ENCRYPTION_KEY"],
          message: "must be a base64-encoded 32-byte key (generate: openssl rand -base64 32)",
        });
      }
    }

    if (!env.ENCRYPTION_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ENCRYPTION_KEY"],
        message: "must be set to encrypt PII (email) at rest (generate: openssl rand -base64 32)",
      });
    }

    if (env.SESSION_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SESSION_SECRET"],
        message: "must be at least 32 characters (generate: openssl rand -base64 48)",
      });
    }

    if (env.ADMIN_ALLOWED_EMAILS.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ADMIN_ALLOWED_EMAILS"],
        message: "must be set to control who can bootstrap the global admin",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  for (const [field, issues] of Object.entries(parsed.error.flatten().fieldErrors)) {
    console.error(`  ${field}: ${(issues as string[]).join(", ")}`);
  }
  process.exit(1);
}

export const config = parsed.data;

// Without a provider nobody can sign in. That is a usability problem, not a security one, so it
// warns rather than refusing to start (the test suites run without providers).
const hasProvider =
  (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) ||
  (config.MICROSOFT_CLIENT_ID && config.MICROSOFT_CLIENT_SECRET) ||
  (config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET) ||
  (config.LINKEDIN_CLIENT_ID && config.LINKEDIN_CLIENT_SECRET);
if (!hasProvider && config.NODE_ENV !== "test") {
  console.warn("⚠️  No OAuth provider (client id + secret) is configured; nobody will be able to sign in.");
}

const trustProxyWarning = missingTrustProxyWarning(config.TRUST_PROXY, config.FRONTEND_URL);
if (trustProxyWarning) console.warn(`⚠️  ${trustProxyWarning}`);

// Advisory: encrypted transport to the database is strongly recommended in production.
if (config.NODE_ENV === "production" && !/sslmode=/i.test(config.DATABASE_URL)) {
  console.warn(
    "⚠️  DATABASE_URL has no sslmode; use sslmode=require (or verify-full) to encrypt DB traffic in production."
  );
}
