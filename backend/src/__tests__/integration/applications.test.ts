/**
 * Integration tests for the applications + roles admin routes.
 * Uses a real PostgreSQL database — no Prisma mocks.
 * Verifies full request → route → service → DB → response path.
 */
import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import { prisma } from '../../prisma'
import { makeTestApp } from './testApp'

const app = makeTestApp()

// Clean up test applications after each test to avoid P2002 conflicts
afterEach(async () => {
  await prisma.application.deleteMany({
    where: { customId: { startsWith: 'test-int-' } },
  })
})

describe('Applications — integration', () => {
  describe('POST /admin/applications', () => {
    it('creates an application and returns 201', async () => {
      const res = await request(app)
        .post('/admin/applications')
        .send({ name: 'Integration App', customId: 'test-int-app1' })

      expect(res.status).toBe(201)
      expect(res.body.customId).toBe('test-int-app1')
      expect(res.body.id).toBeDefined()
    })

    it('returns 409 when customId already exists (real P2002)', async () => {
      await request(app)
        .post('/admin/applications')
        .send({ name: 'App A', customId: 'test-int-dup' })

      const res = await request(app)
        .post('/admin/applications')
        .send({ name: 'App B', customId: 'test-int-dup' })

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('already_exists')
    })

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/admin/applications')
        .send({ name: 'Missing ID' })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /admin/applications', () => {
    it('lists applications including the newly created one', async () => {
      await request(app)
        .post('/admin/applications')
        .send({ name: 'Listed App', customId: 'test-int-list1' })

      const res = await request(app).get('/admin/applications')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      const found = res.body.find((a: { customId: string }) => a.customId === 'test-int-list1')
      expect(found).toBeDefined()
    })
  })

  describe('PATCH /admin/applications/:id', () => {
    it('updates an application name', async () => {
      const created = await request(app)
        .post('/admin/applications')
        .send({ name: 'Original', customId: 'test-int-patch1' })

      const res = await request(app)
        .patch(`/admin/applications/${created.body.id}`)
        .send({ name: 'Updated' })

      expect(res.status).toBe(200)
      expect(res.body.name).toBe('Updated')
    })
  })

  describe('DELETE /admin/applications/:id', () => {
    it('deletes an application and returns 204', async () => {
      const created = await request(app)
        .post('/admin/applications')
        .send({ name: 'To Delete', customId: 'test-int-del1' })

      const res = await request(app)
        .delete(`/admin/applications/${created.body.id}`)

      expect(res.status).toBe(204)
    })

    it('cascades and removes roles when application is deleted', async () => {
      const appRes = await request(app)
        .post('/admin/applications')
        .send({ name: 'With Role', customId: 'test-int-cascade1' })

      const appId = appRes.body.id

      await request(app)
        .post(`/admin/applications/${appId}/roles`)
        .send({ name: 'Editor', customId: 'editor' })

      await request(app).delete(`/admin/applications/${appId}`)

      // Confirm the role no longer exists in the DB
      const role = await prisma.role.findFirst({ where: { applicationId: appId } })
      expect(role).toBeNull()
    })
  })
})
