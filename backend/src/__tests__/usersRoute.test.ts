import { vi, describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../services/userService', () => ({
  listUsers: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}))

vi.mock('../prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}))

import * as svc from '../services/userService'
import { prisma } from '../prisma'
import router from '../routes/admin/users'

const p = prisma.user as unknown as Record<string, ReturnType<typeof vi.fn>>
const mockUser = { id: 'u1', name: 'Alice', sub: '123', provider: 'google', isGlobalAdmin: false }
const globalAdmin = { ...mockUser, isGlobalAdmin: true }

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/', router)
  return app
}

describe('GET /users', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns paginated user list', async () => {
    vi.mocked(svc.listUsers).mockResolvedValue({ total: 1, page: 1, limit: 20, users: [mockUser] } as unknown as Awaited<ReturnType<typeof svc.listUsers>>)
    const res = await request(makeApp()).get('/')
    expect(res.status).toBe(200)
    expect(res.body.users).toHaveLength(1)
  })

  it('passes search, page, limit query params to service', async () => {
    vi.mocked(svc.listUsers).mockResolvedValue({ total: 0, page: 2, limit: 10, users: [] } as unknown as Awaited<ReturnType<typeof svc.listUsers>>)
    await request(makeApp()).get('/?search=alice&page=2&limit=10')
    expect(svc.listUsers).toHaveBeenCalledWith({ search: 'alice', page: 2, limit: 10 })
  })
})

describe('POST /users', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates user and returns 201', async () => {
    vi.mocked(svc.createUser).mockResolvedValue(mockUser as unknown as Awaited<ReturnType<typeof svc.createUser>>)
    const res = await request(makeApp()).post('/').send({ name: 'Alice', sub: '123', provider: 'google' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Alice')
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request(makeApp()).post('/').send({ name: 'Alice' })
    expect(res.status).toBe(400)
  })

  it('returns 409 on duplicate sub+provider', async () => {
    vi.mocked(svc.createUser).mockRejectedValue({ code: 'P2002' })
    const res = await request(makeApp()).post('/').send({ name: 'Alice', sub: '123', provider: 'google' })
    expect(res.status).toBe(409)
  })
})

describe('GET /users/:userId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns user by id', async () => {
    vi.mocked(svc.getUser).mockResolvedValue({ ...mockUser, userRoles: [] } as unknown as Awaited<ReturnType<typeof svc.getUser>>)
    const res = await request(makeApp()).get('/u1')
    expect(res.status).toBe(200)
  })

  it('returns 404 when user not found', async () => {
    vi.mocked(svc.getUser).mockResolvedValue(null)
    const res = await request(makeApp()).get('/nonexistent')
    expect(res.status).toBe(404)
  })
})

describe('PATCH /users/:userId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when patching the global admin', async () => {
    p.findUnique.mockResolvedValue(globalAdmin)
    const res = await request(makeApp()).patch('/u1').send({ name: 'X' })
    expect(res.status).toBe(403)
  })

  it('updates user when not global admin', async () => {
    p.findUnique.mockResolvedValue(mockUser)
    vi.mocked(svc.updateUser).mockResolvedValue({ ...mockUser, name: 'Bob' } as unknown as Awaited<ReturnType<typeof svc.updateUser>>)
    const res = await request(makeApp()).patch('/u1').send({ name: 'Bob' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Bob')
  })

  it('returns 404 when user not found', async () => {
    p.findUnique.mockResolvedValue(null)
    vi.mocked(svc.updateUser).mockRejectedValue({ code: 'P2025' })
    const res = await request(makeApp()).patch('/u1').send({ name: 'X' })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /users/:userId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when deleting the global admin', async () => {
    p.findUnique.mockResolvedValue(globalAdmin)
    const res = await request(makeApp()).delete('/u1')
    expect(res.status).toBe(403)
  })

  it('returns 204 on successful deletion', async () => {
    p.findUnique.mockResolvedValue(mockUser)
    vi.mocked(svc.deleteUser).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof svc.deleteUser>>)
    const res = await request(makeApp()).delete('/u1')
    expect(res.status).toBe(204)
  })

  it('returns 404 when user not found', async () => {
    p.findUnique.mockResolvedValue(null)
    vi.mocked(svc.deleteUser).mockRejectedValue({ code: 'P2025' })
    const res = await request(makeApp()).delete('/u1')
    expect(res.status).toBe(404)
  })
})
