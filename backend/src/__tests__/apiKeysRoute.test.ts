import { vi, describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../services/apiKeyService', () => ({
  listApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
}))

import * as svc from '../services/apiKeyService'
import router from '../routes/admin/apiKeys'

const mockKey = { id: 'k1', label: 'prod', lastUsedAt: null, createdAt: new Date().toISOString() }

function makeApp() {
  const app = express()
  app.use(express.json())
  const parent = express.Router()
  parent.use('/:appId/api-keys', router)
  app.use('/', parent)
  return app
}

describe('GET /applications/:appId/api-keys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns api keys for an application', async () => {
    vi.mocked(svc.listApiKeys).mockResolvedValue([mockKey] as unknown as Awaited<ReturnType<typeof svc.listApiKeys>>)
    const res = await request(makeApp()).get('/app1/api-keys')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('POST /applications/:appId/api-keys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates api key and returns 201 with rawKey', async () => {
    const newKey = { ...mockKey, rawKey: 'bncr_abc123' }
    vi.mocked(svc.createApiKey).mockResolvedValue(newKey as unknown as Awaited<ReturnType<typeof svc.createApiKey>>)
    const res = await request(makeApp()).post('/app1/api-keys').send({ label: 'prod' })
    expect(res.status).toBe(201)
    expect(res.body.rawKey).toBe('bncr_abc123')
  })

  it('creates api key without label (label is optional)', async () => {
    const newKey = { ...mockKey, rawKey: 'bncr_abc123', label: null }
    vi.mocked(svc.createApiKey).mockResolvedValue(newKey as unknown as Awaited<ReturnType<typeof svc.createApiKey>>)
    const res = await request(makeApp()).post('/app1/api-keys').send({})
    expect(res.status).toBe(201)
  })

  it('returns 400 when label is an empty string', async () => {
    const res = await request(makeApp()).post('/app1/api-keys').send({ label: '' })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /applications/:appId/api-keys/:keyId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 on successful deletion', async () => {
    vi.mocked(svc.deleteApiKey).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof svc.deleteApiKey>>)
    const res = await request(makeApp()).delete('/app1/api-keys/k1')
    expect(res.status).toBe(204)
  })

  it('returns 404 when key not found', async () => {
    vi.mocked(svc.deleteApiKey).mockRejectedValue({ code: 'P2025' })
    const res = await request(makeApp()).delete('/app1/api-keys/k1')
    expect(res.status).toBe(404)
  })
})
