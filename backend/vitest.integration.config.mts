import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/integration/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    testTimeout: 30000,
    // Run integration test files sequentially — they share a database
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
})
