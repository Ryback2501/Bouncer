import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { prisma } from '../prisma'
import { listUsers, getUser, createUser, updateUser, deleteUser } from '../services/userService'

const p = prisma.user as unknown as Record<string, ReturnType<typeof vi.fn>>

const mockUser = { id: 'u1', name: 'Alice', sub: '123', provider: 'google', isGlobalAdmin: false }

describe('userService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('listUsers', () => {
    it('returns paginated users without search', async () => {
      p.count.mockResolvedValue(1)
      p.findMany.mockResolvedValue([mockUser])
      const result = await listUsers({})
      expect(result).toEqual({ total: 1, page: 1, limit: 20, users: [mockUser] })
      expect(p.count).toHaveBeenCalledWith({ where: {} })
      expect(p.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }))
    })

    it('filters by search term across name and sub', async () => {
      p.count.mockResolvedValue(0)
      p.findMany.mockResolvedValue([])
      await listUsers({ search: 'alice', page: 2, limit: 10 })
      const where = {
        OR: [
          { name: { contains: 'alice', mode: 'insensitive' } },
          { sub: { contains: 'alice', mode: 'insensitive' } },
        ],
      }
      expect(p.count).toHaveBeenCalledWith({ where })
      expect(p.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 10, take: 10 }))
    })
  })

  describe('getUser', () => {
    it('returns user with role assignments', async () => {
      const user = { ...mockUser, userRoles: [] }
      p.findUnique.mockResolvedValue(user)
      const result = await getUser('u1')
      expect(result).toEqual(user)
      expect(p.findUnique).toHaveBeenCalledWith({
        where: { id: 'u1' },
        include: { userRoles: { include: { application: true, role: true }, orderBy: { assignedAt: 'desc' } } },
      })
    })

    it('returns null when user not found', async () => {
      p.findUnique.mockResolvedValue(null)
      expect(await getUser('x')).toBeNull()
    })
  })

  describe('createUser', () => {
    it('creates user with name, sub and provider', async () => {
      const data = { name: 'Alice', sub: '123', provider: 'google' }
      p.create.mockResolvedValue({ id: 'u1', ...data })
      const result = await createUser(data)
      expect(p.create).toHaveBeenCalledWith({ data })
      expect(result).toMatchObject(data)
    })
  })

  describe('updateUser', () => {
    it('updates user fields', async () => {
      const updated = { ...mockUser, name: 'Bob' }
      p.update.mockResolvedValue(updated)
      const result = await updateUser('u1', { name: 'Bob' })
      expect(result).toEqual(updated)
      expect(p.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { name: 'Bob' } })
    })
  })

  describe('deleteUser', () => {
    it('deletes user by id', async () => {
      p.delete.mockResolvedValue(mockUser)
      await deleteUser('u1')
      expect(p.delete).toHaveBeenCalledWith({ where: { id: 'u1' } })
    })
  })
})
