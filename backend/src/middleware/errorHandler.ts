import { Request, Response, NextFunction } from "express";
import logger from "../lib/logger";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error({ err, method: req.method, url: req.url }, "Unhandled error");
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: "internal_error", message });
}
