import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mutable so each test can set the allowlist before calling findOrCreateUser.
// vi.hoisted lets the (hoisted) vi.mock factory reference it safely.
const mockConfig = vi.hoisted(() => ({
  ADMIN_ALLOWED_EMAILS: [] as string[],
  NODE_ENV: 'test',
  FRONTEND_URL: 'http://localhost:5173',
}))
vi.mock('../config', () => ({ config: mockConfig }))

vi.mock('../lib/bouncerDefaults', () => ({
  ensureBouncerDefaults: vi.fn().mockResolvedValue({
    app: { id: 'bouncer-app', customId: 'bouncer' },
    role: { id: 'admin-role' },
  }),
}))

vi.mock('../prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), upsert: vi.fn(), create: vi.fn(), update: vi.fn() },
    userRole: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    invitation: { findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { prisma } from '../prisma'
import { findOrCreateUser } from '../passport'

const pu = prisma.user as unknown as Record<string, ReturnType<typeof vi.fn>>
const pur = prisma.userRole as unknown as Record<string, ReturnType<typeof vi.fn>>
const ptx = prisma.$transaction as unknown as ReturnType<typeof vi.fn>

const profile = { sub: 'google:1', provider: 'google', name: 'X', email: 'Person@Example.com' }

describe('findOrCreateUser — admin bootstrap allowlist (H1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig.ADMIN_ALLOWED_EMAILS = []
    pu.findUnique.mockResolvedValue(null) // no existing user
    pur.count.mockResolvedValue(0) // no admins yet → bootstrap path
    ptx.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        user: { create: vi.fn().mockResolvedValue({ id: 'u1', isGlobalAdmin: true }) },
        userRole: { create: vi.fn().mockResolvedValue({}) },
      })
    )
  })

  it('rejects bootstrap when the email is not allowlisted', async () => {
    mockConfig.ADMIN_ALLOWED_EMAILS = ['allowed@example.com']
    const result = await findOrCreateUser({ ...profile, email: 'attacker@evil.com' })
    expect(result).toBeNull()
    expect(ptx).not.toHaveBeenCalled() // never creates the admin
  })

  it('allows bootstrap when the email is allowlisted (case-insensitive)', async () => {
    mockConfig.ADMIN_ALLOWED_EMAILS = ['person@example.com']
    const result = await findOrCreateUser(profile) // email is Person@Example.com
    expect(result?.outcome.kind).toBe('admin')
    expect(ptx).toHaveBeenCalled()
  })

  it('allows bootstrap when no allowlist is set (dev convenience; prod requires it via config)', async () => {
    mockConfig.ADMIN_ALLOWED_EMAILS = []
    const result = await findOrCreateUser(profile)
    expect(result?.outcome.kind).toBe('admin')
  })
})
