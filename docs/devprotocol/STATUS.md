# DEVPROTOCOL — Phase Status Dashboard
# Marketplace
**Status:** Phases 1-5 complete — all five gates closed `pass`
**Version:** 1.10
**Date:** 2026-08-30
**Author:** retrofit-run
**Changelog:** v1.10 — 2026-08-30: Two open session-boundary questions are closed — session exit is a page load ([`ADR-051`](./phase3/adr/ADR-051-a-session-exit-is-a-page-load.md)) and session entrance is a page load too ([`ADR-052`](./phase3/adr/ADR-052-a-session-entrance-is-a-page-load-too.md)), both written the same day. The account-lifecycle decisions land across six ADRs: [`ADR-041`](./phase3/adr/ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md) takes the migration pair and the day-30 sweeper, [`ADR-042`](./phase3/adr/ADR-042-registration-is-a-pending-redis-record.md) and [`ADR-043`](./phase3/adr/ADR-043-pending-registration-carries-csfle-ciphertext.md) the pending Redis registration and its ciphertext, [`ADR-044`](./phase3/adr/ADR-044-suspension-names-an-actor-and-a-reason.md) the actor-and-reason writes with the read half, the admin form and the four-service write ban, [`ADR-045`](./phase3/adr/ADR-045-an-inactive-shop-owner-takes-the-storefront-off-air.md) the self-closure, `itemsUpdatePublished` and the owner's two controls, and [`ADR-046`](./phase3/adr/ADR-046-the-retention-window-is-an-undo-window.md) the restore, the privacy notice, the true-up and the customer's close screen. **The one thing this corpus still leaves genuinely open**: whether an admin may be suspended, and by whom — [`ADR-044`](./phase3/adr/ADR-044-suspension-names-an-actor-and-a-reason.md) §Still undecided, owner Platform owner. Counts recounted from the tree: **ADRs 40→52** (twelve landed, `ADR-041`..`ADR-052`) and **documents 79→89** (twelve files arriving, three leaving).
v1.8 — 2026-08-28: An audit of the keygrip-custody design record, closed the same day by [`ADR-040`](./phase3/adr/ADR-040-the-secrets-manager-vendor-choice-is-the-adopters.md) (the KEK's custody, its last open question), found the record's own scope table the only surviving statement of what was *asked for* — a Mongo `signingKey` collection, a fifth DEK, a three-state lifecycle — against an [`ADR-034`](./phase3/adr/ADR-034-keygrip-keys-live-in-redis-wrapped-under-a-kek.md) that records only what shipped. [`ADR-034`](./phase3/adr/ADR-034-keygrip-keys-live-in-redis-wrapped-under-a-kek.md) §Amendment gains why thirty days and not the ninety `REFRESH_TOKEN_EXPIRY` allows — and a correction, because the justification first written for that figure was **inverted**: it said a past-cap session is refused *before* the key is read, where `authenticatedAuthorizationHandler.mts:28` verifies the signature against the whole key array **before** `resolveAuthorizationSession` ever compares `sessionCapDeadline`, so a key dropped too early fails at the signature (a generic 401) and not at the cap; thirty still beats ninety, for the neighbouring reason — and the **honest window**, at least thirty days after demotion and in practice until the next rotation after that, removal being rotation-driven with nothing on a timer, so a fleet that stops rotating keeps every key indefinitely at no cost. The same ADR's §Consequences gains **no fifth DEK was ever owed** — signing keys in Redis are not a CSFLE field, so `fieldEncryption.mts:78`'s "four data encryption keys" stayed right, and the sweep this scope table once seemed to demand never became owed — ⚠️ which must not be "corrected" to five. Other findings, kept as prose with no sibling document to own them: the **16 → 15** `REQUIRED_ENV_VARS` net on `marketplace-dev-public-authorization` (two variables leaving and one arriving, not the one-for-one swap once predicted), the platform owner's authorisation to change the middleware contract across all five services, **granted and never spent**, and the seven-step landing order, planned and never executed as written — *The Keygrip pair leaves five `.env` files for one wrapped record in Redis*, *An admin rotates the signing key, and no service restarts*, *The admin can see which service holds which key* and *`KEYGRIP_KEY_1`/`_2` are gone, and the documents stop describing five files* (all in [`phase5/IDENTITY_ACCESS.md`](./phase5/IDENTITY_ACCESS.md)) landed the substance against Redis instead — kept because the two constraints it encodes held anyway and outlive it: **BCON-05**, `marketplace-common` before its consumers, and **BCON-07**, env-var removal only after every service can already read the record. `ADR-034` was **amended**, not replaced.
v1.2 — 2026-08-27: [`ADR-038`](./phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) lands — cart, order, delivery and payment are permanently out of scope, so §6's "first commerce collection" trigger is struck through because it can no longer fire, and §7's closing paragraph stops routing the four into Phase 6 behind an ADR they were never going to get.
v1.1 — 2026-08-27: §5's inventory was still the count taken the day the retrofit closed and every row of it had gone stale — the corpus has roughly doubled since. Re-measured against the tree: documents, ADRs, bounded contexts, stories and risks. The NFR row was re-checked and is correct as written (the five §Critical rows expand to 17 ids). §6's *"as of"* sentence now points a reader at each document's own header rather than at one frozen date. Nothing about the phases or the gates changed.
v1.0 — initial dashboard, written after the Phase 5 gate closed. Brownfield retrofit: every phase artefact was reverse-engineered from the 15-repo working tree, not written ahead of code.
v1.7 — 2026-08-28: A Product question survives as [`phase5/IDENTITY_ACCESS.md`](./phase5/IDENTITY_ACCESS.md) §6 question 5, **open**: whether a confirm-first email-change flow should exist at all. [`phase3/adr/ADR-INDEX.md`](./phase3/adr/ADR-INDEX.md) §4 gains three rows, recorded in the index rather than as new ADRs: the **lazy prune** refused, because a session key can outlive the session it belongs to, so pruning on key existence keeps naming logins that cannot log in, and the admin session console renders that list anyway; **"revoke all but me"** refused, because the exemption is granted to whichever session sent the mutation and an attacker holding the password can send it; and **`familyId`/the cap** refused, because the index value already maintains that lineage state through token rotation — the same row recording that one of `tier`'s two original reasons turned out **wrong** once built, the key a revocation rebuilds needing no tier because the tier is already in the index key's own name. [`phase5/SESSION_TERMINATION.md`](./phase5/SESSION_TERMINATION.md) §3.1 (new) names the involuntary teardown `logout` is not, and the accepted cost of that refusal: a credential write signs the caller out too, and the three frontends must render the refusal as *log in again* — a screen no story owns. [`phase5/IDENTITY_ACCESS.md`](./phase5/IDENTITY_ACCESS.md) §3.1 (new) records the login-email findings: one writer only, no confirm-a-change flow, `newEmailTmp` written and read by nothing, and the new address live immediately with `emailVerify.valid` untouched — so an admin typo moves an account to an unverified address *and* ends every session its owner held. [`phase5/SHOPOWNER_ONBOARDING_APPROVAL.md`](./phase5/SHOPOWNER_ONBOARDING_APPROVAL.md), under the *Admin grants or withholds login access as one full-state write* story, gains the parking/releasing asymmetry: parking revokes, releasing does not, and the gate reads the target state because both flags arrive on every call. [`phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md`](./phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md) §3.1 (new) explains why `credentialWriteRevokes.test.mts` asserts a substring match rather than an adjacency regex — Stryker rewrites string literals into ternaries, so a positional pattern dies in the dry run. [`phase3/SECURITY_AUTH.md`](./phase3/SECURITY_AUTH.md) §3's `waitApprov` row explains why `checkShopOwnerApproval` is called after the password check: before it, the timing difference would say which addresses belong to parked accounts. The reason the session-index namespace had to be hashed **before** anything else touched it survives only here: unhashed, its `idx:` hash stores session key names as its own fields, so building on it first would have collected every live credential on an account into one greppable structure.
v1.6 — 2026-08-28: Three stale statements are corrected. [`phase3/SECURITY_AUTH.md`](./phase3/SECURITY_AUTH.md) §3.6 no longer calls the edge the platform's *only* application-level auth-path rate limiting — two `assertUnderRateLimit` sites were added on `refresh` on 2026-08-10. [`phase4/ERROR_HANDLING.md`](./phase4/ERROR_HANDLING.md) §3 no longer says no GraphQL error on this platform carries `extensions.code` — `REFRESH_RACE_RETRY` does, though it is thrown from koa middleware registered **before** Apollo, so it never reaches the client at all; that defect is **still open**. `marketplace-common/CLAUDE.md` no longer counts four Redis commands on the two session-store interfaces — `ISessionWriteStore` now declares eight (`hSet`, `expire`, `del`, `sAdd`, `incr`, `ttl`, `hExpire`, `hDel`) and `ISessionReadStore` is declared `extends ISessionFamilyStore`, which itself extends `IReuseEventStore`; the corrected row now says to treat any stated count as a snapshot and re-read the declaration. [`phase3/adr/ADR-INDEX.md`](./phase3/adr/ADR-INDEX.md) §4 gains two rejected alternatives: a tier-keyed session cap (drafted as Admin 7 / ShopOwner 30 / User 90, then as a uniform seven) and a cached-successor-pair "grace cache", which had no implementable path. [`../architecture.md`](../architecture.md) keeps the unfinished `// if remember me, generate ?` comment in koa-utils' `setLoginCookies` deliberately — it names an abandoned cookie-side approach, and without the comment the next reader finishes it and re-introduces the cap as a cookie attribute. [`phase5/RISK_REGISTER.md`](./phase5/RISK_REGISTER.md) R52 records two rate-limit windows, not one: 20 requests per 60 seconds pre-lookup, and 20 per 3600 seconds per family. [`phase5/TELEMETRY_EGRESS_HARDENING.md`](./phase5/TELEMETRY_EGRESS_HARDENING.md) notes Cloudflare's own rate-limiting rules as the alternative that costs plan tier rather than code — not chosen, still available. The admin session console ([`../decisions/admin-session-tooling-placement.md`](../decisions/admin-session-tooling-placement.md)) addresses a session by a non-secret id, and can never be built on a token value. [`../report/token-handling-security-audit.md`](../report/token-handling-security-audit.md) §3.4 records the accepted residual: no cross-service harness exists in these sixteen repos, and one built for that single assertion would re-prove what `sessionKeys.mts` being a single implementation already proves. Two defects found during this pass are outside the design and remain **open**, recorded in [`../report/multi-tab-refresh-behaviour.md`](../report/multi-tab-refresh-behaviour.md) §4, §5 and §9.

*Updated: 2026-08-30*

Read this file first (RULES.md §12), then [`phase1/PDR.md`](./phase1/PDR.md), then [`phase2/UBIQUITOUS_LANGUAGE.md`](./phase2/UBIQUITOUS_LANGUAGE.md). Nothing else until you need it.

---

## 1. Phase status

| Phase | Status | Gate | Conflict report | Artefacts |
|---|---|---|---|---|
| Phase 1 — Discovery | ✅ Complete | closed, no checker run | none — see §7 | [`phase1/PDR.md`](./phase1/PDR.md), [`phase1/SYSTEM_CONTEXT.md`](./phase1/SYSTEM_CONTEXT.md), [`phase1/NFR.md`](./phase1/NFR.md) |
| Phase 2 — Domain Modelling | ✅ Complete | closed, no checker run | none — see §7 | [`phase2/EVENT_STORMING.md`](./phase2/EVENT_STORMING.md), [`phase2/UBIQUITOUS_LANGUAGE.md`](./phase2/UBIQUITOUS_LANGUAGE.md), [`phase2/BOUNDED_CONTEXT.md`](./phase2/BOUNDED_CONTEXT.md) |
| Phase 3 — Architecture | ✅ Complete | **pass** | [`phase3/CONFLICT_REPORT.md`](./phase3/CONFLICT_REPORT.md) v1.1 | [`phase3/C4_CONTEXT.md`](./phase3/C4_CONTEXT.md), [`phase3/C4_CONTAINER.md`](./phase3/C4_CONTAINER.md), `phase3/adr/` (29 ADRs + index + template), [`phase3/SECURITY_AUTH.md`](./phase3/SECURITY_AUTH.md), [`phase3/INFRA.md`](./phase3/INFRA.md) |
| Phase 4 — Design | ✅ Complete | **pass** | [`phase4/CONFLICT_REPORT.md`](./phase4/CONFLICT_REPORT.md) v1.1 | [`phase4/DDD_AGGREGATES.md`](./phase4/DDD_AGGREGATES.md), [`phase4/ERD.md`](./phase4/ERD.md), [`phase4/API_CONTRACTS.md`](./phase4/API_CONTRACTS.md), [`phase4/ERROR_HANDLING.md`](./phase4/ERROR_HANDLING.md) |
| Phase 5 — Behaviour | ✅ Complete | **pass** | [`phase5/CONFLICT_REPORT.md`](./phase5/CONFLICT_REPORT.md) v1.2 | [`phase5/SEQUENCE_DIAGRAMS.md`](./phase5/SEQUENCE_DIAGRAMS.md), [`phase5/IDENTITY_ACCESS.md`](./phase5/IDENTITY_ACCESS.md), [`phase5/SESSION_TERMINATION.md`](./phase5/SESSION_TERMINATION.md) [`phase5/SHOPOWNER_ONBOARDING_APPROVAL.md`](./phase5/SHOPOWNER_ONBOARDING_APPROVAL.md), [`phase5/COMPANY_LEGAL_ENTITY.md`](./phase5/COMPANY_LEGAL_ENTITY.md) , [`phase5/CATALOGUE.md`](./phase5/CATALOGUE.md) , [`phase5/CATEGORY_TAXONOMY.md`](./phase5/CATEGORY_TAXONOMY.md) , [`phase5/CUSTOMER_ACCOUNT_ADDRESSES.md`](./phase5/CUSTOMER_ACCOUNT_ADDRESSES.md) [`phase5/PUBLIC_DISCOVERY_STOREFRONT.md`](./phase5/PUBLIC_DISCOVERY_STOREFRONT.md) [`phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md`](./phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md) and [`phase5/SHARED_KERNEL.md`](./phase5/SHARED_KERNEL.md) and [`phase5/TELEMETRY_EGRESS_HARDENING.md`](./phase5/TELEMETRY_EGRESS_HARDENING.md), [`phase5/RISK_REGISTER.md`](./phase5/RISK_REGISTER.md), [`phase5/DEFINITION_OF_DONE.md`](./phase5/DEFINITION_OF_DONE.md) |
| Phase 6 — Code | ⬜ Open | — | — | pre-code phases are the gate; see §9 |

**Pre-flight:** not run — no `PREFLIGHT_REPORT.md` exists, and that is deliberate. See §7.

---

## 2. Gate log

RULES.md §4: a gate cannot close while its Conflict Checker Report is not `pass`. Three checkers ran. **Every finding was applied at source before its gate closed** — none deferred, none waived, no threshold moved.

| Gate | Initial verdict | Findings | Applied | Final |
|---|---|---|---|---|
| Phase 3 | pass with warnings | CF-01 (warning) — `SECURITY_AUTH.md:257` opened "8 of 9 backend services bind the unspecified address" then contradicted its own count two lines later; ADR-022 and the tree say all 9. §5 nit — `ADR-019:51` cited `docs/nginx/cache.conf` without its `marketplace-user/` prefix. | `SECURITY_AUTH.md:257` → "All 9 backend services bind the **unspecified address**". ADR-019 path prefixed — and since superseded: `marketplace-user/docs/nginx/` is deleted and every nginx citation in phase1/phase3/phase5 now points at `marketplace-nginx/` at the workspace root. | **pass** (v1.1) |
| Phase 4 | **fail** | C-01 (HIGH, blocking) — `ERD.md` and `DDD_AGGREGATES.md` disagreed on whether `admin` carries `personalData`. C-02 (LOW) — `API_CONTRACTS.md` table columns drifted at the two-agent seam (§4-5 vs §6-9). | C-01 re-verified against `BEs/marketplace-db-setup/migrations/20260301000000-create-admin.js` **and** `BEs/marketplace-common/src/models/MongoDB/Admin.mts:17-23` before touching anything — the checker was right, and `DDD_AGGREGATES.md` was wrong against both validator and model, so the fix went there and `ERD.md` was left alone. C-02 closed at the level of the rule: every §6-§8 table re-cut, and the convention written into §3 so the seam cannot silently reopen. | **pass** (v1.1) |
| Phase 5 | pass with warnings | C01 (warning) — §1 cross-referenced "(§9)" for the out-of-scope table, which is §10. C02 (warning) — `CONSTRAINTS.md` §5 documented a story-id naming convention that didn't match what the records actually used. Traceability gap — **NFR-SE03 landed on zero stories**, the one orphan of 17 Critical NFRs. | §9→§10. `CONSTRAINTS.md` §5 corrected to match — no story renamed, none was wrong. NFR-SE03 given a third acceptance criterion on the *Every resource/authorization call asserts its own tier, fails closed* story in [`phase5/IDENTITY_ACCESS.md`](./phase5/IDENTITY_ACCESS.md) after verifying the mechanism at `…admin-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:42,49,51`; placed on that story rather than its own because SE03 and SE05/SE06 are two halves of one middleware and splitting them would let one ship without the other. | **pass** (v1.2) |

Each report keeps its own "what I did **not** read" caveat after the re-verdict rather than deleting it — a `pass` here means no conflict was found by a grep-first sweep, not that every ADR body was read cover to cover.

---

## 3. Shared constraints

Injected into every parallel agent of the phase that owns them.

| Phase | Document | Ids |
|---|---|---|
| Phase 3 | [`phase3/CONSTRAINTS.md`](./phase3/CONSTRAINTS.md) | CON-01..CON-12 |
| Phase 4 | [`phase4/CONSTRAINTS.md`](./phase4/CONSTRAINTS.md) | DCON-01..DCON-09 |
| Phase 5 | [`phase5/CONSTRAINTS.md`](./phase5/CONSTRAINTS.md) | BCON-01..BCON-09 |

Phases 1 and 2 carry none — see §7.

---

## 4. Agent output

All attempts `1`. **0 retries, 0 errors, 0 empty results across every phase.**

| Agent | Phase | Artefact | Lines | Attempt |
|---|---|---|---|---|
| `pdr-agent` | 1 | [`phase1/PDR.md`](./phase1/PDR.md) | 195 | 1 |
| `system-context-agent` | 1 | [`phase1/SYSTEM_CONTEXT.md`](./phase1/SYSTEM_CONTEXT.md) | 468 | 1 |
| `nfr-agent` | 1 | [`phase1/NFR.md`](./phase1/NFR.md) | 164 | 1 |
| `event-storming-agent` | 2 | [`phase2/EVENT_STORMING.md`](./phase2/EVENT_STORMING.md) | 371 | 1 |
| `ubiquitous-language-agent` | 2 | [`phase2/UBIQUITOUS_LANGUAGE.md`](./phase2/UBIQUITOUS_LANGUAGE.md) | 673 | 1 |
| `bounded-context-agent` | 2 | [`phase2/BOUNDED_CONTEXT.md`](./phase2/BOUNDED_CONTEXT.md) | 332 | 1 |
| `brainy-agent` | 3 | [`phase3/CONSTRAINTS.md`](./phase3/CONSTRAINTS.md) | 102 | 1 |
| `c4-agent` | 3 | [`phase3/C4_CONTEXT.md`](./phase3/C4_CONTEXT.md) | 136 | 1 |
| `c4-agent` | 3 | [`phase3/C4_CONTAINER.md`](./phase3/C4_CONTAINER.md) | 320 | 1 |
| `adr-agent` ×28 | 3 | `phase3/adr/ADR-001..028` | 3120 | 1 |
| `adr-agent` | 3 | [`phase3/adr/ADR-INDEX.md`](./phase3/adr/ADR-INDEX.md) | 87 | 1 |
| `security-agent` | 3 | [`phase3/SECURITY_AUTH.md`](./phase3/SECURITY_AUTH.md) | 392 | 1 |
| `infra-agent` | 3 | [`phase3/INFRA.md`](./phase3/INFRA.md) | 571 | 1 |
| `conflict-checker-agent` | 3 | [`phase3/CONFLICT_REPORT.md`](./phase3/CONFLICT_REPORT.md) | 62 | 1 |
| `brainy-agent` | 4 | [`phase4/CONSTRAINTS.md`](./phase4/CONSTRAINTS.md) | 127 | 1 |
| `ddd-agent` | 4 | [`phase4/DDD_AGGREGATES.md`](./phase4/DDD_AGGREGATES.md) | 407 | 1 |
| `erd-agent` | 4 | [`phase4/ERD.md`](./phase4/ERD.md) | 456 | 1 |
| `api-contracts-agent` | 4 | [`phase4/API_CONTRACTS.md`](./phase4/API_CONTRACTS.md) | 519 | 1 |
| `error-handling-agent` | 4 | [`phase4/ERROR_HANDLING.md`](./phase4/ERROR_HANDLING.md) | 521 | 1 |
| `conflict-checker-agent` | 4 | [`phase4/CONFLICT_REPORT.md`](./phase4/CONFLICT_REPORT.md) | 70 | 1 |
| `brainy-agent` | 5 | [`phase5/CONSTRAINTS.md`](./phase5/CONSTRAINTS.md) | 120 | 1 |
| `sequence-agent` | 5 | [`phase5/SEQUENCE_DIAGRAMS.md`](./phase5/SEQUENCE_DIAGRAMS.md) | 566 | 1 |
| `phase5-records-agent` | 5 | the story cross-reference index, since deleted | 115 | 1 |
| `phase5-records-agent` ×4 | 5 | eleven phase5 records — the identity & access record is now [`phase5/IDENTITY_ACCESS.md`](./phase5/IDENTITY_ACCESS.md), the session termination record [`phase5/SESSION_TERMINATION.md`](./phase5/SESSION_TERMINATION.md), the ordering & fulfilment record absorbed with no file of its own into [`ADR-038`](./phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note 2026-08-27, and the telemetry & egress hardening record now [`phase5/TELEMETRY_EGRESS_HARDENING.md`](./phase5/TELEMETRY_EGRESS_HARDENING.md) | 1618 | 1 |
| `risk-agent` | 5 | [`phase5/RISK_REGISTER.md`](./phase5/RISK_REGISTER.md) | 141 | 1 |
| `dod-agent` | 5 | [`phase5/DEFINITION_OF_DONE.md`](./phase5/DEFINITION_OF_DONE.md) | 250 | 1 |
| `conflict-checker-agent` | 5 | [`phase5/CONFLICT_REPORT.md`](./phase5/CONFLICT_REPORT.md) | 107 | 1 |

Ids were **hard-coded in the Phase 5 run script**, pairing each bounded context (`BC-01`..`BC-11`) with its own record, so the index agent and the four file agents could not disagree on a mapping. That is the fix for a class of drift, not a convenience.

---

## 5. Inventory

| Thing | Count |
|---|---|
| Documents | 89 markdown files, 22 022 lines — recounted from the tree after this rewrite pass, which cut 1 628 lines with no file added or removed (was 23 650), with every rewritten file saved. Twelve ADRs (`ADR-041`..`ADR-052`) landed in the same window without an earlier pass returning to update this row, so the total rose from 79 to 89 rather than falling. Always recounted from the tree at the end of a pass, never adjusted by arithmetic alone |
| ADRs | 40 accepted, `ADR-001`..`ADR-040` (+ index + `ADR-000-template.md`). ⚠️ This row read **38** until 2026-08-28: `ADR-039` landed earlier that day and the pass that wrote it did not come back here. ⚠️ **And it read 39 until later the same day** — `ADR-040` landed in the pass that closed the last open question about keygrip custody under a KEK ([`ADR-034`](./phase3/adr/ADR-034-keygrip-keys-live-in-redis-wrapped-under-a-kek.md)) and did not come back here either, so this row has now been one behind twice in one day; recounted from the directory, not adjusted. ⚠️ **52 accepted from 2026-08-30, `ADR-001`..`ADR-052`** — twelve landed between the two readings and no pass that wrote one came back here: the account-lifecycle six (`ADR-041`..`ADR-046`), `ADR-047` on how a `marketplace-common` change reaches a consumer, the admin-tier three (`ADR-048`..`ADR-050`) and the two session-boundary decisions (`ADR-051`, `ADR-052`). Recounted from the directory, not adjusted |
| Bounded contexts | 12 (`BC-01`..`BC-12`) |
| Stories | 115 stories across the eleven phase5 records (`## 4. Stories` headings), each identified by its title rather than an id — recounted from the tree |
| NFR ids | 48, of which 17 Critical — **all 17 now land on ≥1 story** |
| Risks | 54 (`R01`..`R54`) |
| Sequence diagrams | 7 full mermaid flows (§3-§9) + simple flows (§2) |

---

## 6. Stale artefacts / failures

**Stale artefacts:** none recorded.
**Failures:** none. No `retry_exhausted` event fired in any phase.

These documents described the working tree **as of 2026-08-07** and have been maintained against it since; each one carries its own **Version**, **Date** and changelog, and that header is the authority on how current it is, not this page. They go stale on their own — nothing here watches them. What invalidates what:

| Change on disk | Stales |
|---|---|
| New collection, or a `$jsonSchema` edit under `BEs/marketplace-db-setup/lib/schemas/` | [`phase4/ERD.md`](./phase4/ERD.md), [`phase4/DDD_AGGREGATES.md`](./phase4/DDD_AGGREGATES.md), the migration section of [`phase3/INFRA.md`](./phase3/INFRA.md) |
| New or changed resolver | [`phase4/API_CONTRACTS.md`](./phase4/API_CONTRACTS.md), [`phase5/SEQUENCE_DIAGRAMS.md`](./phase5/SEQUENCE_DIAGRAMS.md) |
| New service, or a port change | [`phase3/C4_CONTAINER.md`](./phase3/C4_CONTAINER.md), [`phase3/INFRA.md`](./phase3/INFRA.md), [`phase4/API_CONTRACTS.md`](./phase4/API_CONTRACTS.md) |
| Any auth-middleware edit | [`phase3/SECURITY_AUTH.md`](./phase3/SECURITY_AUTH.md), [`phase5/RISK_REGISTER.md`](./phase5/RISK_REGISTER.md) R01-R04, [`phase5/IDENTITY_ACCESS.md`](./phase5/IDENTITY_ACCESS.md) |
| A decision reversed | a **superseding** ADR — never an edit to an accepted one (RULES.md §10) |
| The first commerce collection (cart/order) | **This trigger cannot fire.** Cart, order, delivery and payment are permanently out of scope ([ADR-038](./phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md), 2026-08-27), so no first commerce collection arrives to stale anything. A collection appearing anyway is an ADR violation to revert, not a doc refresh to schedule |

---

## 7. What this retrofit did not produce, and why

Honest gaps, so nobody hunts for a file that was never meant to exist here.

- **`PREFLIGHT_REPORT.md`** — pre-flight validates a PDR against a Papa Agent preset at startup. This run *wrote* the PDR from the tree rather than consuming one, so there was nothing to validate before Phase 1 and nothing to report. Absent by design, not skipped.
- **`phase1/CONSTRAINTS.md`, `phase2/CONSTRAINTS.md`, and conflict reports for Phases 1-2** — the shared-constraint document is written by `brainy-agent` for a *parallel* phase, and the conflict checker runs *after* one. Phases 1 and 2 ran sequentially (PDR→SYSTEM_CONTEXT→NFR, then EVENT_STORMING→UBIQUITOUS_LANGUAGE→BOUNDED_CONTEXT) because each artefact is the next one's input. No parallel phase, no injected constraints, no cross-agent seam to check. Phases 3, 4 and 5 all ran parallel and all three carry both.
- **Postgres manifest store** — not provisioned. `devprotocol status` has nothing to read. Phase and artefact state live in this file and on disk, which is why this file is item 1 of the session-restore order.
- **`work/`, `papaAgents/`, `agents.config.yaml`, `.env`** — DEVPROTOCOL's own runtime namespace. This retrofit produced the *documents*, not an installation of the framework into this workspace.

---

## 8. Working state

Branch `docs/devprotocol-retrofit`. **Nothing is committed and nothing is pushed** — the whole tree above is uncommitted work. Pushing any repo here is the user's call, always (`docs/workflow.md` → *Git rules*), and no such call has been made.

---

## 9. Phase 6 entry condition

Phases 1-5 are the pre-code protocol; Phase 6 is code. The entry condition is met — five gates closed `pass`, zero outstanding findings.

Two things bind any code written from here:

1. **[`phase5/DEFINITION_OF_DONE.md`](./phase5/DEFINITION_OF_DONE.md) is the exit criterion for every story**, not a suggestion. It restates the platform's real gates — 100% coverage on all four metrics and a 100 mutation score, `lint:check`, `tsc --noEmit` and Qodana, in `.githooks/pre-commit` and `.githooks/pre-push`. Never lower a threshold; add the test.
2. **[`phase2/UBIQUITOUS_LANGUAGE.md`](./phase2/UBIQUITOUS_LANGUAGE.md) §19 is the banned-term list.** Any non-English identifier or string, every product-type term the domain-neutral catalogue must not reintroduce, and the four commerce concepts that will never have a design (ADR-038). Check a name against it before writing it.

⚠️ **Ordering, cart, delivery and payment do not enter Phase 6 at all.** They are the one area with no existing model to copy, and on 2026-08-27 the platform owner decided all four are **permanently out of scope** ([ADR-038](./phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)). The ADR that would have had to open them is the one that closed them; re-opening any of the four takes a superseding ADR, which is the owner's call alone.
