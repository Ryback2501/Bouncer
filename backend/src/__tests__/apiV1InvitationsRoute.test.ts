import { vi, describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { Request, Response, NextFunction } from 'express'
import type { Application } from '@prisma/client'

vi.mock('../middleware/apiKeyAuth', () => ({
  apiKeyAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.bouncerApp = {
      id: 'app1', name: 'My App', customId: 'my-app',
      redirectUris: ['https://app.example.com/welcome'],
    } as unknown as Application
    next()
  },
}))

vi.mock('../services/roleService', () => ({ getRoleByCustomId: vi.fn() }))
vi.mock('../services/invitationService', () => ({ createInvitation: vi.fn() }))

import * as roleService from '../services/roleService'
import * as invitationService from '../services/invitationService'
import router from '../routes/api/v1/invitations'

const role = roleService as unknown as { getRoleByCustomId: ReturnType<typeof vi.fn> }
const inv = invitationService as unknown as { createInvitation: ReturnType<typeof vi.fn> }

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/', router)
  return app
}

describe('POST /api/v1/invitations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when role is missing', async () => {
    const res = await request(makeApp()).post('/').send({})
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid redirectUri format', async () => {
    const res = await request(makeApp()).post('/').send({ role: 'editor', redirectUri: 'not-a-url' })
    expect(res.status).toBe(400)
  })

  it('returns 404 when the role is not in the application', async () => {
    role.getRoleByCustomId.mockResolvedValue(null)
    const res = await request(makeApp()).post('/').send({ role: 'ghost' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('role_not_found')
    expect(role.getRoleByCustomId).toHaveBeenCalledWith('app1', 'ghost')
  })

  it('returns 400 when redirectUri origin is not allowed', async () => {
    role.getRoleByCustomId.mockResolvedValue({ id: 'r1', customId: 'editor' })
    const res = await request(makeApp()).post('/').send({ role: 'editor', redirectUri: 'https://evil.example.com/x' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('redirect_uri_not_allowed')
    expect(inv.createInvitation).not.toHaveBeenCalled()
  })

  it('creates an invitation and returns 201 with inviteUrl + expiresAt', async () => {
    role.getRoleByCustomId.mockResolvedValue({ id: 'r1', customId: 'editor' })
    const expiresAt = new Date()
    inv.createInvitation.mockResolvedValue({ inviteUrl: 'http://localhost:5173/invite/abc', expiresAt })
    const res = await request(makeApp()).post('/').send({ role: 'editor', redirectUri: 'https://app.example.com/welcome' })
    expect(res.status).toBe(201)
    expect(res.body.inviteUrl).toBe('http://localhost:5173/invite/abc')
    expect(inv.createInvitation).toHaveBeenCalledWith({
      applicationId: 'app1',
      roleId: 'r1',
      redirectUri: 'https://app.example.com/welcome',
    })
  })

  it('allows omitting redirectUri (defaults to null)', async () => {
    role.getRoleByCustomId.mockResolvedValue({ id: 'r1', customId: 'editor' })
    inv.createInvitation.mockResolvedValue({ inviteUrl: 'http://localhost:5173/invite/abc', expiresAt: new Date() })
    const res = await request(makeApp()).post('/').send({ role: 'editor' })
    expect(res.status).toBe(201)
    expect(inv.createInvitation).toHaveBeenCalledWith({ applicationId: 'app1', roleId: 'r1', redirectUri: null })
  })
})
