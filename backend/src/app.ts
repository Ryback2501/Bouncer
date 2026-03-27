import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import passport from "passport";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { Pool } from "pg";
import { config } from "./config";
import logger from "./lib/logger";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";
import accessRouter from "./routes/api/v1/access";
import { errorHandler } from "./middleware/errorHandler";
import { prisma } from "./prisma";
import { doubleCsrfProtection } from "./middleware/csrf";

const PgSession = ConnectPgSimple(session);

export function createApp() {
  const app = express();

  // ── Request logging ───────────────────────────────────────────────────────
  app.use(pinoHttp({ logger }));

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(helmet({ contentSecurityPolicy: false }));
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

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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
  app.use("/api/v1", accessRouter);

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
