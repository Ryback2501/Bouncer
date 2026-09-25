import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// EXPOSE_ERROR_DETAILS=true is the explicit, local-debugging-only opt-in that puts the internal
// error text back into 500 bodies. Nothing else — in particular no NODE_ENV value — does (B-07).
vi.mock('../config', () => ({ config: { NODE_ENV: 'production', EXPOSE_ERROR_DETAILS: true } }))

import { errorHandler } from '../middleware/errorHandler'
import type { Request, Response, NextFunction } from 'express'

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response
  ;(res.status as ReturnType<typeof vi.fn>).mockReturnValue(res)
  return res
}

const req = {} as Request
const next = vi.fn() as unknown as NextFunction

describe('errorHandler (EXPOSE_ERROR_DETAILS=true)', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('includes the error message for Error instances', () => {
    const res = makeRes()
    errorHandler(new Error('Something went wrong'), req, res, next)
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({
      error: 'internal_error',
      message: 'Something went wrong',
    })
  })

  it('uses a generic message for non-Error values', () => {
    const res = makeRes()
    errorHandler(null, req, res, next)
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({
      error: 'internal_error',
      message: 'Internal server error',
    })
  })
})
