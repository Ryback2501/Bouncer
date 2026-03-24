import { vi, describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../services/assignmentService', () => ({
  getUserRoles: vi.fn(),
  assignRole: vi.fn(),
  removeRole: vi.fn(),
}))

import * as svc from '../services/assignmentService'
import router from '../routes/admin/assignments'

const mockUserRole = { id: 'ur1', userId: 'u1', applicationId: 'app1', roleId: 'r1', active: true, expiredAt: null }

function makeApp() {
  const app = express()
  app.use(express.json())
  const parent = express.Router()
  parent.use('/:userId/roles', router)
  app.use('/', parent)
  return app
}

describe('GET /users/:userId/roles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns user role assignments', async () => {
    vi.mocked(svc.getUserRoles).mockResolvedValue([mockUserRole] as unknown as Awaited<ReturnType<typeof svc.getUserRoles>>)
    const res = await request(makeApp()).get('/u1/roles')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('PUT /users/:userId/roles/:appId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('assigns a role and returns the assignment', async () => {
    vi.mocked(svc.assignRole).mockResolvedValue(mockUserRole as unknown as Awaited<ReturnType<typeof svc.assignRole>>)
    const res = await request(makeApp()).put('/u1/roles/app1').send({ roleId: 'r1' })
    expect(res.status).toBe(200)
    expect(res.body.roleId).toBe('r1')
  })

  it('returns 400 when roleId is missing', async () => {
    const res = await request(makeApp()).put('/u1/roles/app1').send({})
    expect(res.status).toBe(400)
  })

  it('returns 400 when roleId is an empty string', async () => {
    const res = await request(makeApp()).put('/u1/roles/app1').send({ roleId: '' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when active is not a boolean', async () => {
    const res = await request(makeApp()).put('/u1/roles/app1').send({ roleId: 'r1', active: 'true' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when expiredAt is not a valid datetime', async () => {
    const res = await request(makeApp()).put('/u1/roles/app1').send({ roleId: 'r1', expiredAt: 'not-a-date' })
    expect(res.status).toBe(400)
  })

  it('accepts a valid ISO datetime for expiredAt', async () => {
    vi.mocked(svc.assignRole).mockResolvedValue(mockUserRole as unknown as Awaited<ReturnType<typeof svc.assignRole>>)
    const res = await request(makeApp()).put('/u1/roles/app1').send({ roleId: 'r1', expiredAt: '2030-01-01T00:00:00.000Z' })
    expect(res.status).toBe(200)
  })

  it('accepts null expiredAt', async () => {
    vi.mocked(svc.assignRole).mockResolvedValue(mockUserRole as unknown as Awaited<ReturnType<typeof svc.assignRole>>)
    const res = await request(makeApp()).put('/u1/roles/app1').send({ roleId: 'r1', expiredAt: null })
    expect(res.status).toBe(200)
  })

  it('returns 400 on invalid FK reference', async () => {
    vi.mocked(svc.assignRole).mockRejectedValue({ code: 'P2003' })
    const res = await request(makeApp()).put('/u1/roles/app1').send({ roleId: 'bad-role' })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /users/:userId/roles/:appId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 on successful removal', async () => {
    vi.mocked(svc.removeRole).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof svc.removeRole>>)
    const res = await request(makeApp()).delete('/u1/roles/app1')
    expect(res.status).toBe(204)
  })

  it('returns 404 when assignment not found', async () => {
    vi.mocked(svc.removeRole).mockRejectedValue({ code: 'P2025' })
    const res = await request(makeApp()).delete('/u1/roles/app1')
    expect(res.status).toBe(404)
  })
})
