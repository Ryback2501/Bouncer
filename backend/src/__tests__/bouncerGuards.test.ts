import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../prisma', () => ({
  prisma: {
    application: { findUnique: vi.fn() },
    role: { findUnique: vi.fn() },
  },
}))

import { prisma } from '../prisma'
import { isBouncerApplication, isBouncerAdminRole } from '../lib/bouncerDefaults'

const application = prisma.application as unknown as Record<string, ReturnType<typeof vi.fn>>
const role = prisma.role as unknown as Record<string, ReturnType<typeof vi.fn>>

// These back the five guards protecting the admin portal's own Application and admin Role. They
// resolve the row being acted on and compare its customId, rather than comparing against the ids
// held in the module cache — that cache is never invalidated, so after a database reset under a
// running process it holds ids that match nothing and an id-based guard silently stops firing.
describe('isBouncerApplication', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is true for the portal application', async () => {
    application.findUnique.mockResolvedValue({ customId: 'bouncer' })
    expect(await isBouncerApplication('any-id')).toBe(true)
  })

  it('is false for an ordinary application', async () => {
    application.findUnique.mockResolvedValue({ customId: 'clerk' })
    expect(await isBouncerApplication('any-id')).toBe(false)
  })

  // A missing row must not trip the guard: the handler's own lookup should produce the 404.
  it('is false when the application does not exist', async () => {
    application.findUnique.mockResolvedValue(null)
    expect(await isBouncerApplication('nope')).toBe(false)
  })

  it('reads the row it was asked about, not the cache', async () => {
    application.findUnique.mockResolvedValue({ customId: 'bouncer' })
    await isBouncerApplication('the-id-under-test')
    expect(application.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'the-id-under-test' } })
    )
  })
})

describe('isBouncerAdminRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is true for the admin role of the portal application', async () => {
    role.findUnique.mockResolvedValue({ customId: 'admin', application: { customId: 'bouncer' } })
    expect(await isBouncerAdminRole('any-id')).toBe(true)
  })

  // The discriminator is the pair, not the name. Any application may have a role called `admin`,
  // and protecting those would wrongly stop an operator managing their own roles.
  it('is false for a role named admin under a different application', async () => {
    role.findUnique.mockResolvedValue({ customId: 'admin', application: { customId: 'clerk' } })
    expect(await isBouncerAdminRole('any-id')).toBe(false)
  })

  it('is false for a different role of the portal application', async () => {
    role.findUnique.mockResolvedValue({ customId: 'viewer', application: { customId: 'bouncer' } })
    expect(await isBouncerAdminRole('any-id')).toBe(false)
  })

  it('is false when the role does not exist', async () => {
    role.findUnique.mockResolvedValue(null)
    expect(await isBouncerAdminRole('nope')).toBe(false)
  })
})
