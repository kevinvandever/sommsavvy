import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
    // config.ts requires these at import. Tests stub the database and never
    // connect, so placeholders let the suite run without a .env (for example in
    // a git worktree). A value already set in the shell wins.
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://test:test@localhost:5432/sommsavvy_test',
      JWT_SECRET: process.env.JWT_SECRET ?? 'test-only-secret',
    },
  },
});
