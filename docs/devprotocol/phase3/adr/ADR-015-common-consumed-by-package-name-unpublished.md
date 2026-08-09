# ADR-015 — marketplace-common is consumed by published package name, is not published, and deploy-local.sh bridges the gap
# Marketplace

**Status:** accepted, amended 2026-08-08 and 2026-08-09
**Date:** 2026-08-04
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Amendment, 2026-08-08 — the publish is prepared and deliberately not executed

⚠️ **Everything this ADR listed as "undecided" is now decided, and the package is still not published.**
Read the amendment before the body: the decision below still holds, but three of the reasons it gave for
holding have expired.

| Was | Is |
|---|---|
| `@thedoctorweb_agency/marketplace-common`, version `4.4.0` | `@axiumine/marketplace-common`, version **`1.0.0`** — a rename and a renumber in one move. Every consumer declares `^1.0.0`. |
| `"license": "UNLICENSED"` | **GPL-3.0-or-later**, with the full text in `BEs/marketplace-common/LICENSE`. The nine services stay `UNLICENSED`; their `qodana.yaml` already allowed copyleft dependencies on the grounds that they are never distributed, and that reasoning is what now carries the GPL dependency. |
| "Registry choice/org undecided … nothing here points at them" | Org is **Axiumine**. `git@github.com:Axiumine/marketplace-common.git` exists, is public, and is this repo's `origin`. Nothing has been pushed to it. |
| `package.json` has no publish configuration | It has `publishConfig: { access: "public", registry: "https://registry.npmjs.org/" }` — a scoped package defaults to `restricted`, so the key is what makes a public publish possible at all. |

**The publish itself has not happened and is not to be run without the platform owner doing it.**
`registry.npmjs.org/@axiumine/marketplace-common` still 404s, `deploy-local.sh` is still the only thing
putting built code where node expects it, and the whole body of this ADR still describes the live
mechanism.

One compliance line below is superseded by this amendment: a `publishConfig` registry URL in
`BEs/marketplace-common/package.json` is **no longer a violation**, it is the prepared state. An
`.npmrc` auth token committed to any repo still is, and so is anyone running `npm publish` /
`yarn upload` other than the platform owner.

When the publish does happen, this ADR is superseded rather than amended again — that is the trigger
CON-09 describes, and the day it fires the "Was" column above becomes history rather than context.

---

## Amendment, 2026-08-09 — the LICENSE is in all sixteen repos and the manifests declare it

⚠️ **"The nine services stay `UNLICENSED`" in the table above is no longer true, and the reason it gave
has expired.** That row rested on the services never being distributed. Since ADR-031 all sixteen
repositories exist under `github.com/Axiumine` and every one of them is **public**, so publishing the
source distributes *our* code — whatever stays true of the dependencies, which are still never shipped.

| Was | Is |
|---|---|
| `LICENSE` only in `BEs/marketplace-common` | all **sixteen** repos carry it, byte-identical below line 1, which names the repo it sits in |
| `"license": "UNLICENSED"` in the other manifests | **GPL-3.0-or-later** in all fourteen that have a `package.json` — `marketplace-nginx` and the parent have none |
| `licenseRules.keys: ['PROPRIETARY-LICENSE']` | `['GPL-3.0-or-later', 'PROPRIETARY-LICENSE']` in all fourteen `qodana.yaml`, matching what `marketplace-common` already did |

⚠️ **The `qodana.yaml` half is not cosmetic and had to land in the same commit as the manifest.** Qodana
derives the project key from `package.json`, so a rule keyed only on `PROPRIETARY-LICENSE` matches
nothing the moment the manifest reads `GPL-3.0-or-later` — and a rule that matches no project **does not
fail**. It silently stops checking while the audit still reports green. Flipping the manifest on its own
would have removed the license gate and called it a pass, which is exactly the failure
`marketplace-common`'s own `qodana.yaml` comment was written to warn about. Both keys stay listed so the
rule holds whichever way the metadata is read.

`allowed` is unchanged in every file, including `marketplace-db-setup`'s deliberately short list: a
GPL-3.0-or-later project accepting copyleft dependencies is the ordinary case and needs no argument, and
widening the set would be a policy change nobody asked for.

---

## Context

Nine backend services (`BEs/dev/*`) share one code library, `BEs/marketplace-common`. Its
`package.json` names it `@axiumine/marketplace-common` (`BEs/marketplace-common/package.json:2`)
and every consumer's `package.json` depends on that exact string — a real npm-scoped package name. The
package is not published to any registry. `registry.npmjs.org/@axiumine/marketplace-common`
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
`node_modules/@axiumine/marketplace-common/` (`deploy-local.sh:78,99-100`).

Reasoning: the alternative that removes the manual step (real publish) is explicitly deferred by
CON-09, and the alternative that removes the polyrepo boundary (`yarn workspaces`) is rejected by the
standing "Polyrepo, not a monorepo" decision — the fourth option is the only one left that touches
neither. No consumer `package.json` needs to change on the day of a real publish, because the
dependency string was always the real one.

⚠️ **`deploy-local.sh` does not get deleted on that day, and its header no longer says it will.** It
said "The day the package is published, delete it" until the 2026-08-08 amendment above; that was
wrong about its own job. The script is what closes the gap *between* releases — an edit to `src/` is
not on the registry until someone publishes it, so a workspace that deleted the script would silently
run every consumer against the last published build. It goes only if the workspace stops consuming
this package by name.

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
  `@axiumine/marketplace-common`, matching every consumer's dependency string in its own
  `package.json`.
- After any edit under `BEs/marketplace-common/src/`, `./deploy-local.sh` must run before the change
  is considered live; `./deploy-local.sh --dry-run` lists every consumer it would touch without
  writing, useful to confirm the consumer set before a real run.
- `yarn test:contract` (`BEs/marketplace-common/package.json:24`) must pass — it is what catches a
  file with no `exports` entry.
- A violation looks like: a consumer's `node_modules/@axiumine/marketplace-common/dist/`
  mtime older than the last commit under `BEs/marketplace-common/src/`, or a consumer failing at a
  specific call site with a working `tsc`/import graph (stale build, not missing export), or
  `yarn test:contract` failing (missing export, not stale build).
- A violation also looks like: an `.npmrc` auth token committed to any repo, or anyone other than the
  platform owner running `npm publish` / `yarn upload` for `@axiumine/marketplace-common` — out of
  scope per CON-09 until they decide otherwise. **The `publishConfig` registry URL in
  `BEs/marketplace-common/package.json` is not one** — see the amendment at the top; it is the
  prepared state, and a scoped package without `access: "public"` cannot be published publicly at all.
