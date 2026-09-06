/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.mutation.config.mts'
  },
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress', 'html'],
  // 28 workers on a 32-thread box, the same number every other package on the platform
  // carries. See the long note in any backend service's config for why it is uniform and
  // why "it still scored 100" is not evidence that a concurrency change was harmless.
  concurrency: 28,
  timeoutMS: 60000,
  // Mutation score is a gate, not a report. `break` fails the run below this score.
  // Never lower it to make a run pass — add the missing test, or delete the branch
  // nothing can reach.
  thresholds: { high: 100, low: 95, break: 100 },
  // Build and scan output copied into the sandbox for nothing. `dist/` matters most here:
  // it is a full compiled copy of `src/`, so leaving it in doubles the sandbox and invites
  // Stryker to mutate the build of the file it is already mutating.
  ignorePatterns: ['.qodana', 'coverage', 'dist'],
  mutate: [
    'src/**/*.ts',
    // The browser half. It is an IIFE loaded by a <script> tag that no module imports, which
    // used to be the reason it was excluded from both gates — the `publicApp*.test.ts` suites
    // ended that: they mount the real shell in jsdom, hand the page a fake WebSocket and drive
    // it through the DOM, so a mutant in it is executed and can be killed like any other.
    // ⚠️ Named as one file rather than as `src/public/**`, so a stylesheet stays out and the
    // next `.js` dropped beside it is a decision somebody has to make here.
    'src/public/app.js',
    // Interfaces and type aliases only. Stryker finds nothing to mutate and the file is
    // listed for the reader, so the exclusion is not mistaken for an oversight.
    '!src/types.ts'
  ]
};
