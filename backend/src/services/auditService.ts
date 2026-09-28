import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import logger from "../lib/logger";

// Security audit log (B-16): who did what to what, from where, and whether it was allowed. Rows go to
// AuditEvent (see schema.prisma — no foreign keys, snapshot labels) and every event is also a
// structured `audit: true` log line. Nothing here may carry a secret or an email address.

export type AuditOutcome = "success" | "denied" | "failure";

export interface AuditActor {
  type: "user" | "api_key" | "anonymous";
  id: string | null;
  label: string | null;
  ip: string | null;
}

export interface AuditTarget {
  type: string;
  id?: string | null;
  label?: string | null;
}

export interface AuditEventInput {
  action: string;
  outcome?: AuditOutcome;
  actor: AuditActor;
  target?: AuditTarget;
  details?: Record<string, unknown>;
}

/**
 * The actor behind a request, with the client IP: the API key on a key-authenticated /api/v1 call
 * (it wins over any browser session riding along — the key is what authorised the request),
 * otherwise the signed-in admin.
 */
export function auditActor(req: Request): AuditActor {
  const ip = req.ip ?? null;
  if (req.bouncerApiKey) return { type: "api_key", id: req.bouncerApiKey.id, label: req.bouncerApiKey.label ?? null, ip };
  if (req.user) return { type: "user", id: req.user.id, label: req.user.name ?? null, ip };
  return { type: "anonymous", id: null, label: null, ip };
}

// Defence in depth: whatever a call site passes, detail fields that look like credentials or an
// email address never reach the table or the logs.
// Always dropped, even as an id (a session id is itself a credential).
const ALWAYS_SENSITIVE = /session|cookie|token|secret|password|email/i;
// Dropped unless the field is an id reference (`apiKeyId`, `customId` are fine; `rawKey` is not).
const SENSITIVE_UNLESS_ID = /key|hash|code/i;

function isSafeDetail(name: string): boolean {
  if (ALWAYS_SENSITIVE.test(name)) return false;
  if (/Id$/.test(name)) return true;
  return !SENSITIVE_UNLESS_ID.test(name);
}

function sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined;
  return Object.fromEntries(Object.entries(details).filter(([k]) => isSafeDetail(k)));
}

function toRow(event: AuditEventInput) {
  return {
    action: event.action,
    outcome: event.outcome ?? "success",
    actorType: event.actor.type,
    actorId: event.actor.id,
    actorLabel: event.actor.label,
    targetType: event.target?.type ?? null,
    targetId: event.target?.id ?? null,
    targetLabel: event.target?.label ?? null,
    ip: event.actor.ip,
    details: sanitizeDetails(event.details) as Prisma.InputJsonValue | undefined,
  };
}

/**
 * Store an event and log it. Never throws: the action it describes has already happened, and
 * failing the whole request over a lost log row would be worse — the failure is logged instead.
 */
export async function recordAudit(event: AuditEventInput): Promise<void> {
  const row = toRow(event);
  try {
    await prisma.auditEvent.create({ data: row });
    logger.info({ audit: true, ...row }, "audit");
  } catch (err) {
    logger.error({ err, audit: row }, "audit write failed");
  }
}

/** recordAudit with the actor (admin session or API key) and IP taken from the request. */
export function auditRequest(req: Request, event: Omit<AuditEventInput, "actor">): Promise<void> {
  return recordAudit({ ...event, actor: auditActor(req) });
}

/** Names (never values) of the fields an update actually set. */
export function changedFields(body: Record<string, unknown>): string[] {
  return Object.keys(body).filter((k) => body[k] !== undefined).sort();
}

/**
 * Log-only event for unauthenticated rejections (unknown/expired API key, no session, bad CSRF
 * token). Anyone can trigger these at will, so they are not stored — a table an attacker can grow
 * on demand would be a liability. They still reach the structured logs.
 */
export function logAuditOnly(event: AuditEventInput, level: "warn" | "info" = "warn"): void {
  logger[level]({ audit: true, ...toRow(event) }, "audit");
}

export interface AuditFilters {
  page?: number;
  limit?: number;
  /** Prefix match, e.g. "auth." or "application." */
  action?: string;
  actorId?: string;
  outcome?: AuditOutcome;
  since?: Date;
  until?: Date;
}

export async function listAudit(filters: AuditFilters) {
  const { page = 1, limit = 50, action, actorId, outcome, since, until } = filters;
  const where: Prisma.AuditEventWhereInput = {
    ...(action && { action: { startsWith: action } }),
    ...(actorId && { actorId }),
    ...(outcome && { outcome }),
    ...((since || until) && { createdAt: { ...(since && { gte: since }), ...(until && { lte: until }) } }),
  };
  const [total, events] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
  ]);
  return { total, page, limit, events };
}

/** Delete events older than `days` (retention). Returns how many were removed. */
export async function pruneAudit(days: number, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const { count } = await prisma.auditEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Retention: prune now and then every 24 h. The timer is unref'd so it never keeps the process
 * alive, and a failed prune is logged rather than thrown (it is retried the next day).
 */
export function scheduleAuditPrune(days: number): NodeJS.Timeout {
  const run = () => {
    pruneAudit(days)
      .then((count) => { if (count > 0) logger.info({ count, days }, "audit events pruned"); })
      .catch((err) => logger.error({ err }, "audit prune failed"));
  };
  setTimeout(run, 0).unref();
  return setInterval(run, DAY_MS).unref();
}
