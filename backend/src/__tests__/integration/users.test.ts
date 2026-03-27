/**
 * Integration tests for the users admin routes.
 * Uses a real PostgreSQL database — no Prisma mocks.
 * Verifies full request → route → service → DB → response path.
 */
import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import { prisma } from '../../prisma'
import { makeTestApp } from './testApp'

const app = makeTestApp()

const SUB_PREFIX = 'test-int-user-'

afterEach(async () => {
  await prisma.user.deleteMany({ where: { sub: { startsWith: SUB_PREFIX } } })
})

describe('Users — integration', () => {
  describe('POST /admin/users', () => {
    it('creates a user and returns 201', async () => {
      const res = await request(app)
        .post('/admin/users')
        .send({ name: 'Integration User', sub: `${SUB_PREFIX}create1`, provider: 'google' })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.sub).toBe(`${SUB_PREFIX}create1`)
    })

    it('returns 409 when sub+provider already exists (real P2002)', async () => {
      await request(app)
        .post('/admin/users')
        .send({ name: 'User A', sub: `${SUB_PREFIX}dup`, provider: 'google' })

      const res = await request(app)
        .post('/admin/users')
        .send({ name: 'User B', sub: `${SUB_PREFIX}dup`, provider: 'google' })

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('already_exists')
    })

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/admin/users')
        .send({ name: 'No Sub' })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /admin/users', () => {
    it('lists users including the newly created one', async () => {
      await request(app)
        .post('/admin/users')
        .send({ name: 'Listed User', sub: `${SUB_PREFIX}list1`, provider: 'google' })

      const res = await request(app).get('/admin/users')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.users)).toBe(true)
      const found = res.body.users.find((u: { sub: string }) => u.sub === `${SUB_PREFIX}list1`)
      expect(found).toBeDefined()
    })
  })

  describe('GET /admin/users/:id', () => {
    it('returns user with userRoles array', async () => {
      const created = await request(app)
        .post('/admin/users')
        .send({ name: 'Detail User', sub: `${SUB_PREFIX}detail1`, provider: 'google' })

      const res = await request(app).get(`/admin/users/${created.body.id}`)

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(created.body.id)
      expect(Array.isArray(res.body.userRoles)).toBe(true)
    })

    it('returns 404 for a non-existent user', async () => {
      const res = await request(app).get('/admin/users/00000000-0000-0000-0000-000000000000')
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /admin/users/:id', () => {
    it('updates a user name', async () => {
      const created = await request(app)
        .post('/admin/users')
        .send({ name: 'Original Name', sub: `${SUB_PREFIX}patch1`, provider: 'google' })

      const res = await request(app)
        .patch(`/admin/users/${created.body.id}`)
        .send({ name: 'Updated Name' })

      expect(res.status).toBe(200)
      expect(res.body.name).toBe('Updated Name')
    })
  })

  describe('DELETE /admin/users/:id', () => {
    it('deletes a user and returns 204', async () => {
      const created = await request(app)
        .post('/admin/users')
        .send({ name: 'To Delete', sub: `${SUB_PREFIX}del1`, provider: 'google' })

      const res = await request(app).delete(`/admin/users/${created.body.id}`)

      expect(res.status).toBe(204)

      const gone = await prisma.user.findUnique({ where: { id: created.body.id } })
      expect(gone).toBeNull()
    })
  })
})
