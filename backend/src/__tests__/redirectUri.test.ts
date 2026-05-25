import { describe, it, expect } from 'vitest'
import { isAllowedRedirectUri } from '../lib/redirectUri'

describe('isAllowedRedirectUri', () => {
  const allowed = ['https://app.example.com/welcome', 'http://localhost:5173']

  it('allows a URL whose origin matches a registered entry (any path)', () => {
    expect(isAllowedRedirectUri('https://app.example.com/welcome', allowed)).toBe(true)
    expect(isAllowedRedirectUri('https://app.example.com/somewhere/else', allowed)).toBe(true)
    expect(isAllowedRedirectUri('http://localhost:5173/invited', allowed)).toBe(true)
  })

  it('rejects a different host', () => {
    expect(isAllowedRedirectUri('https://evil.example.com/welcome', allowed)).toBe(false)
  })

  it('rejects a different scheme or port (origin differs)', () => {
    expect(isAllowedRedirectUri('http://app.example.com/welcome', allowed)).toBe(false)
    expect(isAllowedRedirectUri('http://localhost:3000/invited', allowed)).toBe(false)
  })

  it('rejects malformed URLs and empty allowlists', () => {
    expect(isAllowedRedirectUri('not-a-url', allowed)).toBe(false)
    expect(isAllowedRedirectUri('https://app.example.com', [])).toBe(false)
  })
})
