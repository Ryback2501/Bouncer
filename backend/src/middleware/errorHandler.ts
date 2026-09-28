import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import logger from "../lib/logger";
import { redactUrl } from "../lib/redactUrl";
import { logAuditOnly, auditActor } from "../services/auditService";

type HttpErrorLike = { status?: unknown; statusCode?: unknown; code?: unknown; type?: unknown };

// The http-errors convention (body-parser, csrf-csrf): a numeric `status`/`statusCode` on the error.
// Only a real error status counts; anything else is an internal fault.
function statusOf(err: unknown): number {
  if (typeof err !== "object" || err === null) return 500;
  const { status, statusCode } = err as HttpErrorLike;
  const s = status ?? statusCode;
  return Number.isInteger(s) && (s as number) >= 400 && (s as number) <= 599 ? (s as number) : 500;
}

function clientErrorCode(err: unknown, status: number): string {
  const { code, type } = (err ?? {}) as HttpErrorLike;
  if (code === "EBADCSRFTOKEN") return "invalid_csrf_token";
  if (type === "entity.parse.failed") return "invalid_json";
  if (status === 404) return "not_found";
  if (status === 413) return "payload_too_large";
  if (status === 415) return "unsupported_media_type";
  return "bad_request";
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // `url` is a top-level key in both log lines, so it is outside pino-http's req serializer and
  // needs sanitising in its own right — a 500 thrown from an OAuth callback would otherwise write
  // the authorization code in cleartext.
  const url = redactUrl(req.url);
  const status = statusOf(err);

  // A request the client got wrong (bad JSON, oversized body, missing CSRF token) keeps its status
  // and gets a stable code, never the error text. It is not a server fault, so it is a warning
  // without a stack — anyone can send these at will (B-10).
  if (status < 500) {
    const code = clientErrorCode(err, status);
    logger.warn({ status, code, method: req.method, url }, "Request rejected");
    // A forged or stale CSRF token on an admin write is a security event (B-16): log-only, since
    // anyone can send one.
    if (code === "invalid_csrf_token") {
      logAuditOnly({
        action: "admin.csrf_rejected",
        outcome: "denied",
        actor: auditActor(req),
        details: { method: req.method, path: `${req.baseUrl}${req.path}` },
      });
    }
    res.status(status).json({ error: code });
    return;
  }

  // Full detail goes to the logs; clients never receive internal error text (it can leak
  // DB/internal implementation details) unless EXPOSE_ERROR_DETAILS=true is set explicitly for
  // local debugging. No NODE_ENV value turns it on (B-07).
  logger.error({ err, method: req.method, url }, "Unhandled error");
  const body: { error: string; message?: string } = { error: "internal_error" };
  if (config.EXPOSE_ERROR_DETAILS) {
    body.message = err instanceof Error ? err.message : "Internal server error";
  }
  res.status(status).json(body);
}
