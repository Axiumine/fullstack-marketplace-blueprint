# ADR-047 — a change to `marketplace-common` ships as a published release, and `deploy-local.sh` is deleted
# Marketplace

**Status:** accepted
**Date:** 2026-08-30
**Deciders:** platform owner, directly and in four words — *"never use `./deploy-local.sh` in your
development, always publish the package"*.
**Supersedes:** [`ADR-015`](./ADR-015-common-consumed-by-package-name-unpublished.md) **in part** — the
`deploy-local.sh` bridge, which was the one half of ADR-015 that ADR-037 deliberately left standing. Its
GPL-3.0-or-later licence decision is untouched and still lives there.
[`ADR-037`](./ADR-037-marketplace-common-is-published-to-npm.md) **in part** — §Decision property 2
(*"`deploy-local.sh` is not deleted, and the manual step does not go away"*) and the two violation shapes
that hang off it. Everything else in ADR-037 — the registry, the owner as the only publisher, no committed
token, no CI publish — is not merely untouched but is what this decision leans on.
**Superseded by:** —

---

## Context

ADR-015 (2026-08-04) had to answer *how does a consumer reach this library* while nothing was on any
registry, and answered it with a script: `BEs/marketplace-common/deploy-local.sh` built the package and
copied `dist/` and `package.json` into each of the twelve consumers' `node_modules/@axiumine/marketplace-common`.
ADR-037 (2026-08-26) put the package on `registry.npmjs.org` and kept the script anyway, on one argument,
written as property 2: a release is a point in time, an edit is continuous, and between the two the script
is the only thing that carries a change to a call site.

That argument was sound while a release was expensive and rare. Several releases on it is neither, and the
bridge's own costs have been paid in full and measured.

### What the bridge actually did, once the registry existed

- **It made "which build is this consumer running" a question about command order.** The two mechanisms
  write the same path. `./deploy-local.sh` puts the working tree there; a later `yarn install` in that
  consumer puts the released tarball back over it, silently and with no output that says so. The parent
  [`CLAUDE.md`](../../../../CLAUDE.md) carried a rule about the collision because the collision was real
  and could not be designed away while both mechanisms existed.
- **It produced a state no lockfile names.** A deployed build has no version, no integrity hash and no
  entry in `yarn.lock`. It cannot be reproduced on a second machine, in CI, or by the person who cloned
  the blueprint — which is the audience ADR-037 published the package *for*. A green test run in a
  consumer against a hand-copied build proves something about one directory, not about the package.
- **It let an edit be finished without being shipped.** The gates in `marketplace-common` are what a
  release is cut from, and they run on source. A consumer wired to a deployed build reports success on
  code that no `npm view` would return and no `yarn install` anywhere would fetch. The work looks done and
  is undistributable.

### What property 2 feared, and why that fear inverts

ADR-037 §Decision property 2 refused deletion because *"a workspace that deleted the script would
silently run every consumer against the last published build instead of the last written one"*. That is a
correct description of what deletion does, and it is now the **intended** state rather than the failure:
a consumer must run the last published build, because that is the only build anyone else can obtain. The
distance between the last written and the last published build is not a gap to be bridged — it is the
work of publishing, and leaving it un-done is the defect the bridge concealed.

A version number is the cheapest thing in this workspace. The release flow is nine steps
(`BEs/marketplace-common/CLAUDE.md` §The release flow), it is gated end to end by `pre-push`, and a patch
release costs minutes of wall clock and nothing else. The bridge saved those minutes by discarding
reproducibility, and did so on exactly the path where reproducibility is the product.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **Delete the script; every change reaches a consumer as a published release (chosen)** | One mechanism, so the question "what is in this `node_modules`?" has one answer and `yarn.lock` holds it; every consumer, on every machine, runs a build that exists on the registry; the gates that cut a release are the gates every consumer inherits; nothing to keep honest between two distribution surfaces | A version number per shippable edit, and the discipline to cut one; a change that spans common and a consumer lands in two steps, dependency first, and cannot be tested end to end until the first is published |
| Keep the script, ban it by convention | No file to remove; the fast local loop survives for whoever wants it | A convention against a script that is present, executable and documented is a convention that loses. ADR-037 §Risks already predicted the failure ("publish-then-forget") and proposed a `pre-push` check that was never written — the honest reading is that the shortcut wins whenever it is available |
| Keep the script but make it write a version — a prerelease tag published to the registry | Reproducible, lockfile-nameable, still fast | That is publishing, with a second version series to prune and a `dist-tag` to keep off `latest`. It buys back what deletion already gives, at the cost of the thing this platform has one of |
| `yarn link` / a `file:` path dependency for local iteration | No copy, no staleness, resolves from source | Rewrites twelve `package.json` files to a path that only exists on this machine, and ADR-015 already rejected it: a symlinked entry does not survive the `rsync` deploys or the tmpfs `node_modules` swap `dev.sh` performs |
| A workspace tool (`yarn workspaces`, pnpm, Nx) spanning the sixteen repos | Kills the question outright — one install, one resolution graph | Contradicts ADR-001 and ADR-031 on purpose: sixteen independent checkouts with independent history is the shape of this blueprint, not an accident of tooling |

---

## Decision

**A change to `@axiumine/marketplace-common` reaches a consumer by being published, and by nothing else.
`deploy-local.sh` is deleted, and no script, hook, alias or documented manual step may put a locally built
copy of this package into any consumer's `node_modules` again.**

1. **The nine-step release flow is the only path**, in full and every time: branch, `npm version
   --no-git-tag-version`, CHANGELOG, merge `--no-ff`, annotated tag, `git push --follow-tags` (which runs
   the whole gate), `yarn upload`, verify with `npm view`, then move each consumer's range as separate work
   in that consumer's own repo. Steps are not skipped for a small change; a small change is what a patch
   release is for.
2. **A consumer resolves this package from `registry.npmjs.org` through its own `yarn.lock`, always.**
   `yarn install` is authoritative — there is no state it can destroy, which is the property the bridge
   took away and this decision gives back.
3. **Local iteration happens in `marketplace-common`, not in a consumer's `node_modules`.** `yarn test`,
   `yarn test:types` and `yarn test:contract` exercise the library where it lives; the contract test is
   specifically what catches an `exports` entry that would be unreachable for every consumer on the
   registry.
4. **An edit worth a call site is an edit worth a version number.** If a change is not worth publishing,
   it is not worth a consumer running it.

**On what is superseded.** ADR-037's property 2 is reversed and its two matching violation shapes
(*"`deploy-local.sh` deleted"* and *"a `CLAUDE.md` that stops requiring it"*) are reversed with it — those
two lines now describe compliance rather than violation. ADR-015 keeps its licence half and its record of
why the bridge was right in 2026-08-04, when the alternative was a 404.

---

## Consequences

### Positive
- **One mechanism, one answer.** What a consumer runs is what its lockfile names, on every machine, with
  no dependence on which command ran last.
- **The gate reaches the consumer.** 100% coverage on four metrics, mutation 100, Qodana and
  `test:contract` are cut into every artefact a consumer can install, because installable and gated are now
  the same act.
- **The blueprint's own instructions became runnable by a stranger.** No step in `SETUP.md` requires a
  script that only exists inside this workspace; `yarn install` is the whole story.
- **The parent `CLAUDE.md` loses a rule instead of gaining one** — the deploy/install collision it had to
  warn about cannot occur.

### Negative
- **The version series grows faster.** Changes that would once have been carried locally now each take a
  number, so the CHANGELOG holds releases whose diff is small. That is a cost in numbers, which are free.
- **A cross-repo change is two landings.** Common first, published; consumer second, against the published
  range. This was always the rule (ADR-031's "land dependencies first"); it is now enforced by the absence
  of a shortcut rather than by discipline.
- **A mistake ships.** A bad build reaches consumers only when someone installs it — but it is on the
  registry, and npm's unpublish window is 72 hours. The correction is a release, never a removal (ADR-037).

### Risks
- **Someone rewrites the script.** Ten lines of `rsync` reproduce it, and the temptation is highest on the
  day a release feels expensive. Revisit nothing — treat any local-copy path into a consumer's
  `node_modules` as a violation and delete it.
- **Publish-under-pressure moves up a level.** ADR-037 already names it; removing the shortcut removes the
  alternative to publishing, so the pressure lands on the gates instead. The answer is unchanged and is not
  negotiable: a release is cut from a pushed, gated commit or it is not cut.
- **A consumer's range stops reaching the current major.** Every major needs twelve `package.json` edits,
  and the old major-mismatch warning lived in the deleted script. The check is now step 9's `npm view` against
  the ranges: `grep -rn '"@axiumine/marketplace-common"' BEs/dev/*/package.json marketplace-*/package.json`.

---

## Compliance

```bash
# the script is gone and stays gone
test ! -e BEs/marketplace-common/deploy-local.sh && echo "absent, as decided"

# nothing anywhere tells a reader to run it, and no package script wraps it
grep -rIn "deploy-local" --exclude-dir=node_modules --exclude-dir=.git .   # only this ADR, ADR-015, ADR-037 and the CHANGELOG entry that records the deletion

# every consumer resolves the published package, and the range can reach it
npm view @axiumine/marketplace-common version
grep -rn '"@axiumine/marketplace-common"' BEs/dev/*/package.json marketplace-*/package.json
```

A violation looks like:

- `deploy-local.sh` recreated under any name, or any `rsync`/`cp`/`yarn link`/`file:` path that writes a
  local build into a consumer's `node_modules/@axiumine/marketplace-common`;
- a `package.json` script, git hook or `dev.sh` step that performs a local deploy of this package;
- documentation — parent `CLAUDE.md`, `SETUP.md`, a repo `README.md`, a phase document — instructing a
  reader to sync common locally after an edit, rather than to publish;
- an edit under `BEs/marketplace-common/src/` that a consumer is expected to run before a release carries
  it;
- a consumer whose `node_modules` copy of this package does not match the version its `yarn.lock` names.
