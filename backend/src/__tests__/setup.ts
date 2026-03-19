process.env.NODE_ENV = 'test'
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://bouncer:bouncer@localhost:5432/bouncer_test'
process.env.SESSION_SECRET = 'test-secret-minimum-sixteen-chars!!'
process.env.FRONTEND_URL = 'http://localhost:5173'
