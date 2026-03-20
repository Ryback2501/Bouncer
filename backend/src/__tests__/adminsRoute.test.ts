import { vi, describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../prisma', () => ({
  prisma: {
    userRole: { findMany: vi.fn() },
  },
}))

vi.mock('../lib/bouncerDefaults', () => ({
  ensureBouncerDefaults: vi.fn(),
}))

import { prisma } from '../prisma'
import { ensureBouncerDefaults } from '../lib/bouncerDefaults'
import router from '../routes/admin/admins'

const p = prisma.userRole as Record<string, ReturnType<typeof vi.fn>>

const mockAdmin = {
  id: 'u1', name: 'Alice', email: 'alice@test.com', provider: 'google', isGlobalAdmin: true, createdAt: new Date(),
}

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/', router)
  return app
}

describe('GET /admins', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns list of bouncer admins', async () => {
    vi.mocked(ensureBouncerDefaults).mockResolvedValue({
      app: { id: 'bouncer-app-id' } as any,
      role: { id: 'admin-role-id' } as any,
    })
    p.findMany.mockResolvedValue([{ user: mockAdmin }])

    const res = await request(makeApp()).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('Alice')
    expect(res.body[0].isGlobalAdmin).toBe(true)
  })

  it('returns empty list when no admins', async () => {
    vi.mocked(ensureBouncerDefaults).mockResolvedValue({
      app: { id: 'bouncer-app-id' } as any,
      role: { id: 'admin-role-id' } as any,
    })
    p.findMany.mockResolvedValue([])

    const res = await request(makeApp()).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(0)
  })
})
