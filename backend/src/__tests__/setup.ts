process.env.NODE_ENV = 'test'
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://bouncer:bouncer@localhost:5432/bouncer_test'
process.env.SESSION_SECRET = 'test-secret-minimum-sixteen-chars!!'
process.env.FRONTEND_URL = 'http://localhost:5173'
// Tests manage the schema themselves (`prisma migrate deploy` in CI); never auto-migrate.
process.env.MIGRATE_ON_START = 'false'
// Deterministic 32-byte key so the PII-encryption extension is exercised in tests.
process.env.ENCRYPTION_KEY = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')
