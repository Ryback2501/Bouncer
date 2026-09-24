import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import logger from "../lib/logger";
import { redactUrl } from "../lib/redactUrl";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Full detail goes to the logs; clients never receive internal error text in production
  // (it can leak DB/internal implementation details). `url` is a top-level key here, so it is
  // outside pino-http's req serializer and needs sanitising in its own right — a 500 thrown from an
  // OAuth callback would otherwise write the authorization code in cleartext.
  logger.error({ err, method: req.method, url: redactUrl(req.url) }, "Unhandled error");
  const body: { error: string; message?: string } = { error: "internal_error" };
  if (config.NODE_ENV !== "production") {
    body.message = err instanceof Error ? err.message : "Internal server error";
  }
  res.status(500).json(body);
}
