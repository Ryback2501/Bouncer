import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // Never log credentials: API keys (Authorization), session cookies, or Set-Cookie.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "*.password",
      "*.token",
      "*.keyHash",
    ],
    censor: "[redacted]",
  },
  ...(process.env.NODE_ENV !== "production" && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});

export default logger;
