import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // The security suite boots a real HTTP+WS server on a real port and drives it with a real
    // client. Two files racing for a port would flake, and nothing here is slow enough to need
    // the parallelism.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      // public/ is browser code loaded by a <script> tag, not imported by any module here — it
      // cannot be instrumented by a node-side run and would report a permanent 0%.
      exclude: ['src/public/**'],
      // The same gate every other package in this workspace carries. Never lower one of these to
      // make a run pass — add the missing test, or delete the branch nothing can reach.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
});
