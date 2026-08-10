# Epics + Stories
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.3
**Date:** 2026-08-07
**Author:** epics-agent
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
v1.1 - added E12-E18, the remediation backlog for `docs/report/token-handling-security-audit.md` v1.1.
These seven do **not** follow the one-epic-per-BC rule; see §2.2 and [`AMENDMENTS.md`](./AMENDMENTS.md).
v1.2 - E12, E13 and E14 implemented 2026-08-10; their story markers and the three §1 rows now read per
story, and each of those epics carries a §7 saying what did not land and what blocks it.
v1.3 - E14-S09 run the same day against the running Dev stack, closing E14 at 9 of 9. Its finding is
[`docs/report/multi-tab-refresh-behaviour.md`](../../report/multi-tab-refresh-behaviour.md).
**Depends on:** `phase1/PDR.md` ✅ · `phase1/NFR.md` ✅ · `phase2/EVENT_STORMING.md` ✅ · `phase2/BOUNDED_CONTEXT.md` ✅
**Mutability:** living document - refined every sprint

---

## 1. Purpose

Index only. Stories live in `epics/ENN.md` - one file per epic, written by 4 parallel agents, never inline
here. This file lists the 18 epics, maps each to its bounded context (`phase2/BOUNDED_CONTEXT.md` §2,
BC-01..BC-11), states build state against the working tree, and links out.

E01-E11 are bound by `phase5/CONSTRAINTS.md` (read in full before this doc was written): one epic per BC,
no epic spans 2 BC, no BC split across 2 epics, conflict order in that doc's §7 governs if any epic file
disagrees with this index. **E12-E18 do not satisfy that rule** - see §2.2, and §2.1 for why they are numbered as they are.

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
| E09 | Platform Operations & Quality Gates | BC-09 | cross-cutting - engineering concern, not a business tier | Built | all 16 repos' `.githooks/`, `marketplace-db-setup` (migration pipeline), `services-status` | [E09.md](epics/E09.md) |
| E10 | Shared Kernel (marketplace-common) | BC-10 | cross-cutting - consumed by all 9 backend services | Built | `marketplace-common` | [E10.md](epics/E10.md) |
| E11 | Ordering & Fulfilment [PLANNED - NOT BUILT] | BC-11 | User (intended, unbuilt) | Not built - no collection, no resolver, no design | none | [E11.md](epics/E11.md) |
| E12 | Telemetry & Egress Hardening | hardens BC-09 | cross-cutting - all 9 backend services + the edge | Built 2026-08-10 - 13 of 15. E12-S12 and E12-S13 are investigations needing the running Dev stack; E12-S15's config is in the repo but Authenticated Origin Pulls must still be switched on in Cloudflare, **before** the config is deployed. See [E12.md](epics/E12.md) §7 | all 9 backend services, `marketplace-common`, `marketplace-nginx` | [E12.md](epics/E12.md) |
| E13 | Session-Store Hardening & Recorded Decisions | hardens BC-01, BC-09, BC-10 | cross-cutting | Built 2026-08-10 - 10 of 11. E13-S10 removes the dual-read fallback and may not run before `DUAL_READ_REMOVE_AFTER`, whose date is re-stamped at the cutover deploy. See [E13.md](epics/E13.md) §7 | `marketplace-common`, `marketplace-dev-authenticated-logout`, the three resource services, the four authorization services, `docs/` | [E13.md](epics/E13.md) |
| E14 | Refresh Family, Reuse Detection & Absolute Lifetime | hardens BC-01, BC-10 | Admin, ShopOwner, User | Built 2026-08-10 - 9 of 9. E14-S09 was run against the Dev stack and `GRACE_SECONDS = 10` is confirmed on measurement; its finding names two defects *under* the epic that stay open. See [E14.md](epics/E14.md) §7 and [multi-tab-refresh-behaviour.md](../../report/multi-tab-refresh-behaviour.md) | `marketplace-common`, `marketplace-dev-public-authorization`, the three `*-authenticated-authorization` services, `marketplace-admin`, `marketplace-shopowner`, `marketplace-user` | [E14.md](epics/E14.md) |
| E15 | Session Index, Account Revocation & Credential Teardown | hardens BC-01, BC-02, BC-03 | Admin, ShopOwner, User | Not built - and `logout` is a live no-op, see E15-S01 | `marketplace-dev-authenticated-logout`, `marketplace-common`, `marketplace-dev-public-authorization`, the three `*-resource` services | [E15.md](epics/E15.md) |
| E16 | Signing-Key Custody & Rotation | **BC-12 (proposed)** | Admin (operates), all tiers (affected) | Not built - RISK_REGISTER R02 | `marketplace-db-setup`, `marketplace-common`, the five cookie-touching services, `marketplace-dev-admin-authenticated-resource` | [E16.md](epics/E16.md) |
| E17 | Admin Session Console | **BC-12 (proposed)** | Admin | Not built | `marketplace-dev-admin-authenticated-resource`, `marketplace-admin`, `marketplace-common` | [E17.md](epics/E17.md) |
| E18 | Auth Regression Coverage & Documentation Truth-Up | hardens BC-09, BC-10 | cross-cutting | Not built - 1 of 3 resource services tests its reject path | `marketplace-dev-authenticated-resource`, `marketplace-dev-admin-authenticated-resource`, all 9 services, `docs/` | [E18.md](epics/E18.md) |

### 2.1 E12-E18 are numbered in landing order

E01-E11 are numbered by bounded context. **E12-E18 are numbered by the order they should land**, because a
remediation backlog with a dependency chain is read as a sequence and numbering it any other way invites the
wrong one:

| # | Epic | Why here |
|---|---|---|
| E12 | Telemetry & Egress Hardening | Depends on nothing, blocks nothing, and E12-S01 (`rejectUnauthorized`) is severe and near-free. No reason to wait |
| E13 | Session-Store Hardening | E13-S01 hashes the session key namespace. E14's `family:`/`used:` keys and E15's `idx:` hash all store session key names - built before this, they are *new* raw-token structures and a Redis dump comes out worse than it went in |
| E14 | Refresh Family & Absolute Lifetime | Widens `IRefreshData`, which E15 also writes to. Landing it second avoids editing that type and the four login writers twice |
| E15 | Session Index & Credential Teardown | Needs E13's hashed keys and E14's session shape. **E15-S01, the broken-logout fix, is exempt and should land ahead of everything** - it is a four-character fix to a live defect and touches no key shape |
| E16 | Signing-Key Custody | Independent of E13-E15; placed here so it sits next to the console that operates it |
| E17 | Admin Session Console | Renders E15's index, E14's reuse events and E16's resolvers. Cannot precede any of them |
| E18 | Coverage & Documentation Truth-Up | Records what the other six did, so it closes last. **E18-S01 is the exception** - the `assertTier` reject tests depend on nothing and the audit ranks them second overall |

This ordering deviates from the audit's own §6 suggested sequence, which put §3.3/§3.4 first. The reason is
E13: the audit ranked findings by severity, not by which fix makes the next fix safe to build.

### 2.2 Why E12-E18 break the one-epic-per-BC rule

E01-E11 are a **retrofit index**: one epic per bounded context, describing a platform that already exists.
E12-E18 are a **remediation backlog** against
[`docs/report/token-handling-security-audit.md`](../../report/token-handling-security-audit.md) v1.1, and a
security finding does not respect context boundaries. Finding §3.5 alone touches all nine services; finding
§3.6a changes a key shape that BC-01, BC-02 and BC-10 all read.

Forcing them into the existing eleven would have meant appending unrelated hardening stories to epics that
currently read as an accurate description of shipped code, which is the more damaging of the two options.

Two of the seven - E16 and E17 - describe genuinely new capability rather than hardening, and are proposed
under a new **BC-12 — Session Administration & Key Custody**. That context does not exist yet:
[`phase2/BOUNDED_CONTEXT.md:10`](../phase2/BOUNDED_CONTEXT.md) requires team sign-off to modify and defines
no procedure for adding a context. The proposed text for BC-12, and the matching change to
[`phase5/CONSTRAINTS.md`](./CONSTRAINTS.md) §5's "11 epic, one per BC-01..BC-11", are written up in
[`AMENDMENTS.md`](./AMENDMENTS.md) **for sign-off - neither baselined document has been edited.**

Until that sign-off, E12-E18 are a valid backlog whose §4 stories stand on their own, and §4 below records
the coverage table as it will read *if* the amendment is accepted.

---

## 3. How to read a story here

Brownfield retrofit. Most stories in `epics/*.md` describe work ALREADY SHIPPED, not work still ahead.

- **Built** story = code exists now, cites the real path proving it (resolver file, migration file,
  frontend route) - never phrased "we will build X" for something already running.
- **Open** story = genuinely missing, no model to copy. Among E01-E11, only E11 carries these, and per
  `phase5/CONSTRAINTS.md` §6 even those stop at recording the gap - no schema, no resolver signature, no
  checkout sequence gets designed in this protocol. **E12-E18 were open throughout when written**, by
  construction: they described remediation that had not been built. E12, E13 and E14 landed on 2026-08-10
  and are open only where each epic's §7 says so; E15-E18 are still open throughout. Unlike E11 they *do*
  carry design detail, because the §6 prohibition scopes to order/cart/delivery/payment, not to security
  hardening of shipped code.
- **Status tag vocabulary is two values only** - `built` and `not built`. E15-E18 use `not built`
  uniformly; E12-E14 now carry a marker per story, and each of those three epics ends with a §7 naming what
  stayed `not built` and why. A partially-correct mechanism is `not built` with the defect named in the
  epic's §3 - or `built` with the shortfall named in its §7, never a marker that implies more than landed.
- An **investigation story** produces a written finding and nothing else. Its acceptance criteria describe
  what the finding must contain and where each outcome is routed, never a code change. E12-S12, E12-S13,
  E14-S09, E16-S09, E18-S04, E18-S05 and E18-S09 are the seven, and they exist because the audit's §5 names
  its own blind spots rather than hiding them.
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

Every BC-01..BC-11 gets exactly one **describing** epic, 1:1, source `phase2/BOUNDED_CONTEXT.md` §2. The
hardening column is additive and does not break that 1:1: E12-E18 change code inside those contexts without
claiming ownership of them.

| BC | Describing epic | Hardened by |
|---|---|---|
| BC-01 | E01 | E13, E14, E15 |
| BC-02 | E02 | E15 |
| BC-03 | E03 | E15 (E15-S07 status change revokes sessions) |
| BC-04 | E04 | - |
| BC-05 | E05 | - |
| BC-06 | E06 | - |
| BC-07 | E07 | - |
| BC-08 | E08 | - |
| BC-09 | E09 | E12, E13, E18 |
| BC-10 | E10 | E13, E14, E15, E18 |
| BC-11 | E11 | - |
| **BC-12 (proposed)** | **E16, E17** | - |

BC-12 is the one genuine exception: two epics, one context, because key custody (E16) and the operator
surface over it (E17) are separable deliverables with different repos and different landing orders. If the
amendment is rejected, both fold into E01's context and the 1:1 rule holds with E16 and E17 as hardening
rows against BC-01.

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
| `docs/report/token-handling-security-audit.md` v1.1 | E12-E18 - every §3 finding, every §5 blind spot, and the four §4 "do not fix" items recorded so they are not fixed |

Finding-to-epic map, so no audit finding is left unassigned:

| Finding | Epic |
|---|---|
| §3.1 rotation without reuse detection | E14 |
| §3.2 no absolute session lifetime | E14 |
| §3.3 no credential write invalidates a session | E15 |
| §3.4 old access token survives refresh | E14 |
| §3.5 `sendDefaultPii` + `rejectUnauthorized = false` | E12 |
| §3.6a raw tokens as Redis keys | E13 |
| §3.6b no account→sessions index | E15, surfaced by E17 |
| §3.6c `INTROSPECTION_CODE` comparison and reachability | E13-S03 (comparison), E13-S11 (bypass disabled outside development), E13-S09 (reachability) |
| §3.6d `assertTier` reject path untested in 2 of 3 | E18 |
| §3.6e `waitApprov` claimed but not enforced | E15 |
| §3.6f Keygrip rotation unused (= R02) | E16, operated by E17 |
| §3.7a `rememberMe` inert | E14 |
| §3.7b Redis persistence / TLS undocumented | E13 |
| §3.7c `SameSite` in no ADR | E13 |
| §3.7d stale docstring | E13 |
| §4 ADR-018 prose wrong, scope load-bearing | E13-S07 - **prose only, the scope is not touched** |
| §5 all six blind spots | E12-S12, E12-S13, E14-S09, E16-S09, E18-S04, E18-S05, E18-S09 |

---

## 6. Out of scope (binding here too - `phase5/CONSTRAINTS.md` §6)

No story anywhere under `epics/` designs order, cart, delivery, or payment. E11 records the BC-11 gap and
its blocking open questions from `phase2/BOUNDED_CONTEXT.md` BC-11 - never a schema, a resolver signature,
a field, or a checkout sequence diagram. A risk-register row naming the gap is in scope for a sibling
Phase 5 doc; a story designing the fix is not in scope for [`epics/E11.md`](./epics/E11.md).
