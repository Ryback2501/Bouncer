import { vi, describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { Request, Response, NextFunction } from 'express'

vi.mock('../services/invitationService', () => ({
  listInvitations: vi.fn(),
  createInvitation: vi.fn(),
  deleteInvitation: vi.fn(),
}))

vi.mock('../prisma', () => ({
  prisma: {
    role: { findUnique: vi.fn() },
    application: { findUnique: vi.fn() },
  },
}))

import * as svc from '../services/invitationService'
import { prisma } from '../prisma'
import router from '../routes/admin/invitations'

const p = prisma as unknown as {
  role: { findUnique: ReturnType<typeof vi.fn> }
  application: { findUnique: ReturnType<typeof vi.fn> }
}

const mockInvitation = {
  id: 'i1',
  applicationId: '00000000-0000-0000-0000-000000000a01',
  roleId: '00000000-0000-0000-0000-000000000b01',
  inviteUrl: 'http://localhost:5173/invite/tok1',
  createdBy: { name: 'Alice', email: null },
  application: { id: '00000000-0000-0000-0000-000000000a01', name: 'My App', customId: 'my-app' },
  role: { id: '00000000-0000-0000-0000-000000000b01', name: 'Editor', customId: 'editor' },
  expiresAt: new Date().toISOString(),
  usedAt: null,
  createdAt: new Date().toISOString(),
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

  it('returns list of invitations across all apps (no filter)', async () => {
    vi.mocked(svc.listInvitations).mockResolvedValue([mockInvitation] as unknown as Awaited<ReturnType<typeof svc.listInvitations>>)
    const res = await request(makeApp()).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    // The admin listing is cross-app (no applicationId filter).
    expect(svc.listInvitations).toHaveBeenCalledWith()
  })
})

describe('POST /invitations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates an invitation for the given application + role and returns 201', async () => {
    p.role.findUnique.mockResolvedValue({ id: '00000000-0000-0000-0000-000000000b01', applicationId: '00000000-0000-0000-0000-000000000a01' })
    vi.mocked(svc.createInvitation).mockResolvedValue(mockInvitation as unknown as Awaited<ReturnType<typeof svc.createInvitation>>)

    const res = await request(makeApp())
      .post('/')
      .send({ applicationId: '00000000-0000-0000-0000-000000000a01', roleId: '00000000-0000-0000-0000-000000000b01' })

    expect(res.status).toBe(201)
    expect(res.body.inviteUrl).toBe(mockInvitation.inviteUrl)
    expect(svc.createInvitation).toHaveBeenCalledWith({
      applicationId: '00000000-0000-0000-0000-000000000a01',
      roleId: '00000000-0000-0000-0000-000000000b01',
      createdById: 'u1',
      redirectUri: null,
    })
  })

  it('returns 400 when the role does not belong to the application', async () => {
    p.role.findUnique.mockResolvedValue({ id: '00000000-0000-0000-0000-000000000b01', applicationId: '00000000-0000-0000-0000-000000000099' })
    const res = await request(makeApp())
      .post('/')
      .send({ applicationId: '00000000-0000-0000-0000-000000000a01', roleId: '00000000-0000-0000-0000-000000000b01' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('role_not_in_application')
    expect(svc.createInvitation).not.toHaveBeenCalled()
  })

  it('returns 400 for a redirectUri whose origin is not in the application allowlist', async () => {
    p.role.findUnique.mockResolvedValue({ id: '00000000-0000-0000-0000-000000000b01', applicationId: '00000000-0000-0000-0000-000000000a01' })
    p.application.findUnique.mockResolvedValue({ id: '00000000-0000-0000-0000-000000000a01', redirectUris: ['https://app.example.com'] })

    const res = await request(makeApp())
      .post('/')
      .send({ applicationId: '00000000-0000-0000-0000-000000000a01', roleId: '00000000-0000-0000-0000-000000000b01', redirectUri: 'https://evil.example.com/x' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('redirect_uri_not_allowed')
    expect(svc.createInvitation).not.toHaveBeenCalled()
  })

  it('returns 400 when body validation fails (missing applicationId)', async () => {
    const res = await request(makeApp()).post('/').send({ roleId: '00000000-0000-0000-0000-000000000b01' })
    expect(res.status).toBe(400)
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
