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
      // The server's TypeScript, plus the one browser file it sends to the page. `app.js` is an
      // IIFE nothing imports, so it used to be listed as unmeasurable — the `publicApp*.test.ts`
      // suites falsified that: they mount `renderHtml()`'s own shell in jsdom, install a fake
      // WebSocket, import the file and drive it through the DOM. It is gated like everything else.
      //
      // ⚠️ There is no `coverage.exclude` here, deliberately. It used to hold `src/public/**`, a
      // directory glob that would have exempted whatever landed in that directory next, in silence,
      // with the run still green (RISK_REGISTER R60). This list is now the only gate, and
      // `scripts/coverage-audit.mjs` fails on any tracked file under `src/` that no line of it
      // matches unless coverage-exempt.txt names that file with a reason.
      //
      // `systemd/generate.mjs` is the third entry and the one outside `src/`: it is a script with
      // no exports that nothing imports either, so no glob rooted at `src` had ever reached it and
      // nothing measured it (RISK_REGISTER R61) — while it is what decides the `ExecStart` of
      // thirteen real units. `test/systemdGenerate.test.ts` runs it with `node:fs` replaced.
      include: ['src/**/*.ts', 'src/public/app.js', 'systemd/generate.mjs'],
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
