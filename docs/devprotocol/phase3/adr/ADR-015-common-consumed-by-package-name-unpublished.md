# ADR-015 — marketplace-common is consumed by published package name, is not published, and deploy-local.sh bridges the gap
# Marketplace

**Status:** accepted, **superseded in part 2026-08-26** — the publication half only
**Date:** 2026-08-04
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** [`ADR-037`](./ADR-037-marketplace-common-is-published-to-npm.md), **in part.** The
platform owner decided to publish, which is the trigger §Risks names below, so *"the package is not
published to any registry"* stops being true and ADR-037 owns that half. ⚠️ **The other two halves are not
superseded and stay here:** the `deploy-local.sh` bridge — which ADR-037 §Decision property 2 keeps
verbatim, because the script's job is the gap *between* releases and a real registry does not close it —
and the GPL-3.0-or-later licence decision with its eighteen `LICENSE` copies and fifteen `qodana.yaml` key
lists, which nothing else records.

---

## Context

Nine backend services (`BEs/dev/*`) share one code library, `BEs/marketplace-common`. Its `package.json`
names it `@axiumine/marketplace-common` at version `1.0.0`, and every consumer depends on that exact
string at `^1.0.0` — a real npm-scoped package name. ~~**The package is not published to any registry.**
`registry.npmjs.org/@axiumine/marketplace-common` 404s.~~ **True when this ADR was written and until
2026-08-26; [`ADR-037`](./ADR-037-marketplace-common-is-published-to-npm.md) ends it.** The 404 is the
premise the rest of this ADR reasons from, so it is struck rather than removed — everything below is the
right answer *to that premise*, and ADR-037 changes the premise rather than faulting the answer.

Polyrepo, and no workspace tool (`yarn workspaces`, `pnpm`, Nx) links the repos — each is its own
independent git checkout with its own `node_modules` (ADR-001, [`docs/workflow.md`](../../../workflow.md) §Repo layout). A plain
`yarn install` in a consumer cannot find the package: nothing resolves the name to source. Something has
to put built code where node expects it, on every machine, after every edit.

Publishing for real is explicitly out of scope for this phase (`phase3/CONSTRAINTS.md` CON-09 lists "an
ADR proposing a real npm publish as in-scope for Phase 3" as the violation shape). What has to be decided
is the bridge, not the registry publish.

A second, related force: `marketplace-common` has no barrel export. Each of its files is a separate import
target and needs its own line in the `exports` map (**53 entries** as of this ADR), or it is unreachable
from a consumer even after a successful deploy. Per-file, no wildcard, no barrel.

Two facts about the surrounding state, because the decision leans on both:

- **Org and visibility are settled.** All sixteen repositories exist under `github.com/Axiumine`,
  `marketplace-common`'s among them, and every one of them is **public**. Nothing has been pushed to any
  of them yet.
- **Public source means the platform's own code is distributed**, whatever stays true of its
  dependencies, which are never shipped. So licensing is not deferrable the way publishing is.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Publish to a real registry (npmjs, private registry, GitHub Packages) | Standard `yarn install` resolves it; no bespoke script; version pins behave normally | Publishing is a one-way door once a version ships (`docs/workflow.md` §Git rules); out of scope for Phase 3 per CON-09; and it solves only the *released* state — an edit between releases is still not on the registry |
| `yarn workspaces` / monorepo tool spanning the repos | One install, symlinked packages, no manual copy step | Contradicts ADR-001 on purpose; would force all consumer repos into one workspace root, breaking independent git history and branching per repo |
| `npm link` / local `file:` dependency path | No registry needed, resolves from source directly | `file:`/`link:` still needs every consumer edited to a path dependency, so the eventual publish becomes a rewrite across nine repos; a symlinked `node_modules` entry does not survive the `rsync`-based deploys used elsewhere in this workspace, and is fragile across the tmpfs `node_modules` swap `dev.sh` does |
| Keep the published package *name*, ship no registry entry, and sync built output into each consumer's `node_modules` by script (**chosen**) | No registry decision needed now; consumer `package.json` reads exactly as it will once really published, so the eventual publish is a no-op for consumers; a single script, `BEs/marketplace-common/deploy-local.sh`, is the one place the mechanism lives | Manual step — an edit to `src/` is invisible to every consumer until `./deploy-local.sh` runs; drift between the declared semver range and the deployed version is possible if the range is not bumped alongside |

---

## Decision

The fourth option. The package name in `package.json` and in every consumer's dependency is the real
scoped name, no registry entry exists, and `BEs/marketplace-common/deploy-local.sh` builds `dist/` and
rsyncs it plus `package.json` into every consumer's `node_modules/@axiumine/marketplace-common/`.

Reasoning: the alternative that removes the manual step (real publish) is deferred by CON-09, and the
alternative that removes the polyrepo boundary (`yarn workspaces`) is rejected by ADR-001 — the fourth
option is the only one left that touches neither. No consumer `package.json` needs to change on the day of
a real publish, because the dependency string was always the real one.

⚠️ **`deploy-local.sh` is not deleted on that day.** It is tempting to read it as scaffolding for the
missing registry, but that is wrong about its job: the script is what closes the gap *between* releases.
An edit to `src/` is not on the registry until someone publishes it, so a workspace that deleted the
script would silently run every consumer against the last published build. It goes only if the workspace
stops consuming this package by name.

Consumer discovery is by **declaration**, not by what happens to be installed: `deploy-local.sh` globs
`find "$ROOT" -maxdepth 4 -name package.json … -exec grep -l "\"$PKG_NAME\""` — a repo that lists the
dependency but has never run `yarn install` is still deployed to, not silently skipped. The script also
checks the declared semver range's major against the built version and warns on mismatch: a version bump
alone does not fix a stale consumer, the range has to move too.

~~**The publish is prepared and deliberately not executed.**~~ **The trigger fired on 2026-08-26 and the
publish is decided — see [`ADR-037`](./ADR-037-marketplace-common-is-published-to-npm.md).** Struck rather
than deleted because the prepared state it describes is exactly what ADR-037 collects, and the sentence
after it — *running the publish is the platform owner's act and nobody else's* — is not superseded but
confirmed. `package.json` carries
`publishConfig: { access: "public", registry: "https://registry.npmjs.org/" }` — a scoped package defaults
to `restricted`, so that key is what makes a public publish possible at all. Running the publish is the
platform owner's act and nobody else's. The day it happens, this ADR is superseded rather than revised;
that is the trigger CON-09 describes.

**Licensing follows from the repositories being public, not from the publish.** The whole platform is
**GPL-3.0-or-later**: the full text sits in **eighteen** copies — all sixteen repos plus `services-status/`
and `docker-DBs/` — byte-identical below line 1, which names what it sits in. All fifteen manifests that
exist declare `"license": "GPL-3.0-or-later"`: the fourteen sub-repos with a `package.json`, plus
`services-status`. `marketplace-nginx` and the parent have none.

⚠️ **The `qodana.yaml` half of that is not cosmetic and must move in the same commit as any manifest
change.** Qodana derives the project key from `package.json`, so a `licenseRules.keys` entry that names
only `PROPRIETARY-LICENSE` matches nothing once the manifest reads `GPL-3.0-or-later` — and **a rule that
matches no project does not fail.** It silently stops checking while the audit still reports green. All
fifteen `qodana.yaml` files therefore list `['GPL-3.0-or-later', 'PROPRIETARY-LICENSE']`, so the rule
holds whichever way the metadata is read. `allowed` is unchanged in every file, including
`marketplace-db-setup`'s deliberately short list: a GPL-3.0-or-later project accepting copyleft
dependencies is the ordinary case and needs no argument.

**`services-status/` and `docker-DBs/` each carry their own `LICENSE` even though neither is a repo.**
They are tracked directories of the parent (ADR-025 for the first), so the parent's `LICENSE` already
covers them and a second copy is redundant *inside this workspace*. It is not redundant outside it: both
are self-contained enough to be lifted out — a systemd monitor and a Docker compose cluster — and a
directory copied without the file it points at travels with no licence at all. [`services-status/README.md`](../../../../services-status/README.md)
links `./LICENSE` rather than `../LICENSE` for the same reason.

---

## Consequences

### Positive
- Edits to `marketplace-common` reach all nine services, and everything else in the workspace depending on
  it, with one command and no per-repo manual copy.
- Consumer `package.json` files never need editing for this reason — the dependency name and range are
  exactly what they would be against a real registry, so the eventual publish is additive rather than a
  breaking rewrite across nine repos.
- `--dry-run` and `--no-build` flags let a deploy be previewed or re-run without rebuilding, useful when
  only the consumer set changed.
- One licence, one text, eighteen copies: no directory of this workspace can be lifted out and end up
  unlicensed, and no manifest disagrees with the file next to it.

### Negative
- An edit that is not deployed is invisible and fails at the call site, not at import — a consumer keeps
  compiling and running against the previous `dist/`, and the failure surfaces only when the changed code
  path executes.
- The step is easy to forget: nothing in `yarn install`, `yarn build`, or a service's own `pre-commit`
  hook runs it. It is a discipline, not an enforced gate.
- Every new exported file needs a hand-added `exports` entry (53 as of this ADR) — a file with no entry is
  unreachable from any consumer even immediately after a correct deploy, and the two failure modes (stale
  deploy vs. missing `exports` entry) look identical from the call site: module not found, or stale
  behaviour.
- The licence lives in eighteen places and the key list in fifteen. Nothing enforces that they agree; a
  new repo that copies neither is a repo distributing code under no stated terms.

### Risks
- **Drift risk**: a consumer's declared semver range moves out of sync with the deployed major version.
  Revisit if `deploy-local.sh`'s major-mismatch warning starts firing routinely rather than as a one-off —
  that means the warning is being ignored rather than acted on.
- **Missing-exports risk**: a new file is added to `src/` with no matching `exports` entry, caught only by
  `yarn test:contract`. Revisit if a consumer bug is ever traced to an unreachable common module that
  `test:contract` should have caught and did not.
- **Never-deployed risk**: someone edits `src/` and pushes without running `./deploy-local.sh`. Not caught
  by any hook. Revisit — by adding a pre-push check in `BEs/marketplace-common/.githooks/` — the second
  time a consumer is found running against a `dist/` that predates the commit it was supposed to carry.
- **Licence-gate risk**: a manifest's `license` field is changed without its `qodana.yaml` keys, and the
  SCA licence check silently matches nothing while reporting green. Revisit by asserting the pairing in
  the hook if it ever happens once.
- ~~**Scope creep risk**: real `npm publish` is deferred by CON-09, not rejected forever. Revisit only when
  the platform owner explicitly decides to publish — at which point this ADR is superseded, not revised.~~
  **Fired 2026-08-26.** The owner decided to publish and
  [`ADR-037`](./ADR-037-marketplace-common-is-published-to-npm.md) records it. Superseded **in part**
  rather than wholly, as this bullet expected: the licence half and the `deploy-local.sh` bridge are
  independent of the registry and stay in force here.

---

## Compliance

Verify the bridge is in place and current:

- `grep -n '"name"' BEs/marketplace-common/package.json` must read `@axiumine/marketplace-common`, matching
  every consumer's dependency string in its own `package.json`.
- After any edit under `BEs/marketplace-common/src/`, `./deploy-local.sh` must run before the change is
  considered live; `./deploy-local.sh --dry-run` lists every consumer it would touch without writing.
- `yarn test:contract` must pass — it is what catches a file with no `exports` entry.
- Licence coverage, from the workspace root:

```bash
# 18 platform copies — the one under .agents/skills/ is a third-party skill, not ours
find . -maxdepth 4 -name LICENSE -not -path '*/node_modules/*' -not -path './.agents/*' | wc -l
# 15 — every manifest that exists. `git ls-files` cannot be used here: a submodule
# contributes one gitlink to the parent's index, never its own files (ADR-031).
MANIFESTS=$(find . -maxdepth 4 -name package.json -not -path '*/node_modules/*' -not -path '*/.stryker-tmp/*')
grep -l '"license": "GPL-3.0-or-later"' $MANIFESTS | wc -l
grep -l 'GPL-3.0-or-later' $(find . -maxdepth 4 -name qodana.yaml -not -path '*/node_modules/*' -not -path '*/.stryker-tmp/*') | wc -l   # 15
```

- A violation looks like: a consumer's `node_modules/@axiumine/marketplace-common/dist/` mtime older than
  the last commit under `BEs/marketplace-common/src/`; a consumer failing at a specific call site with a
  working `tsc` and import graph (stale build, not missing export); or `yarn test:contract` failing
  (missing export, not stale build).
- A violation also looks like: an `.npmrc` auth token committed to any repo, or anyone other than the
  platform owner running `npm publish` / `yarn upload` for `@axiumine/marketplace-common`. **The
  `publishConfig` registry URL is not one** — it is the prepared state, and a scoped package without
  `access: "public"` cannot be published publicly at all.
- And a violation of the licence half: a `qodana.yaml` whose `licenseRules.keys` no longer lists
  `GPL-3.0-or-later`, or a repo or liftable directory with no `LICENSE` in it.
