import { vi, describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../services/assignmentService', () => ({
  getUserRoles: vi.fn(),
  assignRole: vi.fn(),
  removeRole: vi.fn(),
}))

vi.mock('../prisma', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}))

vi.mock('../lib/bouncerDefaults', () => ({
  isBouncerApplication: vi.fn(),
  isBouncerAdminRole: vi.fn(),
}))

import * as svc from '../services/assignmentService'
import { prisma } from '../prisma'
import { isBouncerApplication, isBouncerAdminRole } from '../lib/bouncerDefaults'
import router from '../routes/admin/assignments'

const mockUserRole = { id: 'ur1', userId: 'u1', applicationId: 'app1', roleId: 'r1', active: true, expiredAt: null }

const findUser = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>

// By default the target is an ordinary user and the app an ordinary application.
function asOrdinary() {
  findUser.mockResolvedValue({ isGlobalAdmin: false })
  vi.mocked(isBouncerApplication).mockResolvedValue(false)
  vi.mocked(isBouncerAdminRole).mockResolvedValue(false)
}

function makeApp() {
  const app = express()
  app.use(express.json())
  const parent = express.Router()
  parent.use('/:userId/roles', router)
  app.use('/', parent)
  return app
}

describe('GET /users/:userId/roles', () => {
  beforeEach(() => { vi.clearAllMocks(); asOrdinary() })

  it('returns user role assignments', async () => {
    vi.mocked(svc.getUserRoles).mockResolvedValue([mockUserRole] as unknown as Awaited<ReturnType<typeof svc.getUserRoles>>)
    const res = await request(makeApp()).get('/u1/roles')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('PUT /users/:userId/roles/:appId', () => {
  beforeEach(() => { vi.clearAllMocks(); asOrdinary() })

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
  beforeEach(() => { vi.clearAllMocks(); asOrdinary() })

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

// B-05. The global admin's portal role is what keeps the first-user bootstrap from mattering: strip
// it and the portal is locked out (or, before the bootstrap latch, re-armed for the next sign-in).
// Same rule users.ts applies to the global admin's user record.
describe("the global admin's portal role", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findUser.mockResolvedValue({ isGlobalAdmin: true })
    vi.mocked(isBouncerApplication).mockResolvedValue(true)
    vi.mocked(isBouncerAdminRole).mockResolvedValue(false)
  })

  it('cannot be changed (403)', async () => {
    const res = await request(makeApp()).put('/u1/roles/bouncer-app').send({ roleId: 'r1', active: false })
    expect(res.status).toBe(403)
    expect(svc.assignRole).not.toHaveBeenCalled()
  })

  // A portal role that is already inactive, expiring or missing (e.g. a database that hit B-05
  // before this fix) must stay repairable: restoring it to admin, active, no expiry is allowed.
  it('can be restored to the admin role, active, with no expiry', async () => {
    vi.mocked(isBouncerAdminRole).mockResolvedValue(true)
    vi.mocked(svc.assignRole).mockResolvedValue(mockUserRole as unknown as Awaited<ReturnType<typeof svc.assignRole>>)
    const res = await request(makeApp()).put('/u1/roles/bouncer-app').send({ roleId: 'admin-role', expiredAt: null })
    expect(res.status).toBe(200)
    expect(svc.assignRole).toHaveBeenCalled()
  })

  it('cannot be set to the admin role but inactive (403)', async () => {
    vi.mocked(isBouncerAdminRole).mockResolvedValue(true)
    const res = await request(makeApp()).put('/u1/roles/bouncer-app').send({ roleId: 'admin-role', active: false })
    expect(res.status).toBe(403)
  })

  it('cannot be given an expiry (403)', async () => {
    vi.mocked(isBouncerAdminRole).mockResolvedValue(true)
    const res = await request(makeApp()).put('/u1/roles/bouncer-app')
      .send({ roleId: 'admin-role', expiredAt: '2030-01-01T00:00:00.000Z' })
    expect(res.status).toBe(403)
  })

  it('cannot be removed (403)', async () => {
    const res = await request(makeApp()).delete('/u1/roles/bouncer-app')
    expect(res.status).toBe(403)
    expect(svc.removeRole).not.toHaveBeenCalled()
  })

  it("leaves the global admin's roles in other applications manageable", async () => {
    vi.mocked(isBouncerApplication).mockResolvedValue(false)
    vi.mocked(svc.removeRole).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof svc.removeRole>>)
    const res = await request(makeApp()).delete('/u1/roles/app1')
    expect(res.status).toBe(204)
  })

  it("leaves other admins' portal roles manageable", async () => {
    findUser.mockResolvedValue({ isGlobalAdmin: false })
    vi.mocked(svc.removeRole).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof svc.removeRole>>)
    const res = await request(makeApp()).delete('/u2/roles/bouncer-app')
    expect(res.status).toBe(204)
  })
})
