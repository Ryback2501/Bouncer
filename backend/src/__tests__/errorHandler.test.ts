import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), fatal: vi.fn() },
}))

import logger from '../lib/logger'
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
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // The module mock persists across tests, so its call history has to be reset or assertions
    // below would read the previous test's call.
    vi.mocked(logger.error).mockClear()
  })
  afterEach(() => vi.restoreAllMocks())
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

  // `url` is logged as a top-level key here, outside pino-http's req serializer — so it needs
  // sanitising in its own right. A 500 thrown from an OAuth callback used to write the
  // authorization code in cleartext.
  it('sanitises credentials out of the logged url', () => {
    const reqWithSecret = {
      method: 'GET',
      url: '/auth/google/callback?code=AQQ6VbSAAqPacxzH&state=8iT5ajHS7m3eyQPv',
    } as Request
    errorHandler(new Error('boom'), reqWithSecret, makeRes(), next)

    const [bindings] = vi.mocked(logger.error).mock.calls[0] as [{ url: string }]
    expect(bindings.url).toBe('/auth/google/callback?code=[redacted]&state=[redacted]')
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain('AQQ6VbSAAqPacxzH')
  })

  it('sanitises an invitation token in the logged url', () => {
    const reqWithToken = { method: 'GET', url: `/invite/${'a'.repeat(64)}` } as Request
    errorHandler(new Error('boom'), reqWithToken, makeRes(), next)

    const [bindings] = vi.mocked(logger.error).mock.calls[0] as [{ url: string }]
    expect(bindings.url).toBe('/invite/[redacted]')
  })
})
