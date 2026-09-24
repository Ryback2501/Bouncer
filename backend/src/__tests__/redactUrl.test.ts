import { describe, it, expect } from 'vitest'
import { redactUrl, redactQuery } from '../lib/redactUrl'

// Credentials must never reach a log line, but a log line with no URL is useless for debugging —
// so the shape of the request (path, parameter names, non-secret values) has to survive.
describe('redactUrl', () => {
  it('blanks the invitation token in a query parameter but keeps the parameter name', () => {
    expect(redactUrl('/auth/google?invite=0123456789abcdef')).toBe('/auth/google?invite=[redacted]')
  })

  it('blanks an OAuth authorization code and state', () => {
    const out = redactUrl('/auth/google/callback?code=AQQ6VbSAAqPacxzH&state=8iT5ajHS7m3eyQPv')
    expect(out).toBe('/auth/google/callback?code=[redacted]&state=[redacted]')
  })

  it('blanks an OIDC nonce', () => {
    expect(redactUrl('/x?nonce=tTU2BlWmm5hDpazjaC1t')).toBe('/x?nonce=[redacted]')
  })

  it('masks a token in the invite path, for links minted before the fragment change', () => {
    expect(redactUrl(`/invite/${'a'.repeat(64)}`)).toBe('/invite/[redacted]')
    expect(redactUrl(`/auth/invite/${'b'.repeat(64)}`)).toBe('/auth/invite/[redacted]')
  })

  it('leaves the bare invite path alone (the fragment form sends no token)', () => {
    expect(redactUrl('/invite')).toBe('/invite')
  })

  // Masking any segment would turn sibling routes into /auth/invite/[redacted] too, making preview
  // and staging indistinguishable in the log.
  it('does not mask a route name that is not a token', () => {
    expect(redactUrl('/auth/invite/stage')).toBe('/auth/invite/stage')
  })

  it('keeps non-sensitive parameters intact', () => {
    expect(redactUrl('/api/v1/access?sub=abc123&provider=google')).toBe(
      '/api/v1/access?sub=abc123&provider=google'
    )
  })

  it('redacts only the sensitive parameter when mixed with others', () => {
    expect(redactUrl('/auth/google?invite=secret&next=%2Fdash')).toBe(
      '/auth/google?invite=[redacted]&next=%2Fdash'
    )
  })

  // code_challenge is a hash, public by design, and useful when debugging PKCE.
  it('leaves code_challenge alone', () => {
    const url = '/x?code_challenge=abc&code_challenge_method=S256'
    expect(redactUrl(url)).toBe(url)
  })

  it('handles an absolute URL, as used in the Location response header', () => {
    const out = redactUrl('https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=sekrit')
    expect(out).toBe('https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=[redacted]')
  })

  it('does not throw on malformed or empty input', () => {
    for (const bad of ['', '???', '%%%', 'not a url at all', '//']) {
      expect(() => redactUrl(bad)).not.toThrow()
    }
  })

  it('passes through a plain path unchanged', () => {
    expect(redactUrl('/health')).toBe('/health')
  })
})

describe('redactQuery', () => {
  it('blanks sensitive keys and keeps the rest', () => {
    expect(redactQuery({ invite: 'secret', sub: 'abc' })).toEqual({
      invite: '[redacted]',
      sub: 'abc',
    })
  })

  it('handles repeated parameters parsed as arrays', () => {
    expect(redactQuery({ code: ['a', 'b'] })).toEqual({ code: '[redacted]' })
  })

  it('returns an empty object unchanged', () => {
    expect(redactQuery({})).toEqual({})
  })
})
