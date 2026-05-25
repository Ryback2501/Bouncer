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

const p = prisma.apiKey as unknown as Record<string, ReturnType<typeof vi.fn>>

describe('apiKeyService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('listApiKeys', () => {
    it('returns api keys for an application without keyHash', async () => {
      const keys = [{ id: 'k1', label: 'prod', lastUsedAt: null, expiresAt: null, createdAt: new Date() }]
      p.findMany.mockResolvedValue(keys)
      const result = await listApiKeys('app1')
      expect(result).toEqual(keys)
      expect(p.findMany).toHaveBeenCalledWith({
        where: { applicationId: 'app1' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, label: true, lastUsedAt: true, expiresAt: true, createdAt: true },
      })
    })
  })

  describe('createApiKey', () => {
    it('generates a key with bncr_ prefix and stores its SHA-256 hash', async () => {
      const now = new Date()
      p.create.mockResolvedValue({ id: 'k1', label: 'prod', expiresAt: null, createdAt: now })
      const result = await createApiKey('app1', { label: 'prod' })

      expect(result.rawKey).toMatch(/^bncr_[0-9a-f]{64}$/)
      expect(result.id).toBe('k1')
      expect(result.label).toBe('prod')

      const expectedHash = createHash('sha256').update(result.rawKey).digest('hex')
      expect(p.create).toHaveBeenCalledWith({
        data: { applicationId: 'app1', keyHash: expectedHash, label: 'prod', expiresAt: null },
        select: { id: true, label: true, expiresAt: true, createdAt: true },
      })
    })

    it('creates key without label when omitted', async () => {
      p.create.mockResolvedValue({ id: 'k1', label: undefined, expiresAt: null, createdAt: new Date() })
      const result = await createApiKey('app1')
      expect(p.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ label: undefined }),
      }))
      expect(result.rawKey).toMatch(/^bncr_/)
    })

    it('stores expiresAt when provided', async () => {
      const exp = new Date(Date.now() + 86_400_000)
      p.create.mockResolvedValue({ id: 'k1', label: null, expiresAt: exp, createdAt: new Date() })
      await createApiKey('app1', { expiresAt: exp })
      expect(p.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ expiresAt: exp }),
      }))
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
