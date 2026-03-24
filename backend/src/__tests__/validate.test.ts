import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { z } from 'zod'
import { validateBody, validateQuery } from '../middleware/validate'

const bodySchema = z.object({ name: z.string().min(1) })
const querySchema = z.object({ page: z.coerce.number().int().positive() })

function makeApp() {
  const app = express()
  app.use(express.json())
  app.post('/body', validateBody(bodySchema), (_req, res) => res.json({ ok: true }))
  app.get('/query', validateQuery(querySchema), (_req, res) => res.json({ ok: true }))
  return app
}

describe('validateBody', () => {
  it('passes valid body to next handler', async () => {
    const res = await request(makeApp()).post('/body').send({ name: 'Alice' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 400 with validation_error for missing required field', async () => {
    const res = await request(makeApp()).post('/body').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('validation_error')
    expect(res.body.issues).toBeDefined()
  })

  it('returns 400 for empty string on min(1) field', async () => {
    const res = await request(makeApp()).post('/body').send({ name: '' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('validation_error')
  })
})

describe('validateQuery', () => {
  it('passes valid query to next handler', async () => {
    const res = await request(makeApp()).get('/query?page=1')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 400 when query param cannot be coerced to number', async () => {
    const res = await request(makeApp()).get('/query?page=abc')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('validation_error')
  })

  it('returns 400 when coerced value fails refinement', async () => {
    const res = await request(makeApp()).get('/query?page=0')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('validation_error')
  })
})
