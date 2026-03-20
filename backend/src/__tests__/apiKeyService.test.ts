import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createHash } from 'crypto'

vi.mock('../prisma', () => ({
  prisma: {
    apiKey: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { prisma } from '../prisma'
import { listApiKeys, createApiKey, deleteApiKey } from '../services/apiKeyService'

const p = prisma.apiKey as Record<string, ReturnType<typeof vi.fn>>

describe('apiKeyService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('listApiKeys', () => {
    it('returns api keys for an application without keyHash', async () => {
      const keys = [{ id: 'k1', label: 'prod', lastUsedAt: null, createdAt: new Date() }]
      p.findMany.mockResolvedValue(keys)
      const result = await listApiKeys('app1')
      expect(result).toEqual(keys)
      expect(p.findMany).toHaveBeenCalledWith({
        where: { applicationId: 'app1' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, label: true, lastUsedAt: true, createdAt: true },
      })
    })
  })

  describe('createApiKey', () => {
    it('generates a key with bncr_ prefix and stores its SHA-256 hash', async () => {
      const now = new Date()
      p.create.mockResolvedValue({ id: 'k1', label: 'prod', createdAt: now })
      const result = await createApiKey('app1', 'prod')

      expect(result.rawKey).toMatch(/^bncr_[0-9a-f]{64}$/)
      expect(result.id).toBe('k1')
      expect(result.label).toBe('prod')

      const expectedHash = createHash('sha256').update(result.rawKey).digest('hex')
      expect(p.create).toHaveBeenCalledWith({
        data: { applicationId: 'app1', keyHash: expectedHash, label: 'prod' },
        select: { id: true, label: true, createdAt: true },
      })
    })

    it('creates key without label when omitted', async () => {
      p.create.mockResolvedValue({ id: 'k1', label: undefined, createdAt: new Date() })
      const result = await createApiKey('app1')
      expect(p.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ label: undefined }),
      }))
      expect(result.rawKey).toMatch(/^bncr_/)
    })
  })

  describe('deleteApiKey', () => {
    it('deletes api key by id', async () => {
      p.delete.mockResolvedValue({ id: 'k1' })
      await deleteApiKey('k1')
      expect(p.delete).toHaveBeenCalledWith({ where: { id: 'k1' } })
    })
  })
})
