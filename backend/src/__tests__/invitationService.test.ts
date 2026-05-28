import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../prisma', () => ({
  prisma: {
    invitation: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { prisma } from '../prisma'
import { createInvitation, listInvitations, deleteInvitation } from '../services/invitationService'

const p = prisma.invitation as unknown as Record<string, ReturnType<typeof vi.fn>>

describe('invitationService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('createInvitation', () => {
    it('creates an invitation scoped to an app + role with a random token and 24h expiry', async () => {
      const now = Date.now()
      p.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'i1',
        token: data.token,
        applicationId: data.applicationId,
        roleId: data.roleId,
        redirectUri: data.redirectUri,
        createdById: data.createdById,
        expiresAt: data.expiresAt,
        createdBy: { name: 'Alice', email: 'alice@test.com' },
        createdAt: new Date(),
        usedAt: null,
      }))
      const result = await createInvitation({ applicationId: 'a1', roleId: 'r1', createdById: 'u1', redirectUri: 'https://app.example/welcome' })

      // inviteUrl contains the raw token (64 hex chars); the hash stored in DB is never exposed
      expect(result.inviteUrl).toMatch(/^http:\/\/localhost:5173\/invite\/[0-9a-f]{64}$/)
      expect(result).not.toHaveProperty('token')
      expect(p.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          applicationId: 'a1',
          roleId: 'r1',
          createdById: 'u1',
          redirectUri: 'https://app.example/welcome',
        }),
        include: {
          createdBy: { select: { name: true, email: true } },
          application: { select: { id: true, name: true, customId: true } },
          role: { select: { id: true, name: true, customId: true } },
        },
      }))
      // expiresAt should be ~24h from now
      const calledData = (p.create.mock.calls[0][0] as { data: { expiresAt: Date } }).data
      expect(calledData.expiresAt.getTime()).toBeGreaterThan(now + 23 * 60 * 60 * 1000)
    })

    it('defaults createdById and redirectUri to null for app-minted invites', async () => {
      p.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'i2', token: data.token, createdAt: new Date(), expiresAt: data.expiresAt, usedAt: null,
        createdBy: null,
      }))
      await createInvitation({ applicationId: 'a1', roleId: 'r1' })
      expect(p.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ createdById: null, redirectUri: null }),
      }))
    })
  })

  describe('listInvitations', () => {
    it('returns invitations with token stripped and no inviteUrl', async () => {
      const invitations = [
        { id: 'i1', token: 'tok1', createdBy: { name: 'Alice', email: null }, createdAt: new Date(), expiresAt: new Date(), usedAt: null },
      ]
      p.findMany.mockResolvedValue(invitations)
      const result = await listInvitations()

      // token hash is stripped; inviteUrl is no longer included in list (raw token not available)
      expect(result[0]).not.toHaveProperty('token')
      expect(result[0]).not.toHaveProperty('inviteUrl')
      expect(p.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { name: true, email: true } },
          application: { select: { id: true, name: true, customId: true } },
          role: { select: { id: true, name: true, customId: true } },
        },
      })
    })

    it('filters by applicationId when given', async () => {
      p.findMany.mockResolvedValue([])
      await listInvitations('a1')
      expect(p.findMany).toHaveBeenCalledWith({
        where: { applicationId: 'a1' },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { name: true, email: true } },
          application: { select: { id: true, name: true, customId: true } },
          role: { select: { id: true, name: true, customId: true } },
        },
      })
    })
  })

  describe('deleteInvitation', () => {
    it('deletes invitation by id', async () => {
      p.delete.mockResolvedValue({ id: 'i1' })
      await deleteInvitation('i1')
      expect(p.delete).toHaveBeenCalledWith({ where: { id: 'i1' } })
    })
  })
})
