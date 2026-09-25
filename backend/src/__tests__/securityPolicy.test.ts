import { describe, it, expect } from 'vitest'
import { isHttpsOrigin, trustProxySetting, missingTrustProxyWarning } from '../lib/securityPolicy'

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
    expect(trustProxySetting('true', 'http://localhost')).toBe(true)
    expect(trustProxySetting('2', 'http://localhost')).toBe(2)
    expect(trustProxySetting('10.0.0.0/8', 'http://localhost')).toBe('10.0.0.0/8')
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
