import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'

const app = createApp()

describe('Authentication guards', () => {
  it('GET /admin/applications returns 401 without session', async () => {
    const res = await request(app).get('/admin/applications')
    expect(res.status).toBe(401)
  })

  it('GET /api/v1/access returns 401 without Authorization header', async () => {
    const res = await request(app).get('/api/v1/access?sub=test')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('invalid_api_key')
  })

  it('GET /api/v1/access returns 401 with invalid Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/access?sub=test')
      .set('Authorization', 'Bearer 0000000000000000000000000000000000000000000000000000000000000000')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('invalid_api_key')
  })

  it('POST /auth/logout clears the session and returns 204', async () => {
    const res = await request(app).post('/auth/logout')
    expect(res.status).toBe(204)
  })

  it('GET /auth/logout is no longer allowed (logout is POST-only)', async () => {
    const res = await request(app).get('/auth/logout')
    expect(res.status).toBe(404)
  })
})
