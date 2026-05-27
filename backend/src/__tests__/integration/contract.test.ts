/**
 * Contract tests — verify API responses match the public OpenAPI specification
 * in api-specs/external-api.yaml (the contract connected applications integrate
 * against). Uses real DB and supertest (no mocks); each test creates minimal data,
 * calls an endpoint, and checks the response shape against the required fields
 * declared for that schema in the spec.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import request from 'supertest'
import { randomBytes, createHash } from 'crypto'
import yaml from 'js-yaml'
import { prisma } from '../../prisma'
import { makeTestApp } from './testApp'

const app = makeTestApp()

const SPECS_DIR = resolve(__dirname, '../../../../api-specs')
const externalSpec = yaml.load(readFileSync(resolve(SPECS_DIR, 'external-api.yaml'), 'utf8')) as {
  components: { schemas: Record<string, { properties: Record<string, unknown> }> }
}

/** Returns the required top-level property names for a schema by name */
function schemaKeys(spec: typeof externalSpec, schemaName: string): string[] {
  return Object.keys(spec.components.schemas[schemaName]?.properties ?? {})
}

const PREFIX = `int-contract-${randomBytes(4).toString('hex')}`
let appId: string
let rawApiKey: string
let userId: string
let roleId: string

beforeAll(async () => {
  const appRow = await prisma.application.create({
    data: { name: 'Contract Test App', customId: `${PREFIX}-app` },
  })
  appId = appRow.id

  const roleRow = await prisma.role.create({
    data: { name: 'Tester', customId: 'tester', applicationId: appId },
  })
  roleId = roleRow.id

  const userRow = await prisma.user.create({
    data: { name: 'Contract User', sub: `${PREFIX}-sub`, provider: 'google' },
  })
  userId = userRow.id

  rawApiKey = `bncr_${randomBytes(32).toString('hex')}`
  const keyHash = createHash('sha256').update(rawApiKey).digest('hex')
  await prisma.apiKey.create({ data: { applicationId: appId, keyHash, label: 'contract' } })

  await prisma.userRole.create({
    data: { userId, applicationId: appId, roleId, active: true, expiredAt: null },
  })
})

afterAll(async () => {
  await prisma.userRole.deleteMany({ where: { userId } })
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.apiKey.deleteMany({ where: { applicationId: appId } })
  await prisma.role.deleteMany({ where: { applicationId: appId } })
  await prisma.application.deleteMany({ where: { id: appId } })
})

describe('External API — contract', () => {
  it('GET /api/v1/access response matches AccessResponse schema', async () => {
    const res = await request(app)
      .get('/api/v1/access')
      .query({ sub: `${PREFIX}-sub`, provider: 'google' })
      .set('Authorization', `Bearer ${rawApiKey}`)

    expect(res.status).toBe(200)

    const requiredKeys = schemaKeys(externalSpec, 'AccessGranted')
    for (const key of requiredKeys) {
      expect(res.body, `AccessResponse missing field: ${key}`).toHaveProperty(key)
    }
  })

  it('documented error code "invalid_api_key" is returned for missing key', async () => {
    const res = await request(app)
      .get('/api/v1/access')
      .query({ sub: `${PREFIX}-sub`, provider: 'google' })
      // No Authorization header

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('invalid_api_key')
  })

  it('documented error code "user_not_found" is returned for unknown sub', async () => {
    const res = await request(app)
      .get('/api/v1/access')
      .query({ sub: 'nobody', provider: 'google' })
      .set('Authorization', `Bearer ${rawApiKey}`)

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('user_not_found')
  })
})
