# ADR-037 — `@axiumine/marketplace-common` is published to npmjs, the platform owner publishes it, and `deploy-local.sh` stays
# Marketplace

**Status:** accepted
**Date:** 2026-08-26
**Deciders:** platform owner, who owns `marketplace-common` and every other repo in this workspace and is
the only person who can run the publish. Taken directly, on the ground that this platform is a blueprint
published for the community rather than a private deployment.
**Supersedes:** [`ADR-015`](./ADR-015-common-consumed-by-package-name-unpublished.md) **in part** — the
publication half only. ADR-015's other two halves, the `deploy-local.sh` bridge and the GPL-3.0-or-later
licence decision, are untouched and stay in force there.
**Superseded by:** —

---

## Context

ADR-015 (2026-08-04) decided how nine backend services and three frontends reach one shared library while
no registry entry existed for it: keep the real scoped name `@axiumine/marketplace-common` in every
consumer's `package.json`, publish nothing, and rsync built output into each consumer's `node_modules/`
with `BEs/marketplace-common/deploy-local.sh`. It did not decide *never publish*. It said the opposite, in
its own last risk:

> **Scope creep risk**: real `npm publish` is deferred by CON-09, not rejected forever. Revisit only when
> the platform owner explicitly decides to publish — at which point this ADR is superseded, not revised.

That is the trigger, and it has fired. **This ADR exists because the platform owner decided to publish.**

### What was actually open, and what was not

Two questions have been conflated and are worth separating before either is answered:

- **Who owns the publish.** `phase5/epics/E09.md` §6 carried this one — that record left `epics/` in this
  same piece of work and is now
  [`phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md`](../../phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md): *"No story here names who owns
  publishing `marketplace-common` past `deploy-local.sh` to a real npm registry."* It is now answered —
  the platform owner, alone, personally. There is no maintainer committee, no CI credential, no delegation.
  This was the last live question in E09, which is why that record leaves `epics/` in the same piece of work.
- ⚠️ **E09 cited the wrong gap for it.** It pointed at [`ADR-INDEX.md`](./ADR-INDEX.md) §5, *"Where the
  sixteen repos get published, and under which org"* — but that bullet is about **git hosting**: which forge
  the sixteen repositories live on, ADR-031's territory. It is not about the npm registry, and it is not
  closed by this ADR. The npm question was always ADR-015's, in the risk quoted above. The misattribution is
  corrected in E09's record, not here.

### What changed since ADR-015

- **CON-09 no longer bites.** [`phase3/CONSTRAINTS.md`](../CONSTRAINTS.md) `CON-09` names the violation
  shape as an ADR that *"proposes real npm publish as **in-scope for Phase 3**"*. Phase 3 is `✅ Complete`
  ([`STATUS.md`](../../STATUS.md)); this is a decision the owner took afterwards, recorded in the phase-3
  ADR directory because that is where architectural decisions live on this platform — ADR-032 (2026-08-10),
  ADR-035 and ADR-036 (both 2026-08-26) all landed there after phase 3 closed. Nothing here proposes
  changing the scope of a completed phase.
- **The stated purpose of the platform is now distribution.** All sixteen repositories are public under
  `github.com/Axiumine` and the whole tree is GPL-3.0-or-later (ADR-015 §Decision, licence half). A
  blueprint whose shared library 404s is a blueprint with a step that only its author can perform.

### The state on disk this decision lands into

Everything the publish needs is already there — ADR-015 built the prepared state deliberately:

| Fact | Where |
|---|---|
| `"name": "@axiumine/marketplace-common"`, `"version": "1.0.0"` | `BEs/marketplace-common/package.json:2-3` |
| `"private": false` | `BEs/marketplace-common/package.json:15` |
| `"publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" }` | `BEs/marketplace-common/package.json:16-19` — a scoped package defaults to `restricted`, so this key is what makes a public publish possible at all |
| `"upload": "npm publish --registry=https://registry.npmjs.org/"` | `BEs/marketplace-common/package.json` §scripts — the command, already written |
| Twelve consumers pin `"@axiumine/marketplace-common": "^1.0.0"` | nine `BEs/dev/*/package.json`, plus `marketplace-admin`, `marketplace-shopowner`, `marketplace-user` |
| The scope is already in use on the public registry | `BEs/marketplace-common/package.json:403` depends on `@axiumine/koa-utils` (`^6.0.0` when this was written, `^7.0.0` since 2026-08-27), and `scripts/lockfile-registry-filter.sh` was *"copied from `@axiumine/koa-utils`, which solved this first"* — the owner already publishes under this scope, so neither the scope nor the workflow is new |

**So the publish is additive, not a migration.** No consumer `package.json` changes on the day it happens:
the dependency string was always the real one. That was ADR-015's whole point and it is being collected now.

### The cost of *not* publishing, measured

Not publishing is not free, and the price is already recorded elsewhere in this tree. From
[`phase5/EPICS_STORIES.md`](../../phase5/EPICS_STORIES.md) changelog v1.26 (2026-08-13), during E18-S10:

> **`yarn install` cannot run anywhere in this workspace** — `@axiumine/marketplace-common` answers 404 on
> both registries and yarn 1 aborts the whole resolution over it — so the lockfiles were pruned by a
> rewriter proven byte-identical on an untouched control repo.

That is the trap in full: a stranger who clones this blueprint and runs the ordinary first command in any
of twelve repos gets a hard resolution failure, not a warning, and the recovery is a script they have not
read yet. An eight-hundred-line hand-written lockfile rewriter existed because of it.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **Publish to `registry.npmjs.org` under `@axiumine`, owner publishes by hand (chosen)** | `yarn install` resolves in all twelve consumers with no prior step; zero consumer edits, the pins were always real; the scope and the publish workflow are already proven by `@axiumine/koa-utils`; the library is independently usable, which is what "blueprint for the community" means past the workspace clone | A published version is a one-way door — npm's unpublish window is 72 hours and the name is held permanently afterwards; the owner's real name and address, already in `package.json:5`, gain a registry page; version discipline becomes permanent rather than local |
| Never publish; declare `deploy-local.sh` the permanent contract | No registry to maintain, no irreversible act, no second distribution surface to keep honest; the unit of distribution stays the whole workspace clone, which `git clone --recurse-submodules` already rebuilds | Freezes the 404 and the `yarn install` trap above as permanent properties of a *published blueprint*; contradicts the prepared state ADR-015 deliberately committed (`private: false`, `publishConfig`, an `upload` script), which would then all have to be reversed to mean anything |
| GitHub Packages, alongside the repositories | One host for source and artifact; org-scoped by construction | Needs an authenticated `.npmrc` to *install*, not only to publish — every clone of the blueprint would need a token before `yarn install` works, which is strictly worse than the trap it replaces. Nothing on disk points at it: every `publishConfig` and every `npmrc` template names `registry.npmjs.org` only |
| Keep it unpublished but record the ownership answer alone | Closes E09 §6 literally, with no irreversible act | Restates ADR-015's deferral under a new number and leaves the trap. Answers *who decides* while refusing to record *what they decided*, which is the half that changes anything |
| The LAN Verdaccio mirror (`yarnproxy.gio.lan:4873`) as the publish target | Already running; no public exposure | Resolves on one LAN. `scripts/lockfile-registry-filter.sh` exists precisely to keep that hostname *out* of committed lockfiles because *"a committed lockfile naming a host that only resolves on one LAN breaks `yarn install` for every clone that is not on it"* — publishing there would write the same defect into the dependency itself |

---

## Decision

**`@axiumine/marketplace-common` is published to `https://registry.npmjs.org/` with public access. The
platform owner runs the publish, personally, from a local checkout, and nobody and nothing else does.**

Four properties fix what that means:

1. **The publish is a manual act, deliberately.** `yarn upload` — `npm publish --registry=https://registry.npmjs.org/`
   — run by the owner. No CI job publishes. No hook publishes. **No npm auth token is committed to any repo,
   ever**; ADR-015 already lists a committed `.npmrc` token as a violation shape and that stays exactly as it
   was. The credential lives in the owner's own environment and nowhere in these sixteen repositories.

2. ⚠️ **`deploy-local.sh` is not deleted, and the manual step does not go away.** This is the single most
   likely wrong inference from this ADR, and ADR-015 already refused it in advance: the script's job is to
   close the gap *between* releases. An edit under `src/` is not on the registry until someone publishes it,
   so a workspace that deleted the script would silently run every consumer against the last **published**
   build instead of the last **written** one — a failure mode strictly worse than today's, because today's
   at least fails at the call site rather than resolving to something plausible and stale.
   **The rule in `CLAUDE.md` — run `./deploy-local.sh` after every edit to `marketplace-common` — is
   unchanged by this decision.**

3. **A publish is a version bump, and the range has to be able to reach it.** Consumers pin `^1.0.0`, so a
   `1.x` release reaches them on a plain `yarn install` and a `2.0.0` does not. `deploy-local.sh` already
   warns on a declared-range/built-version major mismatch; that warning now has a second meaning — it also
   predicts which consumers a real release would fail to reach.

4. **Publication does not weaken any gate.** The push gates (100% coverage on four metrics, mutation score
   100, Qodana, `test:contract`) are what a release is cut from, and `test:contract` in particular is what
   catches an `exports` entry missing from a file that would then be unreachable *for every consumer on the
   registry* rather than for one workspace. Nothing about publishing lowers a threshold or adds an exemption.

**On what is superseded.** ADR-015 said it would be "superseded, not revised" on this day, and it is —
**but only in its publication half.** Its other two decisions are load-bearing and outlive it: the
`deploy-local.sh` bridge (still the mechanism, per property 2) and the GPL-3.0-or-later licence with its
eighteen `LICENSE` copies and fifteen `qodana.yaml` key lists. Marking ADR-015 wholly superseded would
orphan a licence decision that nothing else records, so it is marked superseded **in part** and stays the
place both of those live.

---

## Consequences

### Positive
- `yarn install` works, in all twelve consumer repos, on a clone that is not this machine — for the first
  time. The workspace-wide "`yarn install` cannot run anywhere" state recorded in `EPICS_STORIES.md` v1.26
  ends, and with it the reason a hand-written lockfile rewriter had to exist.
- Nothing downstream changes shape: twelve `package.json` files already name the package and the range they
  would name against a real registry. The publish is the one operation ADR-015 designed the whole bridge to
  make into a no-op.
- The blueprint becomes readable in pieces. Someone who wants the Mongoose models and the GraphQL fragments
  without adopting sixteen repositories can now depend on them, which is what publishing a GPL library for a
  community is for.
- The ownership question is closed with a name rather than a role: one person, who also owns the code.

### Negative
- **The door only opens one way.** Once `1.0.0` is on the registry, that version is public forever in
  practice; npm allows unpublish for 72 hours and then holds the name. A mistake in a published tarball is
  corrected by publishing `1.0.1`, never by removing `1.0.0`.
- **A second distribution surface now has to stay honest.** The registry can disagree with the tree —
  a published version whose `dist/` predates a commit, or an `exports` map that shipped incomplete. Nothing
  in the push gates checks the registry, so this is discipline, exactly like `deploy-local.sh` is.
- **The author field becomes a registry page.** `package.json:5` carries the owner's real name, address and
  homepage, and npm renders them. They are already public in sixteen public repositories, so this widens the
  audience rather than the disclosure — but it is a deliberate widening, not a side effect nobody chose.
- `BEs/marketplace-common/CLAUDE.md:3` has said *"published to npm"* since before it was true. It becomes
  true on the day the first publish runs and not before; until then the sentence is still ahead of the fact.

### Risks
- **Publish-then-forget.** A release is cut and `deploy-local.sh` is then treated as obsolete, so the next
  edit reaches nobody and every consumer runs the last release. Revisit — by making `deploy-local.sh`'s
  absence from a workflow an explicit `pre-push` check in `BEs/marketplace-common/.githooks/` — the first
  time a consumer is found running published code where a working-tree change was expected.
- **Range drift becomes visible to strangers.** Today a stale major only affects this machine. After a
  release, a consumer whose `^1.0.0` cannot reach the current major fails for anyone who clones it. Revisit
  if `deploy-local.sh`'s major-mismatch warning fires on a release rather than on a local build.
- **Publishing under pressure.** The gates take tens of minutes (mutation alone), and the temptation on a
  bad day is to publish from a tree the gates have not passed. Revisit — by pinning the release to a pushed,
  gated commit — the first time a version is published from a dirty working tree.
- **Token handling.** The one credential this decision introduces lives outside the repositories by rule.
  A committed `.npmrc` is already a violation shape under ADR-015 and under
  [`.claude/SECRETS.md`](../../../../.claude/SECRETS.md); publishing makes that rule load-bearing rather
  than theoretical. Revisit nothing — treat a single occurrence as an incident.
- **This is not the git-hosting gap.** `ADR-INDEX.md` §5's *"where the sixteen repos get published, and
  under which org"* bullet stays open and is a different question with a different answer. Anyone reading
  this ADR as closing it is wrong; do not delete that bullet on the strength of this file.

---

## Compliance

The decision is recorded; the publish is the owner's act and is **not** performed by writing this ADR.

Verify the prepared state is still intact (this must hold whether or not a release has been cut):

```bash
cd BEs/marketplace-common
grep -n '"name"\|"private"\|"access"\|"registry"' package.json   # @axiumine/marketplace-common, false, public, registry.npmjs.org/
grep -n '"upload"' package.json                                   # npm publish --registry=https://registry.npmjs.org/
```

Verify the bridge is still the mechanism, not scaffolding — ADR-015 §Compliance is unchanged and still
applies in full: `./deploy-local.sh` after every edit under `src/`, `yarn test:contract` green.

Verify the release, once cut:

```bash
# 200, not 404 — this is the whole difference this ADR makes
npm view @axiumine/marketplace-common version
# and the range twelve consumers pin must be able to reach it
grep -rn '"@axiumine/marketplace-common"' ../dev/*/package.json ../../marketplace-*/package.json
```

A violation looks like:

- an npm auth token committed to any repository, in `.npmrc` or anywhere else — the single occurrence is an
  incident, not a finding;
- anyone other than the platform owner running `npm publish` / `yarn upload` for this package, or a CI job
  configured to;
- `deploy-local.sh` deleted, or a `CLAUDE.md` that stops requiring it after an edit — property 2 of
  §Decision is the reason it stays;
- a version published from a tree whose gates have not passed, or from a commit that was never pushed;
- this ADR cited as closing `ADR-INDEX.md` §5's git-hosting gap.
