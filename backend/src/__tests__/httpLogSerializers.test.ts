import { describe, it, expect } from 'vitest'
import { redactReq, redactRes } from '../lib/httpLogSerializers'

// These are what pino-http actually calls, so they are worth testing directly and not only via the
// redactUrl helper — wiring them up wrongly is how the leak would survive the fix.
describe('redactReq', () => {
  it('sanitises the url', () => {
    const out = redactReq({ url: '/auth/google/callback?code=abc123&state=xyz789' })
    expect(out.url).toBe('/auth/google/callback?code=[redacted]&state=[redacted]')
  })

  // query is a sibling of url in the serialized record, so sanitising the string alone is not enough.
  it('sanitises the parsed query object as well as the url', () => {
    const out = redactReq({ url: '/auth/google?invite=secret', query: { invite: 'secret' } })
    expect(out.url).toBe('/auth/google?invite=[redacted]')
    expect(out.query).toEqual({ invite: '[redacted]' })
  })

  it('leaves a request with nothing sensitive untouched', () => {
    const out = redactReq({ url: '/api/v1/access?sub=abc', query: { sub: 'abc' }, method: 'GET' })
    expect(out.url).toBe('/api/v1/access?sub=abc')
    expect(out.query).toEqual({ sub: 'abc' })
    expect(out.method).toBe('GET')
  })

  it('preserves the other serialized fields', () => {
    const out = redactReq({ url: '/x', id: 7, headers: { host: 'h' }, remotePort: 1234 })
    expect(out.id).toBe(7)
    expect(out.headers).toEqual({ host: 'h' })
    expect(out.remotePort).toBe(1234)
  })

  it('tolerates a record with no url or query', () => {
    expect(() => redactReq({ method: 'GET' })).not.toThrow()
  })
})

describe('redactRes', () => {
  // The outbound redirect to the provider carries `state`; it is logged as res.headers.location.
  it('sanitises the Location header', () => {
    const out = redactRes({
      headers: { location: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=sekrit' },
    })
    expect(out.headers?.location).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=[redacted]'
    )
  })

  it('leaves an ordinary Location alone', () => {
    const out = redactRes({ headers: { location: 'http://localhost:5173/login?error=auth_failed' } })
    expect(out.headers?.location).toBe('http://localhost:5173/login?error=auth_failed')
  })

  it('tolerates a response with no headers', () => {
    expect(() => redactRes({ statusCode: 204 })).not.toThrow()
  })
})
