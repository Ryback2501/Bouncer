import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../prisma', () => ({
  prisma: {
    role: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { prisma } from '../prisma'
import { listRoles, getRoleByCustomId, createRole, updateRole, deleteRole } from '../services/roleService'

const p = prisma.role as unknown as Record<string, ReturnType<typeof vi.fn>>

describe('roleService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('listRoles', () => {
    it('returns roles for an application ordered by createdAt desc', async () => {
      const roles = [{ id: 'r1', name: 'Admin', customId: 'admin', applicationId: 'app1', _count: { userRoles: 5 } }]
      p.findMany.mockResolvedValue(roles)
      const result = await listRoles('app1')
      expect(result).toEqual(roles)
      expect(p.findMany).toHaveBeenCalledWith({
        where: { applicationId: 'app1' },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { userRoles: true } } },
      })
    })
  })

  describe('getRoleByCustomId', () => {
    it('looks up a role by application + customId', async () => {
      const role = { id: 'r1', name: 'Editor', customId: 'editor', applicationId: 'app1' }
      p.findUnique.mockResolvedValue(role)
      const result = await getRoleByCustomId('app1', 'editor')
      expect(result).toEqual(role)
      expect(p.findUnique).toHaveBeenCalledWith({
        where: { applicationId_customId: { applicationId: 'app1', customId: 'editor' } },
      })
    })

    it('returns null when the role is not in the application', async () => {
      p.findUnique.mockResolvedValue(null)
      expect(await getRoleByCustomId('app1', 'nope')).toBeNull()
    })
  })

  describe('createRole', () => {
    it('creates role within an application', async () => {
      const data = { name: 'Editor', customId: 'editor' }
      const created = { id: 'r1', ...data, applicationId: 'app1' }
      p.create.mockResolvedValue(created)
      const result = await createRole('app1', data)
      expect(result).toEqual(created)
      expect(p.create).toHaveBeenCalledWith({ data: { ...data, applicationId: 'app1' } })
    })
  })

  describe('updateRole', () => {
    it('updates role name and customId', async () => {
      const updated = { id: 'r1', name: 'SuperAdmin', customId: 'super-admin' }
      p.update.mockResolvedValue(updated)
      const result = await updateRole('r1', { name: 'SuperAdmin', customId: 'super-admin' })
      expect(result).toEqual(updated)
      expect(p.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { name: 'SuperAdmin', customId: 'super-admin' } })
    })
  })

  describe('deleteRole', () => {
    it('deletes role by id', async () => {
      p.delete.mockResolvedValue({ id: 'r1' })
      await deleteRole('r1')
      expect(p.delete).toHaveBeenCalledWith({ where: { id: 'r1' } })
    })
  })
})
