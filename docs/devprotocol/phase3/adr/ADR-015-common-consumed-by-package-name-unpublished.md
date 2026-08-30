# ADR-015 — marketplace-common is consumed by published package name, is not published, and deploy-local.sh bridges the gap
# Marketplace

**Status:** accepted, **superseded in part 2026-08-26** — the publication half only
**Date:** 2026-08-04
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** [`ADR-037`](./ADR-037-marketplace-common-is-published-to-npm.md), **in part** — the publication half. The platform owner decided to publish on
2026-08-26, which is the trigger §Risks names below, and ADR-037 owns everything about the registry.
[`ADR-047`](./ADR-047-a-common-change-ships-as-a-published-release.md), **in part, 2026-08-30** — the `deploy-local.sh` bridge: **the script is deleted and a change ships by
publishing a release.**

⚠️ **Two halves of this ADR are in force and one is history.** In force: `marketplace-common` is consumed
by its real scoped package name, `@axiumine/marketplace-common`, in every consumer's `package.json`; and
the platform is **GPL-3.0-or-later**, with the eighteen `LICENSE` copies and fifteen `qodana.yaml` key
lists that nothing else records. History: the local bridge this ADR built for a package that had no
registry entry — described below in the past tense, because there is no registry-less state left to bridge
and no script to run.

---

## Context

Nine backend services (`BEs/dev/*`) share one code library, `BEs/marketplace-common`. Its `package.json`
names it `@axiumine/marketplace-common` at version `1.0.0`, and every consumer depends on that exact
string at `^1.0.0` — a real npm-scoped package name. ⚠️ **On 2026-08-04 that package was not published
to any registry**: `registry.npmjs.org/@axiumine/marketplace-common` 404ed. That 404 is the premise this
ADR reasons from, and it held until 2026-08-26, when [`ADR-037`](./ADR-037-marketplace-common-is-published-to-npm.md) ends it by publishing. The reasoning below is the
answer to the premise of its day; ADR-037 changed the premise rather than faulting the answer.

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

⚠️ **A consumer runs the version its lockfile names, and a change reaches it by being published** — the
bridge is gone ([`ADR-047`](./ADR-047-a-common-change-ships-as-a-published-release.md)). The gap between an edit and a release is closed by cutting the release, and a
consumer running the last *published* build turned out to be the state to want rather than the state to
prevent. What this ADR decided and ADR-047 kept is the sentence the bridge rested on: the workspace
consumes this package **by name**.

`package.json` carries `publishConfig: { access: "public", registry: "https://registry.npmjs.org/" }` — a
scoped package defaults to `restricted`, so that key is what makes a public publish possible at all.
**Running the publish is the platform owner's act and nobody else's**, which the publication decision
([`ADR-037`](./ADR-037-marketplace-common-is-published-to-npm.md)) confirms rather than supersedes.

**Licensing follows from the repositories being public, not from the publish.** The whole platform is
**GPL-3.0-or-later**: the full text sits in **eighteen** copies — all sixteen repos plus `marketplace-services-status/`
and `marketplace-docker-DBs/` — byte-identical below line 1, which names what it sits in. All fifteen manifests that
exist declare `"license": "GPL-3.0-or-later"`: the fourteen sub-repos with a `package.json`, plus
`marketplace-services-status`. `marketplace-nginx` and the parent have none.

⚠️ **The `qodana.yaml` half of that is not cosmetic and must move in the same commit as any manifest
change.** Qodana derives the project key from `package.json`, so a `licenseRules.keys` entry that names
only `PROPRIETARY-LICENSE` matches nothing once the manifest reads `GPL-3.0-or-later` — and **a rule that
matches no project does not fail.** It silently stops checking while the audit still reports green. All
fifteen `qodana.yaml` files therefore list `['GPL-3.0-or-later', 'PROPRIETARY-LICENSE']`, so the rule
holds whichever way the metadata is read. `allowed` is unchanged in every file, including
`marketplace-db-setup`'s deliberately short list: a GPL-3.0-or-later project accepting copyleft
dependencies is the ordinary case and needs no argument.

**`marketplace-services-status/` and `marketplace-docker-DBs/` each carry their own `LICENSE` even though neither is a repo.**
They are tracked directories of the parent (ADR-025 for the first), so the parent's `LICENSE` already
covers them and a second copy is redundant *inside this workspace*. It is not redundant outside it: both
are self-contained enough to be lifted out — a systemd monitor and a Docker compose cluster — and a
directory copied without the file it points at travels with no licence at all. [`marketplace-services-status/README.md`](../../../../marketplace-services-status/README.md)
links `./LICENSE` rather than `../LICENSE` for the same reason.

---

## Consequences

### Positive
- Consumer `package.json` files never needed editing when the publish came — the dependency name and range
  were exactly what they would be against a real registry, so the publish was additive rather than a
  breaking rewrite across nine repos. That is the whole return on choosing the real name from day one.
- One licence, one text, eighteen copies: no directory of this workspace can be lifted out and end up
  unlicensed, and no manifest disagrees with the file next to it.

### Negative
- An edit that is not published is invisible and fails at the call site, not at import — a consumer keeps
  compiling and running against the version its lockfile names, and the failure surfaces only when the
  changed code path executes. Publishing is the discipline ([`ADR-047`](./ADR-047-a-common-change-ships-as-a-published-release.md) §The release flow), not an enforced gate.
- Every new exported file needs a hand-added `exports` entry (53 as of this ADR) — a file with no entry is
  unreachable from any consumer even immediately after a correct deploy, and the two failure modes (stale
  deploy vs. missing `exports` entry) look identical from the call site: module not found, or stale
  behaviour.
- The licence lives in eighteen places and the key list in fifteen. Nothing enforces that they agree; a
  new repo that copies neither is a repo distributing code under no stated terms.

### Risks
- **Drift risk**: a consumer's declared semver range moves out of sync with the **published** major
  version. Nothing warns about it — it is checked by hand at step 9 of the release flow, `npm view` the
  published version and then move each range — and it bit for real on `2.0.0` and `3.0.0`, twelve
  `package.json` ranges each time. Revisit by automating the check if a consumer is ever found on a range
  that cannot resolve the current major.
- **Missing-exports risk**: a new file is added to `src/` with no matching `exports` entry, caught only by
  `yarn test:contract`. Revisit if a consumer bug is ever traced to an unreachable common module that
  `test:contract` should have caught and did not.
- **Unpublished-edit risk**: someone edits `src/`, merges, and never cuts the release. No hook catches it,
  and no consumer moves — which is the safe failure, because a consumer cannot run a build that predates
  anything: it runs the version its lockfile names ([`ADR-047`](./ADR-047-a-common-change-ships-as-a-published-release.md)).
- **Licence-gate risk**: a manifest's `license` field is changed without its `qodana.yaml` keys, and the
  SCA licence check silently matches nothing while reporting green. Revisit by asserting the pairing in
  the hook if it ever happens once.
- **Scope creep risk**: real `npm publish` was deferred by CON-09 rather than rejected forever, and the
  owner decided to publish on 2026-08-26 ([`ADR-037`](./ADR-037-marketplace-common-is-published-to-npm.md)). This ADR was superseded **in part** rather than wholly, as
  that expected — and the bridge half outlived it by four days, until [`ADR-047`](./ADR-047-a-common-change-ships-as-a-published-release.md). The licence half and the
  by-name consumption are what remain in force here.

---

## Compliance

⚠️ **The absence of `deploy-local.sh` is checked by [`ADR-047`](./ADR-047-a-common-change-ships-as-a-published-release.md) §Compliance, not here** — verify the script is
*absent*, never that it ran. What this ADR checks is the name, the release, and the contract test:

- `grep -n '"name"' BEs/marketplace-common/package.json` must read `@axiumine/marketplace-common`, matching
  every consumer's dependency string in its own `package.json`.
- An edit under `BEs/marketplace-common/src/` is live when it is published, and only then.
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
