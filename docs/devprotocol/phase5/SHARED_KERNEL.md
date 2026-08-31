# Shared Kernel (marketplace-common)
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.8
**Date:** 2026-08-30
**Author:** records-agent
**Bounded context:** BC-10 — Shared Kernel (marketplace-common)
**Changelog:** v1.8 - 2026-08-30: **The story that a published release is the only way an edit reaches a consumer is rewritten around the decision that replaced its subject.**
[`ADR-047`](../phase3/adr/ADR-047-a-common-change-ships-as-a-published-release.md) deletes
`deploy-local.sh`, so the story's obligation moves from *sync the build* to *publish the release*: the story
keeps the same domain and the same place in the landing order, and gains an acceptance criterion that can
now be checked by `npm view` rather than by a directory listing. §2's ownership table and §3's build state
lose the bridge row with it, and §5's landing order says "publish a release" where it said "run the script".
v1.3 - 2026-08-27: The "not in the kernel" row said no BC-11 shape exists to import. ADR-038 (2026-08-27) makes cart, order, delivery and payment permanently out of scope, so no shape will ever exist to import either.
v1.2 - 2026-08-27: Question 2's answer was upgraded from inference to proof: the Cloud project is named on
disk, so the four repos `phase1/NFR.md` open question 4 called project-less are provisioned too, and that
question, `PDR.md` §8 item 8, `SYSTEM_CONTEXT.md` §7 question 4, `RISK_REGISTER.md` R38 and `README.md` were
all corrected in the same commit rather than flagged.
v1.1 - 2026-08-27: both §6 open questions closed, §6 now reads "None open".
Question 1 — the platform owner stated no further backend service is planned, so the "does a 4th tier share
the authz body or copy it first" fork has no premise; recorded with its re-open trigger rather than deleted,
since the answer is "moot", not "shared". Question 2 — `marketplace-common`'s Qodana Cloud project is
provisioned: a repo-unique `QODANA_TOKEN`, a `qodana.sh` that fails closed without it, and no repo-level
`SKIP_QODANA`; the same check found `phase1/NFR.md` open question 4's 4-repo gap list stale, flagged there
rather than edited here. No story, criterion, scope row or status changed.
v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.

## 1. Goal

Keep the code every backend service compiles against directly — Mongoose models, tier assertion,
session resolution, the disabled/deleted guard — correct, deployed, and gated at 100/100. This context
ships no resolver and no schema of its own (`phase2/BOUNDED_CONTEXT.md:181` "Does not own: any
resolver, any GraphQL schema slice, any route"); it ships the substrate 8 of the 9 services (7 of 9
minus `marketplace-dev-authenticated-logout`, which touches Redis only) import at compile time.

## 2. Scope

| In scope | Out of scope | Why |
|---|---|---|
| `Tier`, `assertTier`, `checkUserAuthorizationDisDel` | A `role` field/enum | Banned term, `phase2/UBIQUITOUS_LANGUAGE.md:79` — role = which collection you authenticate against |
| `resolveAuthorizationSession`, `findAccountForSession`, `refreshSessionTokens` (shared authz body) | Merging the 3 `*-authenticated-authorization` deployables into 1 process | Decided against 2026-08-07, [`docs/decisions/authorization-service-consolidation.md`](../../decisions/authorization-service-consolidation.md); NFR-AV01 |
| The 6 Mongoose models (`Admin`, `ShopOwner`, `Company`, `User`, `Item`, `ItemCategory`) | A shop/collection model | Never existed, never will — a shop IS a `company` |
| `package.json` `exports` map (216 entries, no barrel) | Who runs the publish, and on what cadence | ⚠️ **Corrected 2026-08-26 by [`ADR-037`](../phase3/adr/ADR-037-marketplace-common-is-published-to-npm.md)** — this row read *"Publishing to a real npm registry / 404s by design"* until then. The package is on `registry.npmjs.org`, published by the platform owner personally. ⚠️ **Corrected again 2026-08-30 by [`ADR-047`](../phase3/adr/ADR-047-a-common-change-ships-as-a-published-release.md)**: `deploy-local.sh` is deleted, so there is no between-releases bridge and BC-10 owns the `exports` map only — a change reaches a consumer as a published version or not at all |
| The published release (`yarn upload`) the nine consumers install | Any resolver, any GraphQL schema, any route | BC-10 owns compile-time surface only — a published version is the whole delivery mechanism (ADR-047) |
| `assertTurnstile` (fail-closed anti-bot gate) | Cart/Order/Delivery/Payment models | BC-11 `WILL NOT BUILD` — no shape exists to import and none ever will ([ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note 2026-08-27) |

## 3. Build state

**Built.** This context has shipped since before the customer tier existed and grew a
Koa/GraphQL-shaped surface on 2026-08-07.

- Tier constant: `BEs/marketplace-common/src/others/Tier.mts` — `TIER = { admin, shopOwner, user }`.
- Tier assertion: `BEs/marketplace-common/src/others/assertTier.mts:21-23` — `if (actual !== expected)
  throw throwForbiddenError()`.
- Disabled/deleted guard: `BEs/marketplace-common/src/others/checkUserAuthorizationDisDel.mts`.
- Shared authz body: `BEs/marketplace-common/src/others/resolveAuthorizationSession.mts`,
  `findAccountForSession.mts`, `refreshSessionTokens.mts`.
- Fail-closed anti-bot: `BEs/marketplace-common/src/others/assertTurnstile.mts:26,29-32`.
- Models: `BEs/marketplace-common/src/models/MongoDB/{Admin,ShopOwner,Company,User,Item,ItemCategory}.mts`.
- Exports map: `BEs/marketplace-common/package.json` — 216 `"key":` entries (`grep -c '":'`), no barrel.
- Release: `BEs/marketplace-common/package.json` `scripts.upload` — `npm publish --registry=https://registry.npmjs.org/`,
  the only channel into a consumer since ADR-047. There is no local deploy script and there must not be one.
- Gates: `BEs/marketplace-common/vitest.config.mts`, `stryker.config.mjs`, `test/` (unit + `test:contract`
  + `test:int` + `test:types`), `test:contract` script at `package.json:24`.
- Consolidation record: [`docs/decisions/authorization-service-consolidation.md`](../../decisions/authorization-service-consolidation.md).

## 4. Stories

### Tier constant and assertion stay the single trust boundary   `built`
Technical story. Every resource/authorization service (except logout) must call `assertTier(actual,
expected)` before trusting `ctx.state.user`, and a missing `tier` on a session must reject, never
wildcard.
**domains:** backend, testing
**Acceptance criteria:**
- `BEs/marketplace-common/src/others/assertTier.mts` throws `throwForbiddenError()` (HTTP 403, not 401)
  on `actual !== expected`, including `actual === undefined`.
- `BEs/marketplace-common` sits at 100% coverage on all 4 metrics and a 100 Stryker mutation score
  (`vitest.config.mts` thresholds, `stryker.config.mjs` `thresholds.break: 100`) — NFR-MA01, NFR-MA02.
**Traces:** NFR-SE01, NFR-SE05, NFR-SE06, ADR referenced at [`docs/decisions/authorization-service-consolidation.md`](../../decisions/authorization-service-consolidation.md).
**Evidence:** `BEs/marketplace-common/src/others/assertTier.mts:21-23`, `BEs/marketplace-common/src/others/Tier.mts:12-18`.

### Shared authorization body serves 3 tiers, deployables stay 3   `built`
Technical story. `resolveAuthorizationSession`, `findAccountForSession`, `refreshSessionTokens` are
the one body every `*-authenticated-authorization` service (except public) calls into; each service
still supplies only its own `TIER.*`, model and projection, and each remains its own `process.exit(1)`
crash domain.
**domains:** backend, testing
**Acceptance criteria:**
- `BEs/dev/marketplace-dev-authenticated-authorization/src/graphQLApi/schema/mutations/refresh.mts`
  calls `refreshSessionTokens` from `@axiumine/marketplace-common`, not a local copy.
- 3 `*-authenticated-authorization` services remain 3 separate deployables — no shared `process.exit`
  domain — per NFR-AV01, not re-opened as a refactor (`docs/decisions/authorization-service-consolidation.md`).
**Traces:** NFR-AV01, NFR-AV02, ADR-006 (per `phase4/API_CONTRACTS.md:341`).
**Evidence:** [`docs/decisions/authorization-service-consolidation.md`](../../decisions/authorization-service-consolidation.md), `BEs/marketplace-common/src/others/resolveAuthorizationSession.mts`.

### a published release is the only way an edit reaches a consumer   `built`
Technical story. `marketplace-common` is consumed by package name (`@axiumine/marketplace-common`) from
`registry.npmjs.org`, so an edit under `src/` reaches the nine services when it is **published** — bump,
changelog, merge, tag, gated push, `yarn upload`, then move each consumer's range — and at no other moment.
⚠️ **This story's subject has been replaced twice, and it stays the same story rather than being split into
a new one.** It was written on
2026-08-07 as *"`deploy-local.sh` is the only publish channel"*, when nothing was on any registry and the
second criterion proved the script mandatory by proving the package 404s.
[`ADR-037`](../phase3/adr/ADR-037-marketplace-common-is-published-to-npm.md) (2026-08-26) put the package on
the registry and kept the script as a between-releases bridge; four days later
[`ADR-047`](../phase3/adr/ADR-047-a-common-change-ships-as-a-published-release.md) **deleted the script** on
the platform owner's ruling. What that reverses is a mechanism, not this story's obligation: the kernel's
edits must reach its consumers by a route both can name. The route is now a version number.
**domains:** backend, infra
**Acceptance criteria:**
- `BEs/marketplace-common/deploy-local.sh` **does not exist**, and nothing — script, hook, `dev.sh` step,
  `yarn link`, `file:` path — writes a locally built copy of this package into a consumer's `node_modules`
  (ADR-047 §Compliance).
- An edit under `BEs/marketplace-common/src/` is invisible to all 9 services until a release carrying it is
  published *and* that consumer's range and `yarn.lock` reach it. `npm view @axiumine/marketplace-common
  version` is the check, and it answers for every machine rather than for this one (NFR-PO04, ADR-047).
**Traces:** NFR-PO04, BCON-07 (`phase5/CONSTRAINTS.md` §3), ADR-037 (supersedes ADR-015 in part), ADR-047
(supersedes ADR-015 and ADR-037, each in part).
**Evidence:** `BEs/marketplace-common/package.json` `version` + `publishConfig.registry` +
`scripts.upload`; the declared range in each of the twelve consumers' `package.json`; `BEs/marketplace-common/CLAUDE.md`
§The release flow.

### Every file reachable only via the `exports` map   `built`
Technical story. No barrel export exists; an unlisted file is unreachable by any consumer. Adding a
file to `marketplace-common` requires a matching `exports` entry.
**domains:** backend, testing
**Acceptance criteria:**
- `BEs/marketplace-common/package.json` `exports` block carries 216 keys (`grep -c '":' package.json`
  inside the `exports` object), one per reachable subpath.
- `yarn test:contract` (`vitest.contract.config.mts`) fails when a source file has no corresponding
  `exports` entry.
**Traces:** NFR-PO04.
**Evidence:** `BEs/marketplace-common/package.json:44` (`"exports"` key), `test:contract` script at `package.json:24`.

### Koa/GraphQL-shaped surface still needs both mocks inlined in mutation testing   `built`
Technical story. `vitest.mutation.config.mts` in every consumer of the shared authz body must inline
both `@axiumine/marketplace-common` and `@axiumine/koa-utils`, or a `vi.mock` of a koa-utils
subpath silently stops intercepting mid-mutation-run.
**domains:** backend, testing
**Acceptance criteria:**
- `BEs/dev/marketplace-dev-authenticated-authorization/vitest.mutation.config.mts` lists both packages
  under its inline/deps config.
- `yarn test:mutation` in that service reaches a 100 Stryker score with no survivor traceable to a
  koa-utils mock miss (NFR-MA02).
**Traces:** NFR-MA02, NFR-MA05.
**Evidence:** `BEs/dev/marketplace-dev-authenticated-authorization/vitest.mutation.config.mts`.

### Anti-bot gate fails closed, only in production   `built`
Technical story. `assertTurnstile` must throw when no Turnstile secret is configured and
`NODE_ENV === 'production'`; outside production a missing secret is a no-op, never a silent bypass in
prod.
**domains:** backend, testing
**Acceptance criteria:**
- `BEs/marketplace-common/src/others/assertTurnstile.mts:26,29-32` throws `throwForbiddenError()` when
  `!secret && process.env.NODE_ENV === 'production'`.
- A unit test in `BEs/marketplace-common/test/` exercises both the production-missing-secret branch and
  the non-production branch.
**Traces:** NFR-AV03.
**Evidence:** `BEs/marketplace-common/src/others/assertTurnstile.mts:26,29-32`.

### 6 Mongoose models are the only schema source 7 consumers import   `built`
Technical story. `Admin`, `ShopOwner`, `Company`, `User`, `Item`, `ItemCategory` models live once, in
`marketplace-common`, imported directly (compile-time, not network) by every service that touches Mongo.
**domains:** backend, database
**Acceptance criteria:**
- `BEs/marketplace-common/src/models/MongoDB/` contains exactly `Admin.mts`, `Company.mts`,
  `Item.mts`, `ItemCategory.mts`, `ShopOwner.mts`, `User.mts` plus a `sub/` directory — no 7th model,
  no shop/collection model.
- Every resource service under `BEs/dev/*-resource` imports its models from
  `@axiumine/marketplace-common/models/...`, never redeclares a schema locally.
**Traces:** NFR-SE11 (validator lives in `marketplace-db-setup`, model shape here must match it).
**Evidence:** `BEs/marketplace-common/src/models/MongoDB/` listing (`Admin.mts`, `Company.mts`, `ItemCategory.mts`, `Item.mts`, `ShopOwner.mts`, `User.mts`, `sub/`).

## 5. Dependencies

- **Upstream of everything.** BC-01, BC-02, BC-03, BC-04, BC-05, BC-06, BC-07, BC-08 all import this
  context at compile time (`phase2/BOUNDED_CONTEXT.md` §4 relationship table). Nothing elsewhere in this
  phase can land ahead of this context's build state — it already exists, so this is a standing constraint,
  not a landing order: any story elsewhere that edits a model or an `others/` helper is really a change to
  this context, followed by a **published release** of `marketplace-common`, followed by a separate
  per-consumer commit that moves
  the range (BCON-05, BCON-07, ADR-047).
- **Downstream of nothing** inside this platform — BC-10 consumes no other context
  (`phase2/BOUNDED_CONTEXT.md:181` "Consumes: nothing from the other contexts").
- **Ordering & fulfilment (permanently out of scope) never had a design, so it never added anything here,
  and now never will.** Had BC-11 been built, it would have needed a 7th Mongoose model in this kernel
  alongside the six in §3 above, and a new `TIER`-scoped service pair to go with it —
  `phase2/UBIQUITOUS_LANGUAGE.md` "Service pair": "A fifth tier means a fifth service pair, not a role
  check bolted onto the existing ones." Which of the two it would have been — a genuinely new tier with
  its own service pair, or a new *concern* folded into one of the three tiers that already exist — was
  never settled: it closed as **moot**, not answered, alongside four other questions the same day —
  [ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md).
  This context ships nothing for it, permanently, not provisionally: see ADR-038 §Note, which now carries
  it.

## 6. Open questions

**None open.** Both questions this retrofit raised were closed on 2026-08-27; they stay listed with their
answers rather than deleted, because one carries a re-open trigger and the other bounds how far it was
verified.

- Should the shared authz body (`resolveAuthorizationSession`/`findAccountForSession`/
  `refreshSessionTokens`) grow a 4th caller if a 4th tier is ever added, or does a 4th tier get its own
  body copy first and consolidate later the way the first 3 did? **Closed 2026-08-27 — moot, no 4th
  tier is coming.** The platform owner stated no further backend service is planned, so the premise the
  question rests on does not occur. This does not overturn anything: it aligns this context with the constraint
  the rest of the corpus already carries — `phase4/CONSTRAINTS.md` §"No new tier" (`admin`/`shopOwner`/`user`
  stays 3, and no `role` field as a shortcut around a 4th), `phase4/ERD.md` §"A fourth tier". The shared
  body therefore stays a 3-caller body, [`docs/decisions/authorization-service-consolidation.md`](../../decisions/authorization-service-consolidation.md)
  stays scoped to the 3-tier case it actually argues, and no generalisation of it is owed. ⚠️ **Re-open
  trigger, not a re-litigation:** if a 4th tier is ever added despite this, the copy-first-consolidate-later
  order the first 3 followed is the untested question again — the shared body was extracted *after* three
  callers had proven identical, and nothing here claims it generalises to a caller nobody has written.
  What stays closed either way is option (a), one dispatching service: rejected on doctrine (ADR-002,
  "not a role check bolted onto the existing ones") and on NFR-AV01 crash-domain isolation.
- `marketplace-common` has no Qodana Cloud project gap noted anywhere for itself (unlike
  `marketplace-services-status`/`marketplace-user`/the 2 user-tier services, `phase1/NFR.md` open question 4) — is
  that confirmed provisioned, or simply unchecked? **Closed 2026-08-27 — provisioned, and the silence was
  accurate.** The Cloud project is **`MP common`, id `b892b`** — named on disk by this repo's own last scan,
  in `.qodana/results/open-in-ide.json`, alongside the origin URL `Axiumine/marketplace-common`. Around it:
  `qodana.yaml`, a `qodana.sh` that fails closed on a missing `QODANA_TOKEN` (`"QODANA_TOKEN missing or
  empty"`, `exit 1`) rather than degrading to an unauthenticated scan, and a token distinct from all 14
  others — every repo shipping a `qodana.sh` holds a different value, compared by hash without any value
  being read out. Neither hook carries a repo-level skip: `SKIP_QODANA` appears in `.githooks/pre-commit` and
  `.githooks/pre-push` only as the documented one-shot bypass an admin types, never as a default this repo
  sets. This context was absent from the NFR-MA03/MA04 gap list because it does not belong in it. ⚠️ **The same
  artefact closed a gap outside this record's own scope.** All 15 repos that ship a `qodana.sh` name a distinct project
  — including the four `phase1/NFR.md` open question 4 called project-less: `MP Service Status` (`xPKXD`),
  `MP User` (`dXO5E`), `MP User Authenticated Authorization` (`B5NEV`) and `MP User Authenticated Resources`
  (`eobk1`). So the `SKIP_QODANA=1` workaround those documents describe is provisioned away, and `NFR.md`
  question 4, `PDR.md` §8 item 8, `SYSTEM_CONTEXT.md` §7 question 4, `RISK_REGISTER.md` R38 and `README.md`
  §Linter version were corrected in the same commit as this closure rather than left disagreeing with it.
  ⚠️ **What the artefact does not prove** is that a project is still reachable *now* — it records where the
  last scan landed, not the state of the account today. A scan is what would prove that, and running one
  spends the token.
