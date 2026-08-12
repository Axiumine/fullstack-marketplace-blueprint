# Epics + Stories
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.12
**Date:** 2026-08-12
**Author:** epics-agent
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
v1.1 - added E12-E18, the remediation backlog for `docs/report/token-handling-security-audit.md` v1.1.
These seven do **not** follow the one-epic-per-BC rule; see §2.2. ⚠️ That rule no longer exists — read the
v1.4 line below before treating this sentence as a live caveat.
v1.2 - E12, E13 and E14 implemented 2026-08-10; their story markers and the three §1 rows now read per
story, and each of those epics carries a §7 saying what did not land and what blocks it.
v1.3 - E14-S09 run the same day against the running Dev stack, closing E14 at 9 of 9. Its finding is
[`docs/report/multi-tab-refresh-behaviour.md`](../../report/multi-tab-refresh-behaviour.md).
v1.4 - 2026-08-11: the one-epic-per-BC rule is gone from [`CONSTRAINTS.md`](./CONSTRAINTS.md) §5, which is
the record of that decision, so the v1.1 note above is history rather than a live caveat — E12-E18 break no
rule. §1, §2.2 and §4 rewritten accordingly, the index's context column is now marked informational, and the
BC-12 once proposed for E16 and E17 is withdrawn: it existed only to satisfy the removed rule, so with the
rule gone there is nothing left for it to do, and `phase2/BOUNDED_CONTEXT.md` keeps its eleven contexts.
v1.5 - 2026-08-11: E12-S12 and E12-S13 run, closing E12's two investigations. Findings at
[`docs/report/log-sink-inventory.md`](../../report/log-sink-inventory.md) and
[`docs/report/sentry-event-capture.md`](../../report/sentry-event-capture.md). They opened E12-S16 … E12-S23,
so E12 is now 15 of 24 rather than 13 of 15, and one of the eight is 🔴 and live.
v1.6 - 2026-08-11: E12-S24 added, so E12 reads 15 of 24. E12-S22 claimed the transaction-scrubbing gap was
latent because no service sets a `tracesSampleRate`; the three frontends set `0.1` and configure no
`beforeSend`, and none depends on the package holding the scrubber.
v1.7 - 2026-08-11: the platform owner answered E12 §6 question 1 — raw addresses stay in the nginx
error log, rotation 14–30 days with `shred`, no personal data in the access log, two lines in a privacy
policy. E12-S19 stops waiting on it and E12-S25 is added to write the notice, so E12 reads 15 of 25.
v1.8 - 2026-08-11: the owner chose the mechanism for question 2 and **E12-S16 is built** — the mailed
`:email/:hash` links are redacted out of the nginx access log and out of the `Referer` beside it, at http
level, because four link shapes carry them and only two have a `location` block. E12 reads 16 of 25.
v1.9 - 2026-08-11: **E12-S26 added**, from the owner asking whether E12-S16's residual — the credential still
travelling in the URL — can be closed instead of accepted. It can, for the customer reset flow: the link
moves into the URL fragment, which no browser sends, so the value stops reaching the log, the `Referer`, the
cache key and Cloudflare at once. It cannot for the two verify flows, which are REST `GET`s. E12 reads 16 of 26.
v1.10 - 2026-08-11: E12-S26's **cache criterion is built** the same day, ahead of the fragment itself — nginx
no longer stores a response whose URL carries a mailed credential. That one was not merely prospective: with
the bypass reverted, a second request to a reset link answers `HIT`, so the address and the live hash were
being kept as a cache key under `inactive=24h`. The session-cookie map could not have caught it, because a
visitor following a reset link is anonymous. E12-S26 is `partly built`; E12 still reads 16 of 26.
v1.12 - 2026-08-12: **E03-S08** — a seller registers themselves. E03's row gains the anonymous tier, three
repos and the caveat that an approved self-registered account still has no onboarding flow to walk. It is
the first story to put an unauthenticated write to `shopOwner` on `marketplace-dev-public-resource`, which
is why the epic now touches the public service and the public app.
v1.11 - 2026-08-11: **E12 is complete — 26 of 26.** The ten stories opened after the two investigations all
landed the same day they were written: E12-S17 … E12-S20 (Redis password out of argv, bounded container logs,
edge log retention, four `console` calls deleted), E12-S21 … E12-S23 as one edit to the same `Sentry.init`
call in nine services, E12-S25 (the platform's first privacy notice), E12-S26 (the customer reset credential
moved into the URL fragment) and finally E12-S24. That last one captured nine real browser envelopes and
turned two code-reads into measurements: `httpBodies: []` holds on the browser transport, `urlQueryParams:
false` does **not** — the SDK copies the whole address bar into five places on both event kinds — and
`browserTracingIntegration` is not a default integration, so the `tracesSampleRate: 0.1` all three frontends
set has been a rate applied to nothing. `sentryBeforeSend` now runs as both hooks in all three apps, from one
implementation in `marketplace-common`.
**Depends on:** `phase1/PDR.md` ✅ · `phase1/NFR.md` ✅ · `phase2/EVENT_STORMING.md` ✅ · `phase2/BOUNDED_CONTEXT.md` ✅
**Mutability:** living document - refined every sprint

---

## 1. Purpose

Index only. Stories live in `epics/ENN.md` - one file per epic, written by 4 parallel agents, never inline
here. This file lists the 18 epics, states build state against the working tree, and links out.

Every epic is bound by `phase5/CONSTRAINTS.md` (read in full before this doc was written), and the conflict
order in that doc's §7 governs if any epic file disagrees with this index. **No epic is bound to a bounded
context**: `phase5/CONSTRAINTS.md` §5 attaches no such rule, an epic never owns a context, and the context
column above is a reading aid. See §2.1 for why E12-E18 are numbered as they are.

---

## 2. Epic overview

| ID | Epic | Contexts touched (informational) | Tier(s) served | Build state | Repos | File |
|---|---|---|---|---|---|---|
| E01 | Identity & Access | BC-01 | Admin, ShopOwner, User, anonymous (registration) | Built | `marketplace-dev-public-authorization`, `marketplace-dev-authenticated-authorization`, `marketplace-dev-admin-authenticated-authorization`, `marketplace-dev-user-authenticated-authorization`, `marketplace-dev-public-resource`, `marketplace-common` | [E01.md](epics/E01.md) |
| E02 | Session Termination | BC-02 | Admin, ShopOwner, User - one shared service | Built | `marketplace-dev-authenticated-logout` | [E02.md](epics/E02.md) |
| E03 | Shop Owner Onboarding & Approval | BC-03 | ShopOwner, Admin, **anonymous (self-registration)** | Built - onboarding itself still has no flow | `marketplace-dev-authenticated-resource`, `marketplace-dev-admin-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-common`, `marketplace-db-setup`, `marketplace-shopowner`, `marketplace-admin`, `marketplace-user` | [E03.md](epics/E03.md) |
| E04 | Legal Entity / Company | BC-04 | ShopOwner, Admin, anonymous (storefront read) | Built | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-authenticated-resource`, `marketplace-dev-admin-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-shopowner`, `marketplace-admin`, `marketplace-user` | [E04.md](epics/E04.md) |
| E05 | Catalogue | BC-05 | ShopOwner (write), anonymous (read) | Built - no `price` field, commerce out of scope | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-shopowner`, `marketplace-user` | [E05.md](epics/E05.md) |
| E06 | Category Taxonomy | BC-06 | Admin (write only), ShopOwner + anonymous (read) | Built | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-admin-authenticated-resource`, `marketplace-dev-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-admin` | [E06.md](epics/E06.md) |
| E07 | Customer Account & Addresses | BC-07 | User | Built - identity/account only, no commerce | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-user-authenticated-resource`, `marketplace-dev-user-authenticated-authorization`, `marketplace-dev-public-resource`, `marketplace-user` | [E07.md](epics/E07.md) |
| E08 | Public Discovery / SSR Storefront | BC-08 | anonymous | Built | `marketplace-dev-public-resource`, `marketplace-user` | [E08.md](epics/E08.md) |
| E09 | Platform Operations & Quality Gates | BC-09 | cross-cutting - engineering concern, not a business tier | Built | all 16 repos' `.githooks/`, `marketplace-db-setup` (migration pipeline), `services-status` | [E09.md](epics/E09.md) |
| E10 | Shared Kernel (marketplace-common) | BC-10 | cross-cutting - consumed by all 9 backend services | Built | `marketplace-common` | [E10.md](epics/E10.md) |
| E11 | Ordering & Fulfilment [PLANNED - NOT BUILT] | BC-11 | User (intended, unbuilt) | Not built - no collection, no resolver, no design | none | [E11.md](epics/E11.md) |
| E12 | Telemetry & Egress Hardening | hardens BC-09 | cross-cutting - all 9 backend services + the edge | Built - 26 of 26, closed 2026-08-11. E12-S12 and E12-S13 ran against the running Dev stack and found eight defects the static audit could not, which are the new E12-S16 … E12-S23, checking one of those against the frontends added E12-S24, the owner's log-retention answer added E12-S25, and the owner refusing to accept E12-S16's residual added E12-S26 — the customer reset link moves into the URL fragment, out of every log and cache at once, and its cache half is already built. **Every defect either investigation found is fixed**, the 🔴 among them: no service with a `DSN` set ships a request body any more, and E12-S24's browser capture closed the last one — the address bar, query string and fragment included, was reaching Sentry from all three frontends in five distinct places, and `urlQueryParams: false` never gated it. **One item is still not this repo's to close:** E12-S15's config is in the repo but Authenticated Origin Pulls must be switched on in Cloudflare **before** it is deployed, or every handshake fails from the reload. See [E12.md](epics/E12.md) §7 | all 9 backend services, `marketplace-common`, `marketplace-nginx`, `docker-DBs`, `marketplace-user`, `marketplace-admin`, `marketplace-shopowner` | [E12.md](epics/E12.md) |
| E13 | Session-Store Hardening & Recorded Decisions | hardens BC-01, BC-09, BC-10 | cross-cutting | Built 2026-08-10 - 10 of 11. E13-S10 removes the dual-read fallback and may not run before `DUAL_READ_REMOVE_AFTER`, whose date is re-stamped at the cutover deploy. See [E13.md](epics/E13.md) §7 | `marketplace-common`, `marketplace-dev-authenticated-logout`, the three resource services, the four authorization services, `docs/` | [E13.md](epics/E13.md) |
| E14 | Refresh Family, Reuse Detection & Absolute Lifetime | hardens BC-01, BC-10 | Admin, ShopOwner, User | Built 2026-08-10 - 9 of 9. E14-S09 was run against the Dev stack and `GRACE_SECONDS = 10` is confirmed on measurement; its finding names two defects *under* the epic that stay open. See [E14.md](epics/E14.md) §7 and [multi-tab-refresh-behaviour.md](../../report/multi-tab-refresh-behaviour.md) | `marketplace-common`, `marketplace-dev-public-authorization`, the three `*-authenticated-authorization` services, `marketplace-admin`, `marketplace-shopowner`, `marketplace-user` | [E14.md](epics/E14.md) |
| E15 | Session Index, Account Revocation & Credential Teardown | hardens BC-01, BC-02, BC-03 | Admin, ShopOwner, User | 2 of 9 built - E15-S01 closed the live `logout` no-op and E15-S09 the context type that hid it, both 2026-08-12; `marketplace-dev-authenticated-logout` is done until the index prune | `marketplace-dev-authenticated-logout`, `marketplace-common`, `marketplace-dev-public-authorization`, the three `*-resource` services | [E15.md](epics/E15.md) |
| E16 | Signing-Key Custody & Rotation | BC-01, BC-10 | Admin (operates), all tiers (affected) | Not built - RISK_REGISTER R02 | `marketplace-db-setup`, `marketplace-common`, the five cookie-touching services, `marketplace-dev-admin-authenticated-resource` | [E16.md](epics/E16.md) |
| E17 | Admin Session Console | BC-01, BC-10 | Admin | Not built | `marketplace-dev-admin-authenticated-resource`, `marketplace-admin`, `marketplace-common` | [E17.md](epics/E17.md) |
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

### 2.2 Why E12-E18 are a separate block

E01-E11 are a **retrofit index** describing a platform that already exists; each happens to line up with one
bounded context because that is how the domain map was walked when they were written, one entry at a time.

E12-E18 are a **remediation backlog** against
[`docs/report/token-handling-security-audit.md`](../../report/token-handling-security-audit.md) v1.1, and a
security finding does not respect context boundaries. Finding §3.5 alone touches all nine services; finding
§3.6a changes a key shape that BC-01, BC-02 and BC-10 all read.

Forcing them into the existing eleven would have meant appending unrelated hardening stories to epics that
currently read as an accurate description of shipped code, which is the more damaging of the two options.

They are a separate block because their **source** differs (a dated audit, cited in every one of the seven
headers) and their **nature** differs (remediation of shipped code rather than description of it) — *not*
because they fail a context rule. There is no context rule: `phase5/CONSTRAINTS.md` §5 stopped requiring one
on 2026-08-11, so an epic spanning nine services or naming no context at all is ordinary. E16 and E17, the
two of the seven that describe genuinely new capability rather than hardening, need no context of their own
to exist under; the BC-12 once proposed for them is **withdrawn**, because it was only ever proposed to give
those two epics a context to own under the rule that has since gone. `phase2/BOUNDED_CONTEXT.md` is untouched
and the eleven contexts stand. If key custody ever earns a context, it earns one as domain modelling, by the
route that document's Mutability line describes — not because an epic needs somewhere to live.

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

## 4. Which epics touch which context

**Informational only. No epic owns a bounded context and none is required to name one**
(`phase5/CONSTRAINTS.md` §5). This table exists so a reader who knows the domain map can find the epics that
change code in an area — nothing validates it, nothing fails if an epic is missing from it.

That E01-E11 line up one-for-one with BC-01-BC-11 is a coincidence of how the retrofit index was written,
not a property of epics. A future epic may span several rows, or appear in none.

| BC | Described by | Also changed by |
|---|---|---|
| BC-01 | E01 | E13, E14, E15, E16, E17 |
| BC-02 | E02 | E15 |
| BC-03 | E03 | E15 (E15-S07 status change revokes sessions) |
| BC-04 | E04 | - |
| BC-05 | E05 | - |
| BC-06 | E06 | - |
| BC-07 | E07 | - |
| BC-08 | E08 | - |
| BC-09 | E09 | E12, E13, E18 |
| BC-10 | E10 | E13, E14, E15, E16, E17, E18 |
| BC-11 | E11 | - |

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
| `phase2/BOUNDED_CONTEXT.md` | All (E01-E11) - the domain map they describe, §4 above; not a rule over epics |
| `phase3/C4_CONTEXT.md` | E08, E09 - external actors/systems at the boundary |
| `phase3/C4_CONTAINER.md` | E01, E09, E10 - the 9-service + 3-frontend + common split |
| `phase3/SECURITY_AUTH.md` | E01, E02 - opaque token + Redis session + tier-assert model |
| `phase3/INFRA.md` | E09 - deploy, nginx, Redis cluster / MongoDB topology |
| `phase3/CONSTRAINTS.md` | E09 - CON-01..CON-12 enforced by the gate layer (CON-12 via E01-S10's eslint block) |
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
| §5 all six blind spots | E12-S12, E12-S13, E14-S09, E16-S09, E18-S04, E18-S05, E18-S09 — three now run: E14-S09 ([finding](../../report/multi-tab-refresh-behaviour.md)), E12-S12 ([finding](../../report/log-sink-inventory.md)) and E12-S13 ([finding](../../report/sentry-event-capture.md)) |

---

## 6. Out of scope (binding here too - `phase5/CONSTRAINTS.md` §6)

No story anywhere under `epics/` designs order, cart, delivery, or payment. E11 records the BC-11 gap and
its blocking open questions from `phase2/BOUNDED_CONTEXT.md` BC-11 - never a schema, a resolver signature,
a field, or a checkout sequence diagram. A risk-register row naming the gap is in scope for a sibling
Phase 5 doc; a story designing the fix is not in scope for [`epics/E11.md`](./epics/E11.md).
