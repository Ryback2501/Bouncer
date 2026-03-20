import { vi, describe, it, expect } from 'vitest'
import { errorHandler } from '../middleware/errorHandler'
import type { Request, Response, NextFunction } from 'express'

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response
  ;(res.status as ReturnType<typeof vi.fn>).mockReturnValue(res)
  return res
}

const req = {} as Request
const next = vi.fn() as unknown as NextFunction

describe('errorHandler', () => {
  it('returns 500 with error message for Error instances', () => {
    const res = makeRes()
    errorHandler(new Error('Something went wrong'), req, res, next)
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(500)
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({
      error: 'internal_error',
      message: 'Something went wrong',
    })
  })

  it('returns generic message for non-Error values', () => {
    const res = makeRes()
    errorHandler('a plain string', req, res, next)
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({
      error: 'internal_error',
      message: 'Internal server error',
    })
  })

  it('returns generic message for null', () => {
    const res = makeRes()
    errorHandler(null, req, res, next)
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({
      error: 'internal_error',
      message: 'Internal server error',
    })
  })
})
