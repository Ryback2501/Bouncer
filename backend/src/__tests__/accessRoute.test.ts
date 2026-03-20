import { vi, describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    userRole: { findUnique: vi.fn() },
  },
}))

vi.mock('../middleware/apiKeyAuth', () => ({
  apiKeyAuth: (req: any, _res: any, next: any) => {
    req.bouncerApp = { id: 'app1', name: 'My App', customId: 'my-app' }
    next()
  },
}))

import { prisma } from '../prisma'
import router from '../routes/api/v1/access'

const pu = prisma.user as Record<string, ReturnType<typeof vi.fn>>
const pur = prisma.userRole as Record<string, ReturnType<typeof vi.fn>>

const mockUser = { id: 'u1', sub: '123', provider: 'google' }
const mockRole = { id: 'r1', name: 'Editor', customId: 'editor' }
const activeUserRole = { userId: 'u1', applicationId: 'app1', roleId: 'r1', active: true, expiredAt: null, role: mockRole }

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/', router)
  return app
}

describe('GET /access', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when sub is missing', async () => {
    const res = await request(makeApp()).get('/access')
    expect(res.status).toBe(400)
  })

  it('returns 404 when user not found', async () => {
    pu.findUnique.mockResolvedValue(null)
    const res = await request(makeApp()).get('/access?sub=123&provider=google')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('user_not_found')
  })

  it('returns 404 when user has no role in the application', async () => {
    pu.findUnique.mockResolvedValue(mockUser)
    pur.findUnique.mockResolvedValue(null)
    const res = await request(makeApp()).get('/access?sub=123&provider=google')
    expect(res.status).toBe(404)
  })

  it('returns 403 when role is inactive', async () => {
    pu.findUnique.mockResolvedValue(mockUser)
    pur.findUnique.mockResolvedValue({ ...activeUserRole, active: false })
    const res = await request(makeApp()).get('/access?sub=123&provider=google')
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('role_inactive')
  })

  it('returns 403 when role is expired', async () => {
    pu.findUnique.mockResolvedValue(mockUser)
    pur.findUnique.mockResolvedValue({ ...activeUserRole, expiredAt: new Date('2020-01-01') })
    const res = await request(makeApp()).get('/access?sub=123&provider=google')
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('role_inactive')
  })

  it('returns user role info for a valid active assignment', async () => {
    pu.findUnique.mockResolvedValue(mockUser)
    pur.findUnique.mockResolvedValue(activeUserRole)
    const res = await request(makeApp()).get('/access?sub=123&provider=google')
    expect(res.status).toBe(200)
    expect(res.body.sub).toBe('123')
    expect(res.body.role.customId).toBe('editor')
    expect(res.body.application.customId).toBe('my-app')
  })

  it('uses findFirst when provider is not specified', async () => {
    pu.findFirst.mockResolvedValue(mockUser)
    pur.findUnique.mockResolvedValue(activeUserRole)
    const res = await request(makeApp()).get('/access?sub=123')
    expect(res.status).toBe(200)
    expect(pu.findFirst).toHaveBeenCalledWith({ where: { sub: '123' } })
  })
})
