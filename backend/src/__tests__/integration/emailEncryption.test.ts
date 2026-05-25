/**
 * Integration test for PII-at-rest encryption: User.email is stored as ciphertext but read back
 * as plaintext through the Prisma client extension. Requires a real DB + ENCRYPTION_KEY (set in setup.ts).
 */
import { describe, it, expect, afterAll } from 'vitest'
import { randomBytes } from 'crypto'
import { prisma } from '../../prisma'

const PREFIX = `int-enc-${randomBytes(4).toString('hex')}`
let userId: string

afterAll(async () => {
  await prisma.user.deleteMany({ where: { sub: { startsWith: PREFIX } } })
})

describe('email encryption at rest', () => {
  it('stores email as ciphertext but returns plaintext on read', async () => {
    const email = `${PREFIX}@example.com`
    const created = await prisma.user.create({
      data: { name: 'Enc User', sub: `${PREFIX}-sub`, provider: 'google', email },
    })
    userId = created.id

    // Read paths (create return + findUnique) decrypt transparently.
    expect(created.email).toBe(email)
    const found = await prisma.user.findUnique({ where: { id: userId } })
    expect(found?.email).toBe(email)

    // The raw column value is ciphertext, not the plaintext.
    const rows = await prisma.$queryRaw<{ email: string }[]>`SELECT email FROM "User" WHERE id = ${userId}`
    expect(rows[0].email.startsWith('enc:v1:')).toBe(true)
    expect(rows[0].email).not.toContain(email)
  })

  it('re-encrypts on update and still reads back plaintext', async () => {
    const newEmail = `${PREFIX}-updated@example.com`
    const updated = await prisma.user.update({ where: { id: userId }, data: { email: newEmail } })
    expect(updated.email).toBe(newEmail)

    const rows = await prisma.$queryRaw<{ email: string }[]>`SELECT email FROM "User" WHERE id = ${userId}`
    expect(rows[0].email.startsWith('enc:v1:')).toBe(true)
    expect(rows[0].email).not.toContain(newEmail)
  })

  it('decrypts email on nested reads (userRoles → user)', async () => {
    const found = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: true },
    })
    expect(found?.email).toBe(`${PREFIX}-updated@example.com`)
  })
})
