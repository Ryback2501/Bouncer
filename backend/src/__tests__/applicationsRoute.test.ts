import { vi, describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../services/applicationService', () => ({
  listApplications: vi.fn(),
  getApplication: vi.fn(),
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
  deleteApplication: vi.fn(),
}))

vi.mock('../lib/bouncerDefaults', () => ({
  ensureBouncerDefaults: vi.fn(),
}))

import * as svc from '../services/applicationService'
import { ensureBouncerDefaults } from '../lib/bouncerDefaults'
import router from '../routes/admin/applications'

const BOUNCER_ID = 'bouncer-app-id'
const mockApp = { id: 'app1', name: 'My App', customId: 'my-app' }

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/', router)
  return app
}

describe('GET /applications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns list of applications', async () => {
    vi.mocked(svc.listApplications).mockResolvedValue([mockApp] as any)
    const res = await request(makeApp()).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([mockApp])
  })
})

describe('POST /applications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates application and returns 201', async () => {
    vi.mocked(svc.createApplication).mockResolvedValue(mockApp as any)
    const res = await request(makeApp()).post('/').send({ name: 'My App', customId: 'my-app' })
    expect(res.status).toBe(201)
    expect(res.body).toEqual(mockApp)
  })

  it('returns 400 when name or customId is missing', async () => {
    const res = await request(makeApp()).post('/').send({ name: 'My App' })
    expect(res.status).toBe(400)
  })

  it('returns 409 when customId already exists', async () => {
    vi.mocked(svc.createApplication).mockRejectedValue({ code: 'P2002' })
    const res = await request(makeApp()).post('/').send({ name: 'My App', customId: 'my-app' })
    expect(res.status).toBe(409)
  })
})

describe('GET /applications/:appId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns application by id', async () => {
    vi.mocked(svc.getApplication).mockResolvedValue(mockApp as any)
    const res = await request(makeApp()).get('/app1')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(mockApp)
  })

  it('returns 404 when not found', async () => {
    vi.mocked(svc.getApplication).mockResolvedValue(null)
    const res = await request(makeApp()).get('/nonexistent')
    expect(res.status).toBe(404)
  })
})

describe('PATCH /applications/:appId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when patching the bouncer application', async () => {
    vi.mocked(ensureBouncerDefaults).mockResolvedValue({ app: { id: BOUNCER_ID } as any, role: {} as any })
    const res = await request(makeApp()).patch(`/${BOUNCER_ID}`).send({ name: 'X' })
    expect(res.status).toBe(403)
  })

  it('updates application and returns it', async () => {
    vi.mocked(ensureBouncerDefaults).mockResolvedValue({ app: { id: BOUNCER_ID } as any, role: {} as any })
    vi.mocked(svc.updateApplication).mockResolvedValue({ ...mockApp, name: 'Updated' } as any)
    const res = await request(makeApp()).patch('/app1').send({ name: 'Updated' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated')
  })

  it('returns 404 when application not found', async () => {
    vi.mocked(ensureBouncerDefaults).mockResolvedValue({ app: { id: BOUNCER_ID } as any, role: {} as any })
    vi.mocked(svc.updateApplication).mockRejectedValue({ code: 'P2025' })
    const res = await request(makeApp()).patch('/app1').send({ name: 'X' })
    expect(res.status).toBe(404)
  })

  it('returns 409 on duplicate customId', async () => {
    vi.mocked(ensureBouncerDefaults).mockResolvedValue({ app: { id: BOUNCER_ID } as any, role: {} as any })
    vi.mocked(svc.updateApplication).mockRejectedValue({ code: 'P2002' })
    const res = await request(makeApp()).patch('/app1').send({ customId: 'taken' })
    expect(res.status).toBe(409)
  })
})

describe('DELETE /applications/:appId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when deleting the bouncer application', async () => {
    vi.mocked(ensureBouncerDefaults).mockResolvedValue({ app: { id: BOUNCER_ID } as any, role: {} as any })
    const res = await request(makeApp()).delete(`/${BOUNCER_ID}`)
    expect(res.status).toBe(403)
  })

  it('returns 204 on successful deletion', async () => {
    vi.mocked(ensureBouncerDefaults).mockResolvedValue({ app: { id: BOUNCER_ID } as any, role: {} as any })
    vi.mocked(svc.deleteApplication).mockResolvedValue({} as any)
    const res = await request(makeApp()).delete('/app1')
    expect(res.status).toBe(204)
  })

  it('returns 404 when application not found', async () => {
    vi.mocked(ensureBouncerDefaults).mockResolvedValue({ app: { id: BOUNCER_ID } as any, role: {} as any })
    vi.mocked(svc.deleteApplication).mockRejectedValue({ code: 'P2025' })
    const res = await request(makeApp()).delete('/app1')
    expect(res.status).toBe(404)
  })
})
