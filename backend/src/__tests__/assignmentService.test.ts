import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../prisma', () => ({
  prisma: {
    userRole: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { prisma } from '../prisma'
import { getUserRoles, assignRole, removeRole } from '../services/assignmentService'

const p = prisma.userRole as unknown as Record<string, ReturnType<typeof vi.fn>>

describe('assignmentService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getUserRoles', () => {
    it('returns user roles with application and role details', async () => {
      const roles = [{ id: 'ur1', userId: 'u1', applicationId: 'app1', roleId: 'r1', application: {}, role: {} }]
      p.findMany.mockResolvedValue(roles)
      const result = await getUserRoles('u1')
      expect(result).toEqual(roles)
      expect(p.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        include: { application: true, role: true },
        orderBy: { assignedAt: 'desc' },
      })
    })
  })

  describe('assignRole', () => {
    it('upserts a role assignment with active and expiredAt defaults', async () => {
      const assignment = { id: 'ur1', userId: 'u1', applicationId: 'app1', roleId: 'r1', active: true, expiredAt: null }
      p.upsert.mockResolvedValue(assignment)
      const result = await assignRole('u1', 'app1', { roleId: 'r1' })
      expect(result).toEqual(assignment)
      expect(p.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId_applicationId: { userId: 'u1', applicationId: 'app1' } },
        update: { roleId: 'r1', active: true, expiredAt: null },
        create: { userId: 'u1', applicationId: 'app1', roleId: 'r1', active: true, expiredAt: null },
      }))
    })

    it('respects explicit active and expiredAt values', async () => {
      const expiredAt = new Date('2025-01-01')
      p.upsert.mockResolvedValue({})
      await assignRole('u1', 'app1', { roleId: 'r1', active: false, expiredAt })
      expect(p.upsert).toHaveBeenCalledWith(expect.objectContaining({
        update: { roleId: 'r1', active: false, expiredAt },
      }))
    })
  })

  describe('removeRole', () => {
    it('deletes user role by userId and applicationId', async () => {
      p.delete.mockResolvedValue({ id: 'ur1' })
      await removeRole('u1', 'app1')
      expect(p.delete).toHaveBeenCalledWith({
        where: { userId_applicationId: { userId: 'u1', applicationId: 'app1' } },
      })
    })
  })
})
