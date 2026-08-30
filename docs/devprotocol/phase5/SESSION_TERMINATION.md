# E02 — Session Termination
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.9
**Date:** 2026-08-30
**Author:** epics-agent
**Bounded context:** BC-02 — Session Termination

## 0. Why this record is not an epic file

It was the epic file `E02` until 2026-08-13. The file was deleted and its record moved here in one pass,
for the same reason [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md) moved earlier the same day: nothing in it
was work still ahead. Four of the five stories are `built`, and the fifth is an **anti-story** — a boundary
to defend, not a task queue item — so the file had become the *record* of a shipped surface rather than a
backlog entry. Stories for E14..E19 lived in epic files of their own at the time; E01..E10 and E12 are the eleven whose
records are documents of their own in `phase5/` —
E03's is [`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md), E04's is
[`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md) and E05's is [`CATALOGUE.md`](./CATALOGUE.md), all
three moved 2026-08-14, E06's is [`CATEGORY_TAXONOMY.md`](./CATEGORY_TAXONOMY.md), moved 2026-08-25, and
E07's is [`CUSTOMER_ACCOUNT_ADDRESSES.md`](./CUSTOMER_ACCOUNT_ADDRESSES.md), E08's is
[`PUBLIC_DISCOVERY_STOREFRONT.md`](./PUBLIC_DISCOVERY_STOREFRONT.md) and E09's is
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md), all three moved
2026-08-26. E10's is [`SHARED_KERNEL.md`](./SHARED_KERNEL.md), moved 2026-08-27. E11's is neither: it was
distributed, not moved, also on 2026-08-27 — into [`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)
§Note 2026-08-27, since no file replaced the one deleted.

**The story IDs did not change.** `E02-S01` … `E02-S05` are cited by `SEQUENCE_DIAGRAMS.md` (via
`CONFLICT_REPORT.md` §5's flow↔story map) and by this file's own cross-references. Every one of those
resolves to a section below. Renumbering on a move was refused for E01 and is refused here for the same
reason: an ID is a name, and moving a file is not a reason to change a name.

**What is deliberately not repeated here.** The reasoning for one logout service across three tiers is
specified once, in
[`ADR-005`](../phase3/adr/ADR-005-single-logout-service-all-tiers.md), and the two options it rejected are
in that ADR's options table. The stories below say what each one had to satisfy and where the code is, not
why the tier-blind design is right.

⚠️ **Narrowed again 2026-08-27, later the same day.** The range above reads **E13..E19** because
the `E12` epic record was deleted and its content moved into
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) — the **eleventh** record to make that move, and
the first from the E12-E18 remediation block, so the pattern is no longer about the ten bounded-context
epics alone. E12 lost its file, not its id: `E12-S01` … `E12-S26` are cited from 87 source files across
all fifteen sub-repos and resolve to sections of that record.

⚠️ **Narrowed again 2026-08-28.** The range above now reads **E14..E19** because the `E13` epic record was
deleted and its content distributed rather than moved — the E11 way, not E12's: no twelfth record was
written, so the count of records stays **eleven**, unchanged by this pass. E13 lost
its file, not its id or any of its stories': `E13-S01` … `E13-S11` and every build state are untouched. All
eleven of E13's stories were `built` and its own §6 read "None open.", so an audit of the file found only
seven facts held nowhere else: the landing order, its two `BGREWRITEAOF` passes, and the "step four is the
clock, not step one" rule; the six `INTROSPECTION_CODE` comparison sites named with file and line, recorded
in [`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3.6; and the seventh site, upstream in
`@axiumine/koa-utils`, recorded in
[`dependency-tree-advisory-scan.md`](../../report/dependency-tree-advisory-scan.md) §6.1.

⚠️ **Narrowed again 2026-08-28.** The range above now reads **E15..E19** because the `E14` epic record was
deleted and its content distributed rather than moved — the E11 way, not E12's: no twelfth record was
written, so the count of records stays **eleven** (E01..E10 and E12), unchanged by
this pass. It qualified because all nine of its stories were `built` and its own §6 read "None open.", so
an audit of the file found only nine facts held nowhere else. E14 lost its file, not its id or any of its
stories': `E14-S01` … `E14-S09` are cited from source files across the workspace and resolve to the
documents that now own each subject: the seven-step landing order and the "land E13-S01 and E13-S02 first"
rule; [`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4, for the two rejected alternatives — the tier-keyed
privilege gradient for the session cap and the cached-successor-pair grace design;
[`architecture.md`](../../architecture.md), for the abandoned `// if remember me, generate ?` cookie-side
comment in koa-utils' `setLoginCookies`, which E14-S07 explicitly does not revive;
[`RISK_REGISTER.md`](./RISK_REGISTER.md) R52, for "two windows, not one";
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md), for the Cloudflare rate-limiting-rules
alternative to `limit_req_zone`; and the `E17` epic record §5, for why E17 depends on E14 for
`familyId` and can never key a session by a token value. The two defects E14-S09 found stay open and stay
recorded in [`multi-tab-refresh-behaviour.md`](../../report/multi-tab-refresh-behaviour.md) §4, §5 and §9 —
that report is not deleted. E14-S06's accepted cross-service-harness residual is recorded in
[`token-handling-security-audit.md`](../../report/token-handling-security-audit.md) §3.4. Nothing about
this record's own content or build state changed.

⚠️ **Narrowed again 2026-08-28, later the same day.** The range above now reads **E16..E19** because
the `E15` epic record was deleted and its content distributed, the E11/E13/E14 way and not E12's: no twelfth
record was written, so the count stays **eleven**. Unlike E14's, **E15's §6 was not empty** —
one row survived, a Product question about a confirm-first email-change flow that does not exist, and it is
relocated to [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md) rather than deleted with the file. E15 keeps its
id and all ten story ids. This record gained §3.1 in the same pass, because one of E15's facts is about a
teardown nothing else here describes.

⚠️ **Narrowed again 2026-08-28, later the same day.** The range above now reads **E19** — one file, no
longer a range — because the `E17` and `E18` epic records were **both** deleted and their
records **distributed, not moved**, the E11 / E13 / E14 / E15 / E16 way. Both qualified on the same test,
*what a record still has to do*: E17's nine stories and E18's thirteen are all `built`, and both §6s are
fully closed — E18's three on 2026-08-13, E17's fifth and last earlier the same day as this deletion, in the
record before the code. An audit of the two files, 1 255 lines together, found almost everything already
verbatim in the source docblocks the epics themselves caused to be written and in the reports they produced.
What survived — the story ids written one by one, E17's five-step landing order, its two permanent scope
refusals, and the reason it keys a session by `familyId` and can never key one by a token value — went to
[`docs/testing.md`](../../testing.md) (E18-S09's generalised lesson — a file-and-line citation proves the
line exists, not that the path reaches it — and the `REQUIRED_ENV_VARS` trap E18-S13 walked into), and to
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md) §6, which gains the one live open question either file still carried: nobody owns a newly-red advisory
under a pinned `trivy` image whose advisory database is not pinned, and nobody owns the first `.trivyignore`
line. **No twelfth record was written — the count stays eleven** (E01..E10 and E12).
E17 and E18 kept their epic ids and every story id, `E17-S01` … `E17-S09` and `E18-S01` … `E18-S13`; only the
two files are gone.

⚠️ **Narrowed a last time 2026-08-30, and there is no range left.** The `E19` and `E20` epic records were
the last two, and both were deleted and **distributed, not moved** — the E11 / E13 / E14 / E15 / E16 / E17 /
E18 way — with the running *Epics + Stories* index deleted beside them, an index over nothing having nothing
to index. Both qualified on the usual test, *what a record still has to do*: E19's five stories and E20's
thirteen are `built`, the sixth and the fourteenth are anti-stories that are deliberately not built, and both
§6s were closed before the pass — E20's question 6 by
[`ADR-051`](../phase3/adr/ADR-051-a-session-exit-is-a-page-load.md) and its question 7 by
[`ADR-052`](../phase3/adr/ADR-052-a-session-entrance-is-a-page-load-too.md), both on 2026-08-30. ⚠️ **One
thing was still undecided and moved rather than died**: whether an admin may be **suspended**, the half of
E20's question 2 that the *an admin account cannot be closed* ruling did not touch, is now
[`ADR-044`](../phase3/adr/ADR-044-suspension-names-an-actor-and-a-reason.md) §Still undecided. **No twelfth
record was written, so the count stays eleven** (E01..E10 and E12). Both epics kept every id: `E19-S01` …
`E19-S06` and `E20-S01` … `E20-S14` resolve to ADR-041..ADR-046 and ADR-049, each of which records what the
stories under it built, and to the sources those stories touched.

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

### 3.1 The other way a session ends, and the screen nobody owns

⚠️ **This epic is not the only thing that deletes a session, and reading it as if it were is the mistake
worth naming here.** `logout` is the *voluntary* teardown — one caller, one token, the holder asking. E15
built the involuntary one: `revokeAllSessionsForAccount` in `marketplace-common` ends **every** session an
account holds, and four call sites reach for it — a password change, a login-email write, parking a
ShopOwner, and an admin's revoke from E17's console. Neither path knows about the other, and neither
should: this service reads no account id at all (E02-S03), so it could not enumerate an account's sessions
even if it wanted to.

⚠️ **A credential write ends the calling session too, deliberately — and no story owns the screen that
follows.** "Revoke all but me" was offered and refused ([`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4,
platform owner, 2026-08-10): the exemption would be granted to whichever session sent the mutation, and an
attacker holding the password can send it. The accepted cost lands on the frontends rather than on any
backend: **after a password change or a login-email change, the very next request from the tab that made it
is refused**, and `marketplace-admin`, `marketplace-shopowner` and `marketplace-user` must present that
refusal as *log in again* rather than as an error. No story in any epic covers those three screens. That is
a genuine gap, recorded here because this is the record about sessions ending; it is not a defect in the
revoke, which is behaving exactly as designed.

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
| 1.1 | 2026-08-13 | Record moved out of the epic file `E02` to this file — see §0. No story, criterion, trace or evidence path changed in the move; the one historical open question was folded into a table (§6) because it was already closed. E02-S05's absence check was re-run against the three authorization repos and holds, and the ⚠️ under it now says plainly that the criterion is a dated listing rather than a gate. ADR-INDEX §4 gained the matching *"decisions deliberately NOT re-opened"* row, so the boundary is stated where refactor proposals are actually checked |
| 1.3 | 2026-08-27 | §0's range narrowed from "E11..E19" to **E12..E19**: the `E11` epic record was deleted with no replacement record of its own, unlike the ten epics named beside it — its knowledge was distributed to [`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note 2026-08-27 instead. Nothing about BC-02 changed |
| 1.4 | 2026-08-27, later still | §0's range narrows from "E12..E19" to **E13..E19** — the `E12` epic record was deleted and its content moved into [`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md), the eleventh to move and the first from the E12-E18 remediation block. Moved intact, the E01..E10 way, not distributed like E11: all twenty-six of its stories are `built`. The count in §0 is corrected with it — eleven records now exist, not ten. E12 keeps every story id. Nothing about this record's own content or build state changed. |
| 1.5 | 2026-08-28 | §0's range narrows from "E13..E19" to **E14..E19** — the `E13` epic record was deleted and its content distributed, not moved, the E11 way and not E12's: no twelfth record was written, so the count in §0 stays eleven. Its seven facts held nowhere else went to [`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3.6 and [`dependency-tree-advisory-scan.md`](../../report/dependency-tree-advisory-scan.md) §6.1. E13 keeps its id and all eleven story ids. Nothing about this record's own content or build state changed. |
| 1.6 | 2026-08-28, later the same day | §0's range narrows from "E14..E19" to **E15..E19** — the `E14` epic record was deleted and its content distributed, not moved, the E11 way and not E12's: no twelfth record was written, so the count in §0 stays eleven (E01..E10 and E12). All nine of its stories were `built` and its own §6 read "None open.", so an audit found only nine facts held nowhere else. They went to [`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 (two rejected alternatives), [`architecture.md`](../../architecture.md) (the abandoned `setLoginCookies` comment), `RISK_REGISTER.md` R52, `TELEMETRY_EGRESS_HARDENING.md` (the Cloudflare alternative), the `E17` epic record §5 and [`token-handling-security-audit.md`](../../report/token-handling-security-audit.md) §3.4. E14 keeps its id and all nine story ids; its two open defects stay recorded in `multi-tab-refresh-behaviour.md` §4, §5, §9. Nothing about this record's own content or build state changed. |
| 1.7 | 2026-08-28, later the same day | §0's range narrows from "E15..E19" to **E16..E19** — the `E15` epic record was deleted and its content distributed, the E11/E13/E14 way and not E12's, so the count stays eleven. **This record gained content in the pass, unlike the last four narrowings:** new **§3.1** records the involuntary teardown `revokeAllSessionsForAccount` performs for four callers, which nothing else in the corpus describes next to `logout`, and names the accepted cost of the refused "revoke all but me" — a credential write signs the caller out too, and the three frontends must render that as *log in again*, a screen **no story owns**. E15's §6 was not empty like E14's: its surviving Product question moved to [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md). E15 keeps its id and all ten story ids. Nothing about BC-02's own build state changed |
| 1.8 | 2026-08-28, later the same day | §0's range narrows from "E16..E19" to **E19** — the `E17` and `E18` epic records were **both** deleted and their content **distributed, not moved**, the E11/E13/E14/E15/E16 way. E17's nine stories and E18's thirteen are `built`; E17's five open questions and E18's three are all closed. What the audit found held nowhere else went to `docs/testing.md` and `PLATFORM_OPERATIONS_QUALITY_GATES.md` §6. The count in §0 stays eleven — no new record joined it, and every story id survives. Nothing about this record's own content or build state changed. |
| 1.9 | 2026-08-30 | §0 loses its range entirely — the `E19` and `E20` epic records were the last two, both deleted and **distributed, not moved**, with the running *Epics + Stories* index deleted beside them. Both §6s were closed first — E20's question 6 by [`ADR-051`](../phase3/adr/ADR-051-a-session-exit-is-a-page-load.md), its question 7 by [`ADR-052`](../phase3/adr/ADR-052-a-session-entrance-is-a-page-load-too.md) — and the still undecided half, whether an admin may be suspended, moved to [`ADR-044`](../phase3/adr/ADR-044-suspension-names-an-actor-and-a-reason.md) §Still undecided. No twelfth record was written, so the count stays eleven, and every `E19-Snn` and `E20-Snn` id survives in ADR-041..ADR-046 and ADR-049. Nothing about this record's own content or build state changed |
