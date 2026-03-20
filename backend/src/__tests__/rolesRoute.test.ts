import { vi, describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../services/roleService', () => ({
  listRoles: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
}))

vi.mock('../lib/bouncerDefaults', () => ({
  ensureBouncerDefaults: vi.fn(),
}))

import * as svc from '../services/roleService'
import { ensureBouncerDefaults } from '../lib/bouncerDefaults'
import router from '../routes/admin/roles'

const ADMIN_ROLE_ID = 'admin-role-id'
const mockRole = { id: 'r1', name: 'Editor', customId: 'editor', applicationId: 'app1' }

function makeApp(appId = 'app1') {
  const app = express()
  app.use(express.json())
  // roles router uses mergeParams — mount under :appId to simulate parent params
  const parent = express.Router()
  parent.use('/:appId/roles', router)
  app.use('/', parent)
  return app
}

describe('GET /applications/:appId/roles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns roles for an application', async () => {
    vi.mocked(svc.listRoles).mockResolvedValue([mockRole] as any)
    const res = await request(makeApp()).get('/app1/roles')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([mockRole])
  })
})

describe('POST /applications/:appId/roles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a role and returns 201', async () => {
    vi.mocked(svc.createRole).mockResolvedValue(mockRole as any)
    const res = await request(makeApp()).post('/app1/roles').send({ name: 'Editor', customId: 'editor' })
    expect(res.status).toBe(201)
    expect(res.body).toEqual(mockRole)
  })

  it('returns 400 when name or customId is missing', async () => {
    const res = await request(makeApp()).post('/app1/roles').send({ name: 'Editor' })
    expect(res.status).toBe(400)
  })

  it('returns 409 on duplicate customId', async () => {
    vi.mocked(svc.createRole).mockRejectedValue({ code: 'P2002' })
    const res = await request(makeApp()).post('/app1/roles').send({ name: 'Editor', customId: 'editor' })
    expect(res.status).toBe(409)
  })
})

describe('PATCH /applications/:appId/roles/:roleId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when patching the bouncer admin role', async () => {
    vi.mocked(ensureBouncerDefaults).mockResolvedValue({ app: {} as any, role: { id: ADMIN_ROLE_ID } as any })
    const res = await request(makeApp()).patch(`/app1/roles/${ADMIN_ROLE_ID}`).send({ name: 'X' })
    expect(res.status).toBe(403)
  })

  it('updates role and returns it', async () => {
    vi.mocked(ensureBouncerDefaults).mockResolvedValue({ app: {} as any, role: { id: ADMIN_ROLE_ID } as any })
    vi.mocked(svc.updateRole).mockResolvedValue({ ...mockRole, name: 'Updated' } as any)
    const res = await request(makeApp()).patch('/app1/roles/r1').send({ name: 'Updated' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated')
  })

  it('returns 404 when role not found', async () => {
    vi.mocked(ensureBouncerDefaults).mockResolvedValue({ app: {} as any, role: { id: ADMIN_ROLE_ID } as any })
    vi.mocked(svc.updateRole).mockRejectedValue({ code: 'P2025' })
    const res = await request(makeApp()).patch('/app1/roles/r1').send({ name: 'X' })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /applications/:appId/roles/:roleId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when deleting the bouncer admin role', async () => {
    vi.mocked(ensureBouncerDefaults).mockResolvedValue({ app: {} as any, role: { id: ADMIN_ROLE_ID } as any })
    const res = await request(makeApp()).delete(`/app1/roles/${ADMIN_ROLE_ID}`)
    expect(res.status).toBe(403)
  })

  it('returns 204 on successful deletion', async () => {
    vi.mocked(ensureBouncerDefaults).mockResolvedValue({ app: {} as any, role: { id: ADMIN_ROLE_ID } as any })
    vi.mocked(svc.deleteRole).mockResolvedValue({} as any)
    const res = await request(makeApp()).delete('/app1/roles/r1')
    expect(res.status).toBe(204)
  })

  it('returns 404 when role not found', async () => {
    vi.mocked(ensureBouncerDefaults).mockResolvedValue({ app: {} as any, role: { id: ADMIN_ROLE_ID } as any })
    vi.mocked(svc.deleteRole).mockRejectedValue({ code: 'P2025' })
    const res = await request(makeApp()).delete('/app1/roles/r1')
    expect(res.status).toBe(404)
  })
})
