import { describe, it, expect, vi } from 'vitest'
import type { Response } from 'express'
import { handlePrismaError } from '../lib/prismaErrors'

function mockRes(): Response {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response
  ;(res.status as ReturnType<typeof vi.fn>).mockReturnValue(res)
  return res
}

describe('handlePrismaError', () => {
  it('handles P2002 → 409 already_exists and returns true', () => {
    const res = mockRes()
    expect(handlePrismaError({ code: 'P2002' }, res)).toBe(true)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ error: 'already_exists' })
  })

  it('handles P2025 → 404 not_found and returns true', () => {
    const res = mockRes()
    expect(handlePrismaError({ code: 'P2025' }, res)).toBe(true)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'not_found' })
  })

  it('handles P2003 → 400 invalid_relation and returns true', () => {
    const res = mockRes()
    expect(handlePrismaError({ code: 'P2003' }, res)).toBe(true)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid_relation' })
  })

  it('returns false for an unknown Prisma error code without touching res', () => {
    const res = mockRes()
    expect(handlePrismaError({ code: 'P9999' }, res)).toBe(false)
    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).not.toHaveBeenCalled()
  })

  it('returns false for a non-Prisma error with no code property', () => {
    const res = mockRes()
    expect(handlePrismaError(new Error('generic'), res)).toBe(false)
    expect(res.status).not.toHaveBeenCalled()
  })
})
