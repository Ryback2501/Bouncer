import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import logger from "../lib/logger";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Full detail goes to the logs; clients never receive internal error text in production
  // (it can leak DB/internal implementation details).
  logger.error({ err, method: req.method, url: req.url }, "Unhandled error");
  const body: { error: string; message?: string } = { error: "internal_error" };
  if (config.NODE_ENV !== "production") {
    body.message = err instanceof Error ? err.message : "Internal server error";
  }
  res.status(500).json(body);
}
