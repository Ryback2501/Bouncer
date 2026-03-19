import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import passport from "passport";
import rateLimit from "express-rate-limit";
import { Pool } from "pg";
import { config } from "./config";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";
import accessRouter from "./routes/api/v1/access";
import { errorHandler } from "./middleware/errorHandler";

const PgSession = ConnectPgSimple(session);

export function createApp() {
  const app = express();

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

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ── Session ───────────────────────────────────────────────────────────────
  const pool = new Pool({ connectionString: config.DATABASE_URL });
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
  app.use("/auth", authRouter);
  app.use("/admin", adminRouter);
  app.use("/api/v1", accessRouter);

  // ── Health check ─────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // ── Error handler ─────────────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
