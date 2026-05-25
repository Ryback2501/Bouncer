import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockConfig = vi.hoisted(() => ({ ENCRYPTION_KEY: undefined as string | undefined }))
vi.mock('../config', () => ({ config: mockConfig }))

import { encryptField, decryptField, isEncrypted } from '../lib/fieldCrypto'

const KEY = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')

describe('fieldCrypto', () => {
  beforeEach(() => {
    mockConfig.ENCRYPTION_KEY = KEY
  })

  it('round-trips a value and tags it enc:v1:', () => {
    const plain = 'alice@example.com'
    const enc = encryptField(plain)
    expect(isEncrypted(enc)).toBe(true)
    expect(enc).not.toContain(plain)
    expect(decryptField(enc)).toBe(plain)
  })

  it('uses a fresh IV each time (ciphertexts differ)', () => {
    expect(encryptField('x@y.com')).not.toBe(encryptField('x@y.com'))
  })

  it('passes through legacy plaintext on decrypt', () => {
    expect(decryptField('legacy@example.com')).toBe('legacy@example.com')
  })

  it('fails to decrypt tampered ciphertext (GCM auth)', () => {
    const enc = encryptField('secret@example.com')
    // Tamper at the byte level (flip a byte inside the GCM tag) so the change is real regardless
    // of base64 padding/redundancy, then re-encode.
    const raw = Buffer.from(enc.slice('enc:v1:'.length), 'base64')
    raw[20] ^= 0xff // index 20 is within the 16-byte auth tag (iv=0..11, tag=12..27)
    const tampered = 'enc:v1:' + raw.toString('base64')
    expect(() => decryptField(tampered)).toThrow()
  })

  it('with no key: encrypt is a no-op and decrypting ciphertext throws', () => {
    mockConfig.ENCRYPTION_KEY = undefined
    expect(encryptField('plain@example.com')).toBe('plain@example.com')
    mockConfig.ENCRYPTION_KEY = KEY
    const enc = encryptField('x@example.com')
    mockConfig.ENCRYPTION_KEY = undefined
    expect(() => decryptField(enc)).toThrow(/ENCRYPTION_KEY/)
  })
})
