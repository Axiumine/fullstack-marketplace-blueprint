# Epics + Stories
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.0
**Date:** 2026-08-07
**Author:** epics-agent
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
**Depends on:** `phase1/PDR.md` ✅ · `phase1/NFR.md` ✅ · `phase2/EVENT_STORMING.md` ✅ · `phase2/BOUNDED_CONTEXT.md` ✅
**Mutability:** living document - refined every sprint

---

## 1. Purpose

Index only. Stories live in `epics/ENN.md` - one file per epic, written by 4 parallel agents, never inline
here. This file lists the 11 epics, maps each to its bounded context (`phase2/BOUNDED_CONTEXT.md` §2,
BC-01..BC-11), states build state against the working tree, and links out.

Bound by `phase5/CONSTRAINTS.md` (read in full before this doc was written): one epic per BC, no epic
spans 2 BC, no BC split across 2 epics, conflict order in that doc's §7 governs if any epic file disagrees
with this index.

---

## 2. Epic overview

| ID | Epic | Bounded Context | Tier(s) served | Build state | Repos | File |
|---|---|---|---|---|---|---|
| E01 | Identity & Access | BC-01 | Admin, ShopOwner, User, anonymous (registration) | Built | `marketplace-dev-public-authorization`, `marketplace-dev-authenticated-authorization`, `marketplace-dev-admin-authenticated-authorization`, `marketplace-dev-user-authenticated-authorization`, `marketplace-dev-public-resource`, `marketplace-common` | [E01.md](epics/E01.md) |
| E02 | Session Termination | BC-02 | Admin, ShopOwner, User - one shared service | Built | `marketplace-dev-authenticated-logout` | [E02.md](epics/E02.md) |
| E03 | Shop Owner Onboarding & Approval | BC-03 | ShopOwner, Admin | Built | `marketplace-dev-authenticated-resource`, `marketplace-dev-admin-authenticated-resource`, `marketplace-common`, `marketplace-shopowner`, `marketplace-admin` | [E03.md](epics/E03.md) |
| E04 | Legal Entity / Company | BC-04 | ShopOwner, Admin, anonymous (storefront read) | Built | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-authenticated-resource`, `marketplace-dev-admin-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-shopowner`, `marketplace-admin`, `marketplace-user` | [E04.md](epics/E04.md) |
| E05 | Catalogue | BC-05 | ShopOwner (write), anonymous (read) | Built - no `price` field, commerce out of scope | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-shopowner`, `marketplace-user` | [E05.md](epics/E05.md) |
| E06 | Category Taxonomy | BC-06 | Admin (write only), ShopOwner + anonymous (read) | Built | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-admin-authenticated-resource`, `marketplace-dev-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-admin` | [E06.md](epics/E06.md) |
| E07 | Customer Account & Addresses | BC-07 | User | Built - identity/account only, no commerce | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-user-authenticated-resource`, `marketplace-dev-user-authenticated-authorization`, `marketplace-dev-public-resource`, `marketplace-user` | [E07.md](epics/E07.md) |
| E08 | Public Discovery / SSR Storefront | BC-08 | anonymous | Built | `marketplace-dev-public-resource`, `marketplace-user` | [E08.md](epics/E08.md) |
| E09 | Platform Operations & Quality Gates | BC-09 | cross-cutting - engineering concern, not a business tier | Built | all 15 repos' `.githooks/`, `marketplace-db-setup` (migration pipeline), `services-status` | [E09.md](epics/E09.md) |
| E10 | Shared Kernel (marketplace-common) | BC-10 | cross-cutting - consumed by all 9 backend services | Built | `marketplace-common` | [E10.md](epics/E10.md) |
| E11 | Ordering & Fulfilment [PLANNED - NOT BUILT] | BC-11 | User (intended, unbuilt) | Not built - no collection, no resolver, no design | none | [E11.md](epics/E11.md) |

---

## 3. How to read a story here

Brownfield retrofit. Most stories in `epics/*.md` describe work ALREADY SHIPPED, not work still ahead.

- **Built** story = code exists now, cites the real path proving it (resolver file, migration file,
  frontend route) - never phrased "we will build X" for something already running.
- **Open** story = genuinely missing, no model to copy. Only E11 carries these, and per
  `phase5/CONSTRAINTS.md` §6 even those stop at recording the gap - no schema, no resolver signature, no
  checkout sequence gets designed in this protocol.
- "Built" ≠ "coverage green". `phase5/CONSTRAINTS.md` BCON-04: a vitest project with zero matching files
  still reports 100% and passes (`BEs/dev/marketplace-dev-user-authenticated-resource/test/integration/`
  was exactly this until 2026-08-07). A Built story's proof path is a resolver/model/route, not a
  checkmark alone.
- Acceptance criteria are mechanically checkable per BCON-01 - a gate name, a test file path, an
  `.explain()` output. "Works well" is never a criterion.
- Story IDs: `ENN-SNN`, sequential per epic, restart per epic - `E01-S01`, `E01-S02`, `E07-S01`. Never a
  global counter.

---

## 4. Bounded-context coverage

Every BC-01..BC-11 gets exactly one epic, 1:1, source `phase2/BOUNDED_CONTEXT.md` §2.

| BC | Epic |
|---|---|
| BC-01 | E01 |
| BC-02 | E02 |
| BC-03 | E03 |
| BC-04 | E04 |
| BC-05 | E05 |
| BC-06 | E06 |
| BC-07 | E07 |
| BC-08 | E08 |
| BC-09 | E09 |
| BC-10 | E10 |
| BC-11 | E11 |

---

## 5. Phase 1-4 document coverage

Every mandatory Phase 1-4 document has at least one implementing epic.

| Document | Implementing epic(s) |
|---|---|
| `phase1/PDR.md` | All (E01-E11) - scope + outcomes shape every epic |
| `phase1/SYSTEM_CONTEXT.md` | All (E01-E11) - actor/system boundary crosses every epic |
| `phase1/NFR.md` | All (E01-E11) - critical set NFR-SE01-SE09, SE11, SE12, AV01, AV02, MA01, MA02, MA05, CO01 must land on ≥1 story each (`phase5/CONSTRAINTS.md` §5) |
| `phase2/UBIQUITOUS_LANGUAGE.md` | All (E01-E11) - story language must match its glossary, no banned term |
| `phase2/EVENT_STORMING.md` | E01, E02, E03, E05, E07, E08, E11 - commands/flows map to these |
| `phase2/BOUNDED_CONTEXT.md` | All (E01-E11) - 1:1 source, §4 above |
| `phase3/C4_CONTEXT.md` | E08, E09 - external actors/systems at the boundary |
| `phase3/C4_CONTAINER.md` | E01, E09, E10 - the 9-service + 3-frontend + common split |
| `phase3/SECURITY_AUTH.md` | E01, E02 - opaque token + Redis session + tier-assert model |
| `phase3/INFRA.md` | E09 - deploy, nginx, Redis cluster / MongoDB topology |
| `phase3/CONSTRAINTS.md` | E09 - CON-01..CON-11 enforced by the gate layer |
| `phase3/adr/ADR-INDEX.md` | All (E01-E11) - 29 ADRs, no epic may contradict its area |
| `phase4/ERD.md` | E03, E04, E05, E06, E07 - the 6-collection data model |
| `phase4/DDD_AGGREGATES.md` | E03, E04, E05, E06, E07 - aggregate invariants |
| `phase4/API_CONTRACTS.md` | E01-E08 - one story-group per resource-service surface |
| `phase4/ERROR_HANDLING.md` | All (E01-E11) - error principles cross every resolver |
| `phase4/CONSTRAINTS.md` | E09 - DCON-01..DCON-09 enforced by validators/resolvers |

---

## 6. Out of scope (binding here too - `phase5/CONSTRAINTS.md` §6)

No story anywhere under `epics/` designs order, cart, delivery, or payment. E11 records the BC-11 gap and
its blocking open questions from `phase2/BOUNDED_CONTEXT.md` BC-11 - never a schema, a resolver signature,
a field, or a checkout sequence diagram. A risk-register row naming the gap is in scope for a sibling
Phase 5 doc; a story designing the fix is not in scope for `epics/E11.md`.
