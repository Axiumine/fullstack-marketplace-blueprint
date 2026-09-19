# marketplace-services-status — reference

This file holds the rationale, history and lookup-only detail that `CLAUDE.md` used to carry. `CLAUDE.md`
keeps the identity, routing table and hard rules; read that first. Nothing here is a rule you must obey —
it explains why the rules in `CLAUDE.md` exist, or documents an implementation detail you look up only
when you are about to touch the code it describes.

## Why `yarn test:mutation` is hook-only

`yarn test:mutation` is **hook-only**. It runs when the `pre-push` hook calls it and at no other time —
not to check a change, not before a commit, not on one file, not to confirm a survivor is fixed. Do not
invoke `stryker` directly either.

This does not weaken anything: the threshold stays 100, `pre-push` still blocks, and no survivor is ever
answered by lowering a number. What changes is **who starts the run**. A full pass costs tens of minutes
and holds the whole machine at 28 workers while it lasts, so an on-demand run is time taken from the
person waiting for the work.

Go through the package script if a run is ever authorised — never `npx stryker run`, which skips whatever
the script sets up around it.

A survivor is answered by writing the test it names and letting the next push run the gate. If a mutant
has to be reproduced first, apply it by hand in the source and run `yarn test` — that is seconds, it
names the tests that should have failed, and it costs nobody the machine.

## Gates — full rationale

- **`yarn test:cov` is vitest *and* `scripts/coverage-audit.mjs`.** The script proves the report
  the thresholds were computed over holds every git-tracked file `coverage.include` gates; a file
  that is not in the report is not in the denominator, so 100% said nothing about it (`RISK_REGISTER`
  R07). ⚠️ **There is no `coverage.exclude` here any more.** It used to hold `src/public/**`, a
  directory glob that would have exempted whatever landed in that directory next, in silence, with
  the run still green. `coverage.include` — `src/**/*.ts` plus the exact path `src/public/app.js` —
  is now the only gate, and the audit fails on any tracked file under `src/` that no glob of it
  matches: today the nine stylesheets, each named in `coverage-exempt.txt` with its reason. A new
  file there takes the run red, and the answer is a test or a named line, never a wider glob.
- **The parent workspace's hooks are what gate this directory.** `pre-commit` is scoped to staged,
  non-markdown paths under `marketplace-services-status/` and runs `yarn test:cov` then Qodana; `pre-push` runs
  unscoped — `semgrep:ci` → `test:cov` → `test:mutation` → Qodana — because `pre-commit` never fires
  for a merge commit and never saw a `--no-verify` one.
- **Semgrep is a push gate, and push-only.** It was in no hook at all until 2026-08-13 — `yarn semgrep`
  was a manual step nobody was obliged to run. `pre-push` now runs `yarn semgrep:ci` (the `--error`
  variant) first, because at ~3 s it is the cheapest gate here by an order of magnitude. Push is also
  the only place it can be trusted: semgrep scans **files git already tracks**, so a brand-new file is
  invisible to a "clean" scan until it is committed — which, at push time, everything being pushed is.
  Bypass for a Docker outage, never for a finding: `SKIP_SEMGREP=1 git push`.

## Line-level invariants mutation testing protects

These are not top-level hard rules — they are why specific lines look wrong and aren't. Read the
relevant one before refactoring `src/monitor.ts`, `src/systemd.ts`, `systemd/generate.mjs` or
`src/public/app.js`.

- **Health derivation order is load-bearing and non-commutative.** `loadState !== 'loaded'` → `missing`
  before `activeState`, and `failed` before `portOpen`, so a stale process still holding the port after
  the unit failed reads `failed` rather than `up`. Do not refactor those four lines into independent
  booleans.
- **`refresh()` is not `tick()`.** It awaits any in-flight tick *then* starts a new one, so a
  post-action response cannot report state captured before the action landed. Simplifying it to
  `return tick()` lets a post-action response report pre-action state.
- **`showUnits` matches output blocks back to units by each block's own `Id=`**, never by position.
  Zipping results to the requested array by index would silently show one service's pid, memory and
  state under another service's name.
- **`isEnabled` reads the state string out of the *rejected* promise's `.stdout`.** `systemctl
  is-enabled` exits non-zero for perfectly normal states (`disabled`, `static`), so "cleaning up" that
  catch block reports every non-enabled unit as `unknown`.
- **`(mainPidRaw ?? 0) > 0` is phrased that way on purpose.** The obvious `mainPidRaw !== null &&
  mainPidRaw > 0` is functionally identical but leaves an unreachable conjunct, which fails the 100%
  mutation gate.
- **The probe is a bare TCP connect, not a health check.** A wedged process that still accepts
  connections reads `up`. `healthPath` in `services.json` is validated but not consumed — it is
  reserved for an HTTP probe nobody has written.
- **`systemd.ts` trusts its arguments by design** — it prevents shell injection (`execFile` with an
  argv array, never `shell: true`), not unit-name forgery. Nothing in that module checks a unit against
  `config.services`, so a future handler passing a request-supplied unit straight through would let a
  client drive *any* user unit on the host.
- **`generate.mjs`'s shell-syntax guard fails the whole run, not one unit.** It accepts only a plain
  `&&` chain, so one repo adding `||` or a pipe to its dev script makes `yarn systemd:install` throw
  before writing any of the 13 unit files. ⚠️ **It is gated like `src/`, and it is the only file
  outside `src/` that is.** A script with no exports that nothing imports, it was reached by no
  `coverage.include` or `mutate` glob until 2026-09-06 (`RISK_REGISTER` R61) — it is named by exact
  path in both now, and `test/systemdGenerate.test.ts` runs it with `node:fs` and `node:os`
  replaced. ⚠️ **The fixtures are shapes, never the real sibling repos**: the generator resolves
  every repo it reads out of `services.json`'s `workspaceRoot`, so a real-filesystem test would go
  red whenever another repo edited a script this one has nothing to do with.
- **`install.sh`'s step 7 warns but never exits non-zero**, despite [`README.md`](./README.md) calling it an
  assertion — a monitored unit found wrongly `enabled` does not fail the script. Do not gate automation
  on its exit code for that condition.
- **Raising `MAX_LOG_LINES` has an unstated dependency on `LOGS_MAX_BUFFER`.** The 16MB figure was
  chosen against the current 2000-line cap and `--output=short-iso`; raising one alone can bring back
  the `MAXBUFFER` truncation the other exists to prevent.
- **`src/public/app.js` is gated like everything else, and its suites boot it in jsdom.** It was
  excluded from coverage and mutation until 2026-09-06 on the reasoning that an IIFE no module
  imports cannot be instrumented by a node-side run (RISK_REGISTER R60); `test/publicApp.test.ts`,
  `publicAppBare.test.ts` and `publicAppSecure.test.ts` falsified that. ⚠️ **They mount
  `renderHtml()`'s own output, never a copy of the markup** — every id `app.js` looks up is a
  contract with a template literal in another language in `src/server.ts`, checked by nothing else,
  so a fixture copy would stay green through exactly the rename that breaks the page. ⚠️ **One boot
  per file**: the IIFE registers a delegated `click` and a `keydown` listener on `document` and
  removes neither, so a second boot in one file leaves two pages handling the same click off two
  states. A different starting condition — a bare document, another page URL — is another file.
  The nine stylesheets beside it stay out of both gates and are named in `coverage-exempt.txt`.
  `vitest.mutation.config.mts` excludes `security.live.test.ts` for a different reason: it drives a
  `dist/` built before the mutant existed.
- **`qodana.yaml`'s image tag must stay a real tag.** Only `2026.2`, `2026.1`, `2025.3`, `2025.2` and
  `latest` exist — bumping the pin to match a CLI version banner makes the pull fail and the scan never
  run. Its `licenseRules` lists **two** keys, `GPL-3.0-or-later` and `PROPRIETARY-LICENSE` — the first is
  what Qodana derives from `package.json`'s GPL declaration, the second is what it derives from an
  `UNLICENSED` one. Both stay, because the failure is silent: the
  literal `UNLICENSED` matches nothing, and a key that matches no project does not fail the run — the rule
  simply never fires and the audit reports green while checking nothing.
