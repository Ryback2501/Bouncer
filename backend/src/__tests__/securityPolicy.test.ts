import { describe, it, expect } from 'vitest'
import { isHttpsOrigin, trustProxySetting, trustProxyError, missingTrustProxyWarning } from '../lib/securityPolicy'

// B-07. Security behaviour follows what the deployment actually is, never the NODE_ENV label: the
// image is routinely run as development/test, which used to switch these protections off.
describe('isHttpsOrigin — decides whether cookies are Secure', () => {
  it('is true for an https origin', () => {
    expect(isHttpsOrigin('https://bouncer.example.com')).toBe(true)
  })

  it('is false for http, including localhost', () => {
    expect(isHttpsOrigin('http://localhost')).toBe(false)
    expect(isHttpsOrigin('http://192.168.1.10:8080')).toBe(false)
  })
})

describe('trustProxySetting', () => {
  // Bouncer never terminates TLS itself, so an https origin means a TLS proxy sits in front.
  it('trusts one hop when the origin is https and TRUST_PROXY is unset', () => {
    expect(trustProxySetting(undefined, 'https://bouncer.example.com')).toBe(1)
  })

  // No proxy in front: trusting X-Forwarded-For would let any client pick its own IP and slip
  // past the per-IP rate limits.
  it('trusts nothing when the origin is http and TRUST_PROXY is unset', () => {
    expect(trustProxySetting(undefined, 'http://localhost')).toBe(false)
  })

  it('treats an empty TRUST_PROXY as unset', () => {
    expect(trustProxySetting('', 'http://localhost')).toBe(false)
    expect(trustProxySetting('  ', 'https://bouncer.example.com')).toBe(1)
  })

  it('lets an explicit TRUST_PROXY win', () => {
    expect(trustProxySetting('false', 'https://bouncer.example.com')).toBe(false)
    expect(trustProxySetting('FALSE', 'https://bouncer.example.com')).toBe(false)
    expect(trustProxySetting('2', 'http://localhost')).toBe(2)
    expect(trustProxySetting('10.0.0.0/8', 'http://localhost')).toBe('10.0.0.0/8')
  })
})

// B-09. `true` trusts every hop, so req.ip becomes the left-most X-Forwarded-For entry — chosen by
// the client. Rotating it gave a fresh bucket in every per-IP rate limiter. Anything Express cannot
// parse used to crash createApp() with "invalid IP address"; it is now a startup config error too.
describe('trustProxyError', () => {
  it('rejects true, whatever the case', () => {
    for (const v of ['true', 'TRUE', ' True ']) {
      expect(trustProxyError(v)).toMatch(/X-Forwarded-For/)
    }
  })

  // `true` spelled as a subnet: a zero-length mask would match every address. proxy-addr refuses
  // it as an invalid range, so it cannot slip past as a "valid" list either.
  it('rejects subnets that match every address', () => {
    for (const v of ['0.0.0.0/0', '::/0', '10.0.0.0/8, 0.0.0.0/0', '1.2.3.4/0.0.0.0']) {
      expect(trustProxyError(v)).not.toBeNull()
    }
  })

  it('rejects values Express cannot parse', () => {
    for (const v of ['yes', 'bogus', '10.0.0.0/33', '1.5', '-1']) {
      expect(trustProxyError(v)).toMatch(/TRUST_PROXY|hop count/)
    }
  })

  it('accepts unset, false, a hop count, or proxy IPs/subnets', () => {
    for (const v of [undefined, '', '  ', 'false', 'FALSE', '0', '1', '2', '10.0.0.0/8', 'loopback, 10.0.0.0/8', '::1']) {
      expect(trustProxyError(v)).toBeNull()
    }
  })
})

// Before B-07, production trusted one hop whatever the scheme. A deployment behind a plain-http
// proxy (e.g. on a LAN) that never set TRUST_PROXY would now see every user as the proxy's IP and
// share one rate-limit bucket — so it is told at startup.
describe('missingTrustProxyWarning', () => {
  it('warns for an http origin that is not localhost when TRUST_PROXY is unset', () => {
    expect(missingTrustProxyWarning(undefined, 'http://bouncer.lan')).toMatch(/TRUST_PROXY/)
    expect(missingTrustProxyWarning('', 'http://192.168.1.10:8080')).toMatch(/TRUST_PROXY/)
  })

  it('stays quiet for localhost, https, or an explicit TRUST_PROXY', () => {
    expect(missingTrustProxyWarning(undefined, 'http://localhost')).toBeNull()
    expect(missingTrustProxyWarning(undefined, 'http://127.0.0.1:8080')).toBeNull()
    expect(missingTrustProxyWarning(undefined, 'https://bouncer.example.com')).toBeNull()
    expect(missingTrustProxyWarning('false', 'http://bouncer.lan')).toBeNull()
  })
})
