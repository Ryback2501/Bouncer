import { vi, describe, it, expect, beforeEach } from 'vitest'

const tx = {
  user: { create: vi.fn() },
  userRole: { create: vi.fn() },
}

vi.mock('../prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), count: vi.fn() },
    userRole: { count: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}))

vi.mock('../lib/bouncerDefaults', () => ({
  ensureBouncerDefaults: vi.fn().mockResolvedValue({
    app: { id: 'bouncer-app-id', customId: 'bouncer' },
    role: { id: 'admin-role-id', customId: 'admin' },
  }),
}))

vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>()
  return { config: { ...actual.config, ADMIN_ALLOWED_EMAILS: [] as string[] } }
})

import { prisma } from '../prisma'
import { config } from '../config'
import { findOrCreateUser } from '../passport'

const user = prisma.user as unknown as Record<string, ReturnType<typeof vi.fn>>
const userRole = prisma.userRole as unknown as Record<string, ReturnType<typeof vi.fn>>

const stranger = { sub: 'new-sub', provider: 'google', name: 'Stranger', email: 'stranger@example.com' }

// The "first user becomes global admin" bootstrap must run once per database, ever. It used to be
// armed by "no admin role assignment exists right now", which falls back to zero when the last
// admin's portal role is removed — handing global admin to the next person who signs in (B-05).
describe('findOrCreateUser — first-user bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    config.ADMIN_ALLOWED_EMAILS = []
    user.findUnique.mockResolvedValue(null)
    tx.user.create.mockResolvedValue({ id: 'created-id', ...stranger, isGlobalAdmin: true })
  })

  it('bootstraps the first user on a database that has never had a global admin', async () => {
    user.count.mockResolvedValue(0)
    userRole.count.mockResolvedValue(0)

    const result = await findOrCreateUser(stranger)

    expect(result?.outcome.kind).toBe('admin')
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isGlobalAdmin: true }) })
    )
    expect(tx.userRole.create).toHaveBeenCalledWith({
      data: { userId: 'created-id', applicationId: 'bouncer-app-id', roleId: 'admin-role-id', active: true },
    })
  })

  it('does not re-arm once a global admin exists, even with no admin assignment left', async () => {
    user.count.mockResolvedValue(1)
    userRole.count.mockResolvedValue(0)

    expect(await findOrCreateUser(stranger)).toBeNull()
    expect(tx.user.create).not.toHaveBeenCalled()
    expect(tx.userRole.create).not.toHaveBeenCalled()
  })

  it('still applies the email allowlist to a real bootstrap', async () => {
    user.count.mockResolvedValue(0)
    userRole.count.mockResolvedValue(0)
    config.ADMIN_ALLOWED_EMAILS = ['owner@example.com']

    expect(await findOrCreateUser(stranger)).toBeNull()
    expect(tx.user.create).not.toHaveBeenCalled()
  })
})
