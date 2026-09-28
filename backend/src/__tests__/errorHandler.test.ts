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
  // B-07. Internal error text (it can carry DB or implementation details) stays out of client
  // responses by default, whatever NODE_ENV says. The setup runs as NODE_ENV=test, where it used
  // to be echoed.
  it('returns a generic 500 body with no internal message by default', () => {
    const res = makeRes()
    errorHandler(new Error('secret DB connection string leaked here'), req, res, next)
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(500)
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({ error: 'internal_error' })
  })

  it('returns the same generic body for non-Error values', () => {
    const res = makeRes()
    errorHandler('a plain string', req, res, next)
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({ error: 'internal_error' })
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

// B-10. Errors carrying an http-errors status (body-parser, csrf-csrf) are the client's fault and
// used to come back as 500 internal_error, logged as unhandled server errors.
describe('errorHandler — client errors keep their status', () => {
  const httpError = (status: number, extra: Record<string, unknown> = {}) =>
    Object.assign(new Error('secret-ish internal text'), { status, expose: true, ...extra })

  beforeEach(() => {
    vi.mocked(logger.error).mockClear()
    vi.mocked(logger.warn).mockClear()
  })

  const cases: [string, Error, number, string][] = [
    ['malformed JSON', httpError(400, { type: 'entity.parse.failed' }), 400, 'invalid_json'],
    ['a missing/invalid CSRF token', httpError(403, { code: 'EBADCSRFTOKEN' }), 403, 'invalid_csrf_token'],
    ['an oversized body', httpError(413, { type: 'entity.too.large' }), 413, 'payload_too_large'],
    ['an unsupported charset', httpError(415), 415, 'unsupported_media_type'],
    ['a not-found error', httpError(404), 404, 'not_found'],
    ['any other 4xx', httpError(422), 422, 'bad_request'],
  ]
  for (const [what, err, status, code] of cases) {
    it(`answers ${what} with ${status} ${code}, without the message`, () => {
      const res = makeRes()
      errorHandler(err, req, res, next)
      expect(res.status).toHaveBeenCalledWith(status)
      expect(res.json).toHaveBeenCalledWith({ error: code })
    })
  }

  it('honours statusCode like status', () => {
    const res = makeRes()
    errorHandler(Object.assign(new Error('x'), { statusCode: 413 }), req, res, next)
    expect(res.status).toHaveBeenCalledWith(413)
  })

  it('logs a client error as a warning, not an unhandled error', () => {
    errorHandler(httpError(403, { code: 'EBADCSRFTOKEN' }), { method: 'POST', url: '/admin/x' } as Request, makeRes(), next)
    expect(logger.error).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403, code: 'invalid_csrf_token', method: 'POST', url: '/admin/x' }),
      'Request rejected'
    )
  })

  it('keeps an explicit 5xx status as an internal error', () => {
    const res = makeRes()
    errorHandler(httpError(503), req, res, next)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith({ error: 'internal_error' })
    expect(logger.error).toHaveBeenCalled()
  })

  it('ignores a status that is not an error status', () => {
    for (const status of [200, 302, 999, '400', 400.5]) {
      const res = makeRes()
      errorHandler(Object.assign(new Error('x'), { status }), req, res, next)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'internal_error' })
    }
  })
})
