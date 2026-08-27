# E09 — Platform Operations & Quality Gates
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.3
**Date:** 2026-08-26
**Author:** epics-agent
**Bounded context:** BC-09 — Platform Operations & Quality Gates
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
v1.1 - 2026-08-25: E09-S06's first acceptance criterion said the ShopOwner and public tiers "never write"
`itemCategory`. The public tier still does not; the ShopOwner tier does, in one field, since
`holdItemCategory` landed. The criterion now states the claim that actually holds — no `itemCategory`
mutation outside the Admin resource service — and names the exception so a future grep does not read it as
a regression. The story stays `built`: what it was written to protect, the depth cap having exactly one
enforcement point, is untouched.
v1.2 - 2026-08-26: §6's first open question removed as a duplicate, not closed as answered here. It restated `phase1/NFR.md` open question 1, which owns it; that question was closed 2026-08-26 when the platform owner decided GDPR is in scope, and the six unimplemented obligations continue as NFR.md open question 6. This context still owns no compliance decision, so a pointer replaces the restatement — the same treatment E08's duplicate got before that epic left `epics/`. §6's second question, who owns publishing `marketplace-common` past `deploy-local.sh`, is untouched and still live, so E09 stays under `epics/`.
v1.3 - 2026-08-26, later the same day: **that second question closed, and the file left `epics/` to become
this record**, for the reason §0 gives. The platform owner answered it directly — he owns
`marketplace-common` and every other repo here, this platform is a blueprint published for the community,
and `@axiumine/marketplace-common` goes to npmjs with him as the only publisher. That is
[`ADR-037`](../phase3/adr/ADR-037-marketplace-common-is-published-to-npm.md), which supersedes
[`ADR-015`](../phase3/adr/ADR-015-common-consumed-by-package-name-unpublished.md) **in part** — the
publication half only. ⚠️ **The question was also citing the wrong gap.** It pointed at `ADR-INDEX.md` §5's
*"where the sixteen repos get published, and under which org"*, which is about **git hosting**, not the npm
registry; the npm question had always been ADR-015 §Risks' own revisit trigger. §6 now cites what actually
owned it, and §5's bullet gained a clause saying ADR-037 does not close it. No story changed, no ID moved,
nothing was dropped — only the file's own relative links, which now resolve from `phase5/` rather than from
`phase5/epics/`, and one that was already wrong before the move: §3's schema-builder `README.md` pointed at
the workspace root's README rather than at `BEs/marketplace-db-setup/lib/schemas/README.md`, which is the
file the sentence around it is listing.

## 0. Why this record is not under `epics/`

It was `phase5/epics/E09.md` until 2026-08-26. The file was deleted and its record moved here in one pass,
the ninth to move for the reason [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md),
[`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md),
[`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md),
[`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md), [`CATALOGUE.md`](./CATALOGUE.md),
[`CATEGORY_TAXONOMY.md`](./CATEGORY_TAXONOMY.md),
[`CUSTOMER_ACCOUNT_ADDRESSES.md`](./CUSTOMER_ACCOUNT_ADDRESSES.md) and
[`PUBLIC_DISCOVERY_STOREFRONT.md`](./PUBLIC_DISCOVERY_STOREFRONT.md) moved before it: nothing in it is work
still ahead. All nine stories are `built` and §6 has no live question left — the first was a duplicate and
became a pointer on 2026-08-26, the second closed the same day by the owner's decision that ADR-037 records.
`EPICS_STORIES.md` §1 still says stories live in `epics/ENN.md`, and that stays true for E10..E19; E01..E09
are the nine whose records sit beside the index instead of under it.

**The story IDs did not change.** `E09-S01` … `E09-S09` keep their names and are cited as they are from
[`EPICS_STORIES.md`](./EPICS_STORIES.md) §2 and §4.

⚠️ **This is the first record to move on a decision that also supersedes an ADR.** The eight before it moved
when their last question was answered inside phase 5 or handed to the document that owned it. This one moved
because a phase-3 architectural decision was taken, so the closure lives in
[`ADR-037`](../phase3/adr/ADR-037-marketplace-common-is-published-to-npm.md) and §6 points at it rather than
restating it — the same discipline §6's first bullet already follows for `NFR-CO02`.

## 1. Epic goal

Keep every other context honest at commit/push time: coverage, mutation score, lint, Qodana, and the
immutable migration pipeline every context above builds its collections on. Produces no domain event —
pass/fail gate signals, migration `up`/`down` pairs, service-liveness probes only.

## 2. Scope

| In scope | Out of scope | Why |
|---|---|---|
| `.githooks/pre-commit` + `.githooks/pre-push` in all 16 repos (14 sub-repos + parent carry the code gates; `marketplace-nginx` gates on its own test suite and the secret guard, ADR-030) | Any domain resolver's business logic | This context proves correctness, never implements a feature |
| `BEs/marketplace-db-setup/migrations/` (immutable) + `lib/schemas/*.js` builders | Editing an applied migration | Immutability rule — a new shape is a new migration, not an edit |
| Each repo's `qodana.yaml`/`qodana.sh`/`stryker.config.mjs`/`vitest.config.mts` thresholds | Lowering any threshold to unblock a story | BCON-02, NFR-MA05 — the fix is always a test |
| `marketplace-services-status` (`server.ts`, `systemd.ts`, `monitor.ts`, `probe.ts`, `config.ts`) | Any repo of its own for `marketplace-services-status` | Deliberately tracked by the parent — no repo to give it |
| `core.hooksPath` wiring + each repo's `"prepare"` script | Forge-side branch protection | Where these repos get published is the platform owner's open call (`docs/workflow.md` §Repo layout) |

## 3. Build state

**Built, and the gate-wiring itself is the newest work in this context (2026-08-07).**

- Hooks: every sub-repo carries `.githooks/pre-commit` + `.githooks/pre-push` at mode `100755`; parent
  workspace carries its own at `.githooks/pre-commit`, `.githooks/pre-push` (confirmed present).
- Migrations: `BEs/marketplace-db-setup/migrations/` holds 7 files, oldest
  `20260301000000-create-admin.js`, newest `20260301000600-seed-demo.js` — six collection creates and
  one demo seed, no `collMod` anywhere (confirmed count and ordering on disk).
- Schema builders: `BEs/marketplace-db-setup/lib/schemas/` holds `account.js`, `admin.js`,
  `collection.js`, `company.js`, `encrypted.js`, `geo.js`, `item.js`, `itemCategory.js`, `shopOwner.js`,
  `user.js`, [`README.md`](../../../BEs/marketplace-db-setup/lib/schemas/README.md) (confirmed — this is the
  complete current set of schema builders).
- `marketplace-services-status` gate: `marketplace-services-status/src/server.ts`, `systemd.ts`, `monitor.ts`, `probe.ts`,
  `config.ts`, `types.ts` plus `marketplace-services-status/test/` holding `config.test.ts`, `monitor.test.ts`,
  `probe.test.ts`, `security.live.test.ts`, `security.test.ts`, `server.test.ts`, `systemd.test.ts` (7
  files, confirmed — matches the "7 test files, 379 tests" row in [`docs/frontends.md`](../../frontends.md) §Current suite sizes).
- Unit suites beside the end-to-end replay: `BEs/marketplace-db-setup/test/migrateMongoConfig.test.mjs`,
  `test/mongoUrl.test.mjs`, `test/encryption.test.mjs`, `test/migrationCalls.test.mjs` (confirmed
  present) — these are what let the 100% mutation threshold go in for db-setup.
- Decision record: [`docs/decisions/authorization-service-consolidation.md`](../../decisions/authorization-service-consolidation.md) (confirmed present) — the
  ADR-006-equivalent this epic's AV01/AV02 stories trace to.
- `.githooks/pre-commit` executability check for `qodana.sh`, confirmed at lines 237-251 (`for required
  in qodana.yaml qodana.sh; do` … `if [ ! -x "$APP_DIR/qodana.sh" ]`).

## 4. Stories

### E09-S01 — 100% coverage on all four metrics gates every push, in all 15 packages   `built`
Technical story: statements/branches/functions/lines all-or-nothing, no partial-credit threshold.
**domains:** testing, backend, frontend
**Acceptance criteria:**
- `thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }` present in
  `BEs/dev/marketplace-dev-user-authenticated-resource/vitest.config.mts:43`, and the same shape repeats
  across the 9 services, `marketplace-common`, `marketplace-db-setup`, the 3 frontends and
  `marketplace-services-status` — traces NFR-MA01.
- `.githooks/pre-push` runs `test:cov` before mutation and Qodana in every repo — grep
  `.githooks/pre-push` in any sub-repo for the ordered step list.

### E09-S02 — 100 Stryker mutation score gates every push, in all 15 packages   `built`
Technical story: coverage proves a line ran, mutation proves a wrong line would fail a test — both required.
**domains:** testing, backend, frontend
**Acceptance criteria:**
- `thresholds: { high: 100, low: 95, break: 100 }` present in each repo's `stryker.config.mjs` (confirmed
  `marketplace-services-status/stryker.config.mjs` on disk) — traces NFR-MA02.
- No `ignoreStatic` appears in any `stryker.config.mjs` on the platform — a genuine equivalent mutant is
  silenced with `// Stryker disable <Mutator>` plus a reason, never with `ignoreStatic` or a lowered
  `thresholds.break` (BCON-02).

### E09-S03 — `marketplace-services-status` gate now actually runs, closing a silent-pass hole   `built`
**As a** platform operator, **when** `marketplace-services-status` changes, **I want** its coverage/mutation/Qodana
gates to run from the parent's own hooks **so that** a change to code with no repo of its own is not
merged unverified.
**domains:** testing, infra
**Acceptance criteria:**
- Parent `.githooks/pre-commit` runs `yarn test:cov` and Qodana scoped to staged paths under
  `marketplace-services-status/` that are not `*.md` — confirmed hook file present at `.githooks/pre-commit`.
- `marketplace-services-status/qodana.sh` is executable (mode `100755`, git-tracked) — `pre-commit` lines 250-251
  block with the fixing command (`chmod +x` + `git update-index --chmod=+x`) rather than silently
  reporting "Qodana failed" against a SARIF that was never created. Traces NFR-MA03, NFR-MA04.

### E09-S04 — Executability is checked separately from existence for every hook-invoked script   `built`
Technical story: a `100644` mode dies with `Permission denied` before reaching the tool, and both old
hooks reported that identically to "Qodana failed" with no results directory — this is the fix.
**domains:** infra, testing
**Acceptance criteria:**
- `.githooks/pre-commit` tests `[ ! -x "$APP_DIR/qodana.sh" ]` as a distinct branch from
  `[ ! -f "$APP_DIR/qodana.sh" ]` (confirmed lines 237-251) — printing both fixing commands when the
  file exists but is not executable.
- Same two-branch check exists in `.githooks/pre-push` for every sub-repo's `qodana.sh` — grep any
  sub-repo's `pre-push` for the `-x` test before citing this as fixed platform-wide.

### E09-S05 — Migrations are immutable; a shape change is a new migration, never an edit   `built`
Technical story: the one deliberate exception (2026-08-04 rename) is recorded, not a precedent.
**domains:** database
**Acceptance criteria:**
- 7 files under `BEs/marketplace-db-setup/migrations/`, each named with an ascending timestamp prefix —
  confirmed on disk, oldest `20260301000000-create-admin.js`, newest
  `20260301000600-seed-demo.js`.
- A change to `lib/schemas/*.js` is followed by a full rebuild of every database that ran the affected
  migrations (`dbMarketplaceDev` dropped + replayed with `SEED_DEMO=true`, each repo's integration DB
  dropped by its own `globalSetup`) — no story here marks a schema edit "done" without that rebuild step
  named.

### E09-S06 — `itemCategory` depth cap lives in the resolver, and writes exist only on the Admin tier   `built`
Technical story: a `$jsonSchema` cannot read another document, so "my parent has no parent" cannot be
expressed at the database layer — the resolver is the only place this invariant can hold.
**domains:** backend, database
**Acceptance criteria:**
- `itemCategoryAdd`/`itemCategoryUpdate`/`itemCategoryDel` exist only under
  `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/` — no
  `itemCategory` mutation exists on any other tier (grep confirms no such file outside the admin
  resource service). ⚠️ **Not "no other tier writes the collection":** `holdItemCategory`
  (`BEs/dev/marketplace-dev-authenticated-resource/src/lib/item/holdItemCategory.mts:41-53`) `$inc`s
  `__v` on one category inside every `itemAdd`/`itemUpdate` transaction, so the item write and a
  concurrent `itemCategoryDel` collide instead of skewing past each other. It reaches no domain field
  and no `idParent`, so it cannot file a category at a third level — the cap below still has exactly
  one enforcement point.
- A parent argument that is itself a subcategory (has its own `idParent`) is rejected before the write —
  cite the resolver's own rejection branch, not the collection validator, when marking this built.

### E09-S07 — The three `*-authenticated-authorization` services stay three deployables, never merge   `built`
Technical story: decided against 2026-08-07, re-opening needs a fresh change request, not a refactor PR.
**domains:** backend, infra
**Acceptance criteria:**
- [`docs/decisions/authorization-service-consolidation.md`](../../decisions/authorization-service-consolidation.md) records the decision and its argument
  (confirmed present) — traces NFR-AV01.
- Each of the three services still calls `process.exit(1)` on an uncaught exception in its own
  `index.mts` — one process is one crash domain per tier; a story proposing a merged dispatcher on a
  tier value is a rejected design per this file, not an open option (BCON-06 territory — do not silently
  override a higher-ranked decision).

### E09-S08 — Logout stays the one shared, tier-blind service   `built`
Technical story: safe specifically because it never re-reads a tier-specific collection.
**domains:** backend
**Acceptance criteria:**
- `marketplace-dev-authenticated-logout`'s `start()` connects Redis only, no MongoDB — confirmed by its
  documented absence of a `MONGO_TEST_*` block in [`docs/testing.md`](../../testing.md)'s integration-database list.
- All three frontends (`marketplace-admin`, `marketplace-shopowner`, `marketplace-user`) point their
  logout call at port 4030 — traces NFR-AV02.

### E09-S09 — `engines.node` is `^24.18.0` in every repo with a `package.json`, hard-gated   `built`
Technical story: a mismatch is `exit 1` under yarn classic, not a warning, and `pre-push` selects the
pinned node via nvm before the first gate runs.
**domains:** infra, testing
**Acceptance criteria:**
- `BEs/dev/marketplace-dev-user-authenticated-resource/package.json:30-31` carries
  `"engines": { "node": "^24.18.0" }` — spot-checked on disk, matches [`docs/conventions.md`](../../conventions.md) §Node and package manager.
- `.githooks/pre-push` reads `engines.node` and switches via nvm before shelling to yarn in every repo
  that has one — traces NFR-PO01.

## 5. Dependencies

- Every other epic (E01-E08, E11) depends on this one landing first in the sense that its gates are what
  make any of their "built" claims verifiable — but this context ships nothing new to any of them; it is
  infrastructure, not a feature they consume at runtime.
- `BEs/marketplace-common`'s own gate (coverage + mutation + `test:contract`) is a precondition for
  `./deploy-local.sh` being trustworthy — BCON-07 still applies: a green gate in common is not a shipped
  change until deployed to consumers.
- Parent workspace's own `core.hooksPath` has no `package.json`/`prepare` script to restore it after a
  fresh clone — `git config core.hooksPath .githooks` must be run by hand there, unlike the 14 sub-repos that are
  packages.

## 6. Open questions

**None live.** Both are closed or owned elsewhere, which is why this record sits beside the index rather
than under `epics/` — see §0.

- `NFR-CO02` (GDPR applicability) — tracked at [`phase1/NFR.md`](../phase1/NFR.md) §Open questions.
  Not decided here: this context owns only the secret-handling layers under NFR-CO01/NFR-SE12. A pointer,
  not a question — it restated NFR.md's own open question 1, which was closed on 2026-08-26 when the
  platform owner decided GDPR is in scope; what remains of it continues as NFR.md open question 6, and none
  of the obligations there falls to this context.
- ~~No story here names who owns publishing `marketplace-common` past `deploy-local.sh` to a real npm
  registry.~~ **Closed 2026-08-26 by
  [`ADR-037`](../phase3/adr/ADR-037-marketplace-common-is-published-to-npm.md).** The platform owner owns
  `marketplace-common` and every other repo in this workspace, and decided that
  `@axiumine/marketplace-common` is published to `registry.npmjs.org` with public access, by him
  personally, with no CI job and no delegation — this platform is a blueprint published for the community,
  and a shared library that 404s is a step only its author can perform. ADR-037 supersedes
  [`ADR-015`](../phase3/adr/ADR-015-common-consumed-by-package-name-unpublished.md) **in part**: the
  publication half only, since ADR-015 also carries the `deploy-local.sh` bridge and the GPL-3.0-or-later
  licence decision, and neither is touched by a registry.
  ⚠️ **`deploy-local.sh` does not go away, and BCON-07 in §5 is unchanged.** A published release is not
  where an edit lands — the script is what closes the gap *between* releases, and a workspace that deleted
  it would silently run every consumer against the last published build. ADR-037 §Decision property 2 keeps
  it and lists its deletion as a violation shape.
  ⚠️ **This question had been citing the wrong gap.** It pointed at
  [`phase3/adr/ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §5's *"where the sixteen repos get published, and
  under which org"*, which is about **git hosting** — ADR-031's territory — not about the npm registry. That
  bullet is still open and ADR-037 does not close it. The npm question was ADR-015 §Risks' own revisit
  trigger from the day it was written; §5 now carries a clause saying so, so the two cannot be conflated
  again.
