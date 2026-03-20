import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../prisma', () => ({
  prisma: {
    application: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { prisma } from '../prisma'
import {
  listApplications, getApplication, createApplication,
  updateApplication, deleteApplication,
} from '../services/applicationService'

const p = prisma.application as Record<string, ReturnType<typeof vi.fn>>

describe('applicationService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('listApplications', () => {
    it('returns applications ordered by createdAt desc with counts', async () => {
      const apps = [{ id: '1', name: 'App', _count: { roles: 2, userRoles: 3, apiKeys: 1 } }]
      p.findMany.mockResolvedValue(apps)
      const result = await listApplications()
      expect(result).toEqual(apps)
      expect(p.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { roles: true, userRoles: true, apiKeys: true } } },
      })
    })
  })

  describe('getApplication', () => {
    it('returns application by id with counts', async () => {
      const app = { id: '1', name: 'App', _count: { roles: 2, userRoles: 3 } }
      p.findUnique.mockResolvedValue(app)
      const result = await getApplication('1')
      expect(result).toEqual(app)
      expect(p.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: { _count: { select: { roles: true, userRoles: true } } },
      })
    })

    it('returns null when application not found', async () => {
      p.findUnique.mockResolvedValue(null)
      expect(await getApplication('x')).toBeNull()
    })
  })

  describe('createApplication', () => {
    it('creates application with name and customId', async () => {
      const data = { name: 'My App', customId: 'my-app' }
      const created = { id: '1', ...data }
      p.create.mockResolvedValue(created)
      const result = await createApplication(data)
      expect(result).toEqual(created)
      expect(p.create).toHaveBeenCalledWith({ data })
    })
  })

  describe('updateApplication', () => {
    it('updates application fields', async () => {
      const updated = { id: '1', name: 'Updated', customId: 'updated' }
      p.update.mockResolvedValue(updated)
      const result = await updateApplication('1', { name: 'Updated', customId: 'updated' })
      expect(result).toEqual(updated)
      expect(p.update).toHaveBeenCalledWith({ where: { id: '1' }, data: { name: 'Updated', customId: 'updated' } })
    })
  })

  describe('deleteApplication', () => {
    it('deletes application by id', async () => {
      p.delete.mockResolvedValue({ id: '1' })
      await deleteApplication('1')
      expect(p.delete).toHaveBeenCalledWith({ where: { id: '1' } })
    })
  })
})
