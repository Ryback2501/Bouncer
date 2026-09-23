import { vi, describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../services/apiKeyService', () => ({
  listApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
}))

vi.mock('../lib/bouncerDefaults', () => ({
  ensureBouncerDefaults: vi.fn(),
}))

import type { Application, Role } from '@prisma/client'
import * as svc from '../services/apiKeyService'
import { ensureBouncerDefaults } from '../lib/bouncerDefaults'
import router from '../routes/admin/apiKeys'

const mockKey = { id: 'k1', label: 'prod', lastUsedAt: null, createdAt: new Date().toISOString() }
const BOUNCER_ID = 'bouncer-app-id'

function mockDefaults() {
  vi.mocked(ensureBouncerDefaults).mockResolvedValue({
    app: { id: BOUNCER_ID } as unknown as Application,
    role: {} as unknown as Role,
  })
}

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
  beforeEach(() => { vi.clearAllMocks(); mockDefaults() })

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

  // A key for the portal's own Application would be able to mint global-admin invitations, so
  // refuse to issue one at all — mirroring the guards on modifying/deleting that application.
  it('returns 403 when issuing a key for the Bouncer application', async () => {
    const res = await request(makeApp()).post(`/${BOUNCER_ID}/api-keys`).send({ label: 'nope' })
    expect(res.status).toBe(403)
    expect(svc.createApiKey).not.toHaveBeenCalled()
  })
})

// Listing and revoking stay reachable for the Bouncer application: an operator upgrading from a
// version that allowed such a key must still be able to see and delete it.
describe('Bouncer application keys remain listable and revocable', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDefaults() })

  it('GET still returns 200 for the Bouncer application', async () => {
    vi.mocked(svc.listApiKeys).mockResolvedValue([mockKey] as unknown as Awaited<ReturnType<typeof svc.listApiKeys>>)
    const res = await request(makeApp()).get(`/${BOUNCER_ID}/api-keys`)
    expect(res.status).toBe(200)
  })

  it('DELETE still returns 204 for the Bouncer application', async () => {
    vi.mocked(svc.deleteApiKey).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof svc.deleteApiKey>>)
    const res = await request(makeApp()).delete(`/${BOUNCER_ID}/api-keys/k1`)
    expect(res.status).toBe(204)
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
