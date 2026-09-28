import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Request } from 'express'

vi.mock('../prisma', () => ({
  prisma: {
    auditEvent: { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
  },
}))
vi.mock('../lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { prisma } from '../prisma'
import logger from '../lib/logger'
import { recordAudit, logAuditOnly, auditActor, listAudit, pruneAudit, scheduleAuditPrune } from '../services/auditService'

const p = prisma.auditEvent as unknown as Record<string, ReturnType<typeof vi.fn>>

// B-16. Security-relevant events are stored (AuditEvent) and logged, so an incident can be
// reconstructed. They must never carry secrets or email addresses.
describe('auditService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('auditActor', () => {
    it('is the signed-in admin (id + display name, never the email) with the client IP', () => {
      const req = { user: { id: 'u1', name: 'Alice', email: 'alice@example.com' }, ip: '10.0.0.5' } as unknown as Request
      expect(auditActor(req)).toEqual({ type: 'user', id: 'u1', label: 'Alice', ip: '10.0.0.5' })
    })

    it('is the API key (id + label) on the external API', () => {
      const req = { bouncerApiKey: { id: 'k1', label: 'ci' }, ip: '10.0.0.6' } as unknown as Request
      expect(auditActor(req)).toEqual({ type: 'api_key', id: 'k1', label: 'ci', ip: '10.0.0.6' })
    })

    // /api/v1 routes authenticate by key; a browser session riding along must not take the credit.
    it('prefers the API key when a request carries both a key and a session', () => {
      const req = { user: { id: 'u1', name: 'Alice' }, bouncerApiKey: { id: 'k1', label: 'ci' }, ip: '10.0.0.8' } as unknown as Request
      expect(auditActor(req)).toMatchObject({ type: 'api_key', id: 'k1' })
    })

    it('is anonymous otherwise', () => {
      expect(auditActor({ ip: '10.0.0.7' } as unknown as Request)).toEqual({ type: 'anonymous', id: null, label: null, ip: '10.0.0.7' })
    })
  })

  describe('recordAudit', () => {
    const actor = { type: 'user' as const, id: 'u1', label: 'Alice', ip: '10.0.0.5' }

    it('stores the event and writes a structured log line', async () => {
      p.create.mockResolvedValue({})
      await recordAudit({
        action: 'application.delete',
        actor,
        target: { type: 'application', id: 'a1', label: 'Shop' },
        details: { customId: 'shop' },
      })
      expect(p.create).toHaveBeenCalledWith({
        data: {
          action: 'application.delete',
          outcome: 'success',
          actorType: 'user',
          actorId: 'u1',
          actorLabel: 'Alice',
          targetType: 'application',
          targetId: 'a1',
          targetLabel: 'Shop',
          ip: '10.0.0.5',
          details: { customId: 'shop' },
        },
      })
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ audit: true, action: 'application.delete', outcome: 'success', actorId: 'u1' }),
        'audit'
      )
    })

    it('drops secret-looking and email detail fields before storing or logging', async () => {
      p.create.mockResolvedValue({})
      await recordAudit({
        action: 'api_key.create',
        actor,
        details: { label: 'ci', rawKey: 'bncr_x', keyHash: 'h', token: 't', csrfSecret: 's', password: 'p', sessionId: 'sid', email: 'a@b.c', applicationId: 'a1' },
      })
      const stored = p.create.mock.calls[0][0].data.details
      expect(stored).toEqual({ label: 'ci', applicationId: 'a1' })
      expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toMatch(/bncr_x|a@b\.c|sid|"t"/)
    })

    it('never throws: a failed write is logged and the request carries on', async () => {
      p.create.mockRejectedValue(new Error('db down'))
      await expect(recordAudit({ action: 'auth.logout', actor })).resolves.toBeUndefined()
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ audit: expect.objectContaining({ action: 'auth.logout' }) }),
        'audit write failed'
      )
    })
  })

  describe('logAuditOnly', () => {
    it('logs a warning without touching the table (unauthenticated noise)', () => {
      logAuditOnly({ action: 'api_key.rejected', outcome: 'denied', actor: { type: 'anonymous', id: null, label: null, ip: '1.2.3.4' }, details: { reason: 'unknown_key' } })
      expect(p.create).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ audit: true, action: 'api_key.rejected', outcome: 'denied', ip: '1.2.3.4' }),
        'audit'
      )
    })
  })

  describe('listAudit', () => {
    it('returns newest first, paginated, filtered by action prefix, actor, outcome and time', async () => {
      p.findMany.mockResolvedValue([])
      p.count.mockResolvedValue(0)
      const since = new Date('2026-09-01T00:00:00Z')
      const until = new Date('2026-09-30T00:00:00Z')
      const res = await listAudit({ page: 2, limit: 10, action: 'auth.', actorId: 'u1', outcome: 'denied', since, until })
      const where = {
        action: { startsWith: 'auth.' },
        actorId: 'u1',
        outcome: 'denied',
        createdAt: { gte: since, lte: until },
      }
      expect(p.findMany).toHaveBeenCalledWith({ where, orderBy: { createdAt: 'desc' }, skip: 10, take: 10 })
      expect(p.count).toHaveBeenCalledWith({ where })
      expect(res).toEqual({ total: 0, page: 2, limit: 10, events: [] })
    })

    it('defaults to page 1 of 50 with no filters', async () => {
      p.findMany.mockResolvedValue([])
      p.count.mockResolvedValue(0)
      await listAudit({})
      expect(p.findMany).toHaveBeenCalledWith({ where: {}, orderBy: { createdAt: 'desc' }, skip: 0, take: 50 })
    })
  })

  describe('scheduleAuditPrune', () => {
    it('prunes at startup and then every 24 hours, without keeping the process alive', async () => {
      vi.useFakeTimers()
      try {
        p.deleteMany.mockResolvedValue({ count: 0 })
        const timer = scheduleAuditPrune(90)
        await vi.advanceTimersByTimeAsync(0)
        expect(p.deleteMany).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)
        expect(p.deleteMany).toHaveBeenCalledTimes(2)
        expect(timer.hasRef()).toBe(false)
        clearInterval(timer)
      } finally {
        vi.useRealTimers()
      }
    })

    it('logs a failed prune instead of throwing', async () => {
      vi.useFakeTimers()
      try {
        p.deleteMany.mockRejectedValue(new Error('db down'))
        const timer = scheduleAuditPrune(90)
        await vi.advanceTimersByTimeAsync(0)
        expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), 'audit prune failed')
        clearInterval(timer)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('pruneAudit', () => {
    it('deletes rows older than the retention period', async () => {
      p.deleteMany.mockResolvedValue({ count: 3 })
      const now = new Date('2026-09-28T12:00:00Z')
      expect(await pruneAudit(90, now)).toBe(3)
      expect(p.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date('2026-06-30T12:00:00Z') } } })
    })
  })
})
