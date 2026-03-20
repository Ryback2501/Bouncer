import { vi, describe, it, expect } from 'vitest'

vi.mock('../prisma', () => ({
  prisma: {
    application: { upsert: vi.fn() },
    role: { upsert: vi.fn() },
  },
}))

import { prisma } from '../prisma'
import { ensureBouncerDefaults } from '../lib/bouncerDefaults'

const appMock = prisma.application as unknown as Record<string, ReturnType<typeof vi.fn>>
const roleMock = prisma.role as unknown as Record<string, ReturnType<typeof vi.fn>>

const mockApp = { id: 'bouncer-app', name: 'Bouncer', customId: 'bouncer', createdAt: new Date(), updatedAt: new Date() }
const mockRole = { id: 'admin-role', name: 'Admin', customId: 'admin', applicationId: 'bouncer-app', createdAt: new Date(), updatedAt: new Date() }

describe('ensureBouncerDefaults', () => {
  it('upserts bouncer app and admin role on first call, then caches the result', async () => {
    appMock.upsert.mockResolvedValue(mockApp)
    roleMock.upsert.mockResolvedValue(mockRole)

    const result = await ensureBouncerDefaults()

    expect(result).toEqual({ app: mockApp, role: mockRole })
    expect(appMock.upsert).toHaveBeenCalledWith({
      where: { customId: 'bouncer' },
      update: {},
      create: { name: 'Bouncer', customId: 'bouncer' },
    })
    expect(roleMock.upsert).toHaveBeenCalledWith({
      where: { applicationId_customId: { applicationId: mockApp.id, customId: 'admin' } },
      update: {},
      create: { name: 'Admin', customId: 'admin', applicationId: mockApp.id },
    })

    // Second call should use cache — prisma not called again
    vi.clearAllMocks()
    const cached = await ensureBouncerDefaults()
    expect(cached).toEqual({ app: mockApp, role: mockRole })
    expect(appMock.upsert).not.toHaveBeenCalled()
    expect(roleMock.upsert).not.toHaveBeenCalled()
  })
})
