# Phase 5 — Shared constraints
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.8
**Date:** 2026-08-30
**Author:** brainy-agent
**Changelog:** v1.0 - initial retrofit.
v1.8 - 2026-08-30: **BCON-05's landing order and BCON-07's mechanism follow
[`ADR-047`](../phase3/adr/ADR-047-a-common-change-ships-as-a-published-release.md).** The platform owner
ruled that an edit to `marketplace-common` reaches a consumer by being published and by nothing else, and
deleted the sync script; the landing order is now common → publish the release → move each consumer's
range, and BCON-07 keeps its teeth for the half that never depended on the script — a commit in common has
not shipped. CON-09's short name in §3 follows the same rewrite in `phase3/CONSTRAINTS.md`. No constraint
added, removed or weakened.
v1.5 - 2026-08-27: §6 renamed and rewritten on one word. The four commerce concepts are not "unbuilt", they are **permanently out of scope** — `phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md`, the platform owner's decision. **Every rule in §6 is unchanged and every one of them still binds**: no story designs a state machine, a schema, a delivery-cost model or a gateway, and the ordering & fulfilment gap is still recorded in exactly one place. What changed is why — the ban used to hold because no design existed, and now holds because none is coming. The gap gained a second recorded account of its closure, under the same rule, since recording a decision *not* to build is not a story designing the fix.
v1.4 - 2026-08-27, later the same day: v1.3 left BCON-07 reading as though installing and deploying were coupled in both directions. They are not — no install path in any of the 16 repos invokes `deploy-local.sh`, and none may. The row now says so, and scopes the collision to the window where it is real: while `marketplace-common` carries an edit no release has shipped. No constraint added, removed or weakened.
v1.2 - 2026-08-26: the inherited "GDPR call" out-of-scope row annotated — the call was made by the platform owner on 2026-08-26 (in scope), out of phase exactly as `phase3/CONSTRAINTS.md` §5 required. The constraint is unchanged; only a reader grepping "GDPR call" and stopping at this row would have been misled.
v1.1 - 2026-08-11: the record-to-bounded-context rule removed from §5 and its inherited-input row in §2. A
record no longer requires, owns or maps to a bounded context; the alignment with `BC-01`..`BC-11` is
recorded as coincidence. Decided by the platform owner on the grounds that the two are unrelated — a record is
one coherent deliverable, a bounded context is a piece of the domain map, and nothing was ever enforcing the
correspondence in the first place. ⚠️ **§5 is the record of that decision.** `DEFINITION_OF_DONE.md` and
`CONFLICT_REPORT.md` cite it rather than restating it, so re-opening the rule means editing §5 and both of
those.

## 1. Purpose

Doc feed every Phase 5 agent same rules. 8 agent this phase: sequence diagrams, records index, 4
record writers, risk register, definition of done. Stop agent A flow contradict agent B story. Stop
Phase 5 contradict Phase 1-4.

RULES.md §11 mandate inject this file into all 8. Phase 3 built architecture (28 ADR), Phase 4 built
design (ERD/aggregates/contracts/errors) — Phase 5 sit ON TOP of both, not replace either. Phase 5 =
BEHAVIOUR level (what flow happen, what story ship, what risk exist, what "done" mean). Do not redecide
Phase 3 architecture or Phase 4 design here — cite it.

If task collide with rule here — rule here win, unless §7 say otherwise.

## 2. Inherited constraints

Already settled. Do NOT restate body, point at source.

| What | Where settled |
|---|---|
| CON-01..CON-11 (role=collection, shop=company, opaque token, tier assert, single logout, 3-authz-stay-3, migration immutable, 100/100 gate, common ships as a published release, SSR/CSR split, English+tabs+node) | `phase3/CONSTRAINTS.md` §2 |
| DCON-01..DCON-09 (validator authoritative, additionalProperties false, soft-delete-not-hard-remove, 7 global unique index list, itemCategory depth cap in resolver admin-only, ObjectId coercion into pipeline, updatePipeline per-call, bare Boolean return + 2 named exceptions, no role field anywhere) | `phase4/CONSTRAINTS.md` §3 |
| Vocabulary lock (actor names, auth vocab, per-collection field vocab, banned terms, registration-field definitions, planned-commerce-vocab) | `phase3/CONSTRAINTS.md` §3, full source `phase2/UBIQUITOUS_LANGUAGE.md` |
| Architectural invariants Phase 3/4 could not redesign | `phase3/CONSTRAINTS.md` §4, `phase4/CONSTRAINTS.md` §4-5 |
| Bounded contexts — the domain map | `phase2/BOUNDED_CONTEXT.md` §2, BC-01..BC-11 |
| NFR catalogue + priority matrix, story acceptance criteria must trace here | `phase1/NFR.md` §2-3 |
| ADR-001..ADR-028, one row each, by area | `phase3/adr/ADR-INDEX.md` §2-3 |
| Decisions deliberately NOT re-opened (merge 3 authz, per-tier REDIS_KEY, role field, shop collection, price field, lower threshold, ignoreStatic, domain-specific catalogue vocab) | `phase3/adr/ADR-INDEX.md` §4 |
| Gaps this platform still owes an ADR (ordering, repo publish target, prod topology) | `phase3/adr/ADR-INDEX.md` §5 |
| Out of scope (order/cart/delivery/payment, price on item, nginx install, forge publish, GDPR call — ⚠️ the GDPR call was **made** on 2026-08-26, out of phase as intended: in scope, `phase1/NFR.md` §2.7) | `phase3/CONSTRAINTS.md` §5, `phase4/CONSTRAINTS.md` §6 |

Phase 5 agent read `phase3/CONSTRAINTS.md`, `phase4/CONSTRAINTS.md`, `phase3/adr/ADR-INDEX.md` full
before start. This doc assume all three already read — no re-explain here.

## 3. Behavioural constraints

Numbered BCON-xx. NEW this phase — behaviour-level rule Phase 3/4 did not need (they draw structure,
Phase 5 draws motion: flows, stories, risk, done-ness). Each row: rule, source, what violation look like.

| ID | Constraint | Source | Violation looks like |
|---|---|---|---|
| BCON-01 | Every acceptance criterion must be MECHANICALLY checkable. Machine exist: 100% coverage all 4 metric + 100 Stryker mutation score in all 15 package, `lint:check`, `tsc --noEmit`, Qodana — run by `.githooks/pre-commit` + `.githooks/pre-push` in every repo. "Works well" not a criterion. "Gate passes" is. | [`README.md`](../../../README.md) §Test quality gates (mutation-gate + coverage-gate paragraphs); `BEs/dev/marketplace-dev-public-authorization/.githooks/pre-push` | Acceptance criterion say "UX feels smooth" / "performs well" with no gate, script, or assertion named |
| BCON-02 | Do NOT lower a threshold or remove a gate to make a story pass. Story that need threshold lowered is story that need a test. | [`CLAUDE.md`](../../../CLAUDE.md) §Rules that apply to every task ("Never lower a coverage or mutation threshold, and never remove a gate"); `phase3/adr/ADR-INDEX.md` §4 | Story/DoD line reads "adjust coverage threshold" or "skip mutation gate for this story" |
| BCON-03 | No test on this platform spans two service, by construction. Story asserting agreement between 2 repo (shared secret, Redis key shape) must state HOW verified — no automated gate catch it. Cookie-signing key mismatch between `marketplace-dev-public-authorization` and user-tier authz returned 401 every customer refresh while both repo suite stayed green. ⚠️ **That one example no longer applies and the constraint still does**: ADR-034 removed the shared *value* rather than testing it — one wrapped Redis record, service that cannot unwrap refuse boot. Closing one of these mean deleting the agreement, not writing cross-repo test. `REDIS_KEY` unchanged. | [`docs/workflow.md`](../../workflow.md) §Environment files "the one place where a *wrong* value fails where nothing is looking" paragraph | Story with acceptance criterion "cookie signed by service A verified by service B" and no manual/fingerprint verification step named |
| BCON-04 | Vitest project with NO matching file still PASSES. Count test file, never checkmark. `marketplace-dev-user-authenticated-resource` declared integration project, zero `*.itest.mts`, reported success at 100% coverage — every address delete answered 500 the day file landed. | [`docs/testing.md`](../../testing.md) §Traps that make a green run lie "A vitest project with no matching files passes"; now fixed at `BEs/dev/marketplace-dev-user-authenticated-resource/test/integration/` (5 `.itest.mts` files) | "Built" story cite 100% coverage as sole proof with no file-count check named |
| BCON-05 | One logical change = N git commit, one per affected repo. No atomic cross-repo commit. Story touching `marketplace-common` plus consumer = N stories, or 1 story with explicit landing order (common → publish the release → bump each consumer's range). | [`docs/workflow.md`](../../workflow.md) §Repo layout, "One logical change" bullet | Story described as single unit spanning 2+ repo with no per-repo commit list or landing order |
| BCON-06 | Never commit on `main`, branch first. `marketplace-common` only repo may commit/merge/push/publish without asking; every other repo push-on-request. ⚠️ **Machine-checked since 2026-09-06** — all sixteen `.githooks/pre-commit` refuse a commit whose `HEAD` is `main`, exempting an in-progress merge, with `SKIP_MAIN_GUARD=1` as the named way past (MC-25). `--no-verify` still lifts it, as it lifts every gate here. | [`docs/workflow.md`](../../workflow.md) §Git rules "Never commit on main. Ever." | DoD/story instructs committing straight to `main`, or assumes push permission on a non-common repo |
| BCON-07 | Edit to `marketplace-common` invisible until it is **published** — the registry carries releases, not edits, and every consumer compiles against the version its own `yarn.lock` names. Story ending "committed to common" has NOT shipped, and neither has one ending at `yarn upload`: the range in each consumer has to move too. The package is published (`ADR-037`) and there is no local sync script (`ADR-047`), which removes the install collision entirely — with nothing hand-placed, a `yarn install` undoes nothing. The constraint is unchanged; the reason is simpler. | [`docs/conventions.md`](../../conventions.md) §marketplace-common plumbing, "Consumed by package name, and published"; `BEs/marketplace-common/CLAUDE.md` §Publishing a release | Story marks itself done at "PR merged in marketplace-common" with no published version and no consumer range bump |
| BCON-08 | Redis is a cluster. One key per `del` call. Multi-key `del` throws CROSSSLOT. ⚠️ **Machine-checked since 2026-09-06** — `REDIS_ONE_KEY_PER_DEL` in ten `eslint.config.js` refuses `del(a, b)`, `del([a, b])` and `del(...keys)` for `del` and `unlink` alike (MC-22). A key list held in a variable still passes, so the constraint is narrowed rather than closed. | [`docs/testing.md`](../../testing.md) §The mechanical checks MC-22 and §Integration test conventions "Redis is a cluster" bullet; `phase1/NFR.md` NFR-SC03 | Flow/story shows batched multi-key Redis delete in one call |
| BCON-09 | Integration suite run against REAL Mongo + Redis, each repo own database, must clean self up — seed through raw driver (not Mongoose model, several disagree with validator), register every `_id`/Redis key at creation time, drain in `afterAll`. | [`docs/testing.md`](../../testing.md) §Integration test conventions "Integration tests run against real infrastructure" bullet | Acceptance criterion for a "built" story cites integration test with no cleanup/registration step, or seeds via Mongoose model on a collection named as disagreeing |

## 4. Flow rules

How a sequence diagram on this platform must be drawn:

| Rule | Detail |
|---|---|
| Participant set is fixed | Actors: `Admin`, `ShopOwner`, `User`, anonymous. Frontends: `marketplace-admin` (3043), `marketplace-shopowner` (3044), `marketplace-user` (3045, SSR). Backend: 9 named services in [`docs/architecture.md`](../../architecture.md) §Services table, each own port. Infra: Redis (cluster, shared `REDIS_KEY` prefix), MongoDB (6 collections). No 10th service, no `Shop`/`Order`/`Cart` participant. |
| Tokens are opaque, looked up in Redis | Not JWT (CON-03). A flow never decodes a token client-side — every "is this valid" step is a Redis hash lookup (`hGetAll`), never a signature verify of claims. |
| Every resource-service step asserts its own tier | `assertTier(actual, expected)` — draw it on EVERY arrow that hits a `*-authenticated-resource`/`*-authorization` service, mismatch branch = 403 not 401, missing-tier branch = reject not wildcard (CON-04). Logout is the one exception: single service, all 3 tier, matches by token content only (CON-05) — draw logout without a tier-assert step. |
| No flow crosses two services inside one transaction | Nothing here is transactional across repos — each service owns its own Mongo connection and Redis view. A flow needing "both succeed or both roll back" across 2 services must show it as 2 separate calls with an explicit compensating/failure branch, never a dotted "transaction boundary" box spanning both. |
| SSR vs CSR boundary is a security boundary, not a rendering detail | Public-route flows on `marketplace-user` render server-side and hit `PUBLIC_RESOURCE_URL` directly per-request (new urql client per request). `/account/*` flows are `ssr: false` — draw the browser calling the API directly, never the SSR server rendering authenticated HTML (CON-10). |
| HTTP contract cross-link tooling gives nothing here | GitNexus `group sync` → 0 cross-link on this platform (Apollo inline dispatch, no GraphQL model in extractor). Do not cite `route_map` as evidence a flow exists — trace resolver source directly. |

## 5. Work-item rules

| Rule | Detail |
|---|---|
| Every story ≥2 testable acceptance criteria | Each criterion mechanically checkable per BCON-01 — a gate name, a test file, an explain output, not a feeling. |
| Every 🔴 Critical NFR appears as acceptance criterion somewhere | Critical set (`phase1/NFR.md` §3): NFR-SE01–SE09, SE11, SE12, AV01, AV02, MA01, MA02, MA05, CO01. Each must land on ≥1 story somewhere across the records — risk register + DoD writer cross-check this, do not leave one orphaned. |
| Story for already-built work marked BUILT, cites path proving it | E.g. "customer can register" cites `BEs/dev/marketplace-dev-public-resource` registration resolver + `marketplace-user` account route, not left as if still to design. Built vs planned split follows [`CLAUDE.md`](../../../CLAUDE.md) §Build state table exactly — do not upgrade a planned piece to built by writing a nice story about it. |

## 6. Out of scope for Phase 5

Same 4 commerce concepts as Phase 3/4, and as of 2026-08-27 **permanently out of scope** rather than merely unbuilt
([`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)) — no shape, no story that designs the thing, and no design coming:

- **Order** — no story defines a state machine, no story defines a resolver signature.
- **Cart** — no story defines a schema, no story defines a mutation.
- **Delivery** — no story defines a delivery-cost model or any successor concept; nothing was replaced.
- **Payment** — no gateway story, no integration story, no error-taxonomy story.

BC-11 "Ordering & Fulfilment [WILL NOT BUILD]" is recorded in exactly one place — the gap and the
decision that closed it are held at
[`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note 2026-08-27.
It never gets a schema, a resolver, a field, a sequence diagram of a checkout
flow, or a "story" with acceptance criteria that presume the thing exists. A risk-register row naming the
gap is fine; a story designing the fix is not. ⚠️ **A recording story is still allowed, and this decision
has two** — one recorded the gap, the other recorded its closure; both are held in full at the ADR, not
in a file of their own. The line between a recording story and a design story is unmoved: neither
ships a shape.

## 7. Conflict resolution order

When two docs disagree, higher row wins:

| Rank | Document |
|---|---|
| 1 (highest) | `phase1/PDR.md` |
| 2 | `phase1/NFR.md` |
| 3 | `phase2/UBIQUITOUS_LANGUAGE.md` |
| 4 | `phase2/BOUNDED_CONTEXT.md` |
| 5 | `phase3/adr/ADR-*.md` (28 decisions) |
| 6 | `phase3/*.md` (this file's phase 3 equivalent + siblings) |
| 7 | `phase4/*.md` |
| 8 (lowest) | Phase 5 docs (this file, the 8 agents' output) |

A Phase 5 output that contradicts anything ranked above it is WRONG, not a superseding decision — fix
the Phase 5 doc, don't reinterpret the higher-ranked one. A genuine error found in a higher-ranked doc
goes back through `RULES.md` change-control, not silently overridden here.

Within Phase 5 itself: this CONSTRAINTS.md wins over any single one of the 8 agents' output — that is
the whole reason it exists (RULES.md §11). Between the 8 agents' own outputs (e.g. a sequence diagram
naming a flow the records index doesn't list, or a risk register row a record contradicts): whichever
one matches §3/§4/§5 of THIS file wins; if neither matches, escalate rather than let one silently
override the other.
