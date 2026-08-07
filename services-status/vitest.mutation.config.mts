import { defineConfig } from 'vitest/config';

// Vitest config used by Stryker's vitest-runner (`yarn test:mutation`).
//
// It mirrors vitest.config.mts with two deliberate differences:
//
//   - No coverage block. Mutants break the code on purpose, so a line-coverage threshold
//     here would fail every run for the wrong reason — the mutation score is the metric.
//
//   - `test/security.live.test.ts` is excluded. That suite spawns `dist/server.js` in a
//     child process, and Stryker mutates `src/`: the child would run a build made before
//     any mutant existed, so every assertion in it passes no matter what was done to the
//     source. Left in, it would report mutants as *survived* while appearing to test them
//     thoroughly — and it would pay a fresh 20-second server boot for each one. The guards
//     it drives over the socket are also called directly in `test/security.test.ts`, which
//     is where the mutants for them are killed.
//
// `fileParallelism` is not set here for the same reason it is set there: with the live
// suite gone, nothing left in this run binds a port, so nothing can race for one.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['test/security.live.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000
  }
});
