# Definition of Done
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.2
**Date:** 2026-08-07
**Author:** dod-agent
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
v1.1 - 2026-08-11: §2.1 and §3 no longer require a story or an epic to map onto a bounded context — that
rule was removed from [`CONSTRAINTS.md`](./CONSTRAINTS.md) §5, which records the decision. The same edit
corrects the story-id spelling from `BC-0N-0X` to the `ENN-SNN` every story has always used, which
[`CONFLICT_REPORT.md`](./CONFLICT_REPORT.md) C02 fixed in `CONSTRAINTS.md` and missed here.
v1.2 - 2026-08-11: Mutability no longer requires a team vote — single developer.
**Depends on:** `phase1/PDR.md` ✅ · `phase1/NFR.md` ✅ · `phase4/ERROR_HANDLING.md` ✅ · `phase5/CONSTRAINTS.md` ✅
**Mutability:** the platform owner decides — no vote exists, there is one developer. Record the reason in the
changelog above; a change here affects all open stories.

---

## 1. Purpose

Gate already exist. Live, running, in every repo hook, today — not a proposal. This doc writes the gate
down; it does not invent one. "Done" at story, epic, phase-gate or sprint level means: pass every
mechanical check below, cite the path that proves it, never a feeling. "Works well" / "performs well"
with no gate named is banned as an acceptance criterion (BCON-01, `phase5/CONSTRAINTS.md` §3). Machine
verdict beats judgment call every time — that is standing doctrine here (`CLAUDE.md` §Rules that apply to every task, "Never lower a coverage or mutation threshold, and never remove a gate") — and this
document is that doctrine in checklist form.

---

## 2. Story-level DoD

### 2.1 Functionality
- [ ] Story carries id `ENN-SNN` (`E01-S01`, `E01-S02`, …) numbered sequentially inside its epic — never a
  global counter, and never the bounded-context id (`phase5/CONSTRAINTS.md` §5). A story is **not** required
  to map onto a bounded context, and naming one is never a criterion.
- [ ] Story for already-running code is marked BUILT and cites the path proving it — never phrased as
  still-to-build. Built-vs-planned split follows [`CLAUDE.md`](../../../CLAUDE.md)'s §Build state table exactly
  (`phase5/CONSTRAINTS.md` §5).
- [ ] Story never designs order, cart, delivery or payment shape. `item` deliberately carries no `price`
  field (ADR-009). A gap here is a risk-register row, never a story with acceptance criteria
  (`phase5/CONSTRAINTS.md` §6).
- [ ] Every acceptance criterion is mechanically checkable — a gate name, a test file path, an `.explain()`
  output — never a feeling (BCON-01).

### 2.2 Code quality
- [ ] `yarn lint:check` clean over the WHOLE tree — tests, configs, yaml included, not just `src/`. See the
  lint gate in `BEs/dev/marketplace-dev-user-authenticated-resource/.githooks/pre-push:121-141`.
- [ ] Indentation is tabs, enforced by eslint `indent: ['error','tab']` **and** prettier `useTabs: true`
  together (ADR-024) — a file reindented with spaces fails both identically.
- [ ] Type-check clean: `tsc --noEmit` (frontends) or the `yarn build` half of `test:cov` (backend services
  and `services-status`, whose `test:cov` is literally `yarn build && vitest run --coverage` —
  `services-status/.githooks` reasoning documented at `.githooks/pre-push:112-119` of this parent repo).
- [ ] No `ignoreStatic` added to any `stryker.config.mjs` to silence a survivor, ever (`docs/testing.md` §Mutation testing traps; BCON-02).
- [ ] `engines.node` reads `^24.18.0` in every touched `package.json` — bumping it means bumping all 14
  repos that have one, in one sweep, caret included (ADR-026).

### 2.3 Error handling
- [ ] Every user-facing failure routed through `throwGraphQLError(status, title, description)` or a named
  wrapper — never a bare `new Error()` in a resolver (`phase4/ERROR_HANDLING.md` §2).
- [ ] 401/403 distinction held: `assertTier` answers 403, never 401, on a foreign-tier token — caller
  authenticated correctly, just the wrong door (ADR-004; `phase4/ERROR_HANDLING.md` §2, §8).
- [ ] Any account-existence-leaking path (login, password reset) answers the SAME generic envelope for
  unknown-email / wrong-password / deleted / disabled / unconfirmed-email — no branch gets a more specific
  message (`phase4/ERROR_HANDLING.md` §2).
- [ ] A mutation returning `true`/success asserts `matchedCount`/`modifiedCount` (or driver equivalent)
  before returning it — absence of a thrown error is not proof of a write. `funUserAddressDel` shipped
  without this check and silently no-op'd (`phase4/ERROR_HANDLING.md` §2, "Layer 8").
- [ ] `checkRequiredEnv` fails closed at boot on any empty/absent required var — no default, no
  partial-service mode (`phase4/ERROR_HANDLING.md` §2, §8).
- [ ] No secret value (`KEYGRIP_KEK`, `REDIS_PASSWORD`, `INTROSPECTION_CODE`, `DSN`, `MONGODB_URI`,
  `QODANA_TOKEN`, npm token, stack trace) ever reaches a GraphQL response body or a client-visible log line
  (`phase4/ERROR_HANDLING.md` §4, §8; `phase3/SECURITY_AUTH.md` §4).

### 2.4 Testing
- [ ] `yarn test:cov` reports 100% on statements/branches/functions/lines. Example:
  `BEs/dev/marketplace-dev-user-authenticated-resource/vitest.config.mts:43` —
  `thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }`.
- [ ] `yarn test:mutation` reports Stryker score 100. Example:
  `BEs/dev/marketplace-dev-user-authenticated-resource/stryker.config.mjs:47` —
  `thresholds: { high: 100, low: 95, break: 100 }`. `break: 100` fails the whole run below that.
- [ ] Integration test FILE COUNT verified per vitest project, never just the green checkmark — a project
  with zero matching `*.itest.mts` files still reports success at 100% coverage.
  `marketplace-dev-user-authenticated-resource` shipped exactly this gap before 2026-08-07, and the day
  files landed every address delete answered 500 (BCON-04).
- [ ] Integration suite seeds through the raw Mongo driver, never the Mongoose model — several models
  disagree with their own collection's `$jsonSchema`. Every seeded `_id` and Redis key registered in a
  module-level array AT CREATION TIME, drained in `afterAll` (BCON-09).
- [ ] Coverage FILE LIST checked, not just the percentage — v8 coverage reports only a file it saw loaded;
  an unloaded file is absent from the report rather than listed at 0%, so a 100% threshold can pass
  vacuously over it (`docs/testing.md` §Traps that make a green run lie, "v8 coverage only reports files it saw loaded").
- [ ] Cross-repo value agreement (shared secret, signed-cookie key pair, Redis key shape) named with an
  explicit verification step (fingerprint sweep, manual diff) — no automated test spans two services on
  this platform, by construction (BCON-03).

### 2.5 NFR compliance
- [ ] NFR-SE01–SE09 (🔴 Critical) — every `*-authenticated-resource` / `*-authorization` service asserts
  its own tier via `assertTier(actual, expected)` on every request; a missing `tier` field is rejected,
  never treated as a wildcard (ADR-004; `phase3/SECURITY_AUTH.md` §3.3).
- [ ] NFR-SE11, SE12 (🔴 Critical) — no undeclared field accepted silently: `$jsonSchema`
  `additionalProperties: false` rejects it as a Mongo validation error, translated to 400, never dropped
  (DCON-02).
- [ ] NFR-AV01, AV02 (🔴 Critical) — the three `*-authenticated-authorization` services stay 3 separate
  deployables sharing one body via `marketplace-common`; never merged into one process dispatching on tier
  (ADR-006, decided against 2026-08-07).
- [ ] NFR-MA01, MA02, MA05 (🔴 Critical) — 100% coverage on all 4 metrics + 100 Stryker score, enforced 4
  times over (`vitest.config.mts` thresholds, `qodana.yaml` `testCoverageThresholds`, `.githooks/pre-commit`,
  `.githooks/pre-push`); never lowered.
- [ ] NFR-CO01 (🔴 Critical) — no secret read, echoed, or committed; `.env`/`.env.*`/`.npmrc`/`.yarnrc`/
  `.netrc`/`*.pem`/ssh keys off-limits; inspection by key name or salted fingerprint only
  (`phase3/SECURITY_AUTH.md` §4).
- [ ] NFR-PF01, PF02 (🟠 High) — geo query (`company.address.position_2dsphere`) and listing-sort queries
  verified with `.explain()` showing `IXSCAN`, never `COLLSCAN`.
- [ ] NFR-SC03 (🟠 High) — one Redis key per `del` call; Redis is a cluster and a multi-key `del` throws
  CROSSSLOT (BCON-08).
- [ ] NFR-PO01 (🟠 High) — `engines.node` identical (`^24.18.0`) across every repo touched; a mismatch is
  `exit 1` under yarn classic, not a warning.
- [ ] NFR-AV03–AV05 (🟠 High) — services bind wildcard (`httpServer.listen({ port })`, no host), except
  `marketplace-user/serve.mjs:34` (`const HOSTNAME = '127.0.0.1'`), which binds loopback deliberately; the
  push gate blocks rather than warns on any missing prerequisite.
- [ ] NFR-MA03, MA04, MA06, MA07 (🟠 High) — gate wiring itself verified: `core.hooksPath` set
  (`git config core.hooksPath .githooks`), hook file mode `100755` checked SEPARATELY from existence (the
  `services-status/qodana.sh` incident — committed at `100644`, silently never ran).

### 2.6 Documentation
- [ ] No banned term reintroduced — checked against `phase2/UBIQUITOUS_LANGUAGE.md` §19 Banned Terms
  (`role`, vocabulary presuming a specific product domain, "the admin" used for `ShopOwner`, etc).
- [ ] Every identifier, comment, UI string, route and test fixture the story adds is English — no
  exception, and a field whose meaning is not obvious from its name carries a comment instead of a
  borrowed word (`UBIQUITOUS_LANGUAGE.md` §12).
- [ ] `COVERAGE.md`, where the repo has one (e.g. `BEs/dev/marketplace-dev-authenticated-logout/COVERAGE.md`),
  updated if the story changes what a gate covers or how it is bypassed.
- [ ] `schema/*.graphql` frontend slices re-checked against the resolver tree before being cited as the
  contract — no service builds an SDL file, and slices drift (`phase4/API_CONTRACTS.md` §9, "No SDL
  anywhere").

### 2.7 ADR compliance
- [ ] Identity/access change checked against ADR-002 (role=collection), ADR-003 (opaque tokens, not JWT),
  ADR-004 (tier assertion, fail-closed, 403), ADR-005 (single logout service), ADR-006 (3 authz stay 3
  deployables).
- [ ] Data-model change checked against ADR-007 (company=shop), ADR-010 (default-address pointer, not a
  per-address boolean), ADR-011 (soft delete via `deleted` date), ADR-013 (English-only naming), ADR-014
  (migrations immutable).
- [ ] Catalogue change checked against ADR-008 (domain-neutral item/itemCategory), ADR-009 (no `price`
  field), ADR-012 (2-level category cap, admin-only writes).
- [ ] Frontend change checked against ADR-018 (SSR public / CSR `/account/*`), ADR-019 (new urql client per
  SSR request), ADR-020 (route files as one-line `createFileRoute`), ADR-021 (`preferGetMethod` stays
  false), ADR-027 (one app per tier).
- [ ] Build/gate change checked against ADR-015 (`marketplace-common` package-name + `deploy-local.sh`),
  ADR-016 (100/100 everywhere), ADR-017 (Qodana in both hooks), ADR-023 (per-repo integration DB naming),
  ADR-024 (tabs + eslint + prettier together), ADR-025 (`services-status` gated by parent hooks), ADR-026
  (`engines.node` pin).
- [ ] Infra change checked against ADR-001 (polyrepo), ADR-022 (wildcard bind except SSR loopback), ADR-028
  (GraphQL is the whole API, 3 REST endpoints only).
- [ ] Change contradicting an ADR listed in `phase3/adr/ADR-INDEX.md` §4 "Decisions deliberately NOT
  re-opened" is rejected outright, never re-litigated inside a story (`phase5/CONSTRAINTS.md` §2).

---

## 3. Epic-level DoD
- [ ] Every story inside the epic individually meets §2 in full — no epic closes on a partial story.
- [ ] Every 🔴 Critical NFR the epic touches lands on ≥1 story inside it — cross-checked against the risk
  register; no orphaned Critical NFR (`phase5/CONSTRAINTS.md` §5). Scope is what the epic changes, not a
  bounded context it is assigned to; no epic is assigned one.
- [ ] If the epic is `E11` (Ordering & Fulfilment [PLANNED - NOT BUILT]) — it closes with exactly the gap
  recorded (blocking questions from `phase2/BOUNDED_CONTEXT.md` BC-11 + §7 Open questions), never a schema,
  resolver, field, or sequence diagram that presumes order/cart/delivery/payment exists
  (`phase5/CONSTRAINTS.md` §6).
- [ ] Every ADR under the epic's area (`phase3/adr/ADR-INDEX.md` §3 "By area") re-verified compliant across
  ALL its stories combined, not just per-story.

---

## 4. Phase gate DoD
- [ ] Every claim in the phase's document cites a real on-disk path — an uncited or hallucinated path fails
  the Citation-Verify Gate (RETRO-020, per `dod.agent.md` brownfield rules) before the gate can close.
- [ ] Phase output does not contradict any higher-ranked document, per `phase5/CONSTRAINTS.md` §7 conflict
  order (`PDR.md` > `NFR.md` > `UBIQUITOUS_LANGUAGE.md` > `BOUNDED_CONTEXT.md` > ADRs > phase3 > phase4 >
  phase5). A contradiction is fixed in the lower-ranked doc; it is never treated as a supersession.
- [ ] Phase 5 output does not re-open a decision listed in `phase3/adr/ADR-INDEX.md` §4 — merge-3-authz,
  per-tier `REDIS_KEY`, `role` field, shop collection, `price` field, lowered threshold, `ignoreStatic`,
  domain-specific catalogue vocabulary.
- [ ] Success-definition items relevant to the phase, from `phase1/PDR.md` §7, individually re-verified
  true on disk — never assumed carried over from a prior phase.

---

## 5. Sprint DoD
- [ ] Every repo touched this sprint has its work on a branch created BEFORE the first edit
  (`git switch -c <type>/<slug>`) — never a bare commit landing on `main`, which is the checked-out branch
  in every one of the 16 repos (`docs/workflow.md` §Git rules, "Never commit on main. Ever.").
- [ ] One logical change = N separate commits, one per affected repo — no atomic cross-repo commit exists on
  this platform (BCON-05).
- [ ] Any `marketplace-common` change is followed by `./deploy-local.sh` in the SAME piece of work — an
  undeployed edit is invisible to all 9 consumers, which keep resolving the previous build (BCON-07;
  `BEs/marketplace-common/deploy-local.sh`).
- [ ] Merged branch deleted immediately with `git branch -d <slug>` (never `-D`) — in the same breath as the
  merge, never "later" (`docs/workflow.md` §Git rules, "Delete the local branch the moment it is
  merged").
- [ ] `git push` run ONLY on explicit user request, per repo — `marketplace-common` is the sole
  standing-permission exception; every other repo (13 sub-repos, this parent, `@axiumine/koa-utils`) is
  push-on-request, always (`docs/workflow.md` §Git rules).
- [ ] `detect_changes()` run before any commit to confirm the diff's blast radius matches what the sprint
  intended (GitNexus §Always Do).
- [ ] A doc-only commit does not skip a gate scoped away from it on purpose. The parent
  `.githooks/pre-commit:107-114` deliberately scopes the `services-status` build/coverage gate to staged
  paths under `services-status/` that are not `*.md` — a docs-only commit here legitimately triggers
  nothing further, and that is correct, not a bypass:
  ```bash
  # .githooks/pre-commit:107-114
  if ! printf '%s\n' "$staged_all" | grep -E "^$APP/" | grep -qvE '\.md$'; then
  	exit 0
  fi
  ```

---

## 6. What "done" explicitly excludes
- No production deploy target exists in this workspace — nothing here deploys anywhere; "shipped to prod"
  is never a DoD claim.
- No nginx is installed anywhere in this workspace or on this machine — no `/etc/nginx`, no nginx binary on
  `PATH`. The edge under `marketplace-nginx/` at the workspace root (three vhosts, five `conf.d/` files, three snippets)
  is deployable, real, and passes `nginx -t` plus 168 behavioural assertions in `marketplace-nginx/test/run.sh` — which
  makes "nginx config written" *and* "nginx config tested" claimable, and neither of them is "nginx config
  live" (`phase3/SECURITY_AUTH.md` §5, `marketplace-nginx/README.md`). ⚠️ The suite runs against stand-in backends in a
  container, so it proves the configuration's behaviour, never the platform's.
- Where these repos get published, and under which org, is the platform owner's open call, not yet made.
  Until that call is made, a `git push` or `git merge` here is not "shipped" or "released" in any
  externally-visible sense.
- No CI runs anything on this platform. Every gate — lint, coverage, mutation, Qodana — is a LOCAL git
  hook (`.githooks/pre-commit`, `.githooks/pre-push`), fired only if `core.hooksPath` is set and the hook
  file is executable (`100755`). A gate that "would have caught it in CI" is not a gate here — it has to
  actually fire, locally, on this machine.
- "Tests pass" alone is never done — coverage without mutation is proven insufficient platform-wide:
  `marketplace-common` sat 100% covered at a 45.95% mutation score, `marketplace-db-setup` at 52.92%.
  Both gates required together, in order (`lint:check` → `test:cov` → `test:mutation` → Qodana).
- A merged branch is not "released" by the act of merging alone — no CI/CD pipeline runs here to publish
  it; "merge" means a local `git merge` the user explicitly requested.
- `SKIP_QODANA=1` bypasses ONLY the Qodana gate — coverage and mutation still gate underneath it
  (`BEs/dev/marketplace-dev-user-authenticated-resource/.githooks/pre-push:213`). It is never read as
  "gates skipped" wholesale.
- A vitest `integration` project reporting success with zero matching test files is not evidence of
  anything — count files, never checkmarks (BCON-04).
- Qodana running in `pre-commit` is not redundant with `pre-push`, and dropping either is not a
  simplification: `git merge --no-ff` never fires `pre-commit` (git runs it for `git commit` only), so the
  merge commit — the one revision that actually reaches a remote — is the single commit `pre-commit` never
  sees; and Qodana Cloud files every report under the branch git HEAD reports (no `--branch` flag), so a
  repo gated only at `pre-commit` can never produce a `main`-tagged report or a stable "new problems"
  baseline (`BEs/dev/marketplace-dev-user-authenticated-resource/.githooks/pre-push:194-215`; same
  reasoning restated for `services-status` at this parent's `.githooks/pre-push:207-216`).

---

## 7. Change log
| Date | Change | Approved by |
|---|---|---|
| 2026-08-07 | v1.0 — initial retrofit, reverse-engineered from `.githooks/pre-commit` and `.githooks/pre-push` (this parent repo and `BEs/dev/marketplace-dev-user-authenticated-resource`), `vitest.config.mts`, `stryker.config.mjs`, `qodana.yaml`, and phase 1-5 baselined docs across the 15-repo working tree | dod-agent |
