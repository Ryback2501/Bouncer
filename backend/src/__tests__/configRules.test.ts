import { describe, it, expect } from 'vitest'
import { envSchema } from '../config'

// B-07. The startup checks used to run only when NODE_ENV=production, so the image — routinely run
// as development/test — would boot with no encryption key, a weak session secret, or an empty
// admin allowlist. They now apply whatever the label says.
const valid = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  SESSION_SECRET: 'x'.repeat(32),
  FRONTEND_URL: 'http://localhost',
  ENCRYPTION_KEY: Buffer.from('0123456789abcdef0123456789abcdef').toString('base64'),
  ADMIN_ALLOWED_EMAILS: 'owner@example.com',
}

const failingFields = (env: Record<string, string | undefined>) => {
  const result = envSchema.safeParse(env)
  return result.success ? [] : Object.keys(result.error.flatten().fieldErrors)
}

describe('startup checks apply in every NODE_ENV', () => {
  it('accepts a complete configuration', () => {
    expect(envSchema.safeParse(valid).success).toBe(true)
  })

  for (const mode of ['development', 'test', 'production']) {
    it(`requires ENCRYPTION_KEY in ${mode}`, () => {
      expect(failingFields({ ...valid, NODE_ENV: mode, ENCRYPTION_KEY: undefined })).toContain('ENCRYPTION_KEY')
    })

    it(`requires a SESSION_SECRET of at least 32 characters in ${mode}`, () => {
      expect(failingFields({ ...valid, NODE_ENV: mode, SESSION_SECRET: 'x'.repeat(31) })).toContain('SESSION_SECRET')
    })

    it(`requires ADMIN_ALLOWED_EMAILS in ${mode}`, () => {
      expect(failingFields({ ...valid, NODE_ENV: mode, ADMIN_ALLOWED_EMAILS: '' })).toContain('ADMIN_ALLOWED_EMAILS')
    })
  }

  // Without a provider nobody can sign in — a usability problem, reported as a startup warning,
  // not a security one. It must not stop the process.
  it('does not fail when no OAuth provider is configured', () => {
    expect(envSchema.safeParse({ ...valid, NODE_ENV: 'production' }).success).toBe(true)
  })

  it('parses EXPOSE_ERROR_DETAILS, off by default', () => {
    expect(envSchema.parse(valid).EXPOSE_ERROR_DETAILS).toBe(false)
    expect(envSchema.parse({ ...valid, EXPOSE_ERROR_DETAILS: 'true' }).EXPOSE_ERROR_DETAILS).toBe(true)
  })
})
