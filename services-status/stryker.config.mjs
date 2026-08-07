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
    // Browser code, loaded by a <script> tag and never imported by a module here. No
    // node-side test can execute it, so every mutant in it is NoCoverage noise — the same
    // reason it is excluded from the coverage run.
    '!src/public/**',
    // Interfaces and type aliases only. Stryker finds nothing to mutate and the file is
    // listed for the reader, so the exclusion is not mistaken for an oversight.
    '!src/types.ts'
  ]
};
