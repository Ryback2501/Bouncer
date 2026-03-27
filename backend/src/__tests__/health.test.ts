import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../prisma', () => ({
  prisma: { $queryRaw: vi.fn() },
}))

import { prisma } from '../prisma'
import request from 'supertest'
import { createApp } from '../app'

const p = prisma as unknown as Record<string, ReturnType<typeof vi.fn>>
const app = createApp()

describe('GET /health', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with db: ok when database is reachable', async () => {
    p.$queryRaw.mockResolvedValue([])
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', db: 'ok' })
  })

  it('returns 503 with db: unreachable when database is down', async () => {
    p.$queryRaw.mockRejectedValue(new Error('connection refused'))
    const res = await request(app).get('/health')
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ status: 'error', db: 'unreachable' })
  })
})
