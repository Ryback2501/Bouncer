import { vi, describe, it, expect } from 'vitest'
import { requireAdmin } from '../middleware/requireAdmin'
import type { Request, Response, NextFunction } from 'express'

function makeReq(authenticated: boolean): Request {
  return { isAuthenticated: () => authenticated } as unknown as Request
}

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response
  ;(res.status as ReturnType<typeof vi.fn>).mockReturnValue(res)
  return res
}

describe('requireAdmin', () => {
  it('calls next() when request is authenticated', () => {
    const next = vi.fn() as unknown as NextFunction
    requireAdmin(makeReq(true), makeRes(), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('returns 401 when request is not authenticated', () => {
    const next = vi.fn() as unknown as NextFunction
    const res = makeRes()
    requireAdmin(makeReq(false), res, next)
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(401)
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({ error: 'unauthorized' })
    expect(next).not.toHaveBeenCalled()
  })
})
