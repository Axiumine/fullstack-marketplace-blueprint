# E02 — Session Termination
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.1
**Date:** 2026-08-13
**Author:** epics-agent
**Bounded context:** BC-02 — Session Termination

## 0. Why this record is not under `epics/`

It was `phase5/epics/E02.md` until 2026-08-13. The file was deleted and its record moved here in one pass,
for the same reason [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md) moved earlier the same day: nothing in it
was work still ahead. Four of the five stories are `built`, and the fifth is an **anti-story** — a boundary
to defend, not a task queue item — so the file had become the *record* of a shipped surface rather than a
backlog entry. `EPICS_STORIES.md` §1 still says stories live in `epics/ENN.md`, and that stays true for
E04..E18; E01, E02 and E03 are the three whose records sit beside the index instead of under it —
E03's is [`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md), moved 2026-08-14.

**The story IDs did not change.** `E02-S01` … `E02-S05` are cited by `SEQUENCE_DIAGRAMS.md` (via
`CONFLICT_REPORT.md` §5's flow↔story map) and by this file's own cross-references. Every one of those
resolves to a section below. Renumbering on a move was refused for E01 and is refused here for the same
reason: an ID is a name, and moving a file is not a reason to change a name.

**What is deliberately not repeated here.** The reasoning for one logout service across three tiers is
specified once, in
[`ADR-005`](../phase3/adr/ADR-005-single-logout-service-all-tiers.md), and the two options it rejected are
in that ADR's options table. The stories below say what each one had to satisfy and where the code is, not
why the tier-blind design is right.

## 1. Epic goal

Delete a session's Redis keys given only the token content — one shared `logout` mutation for `Admin`,
`ShopOwner` and `User` alike, because deletion needs no knowledge of which collection minted the token.
Stay tier-blind on purpose: this is what lets one process serve three tiers where authorization (BC-01)
cannot.

## 2. Scope

| Item | In/Out | Why |
|---|---|---|
| `logout` mutation, `marketplace-dev-authenticated-logout` (port 4030) | In | the whole of BC-02 |
| Deleting the refresh-token Redis key and the access-token Redis key | In | the mutation's entire effect |
| `helloLogout` smoke-test query | In | same repo, same service |
| Session creation, session content, `tier` field | Out | BC-01 owns minting; BC-02 never reads `tier` |
| Refresh-cookie clearing semantics beyond the delete itself | Out | cookie is cleared as part of the same call but its signing/verification is BC-01's `Tier`/Keygrip machinery |
| Per-tier logout mutations (`logoutAdmin`, `logoutUser`, …) | Out | evaluated and rejected — ADR-005; would reintroduce the tier-dispatch pattern BC-01 exists to avoid |

## 3. Build state

Fully built, one repo, one mutation:

- `BEs/dev/marketplace-dev-authenticated-logout` — the whole repo is this epic
- `BEs/dev/marketplace-dev-authenticated-logout/src/graphQLApi/schema/mutations/logout.mts` — the
  `logout` resolver
- `BEs/dev/marketplace-dev-authenticated-logout/src/lib/authorizationLogoutHandler.mts:60,74` — the two
  `del` calls
- `BEs/dev/marketplace-dev-authenticated-logout/test` — unit suite (this repo's `test/integration/` has
  no Mongo — the service never touches it, only Redis)

All three frontends (`marketplace-admin`, `marketplace-shopowner`, `marketplace-user`) already point their
logout call at port 4030. Nothing designed-but-unbuilt in this context.

## 4. Stories

### E02-S01 — `logout` deletes both session keys by token content   `built`
**As an** Admin, ShopOwner or User, **when** I call `logout`, **I want** my refresh-token and access-token
Redis keys deleted **so that** neither token can be used again regardless of which collection authenticated
me.
**domains:** backend, database
**Acceptance criteria:**
- Resolver deletes `${REDIS_KEY}${ctx.state.user.refreshToken}` —
  `BEs/dev/marketplace-dev-authenticated-logout/src/lib/authorizationLogoutHandler.mts:60`
- Resolver deletes the matching access-token key —
  `BEs/dev/marketplace-dev-authenticated-logout/src/lib/authorizationLogoutHandler.mts:74`
- `logout` answers `Boolean!` and never reads or asserts a `tier` field anywhere in its call path —
  `BEs/dev/marketplace-dev-authenticated-logout/src/graphQLApi/schema/mutations/logout.mts:11-27`
**Traces:** NFR-AV02; ADR-005
**Evidence:** `mutations/logout.mts:11-27`, `authorizationLogoutHandler.mts:60,74`

### E02-S02 — Redis cluster forces two single-key deletes, never one multi-key call   `built`
State plainly: because Redis is deployed as a cluster, the refresh-token key and the access-token key must
be deleted with two separate single-key `del` calls — a multi-key `del` across cluster slots throws
`CROSSSLOT`.
**domains:** backend, database, infra
**Acceptance criteria:**
- `authorizationLogoutHandler.mts` issues two distinct `del` calls (lines 60 and 74), never one call with
  an array of both keys
- No test or resolver in this repo constructs a multi-key `del` against `REDIS_KEY`-prefixed keys —
  verified by reading every call site under `BEs/dev/marketplace-dev-authenticated-logout/src/lib/`
**Traces:** NFR-SC03; BCON-08
**Evidence:** `authorizationLogoutHandler.mts:60,74`

### E02-S03 — Logout stays tier-blind by construction, not by convention   `built`
State plainly: this service's `start()` must connect to Redis only — no MongoDB connection — so there is
no tier-specific document it could re-read even if a future edit tried to add a tier check.
**domains:** backend, infra
**Acceptance criteria:**
- `BEs/dev/marketplace-dev-authenticated-logout/src/index.mts` opens a Redis client and never imports a
  Mongoose model or a MongoDB connection helper
- `package.json` for this repo carries no `mongoose` dependency (unlike every resource service) — checked
  against `BEs/dev/marketplace-dev-authenticated-logout/package.json`
**Traces:** NFR-AV02; ADR-005
**Evidence:** [`docs/decisions/authorization-service-consolidation.md:35-45`](../../decisions/authorization-service-consolidation.md#L35-L45)

### E02-S04 — All three frontends target the one logout service   `built`
State plainly: `marketplace-admin`, `marketplace-shopowner` and `marketplace-user` must all call `logout`
against port 4030, never a tier-specific logout endpoint.
**domains:** backend, frontend
**Acceptance criteria:**
- Each frontend's GraphQL endpoint config for the logout call resolves to port 4030 (`docs/architecture.md` §Services, the logout row: "All three frontends point at 4030")
- `helloLogout` query answers on the same service, confirming the endpoint is mounted before any frontend
  wiring is trusted — `BEs/dev/marketplace-dev-authenticated-logout/src/graphQLApi/schema/queries/helloLogout.mts`
**Traces:** NFR-AV02
**Evidence:** [`docs/architecture.md`](../../architecture.md) §Services

### E02-S05 — Merging BC-02 into BC-01 stays rejected   `not built` (deliberately — an anti-story)
State plainly: no code change should collapse `logout` into a method on any `*-authenticated-authorization`
service. Recorded here as a boundary to defend, not a task queue item.
**domains:** backend
**Acceptance criteria:**
- No `logout` resolver exists under any of the three `*-authenticated-authorization` services' `schema/mutations/`
  directories — checked by directory listing at time of writing
- Any future PR adding a tier-scoped logout mutation must cite this story and ADR-005 before merging
**Traces:** NFR-AV02; ADR-005 ([`ADR-005-single-logout-service-all-tiers.md`](../phase3/adr/ADR-005-single-logout-service-all-tiers.md))
**Evidence:** absence verified — `BEs/dev/marketplace-dev-authenticated-authorization/src/graphQLApi/schema/mutations/`,
`BEs/dev/marketplace-dev-admin-authenticated-authorization`, `BEs/dev/marketplace-dev-user-authenticated-authorization`
carry only `refresh.mts` and `helloRefresh`-style smoke queries, no `logout.mts`. **Re-verified 2026-08-13**
on the move to this file — all three still hold exactly `mutations/refresh.mts` + `queries/helloRefresh.mts`.

⚠️ **This criterion is a dated directory listing, not a gate.** Nothing in any repo's `pre-push` fails if a
`logoutAdmin` appears tomorrow; the boundary is held by review, by ADR-005's Compliance section, and by the
ADR-INDEX §4 row that names this temptation. Turning it into an executable check — a test asserting no
`logout*.mts` under the three authorization repos' `schema/mutations/` — would touch three repos plus a
parent pointer bump and has not been done. Recorded so the gap is not mistaken for coverage.

## 5. Dependencies

- Consumes the session shape BC-01 (E01, recorded in [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md)) mints —
  same `REDIS_KEY` prefix, same key-per-token addressing. A change to E01's key naming or to what a session
  hash contains is a change this epic's stories must be re-verified against; BCON-05 makes that a separate
  commit in this repo, not a side effect of editing `marketplace-common`.
- No dependency the other direction: BC-01 does not call into this service, and nothing in E01 requires
  E02 to ship first — the two can be delivered in either order, but both must exist before any frontend
  session lifecycle (login → use → logout) is end-to-end testable.

## 6. Open questions — none open

None open. Kept because the closure is cited elsewhere and the *shape* of the answer is the knowledge, not
the fact that a question existed.

| # | Question | Closed by | Answer |
|---|---|---|---|
| 1 | Should logout have its own bounded context at all, or be one more mutation on each `*-authenticated-authorization` service? | ADR-005, 2026-08-05 | **Its own context, one service, all three tiers.** The operation reads no tier and opens no collection, so per-tier copies would triple a resolver that cannot diverge and pay the full CON-08 gate cost three times for isolation session teardown has no use for. The cost is accepted and written down: the service name carries no tier marker, and one outage takes logout down for all three tiers at once. E02-S05 is the standing form of this answer |

## 7. Changelog

| Version | Date | What changed |
|---|---|---|
| 1.0 | 2026-08-07 | Initial retrofit, reverse-engineered from the 15-repo working tree |
| 1.1 | 2026-08-13 | Record moved out of `phase5/epics/E02.md` to this file — see §0. No story, criterion, trace or evidence path changed in the move; the one historical open question was folded into a table (§6) because it was already closed. E02-S05's absence check was re-run against the three authorization repos and holds, and the ⚠️ under it now says plainly that the criterion is a dated listing rather than a gate. ADR-INDEX §4 gained the matching *"decisions deliberately NOT re-opened"* row, so the boundary is stated where refactor proposals are actually checked |
