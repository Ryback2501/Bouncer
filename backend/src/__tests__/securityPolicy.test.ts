import { describe, it, expect } from 'vitest'
import { isHttpsOrigin, trustProxySetting } from '../lib/securityPolicy'

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
