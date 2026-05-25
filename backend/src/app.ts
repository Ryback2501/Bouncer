import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import passport from "passport";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { createHash } from "crypto";
import { Pool } from "pg";
import { config } from "./config";
import logger from "./lib/logger";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";
import accessRouter from "./routes/api/v1/access";
import apiInvitationsRouter from "./routes/api/v1/invitations";
import { errorHandler } from "./middleware/errorHandler";
import { prisma } from "./prisma";
import { doubleCsrfProtection } from "./middleware/csrf";

const PgSession = ConnectPgSimple(session);

export function createApp() {
  const app = express();

  // ── Reverse proxy ───────────────────────────────────────────────────────────
  // Required behind a TLS-terminating proxy so `secure` cookies are set and the real
  // client IP is used for rate-limiting. TRUST_PROXY overrides; defaults on in production.
  if (config.TRUST_PROXY !== undefined) {
    const tp = config.TRUST_PROXY;
    app.set(
      "trust proxy",
      tp === "true" ? true : tp === "false" ? false : /^\d+$/.test(tp) ? Number(tp) : tp
    );
  } else if (config.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // ── Request logging ───────────────────────────────────────────────────────
  app.use(pinoHttp({ logger }));

  // ── Security ──────────────────────────────────────────────────────────────
  // This service returns only JSON (no HTML/assets), so lock the CSP down hard and
  // forbid framing. The admin SPA gets its own CSP from nginx.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          "default-src": ["'none'"],
          "frame-ancestors": ["'none'"],
          "base-uri": ["'none'"],
        },
      },
    })
  );
  app.use(
    cors({
      origin: config.FRONTEND_URL,
      credentials: true,
    })
  );
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // ── Auth-specific rate limiter (stricter) ─────────────────────────────────
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.NODE_ENV === "test",
  });

  // ── Per-API-key limiter for the external API (/api/v1/*) ──────────────────
  // Buckets by the API key (hashed) so one key can't exhaust another's budget and a
  // leaked key has a bounded blast radius. Falls back to client IP for keyless requests.
  const apiKeyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.NODE_ENV === "test",
    validate: false,
    keyGenerator: (req) => {
      const auth = req.headers.authorization;
      if (auth?.startsWith("Bearer ")) {
        return "k:" + createHash("sha256").update(auth.slice(7)).digest("hex");
      }
      return "ip:" + (req.ip ?? "unknown");
    },
  });

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // ── Session ───────────────────────────────────────────────────────────────
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  app.use(
    session({
      store: new PgSession({ pool, createTableIfMissing: true }),
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  // ── Passport ──────────────────────────────────────────────────────────────
  // Note: configurePassport() is called in index.ts before app starts (it is async)
  app.use(passport.initialize());
  app.use(passport.session());

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use("/auth", authLimiter, authRouter);
  app.use("/admin", doubleCsrfProtection, adminRouter);
  app.use("/api/v1", apiKeyLimiter);
  app.use("/api/v1", accessRouter);
  app.use("/api/v1/invitations", apiInvitationsRouter);

  // ── Health check ─────────────────────────────────────────────────────────
  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", db: "ok" });
    } catch {
      res.status(503).json({ status: "error", db: "unreachable" });
    }
  });

  // ── Error handler ─────────────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
