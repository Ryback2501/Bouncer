import { vi, describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { Request, Response, NextFunction } from 'express'

vi.mock('../services/invitationService', () => ({
  listInvitations: vi.fn(),
  createInvitation: vi.fn(),
  deleteInvitation: vi.fn(),
}))

vi.mock('../lib/bouncerDefaults', () => ({
  ensureBouncerDefaults: vi.fn().mockResolvedValue({
    app: { id: 'bouncer-app' },
    role: { id: 'admin-role' },
  }),
}))

import * as svc from '../services/invitationService'
import router from '../routes/admin/invitations'

const mockInvitation = {
  id: 'i1', token: 'tok1', createdById: 'u1',
  inviteUrl: 'http://localhost:5173/invite/tok1',
  createdBy: { name: 'Alice', email: null },
  expiresAt: new Date().toISOString(), usedAt: null, createdAt: new Date().toISOString(),
}

const mockUser = { id: 'u1', name: 'Alice' }

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = mockUser as unknown as Express.User
    next()
  })
  app.use('/', router)
  return app
}

describe('GET /invitations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns list of invitations', async () => {
    vi.mocked(svc.listInvitations).mockResolvedValue([mockInvitation] as unknown as Awaited<ReturnType<typeof svc.listInvitations>>)
    const res = await request(makeApp()).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    // Admin list is scoped to the Bouncer app.
    expect(svc.listInvitations).toHaveBeenCalledWith('bouncer-app')
  })
})

describe('POST /invitations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates invitation and returns 201', async () => {
    vi.mocked(svc.createInvitation).mockResolvedValue(mockInvitation as unknown as Awaited<ReturnType<typeof svc.createInvitation>>)
    const res = await request(makeApp()).post('/')
    expect(res.status).toBe(201)
    expect(res.body.inviteUrl).toBe(mockInvitation.inviteUrl)
    // Admin invites are scoped to the Bouncer app + admin role, created by the admin user.
    expect(svc.createInvitation).toHaveBeenCalledWith({
      applicationId: 'bouncer-app',
      roleId: 'admin-role',
      createdById: 'u1',
    })
  })
})

describe('DELETE /invitations/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 on successful deletion', async () => {
    vi.mocked(svc.deleteInvitation).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof svc.deleteInvitation>>)
    const res = await request(makeApp()).delete('/i1')
    expect(res.status).toBe(204)
  })

  it('returns 404 when invitation not found', async () => {
    vi.mocked(svc.deleteInvitation).mockRejectedValue({ code: 'P2025' })
    const res = await request(makeApp()).delete('/i1')
    expect(res.status).toBe(404)
  })
})
