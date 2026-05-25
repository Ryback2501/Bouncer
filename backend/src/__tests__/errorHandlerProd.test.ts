import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// In production the handler must NOT echo internal error text to the client.
vi.mock('../config', () => ({ config: { NODE_ENV: 'production' } }))

import { errorHandler } from '../middleware/errorHandler'
import type { Request, Response, NextFunction } from 'express'

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response
  ;(res.status as ReturnType<typeof vi.fn>).mockReturnValue(res)
  return res
}

const req = {} as Request
const next = vi.fn() as unknown as NextFunction

describe('errorHandler (production)', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('returns a generic body with no internal message', () => {
    const res = makeRes()
    errorHandler(new Error('secret DB connection string leaked here'), req, res, next)
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(500)
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({ error: 'internal_error' })
  })
})
