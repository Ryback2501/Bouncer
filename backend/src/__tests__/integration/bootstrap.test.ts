/**
 * B-20. The first-admin bootstrap is a one-time latch. It used to count global admins outside the
 * transaction that creates one, so simultaneous first sign-ins could all pass the check and all
 * become global admin. Real PostgreSQL, real concurrency.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import { prisma } from '../../prisma'
import { findOrCreateUser } from '../../passport'

const PREFIX = `int-boot-${randomBytes(4).toString('hex')}`
// setup.ts allowlists this address for the bootstrap.
const ALLOWED = 'admin@test.com'

beforeEach(async () => {
  // An empty-install state: nobody holds the latch (test database only).
  await prisma.user.updateMany({ where: { isGlobalAdmin: true }, data: { isGlobalAdmin: false } })
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { sub: { startsWith: PREFIX } } })
})

describe('first-admin bootstrap under concurrency', () => {
  it('lets exactly one of several simultaneous first sign-ins become global admin', async () => {
    const attempts = Array.from({ length: 6 }, (_, i) =>
      findOrCreateUser({ sub: `${PREFIX}-${i}`, provider: 'google', name: `Racer ${i}`, email: ALLOWED }).catch(() => null)
    )
    const results = await Promise.all(attempts)

    expect(results.filter((r) => r !== null)).toHaveLength(1)
    expect(await prisma.user.count({ where: { isGlobalAdmin: true } })).toBe(1)
  })

  it('the database refuses a second global admin outright', async () => {
    await prisma.user.create({ data: { sub: `${PREFIX}-a`, provider: 'google', name: 'A', isGlobalAdmin: true } })
    await expect(
      prisma.user.create({ data: { sub: `${PREFIX}-b`, provider: 'google', name: 'B', isGlobalAdmin: true } })
    ).rejects.toMatchObject({ code: 'P2002' })
  })
})
