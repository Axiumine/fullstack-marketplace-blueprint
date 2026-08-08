# ADR-015 — marketplace-common is consumed by published package name, is not published, and deploy-local.sh bridges the gap
# Marketplace

**Status:** accepted
**Date:** 2026-08-04
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

Nine backend services (`BEs/dev/*`) share one code library, `BEs/marketplace-common`. Its
`package.json` names it `@thedoctorweb_agency/marketplace-common` (`BEs/marketplace-common/package.json:2`)
and every consumer's `package.json` depends on that exact string — a real npm-scoped package name. The
package is not published to any registry. `registry.npmjs.org/@thedoctorweb_agency/marketplace-common`
404s.

Polyrepo, no workspace tool (`yarn workspaces`, `pnpm`, Nx) links the repos — each of the fourteen repos
under this parent dir is its own independent git checkout with its own `node_modules`
(`fullstack-marketplace-blueprint/docs/workflow.md` §Repo layout). A plain `yarn install` in a consumer cannot
find the package: nothing resolves the name to source. Something has to put built code where node
expects it, on every machine, after every edit.

Publishing for real is explicitly out of scope for this phase (`phase3/CONSTRAINTS.md` CON-09: "ADR
… proposes real npm publish as in-scope for Phase 3" is listed as the violation shape). The retrofit
has to describe the bridge that exists today, not design the registry publish that does not.

A second, related force: `marketplace-common` has no barrel export. Each of its ~40 files is a
separate import target and needs its own line in the `exports` map (`BEs/marketplace-common/package.json`),
or it is unreachable from a consumer even after a successful deploy. `docs/conventions.md` quotes this as "~38
entries" — counted on disk today (`python3 -c "import json;print(len(json.load(open('package.json'))['exports']))"`
in `BEs/marketplace-common/`) the map holds **46** entries, so the file has grown past that figure
since it was written; the mechanism the number illustrates (per-file, no wildcard, no barrel) is
unchanged.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Publish to a real registry (npmjs, private registry, GitHub Packages) | Standard `yarn install` resolves it; no bespoke script; version pins behave normally | Registry choice/org undecided (`docs/workflow.md` §Repo layout: "nothing here points at them and nothing here should be pushed to them"); publishing is a one-way door once a version ships (`docs/workflow.md` §Git rules: "npm publish is a one-way door"); out of scope for Phase 3 per CON-09 |
| `yarn workspaces` / monorepo tool spanning all 14 repos | One install, symlinked packages, no manual copy step | Contradicts the polyrepo layout on purpose kept (`docs/workflow.md` §Repo layout: "Polyrepo, **not** a monorepo"); would force all consumer repos into one workspace root, breaking independent git history/branching per repo |
| `npm link` / local `file:` dependency path | No registry needed, resolves from source directly | `file:`/`link:` in `package.json` still needs every consumer edited to a path dependency, and a symlinked `node_modules` entry does not survive `rsync`-based deploys elsewhere in this workspace; fragile across the tmpfs `node_modules` swap `dev.sh` does |
| Keep the published package *name*, ship no registry entry, and sync built output into each consumer's `node_modules` by script | No registry decision needed now; consumer `package.json` reads exactly as it will once really published — the eventual publish is a no-op edit to consumers; single script, `BEs/marketplace-common/deploy-local.sh`, is the one place the mechanism lives | Manual step — an edit to `src/` is invisible to every consumer until `./deploy-local.sh` runs; drift between declared semver range and deployed version is possible if the range isn't bumped alongside |

---

## Decision

Chosen: the fourth option — package name in `package.json` and in every consumer's dependency stays
the real scoped name, no registry entry exists, and `BEs/marketplace-common/deploy-local.sh` builds
`dist/` and rsyncs it plus `package.json` into every consumer's
`node_modules/@thedoctorweb_agency/marketplace-common/` (`deploy-local.sh:78,99-100`).

Reasoning: the alternative that removes the manual step (real publish) is explicitly deferred by
CON-09, and the alternative that removes the polyrepo boundary (`yarn workspaces`) is rejected by the
standing "Polyrepo, not a monorepo" decision — the fourth option is the only one left that touches
neither. It also makes the eventual real publish a pure subtraction: `deploy-local.sh`'s own header
says "It replaces neither `npm publish` nor `yarn install` … The day the package is published, delete
it" (`deploy-local.sh:11`) — no consumer `package.json` needs to change on that day, because the
dependency string was always the real one.

Consumer discovery is by **declaration**, not by what happens to be installed:
`deploy-local.sh` globs `find "$ROOT" -maxdepth 4 -name package.json … -exec grep -l "\"$PKG_NAME\""`
(`deploy-local.sh:63-67`) — a repo that lists the dependency but has never run `yarn install` is
still deployed to, not silently skipped. The script also checks the declared semver range's major
against the built version and warns on mismatch (`deploy-local.sh:80-88`) — a version bump alone does
not fix a stale consumer, the range has to move too.

---

## Consequences

### Positive
- Edits to `marketplace-common` reach all nine services (and, once the customer tier's frontend
  matured, everything else in the workspace depending on it) with one command and no per-repo manual
  copy.
- Consumer `package.json` files never need editing for this reason — the dependency name and range
  are exactly what they'd be against a real registry, so the eventual publish is additive, not a
  breaking rewrite across nine repos.
- `--dry-run` and `--no-build` flags (`deploy-local.sh:29-34`) let a deploy be previewed or re-run
  without rebuilding, useful when only the consumer set changed.

### Negative
- An edit that is not deployed is invisible and fails at the call site, not at import — a consumer
  keeps compiling and running against the previous `dist/`, the failure surfaces only when the
  changed code path executes (`docs/workflow.md` §Repo layout, `deploy-local.sh:12-15`).
- The step is easy to forget: nothing in `yarn install`, `yarn build`, or a service's own `pre-commit`
  hook runs it. It is a discipline, not an enforced gate.
- Every new exported file needs a hand-added `exports` entry (46 as of this ADR, `BEs/marketplace-common/package.json`)
  — a file with no entry is unreachable from any consumer even immediately after a correct deploy, and
  the two failure modes (stale deploy vs. missing exports entry) look identical from the call site
  (module not found / stale behavior).

### Risks
- **Drift risk**: a consumer's declared semver range moves out of sync with the deployed major
  version. Triggers a revisit if `deploy-local.sh`'s major-mismatch warning (`deploy-local.sh:83-86`)
  starts firing routinely instead of as a one-off — that would mean the warning is being ignored
  rather than acted on.
- **Missing-exports risk**: a new file is added to `src/` with no matching `exports` entry, caught
  today only by `yarn test:contract` (`BEs/marketplace-common/package.json:24`,
  `vitest.contract.config.mts`). Triggers a revisit if a shipped consumer bug is ever traced to an
  unreachable common module that `test:contract` should have caught but didn't.
- **Never-deployed risk**: someone edits `src/` and pushes without running `./deploy-local.sh`. Not
  caught by any hook today. Triggers a revisit — worth adding a pre-push check in
  `BEs/marketplace-common/.githooks/` — if this causes a second incident like the "four repos sitting
  on `^1.21.0` with a 3.0.0 copy installed" case the script's own comment records
  (`deploy-local.sh:79-81`).
- **Scope creep risk**: real `npm publish` is deferred by CON-09, not rejected forever. Triggers a
  revisit only when the platform owner explicitly decides to publish for real — at which point this
  ADR's decision is superseded, not amended, per `deploy-local.sh`'s own "delete it" instruction.

---

## Compliance

Verify the bridge is in place and current:

- `grep -n '"name"' BEs/marketplace-common/package.json` must read
  `@thedoctorweb_agency/marketplace-common`, matching every consumer's dependency string in its own
  `package.json`.
- After any edit under `BEs/marketplace-common/src/`, `./deploy-local.sh` must run before the change
  is considered live; `./deploy-local.sh --dry-run` lists every consumer it would touch without
  writing, useful to confirm the consumer set before a real run.
- `yarn test:contract` (`BEs/marketplace-common/package.json:24`) must pass — it is what catches a
  file with no `exports` entry.
- A violation looks like: a consumer's `node_modules/@thedoctorweb_agency/marketplace-common/dist/`
  mtime older than the last commit under `BEs/marketplace-common/src/`, or a consumer failing at a
  specific call site with a working `tsc`/import graph (stale build, not missing export), or
  `yarn test:contract` failing (missing export, not stale build).
- A violation also looks like: any `package.json` in this workspace adding a registry URL, an
  `.npmrc` auth token, or a real `npm publish` step for `@thedoctorweb_agency/marketplace-common` —
  out of scope per CON-09 until the platform owner decides otherwise.
