# Epics + Stories
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.30
**Date:** 2026-08-14
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
v1.27 - 2026-08-13: **E03-S04 closes on the platform owner's call, and the closure is a correction rather
than a build.** Onboarding progress is written by `shopOwnerUpdatePreferences` on the Admin tier — the only
writer, deliberately, until a shop-owner onboarding flow is designed, which is future work. Six documents
said no mutation anywhere writes those fields; only E03-S04's own acceptance criterion had it right, because
only it kept the word **other**. `EVENT_STORMING.md` hotspot 2, `BOUNDED_CONTEXT.md` q2, `SECURITY_AUTH.md`
q3, `DDD_AGGREGATES.md` q2 (four separate false claims), `UBIQUITOUS_LANGUAGE.md` §6 and E03 §6 are all
corrected and closed; `RISK_REGISTER.md` R27 closes on a premise that was never true, and the real residual
— no shop-owner-side flow — opens as **R53** (🟢 Low, measured: no frontend reads either field). E03's build
state reads per that decision now instead of "onboarding itself still has no flow".
v1.26 - 2026-08-13: **E18-S10 is built**, across eight services and eight commits. `@socketlabs/email` and
its whole `axios@0.21.4` closure — six lockfile blocks, 38 lines, all deletions — leave the seven trees that
never executed a line of it; `public-resource` keeps it and is now the only tree in the workspace that
reaches it. The mail credential pair stops being required by the two services that cannot send mail, and the
one that can gains all six variables its client reads. Two things the story did not anticipate: **`yarn
install` cannot run anywhere in this workspace** — `@axiumine/marketplace-common` answers 404 on both
registries and yarn 1 aborts the whole resolution over it — so the lockfiles were pruned by a rewriter proven
byte-identical on an untouched control repo; and the new startup check immediately caught `APP_DOMAIN_USER`
missing from this machine's environment, which means every customer verification link built here carried the
string `undefined`. **E18-S13** opens for six variables two services require and nothing reads. E18 reads
6 of 13.
v1.25 - 2026-08-13: **E18-S04 is built** — `docs/report/dependency-tree-advisory-scan.md`. **54 advisories
match installed versions across the 14 repos that have a dependency tree; 29 reach a production zone and
none of the 29 is reachable through an attacker-influenced path.** The auth path itself is clean —
`keygrip@1.1.0`, `cookies@0.9.1`, `koa@3.2.1`, `redis@6.2.0`, both Sentry packages, `@axiumine/koa-utils@6.0.0`,
zero advisories — and every one of them except `@axiumine/marketplace-common` is external and unmodifiable
from this workspace, stated once so the next epic stops rediscovering it. Three things the story did not
anticipate: `yarn audit` **cannot run here at all** (yarn 1 aborts the whole run over the unpublished
`@axiumine/marketplace-common`, so the scan reads the tree from disk and queries npm's bulk endpoint);
**seven of the eight services that ship `@socketlabs/email`'s `axios@0.21.4` never load a line of it**; and
the env contract is backwards — two services that send no mail require the SocketLabs credentials, and the
one that sends all of it requires neither. **E18-S10**, **E18-S11** and **E18-S12** open, **R49** opens for
the residual `axios`, and **R21 is rewritten and promoted to 🟠 High**: it assumed no dependency gate
existed, and the measurement is worse — Qodana's `VulnerableLibrariesLocal` runs on every commit and every
push and reports **0 problems in every repo**. E18 reads 5 of 12.
v1.24 - 2026-08-13: **E18-S05 is built** — `docs/report/encryption-at-rest-coverage.md` separates the two
things called encryption at rest. Field level: **30 paths across 4 of the 6 collections, 4 DEKs, 5 of them
deterministic**, enumerated, with the not-encrypted personal data written down for the first time and a
reason per omission. Storage level: **none, and MongoDB Community cannot** — `mongod --help` matches
`encrypt` zero times, both volumes are on an unencrypted filesystem, and every other environment is
**unknown** because none exists. Two of the story's own premises were wrong: Redis session values *are*
personal data (the access-token hash carries a plaintext email into the AOF, where it outlives the session's
TTL), and the keyspace stopped being credentials when E13-S01 landed. The audit §5 item is closed; **R48**
opens for the storage residual, owned by the platform owner and coupled to ADR-032. E18 reads 4 of 9.
v1.23 - 2026-08-13: **E18-S03 is built** in all nine services — each `REQUIRED_ENV_VARS` asserted with
`toStrictEqual` against its exact list *and* its order, since the boot names the first missing variable, and
each service proved to reject out of `start()` before a datasource is touched. It also fixed the defect
E16-S09 found and handed here: a service failing its required-env check exited **0**, because the throw
reached only the entrypoint's `.catch` and a Sentry client with no DSN discards what it is given. Docker and
every restart policy reading the code saw a clean shutdown. It now logs to stderr and exits 1. E18 reads
3 of 9.
v1.22 - 2026-08-13: **E17 is complete — 9 of 9**, and all four of its open questions are answered from the
code. A platform operator can now list the sessions an account holds, end one or all of them, and read the
reuse trail beside the table, at `/security` in `marketplace-admin`. No token, a prefix of one, or anything
network- or device-derived appears anywhere in it, which a dedicated no-leak suite asserts rather than
assumes. E17.md v1.2 also corrects its own §3 port table against `docs/architecture.md`.
v1.21 - 2026-08-13: **E16 is complete, and ADR-034 built five of its nine stories before it was opened.**
The epic specified a CSFLE-encrypted `signingKey` collection with a three-state lifecycle; what shipped is
one AES-256-GCM-wrapped Redis record with an ordered list, built by E01-S12 through E01-S15. E16 v2.0
retargets onto that rather than demanding a second custody store — which is exactly what E16-S06 calls worse
than either alone — and every story keeps its criteria and gains an **Outcome** paragraph. S04 and S07 were
built in E16's own name; S08 and S09 close it today. Two departures are recorded rather than papered over:
**R02 stays `Mitigated`, not `Closed`** (the KEK is still hand-provisioned per machine) — ⚠️ **reversed the
same day by E18-S07**, which closed R02 on the failure it actually names, two live services holding different
keys, and moved the hand-provisioned KEK out to its own row **R50**, since a closed row may not carry an open
residual — and the residual row opened at **R47**, R42 through R46 having been taken since the epic was written. E16-S09 ran the first
rotation this platform has ever performed — 37 ms to all five signers, 8 ms for the retirement — and found a
defect that belongs to E18-S03: a service failing its required-env check exits **0** in silence.
v1.20 - 2026-08-13: **E18-S02 is built** — eleven auth-boundary cases AB-01..AB-11 single-sourced in
`marketplace-common`, tagged above the covering test in all seven authenticated services, each with a
contract test that fails when a required tag is absent, and the whole thing written up in `docs/testing.md`.
It was not bookkeeping: the three authorization services were missing the introspection allowlist case
(E13-S11) entirely, and their replay refusal (E14-S02) was asserted only as a tombstone written, never as a
token refused. E18 reads 2 of 9.
v1.19 - 2026-08-13: **E18-S01 verified `built`, and E18 did not build it** — all three resource services
already test the wrong tier, the missing tier and 403-not-401 against their own middleware, having gained
those tests with the tier discriminator itself. The audit's §3.6d is closed and E18's §3 no longer claims
otherwise. The check is also the argument for E18-S02: three suites agreeing is not a contract, and nothing
in the workspace fails when a service is added carrying none of the cases. E18 reads 1 of 9.
v1.18 - 2026-08-13: **E15-S07, and E15 is complete at 9 of 9** — parking a ShopOwner ends the sessions they
were holding, so `disabled` and `waitApprov` stop being labels that only bite at the next rotation. The gate
reads the target state rather than a transition (both flags arrive on every save, so no previous state is in
hand and none is fetched), and **releasing an account revokes nothing** — nobody's credentials changed, and
all four flag combinations are pinned so that case is asserted rather than untested. One deviation recorded
on the story: the integration test cannot boot `marketplace-dev-authenticated-resource` to be refused by it,
so it asserts what the two services share — the refresh session and the index key are gone. What the epic
leaves behind is not one of its stories: the public reset-password flow of open question 4.
v1.17 - 2026-08-13: **E15-S06** — writing a login email now ends that account's sessions, with one call
site (`shopOwnerUpdateEmail`, the platform's only email-change mutation) and an enumeration test in both
services that write a credential, so a future mutation cannot skip the revoke silently. It is the mirror
of S05: the operator editing somebody else's address keeps their own session, because the caller rule is
about whose credentials changed. The story's investigation found **the confirm-an-email-change flow has
no caller** — `emailVerify.newEmailTmp` is in the schema and written by nothing — so an operator's write
puts an account on an unconfirmed address while `emailVerify.valid` still reads `true`. E15 reads 8 of 9.
v1.16 - 2026-08-13: **E15-S05** — changing a password now ends every session the account holds, the
caller's own included, on `marketplace-dev-user-authenticated-resource` and
`marketplace-dev-admin-authenticated-resource`. The revoke runs after the write and inside the `try`, so a
Redis that refuses fails the mutation instead of answering `true` over live stolen sessions. Two findings
came out of the build and are recorded on the story rather than smoothed away: **the "three tiers" in the
acceptance criteria is two** — the ShopOwner service has no password-change mutation to hook into — and
**the public reset-password flow is an uncovered credential write**, setting a new password for two tiers
while ending nothing, on a service E15's landing order never listed. That one is now open question 4.
E15 reads 7 of 9.
v1.15 - 2026-08-13: **E15-S04** — one routine, `revokeAllSessionsForAccount`, ends every session an account
holds: `hKeys`, one single-key `del` per session, and the index key last so an interrupted revocation is
safe to run again. Four callers were going to need this and four hand-written versions of it would have
been four chances to fail open. `marketplace-common` is finished for E15; what remains is the three
credential-write call sites. E15 reads 6 of 9.
v1.14 - 2026-08-13: **E15-S03** — the index prunes itself, so it stops being both a memory leak and a lie
about which sessions are live. Rotation and logout unfile the token they delete, and every field carries an
`HEXPIRE` of what remains of its own session's absolute cap, so a session that ends any other way takes its
row with it: the upper bound on stale fields per account is zero by design. That puts a hard Redis 7.4 floor
under the platform, now checked by `up.sh --with-redis` and by a boot probe in each of the four
authorization services rather than assumed. E15 reads 5 of 9; the revoke routine (S04) is the last piece
before a credential write can end a session.
v1.13 - 2026-08-13: **E15-S02** — every login and rotation files its session under its account, so the
platform can finally answer "which sessions does this account have open?" without a keyspace scan. The key
shape is in [`docs/data-model.md`](../../data-model.md) with the four properties of it that are
load-bearing. E15 reads 4 of 9; the prune (S03) and the revoke routine (S04) are what remain before any
credential write can end a session.
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
v1.28 - 2026-08-14: **E13 closes at 11 of 11.** E13-S10 removed the pre-cutover dual-read fallback, the
`dual-read-hits` counter and `DUAL_READ_REMOVE_AFTER` from `marketplace-common` and eight services, and cut
the dual delete to one key. ⚠️ **Its two gates never had anything to measure**: the 90-day window drains
live pre-cutover sessions and the counter counts served fallback reads, and **nothing on this platform has
ever been deployed** — the counter key was absent on the one cluster there is, at `DBSIZE 0`. The six
E13-S02 tests were **inverted rather than deleted**, so a raw-shape key now carries a test proving it fails
to authenticate; `RISK_REGISTER` R51 closed at v1.17.
v1.29 - 2026-08-14: **E03's record leaves `epics/`, the third to do so.** `phase5/epics/E03.md` is deleted
and its content is [`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md), beside this
index next to E01's and E02's, on the condition those two set: all eight stories `built`, and §6's last
open question closed the same day (the `idShopOwner` one, on a premise the Admin tier cannot produce —
`RISK_REGISTER.md` R30). **`E03-S01`..`E03-S08` are unchanged**; sixteen files cite them and every citation
still resolves. §1's "two exceptions" is now three and §2's E03 row links to the new path; `epics/` holds
E04..E18.
v1.30 - 2026-08-14: **E04's record leaves `epics/` the same day, the fourth to do so.**
`phase5/epics/E04.md` is deleted and its content is
[`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md), on the same condition: all eight stories `built`,
§6's one open question closed — the two-writer race the platform owner accepted — and the publish split
under it landed the same day (E04-S08). **`E04-S01`..`E04-S08` are unchanged.** §1's "three exceptions" is
now four and §2's E04 row links to the new path; `epics/` holds E05..E18.
v1.31 - 2026-08-14, last that day: **E05's record leaves `epics/` too, the fifth.**
`phase5/epics/E05.md` is deleted and its content is [`CATALOGUE.md`](./CATALOGUE.md), on the same
condition: all nine stories `built` and §6 empty — its two open questions closed hours apart, the publish
split (E05-S08) and the picture upload (E05-S09). **`E05-S01`..`E05-S09` are unchanged.** §1's "four
exceptions" is now five and §2's E05 row links to the new path; `epics/` holds E06..E18.
**Depends on:** `phase1/PDR.md` ✅ · `phase1/NFR.md` ✅ · `phase2/EVENT_STORMING.md` ✅ · `phase2/BOUNDED_CONTEXT.md` ✅
**Mutability:** living document - refined every sprint

---

## 1. Purpose

Index only. Stories live in `epics/ENN.md` - one file per epic, written by 4 parallel agents, never inline
here. This file lists the 18 epics, states build state against the working tree, and links out.

**Five exceptions, all since 2026-08-13:** E01's record is [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md),
E02's is [`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md), E03's is
[`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md), E04's is
[`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md) and E05's is [`CATALOGUE.md`](./CATALOGUE.md) (all
three 2026-08-14), beside this index rather than under `epics/`. All fifteen of E01's stories are `built`,
E02's four built stories sit next to one anti-story - a boundary to defend, not work ahead - all eight of
E03's are `built` with its last open question closed the day it moved, all eight of E04's are too, and all
nine of E05's are `built` with both of its open questions closed the day it moved, so all five read as the
record of a shipped surface rather than a backlog entry. The story IDs `E01-S01`..`E01-S15`,
`E02-S01`..`E02-S05`, `E03-S01`..`E03-S08`, `E04-S01`..`E04-S08` and `E05-S01`..`E05-S09` are unchanged and
are still what the citing files cite - see each file's §0.

Every epic is bound by `phase5/CONSTRAINTS.md` (read in full before this doc was written), and the conflict
order in that doc's §7 governs if any epic file disagrees with this index. **No epic is bound to a bounded
context**: `phase5/CONSTRAINTS.md` §5 attaches no such rule, an epic never owns a context, and the context
column above is a reading aid. See §2.1 for why E12-E18 are numbered as they are.

---

## 2. Epic overview

| ID | Epic | Contexts touched (informational) | Tier(s) served | Build state | Repos | File |
|---|---|---|---|---|---|---|
| E01 | Identity & Access | BC-01 | Admin, ShopOwner, User, anonymous (registration) | Built | `marketplace-dev-public-authorization`, `marketplace-dev-authenticated-authorization`, `marketplace-dev-admin-authenticated-authorization`, `marketplace-dev-user-authenticated-authorization`, `marketplace-dev-public-resource`, `marketplace-common` | [IDENTITY_ACCESS.md](IDENTITY_ACCESS.md) — not under `epics/`, see §1 |
| E02 | Session Termination | BC-02 | Admin, ShopOwner, User - one shared service | Built | `marketplace-dev-authenticated-logout` | [SESSION_TERMINATION.md](SESSION_TERMINATION.md) — not under `epics/`, see §1 |
| E03 | Shop Owner Onboarding & Approval | BC-03 | ShopOwner, Admin, **anonymous (self-registration)** | Built - onboarding progress is operator-written by decision (E03-S04), a shop-owner flow is future work | `marketplace-dev-authenticated-resource`, `marketplace-dev-admin-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-common`, `marketplace-db-setup`, `marketplace-shopowner`, `marketplace-admin`, `marketplace-user` | [SHOPOWNER_ONBOARDING_APPROVAL.md](SHOPOWNER_ONBOARDING_APPROVAL.md) — not under `epics/`, see §1 |
| E04 | Legal Entity / Company | BC-04 | ShopOwner, Admin, anonymous (storefront read) | Built | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-authenticated-resource`, `marketplace-dev-admin-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-shopowner`, `marketplace-admin`, `marketplace-user` | [COMPANY_LEGAL_ENTITY.md](./COMPANY_LEGAL_ENTITY.md) — not under `epics/`, see §1 |
| E05 | Catalogue | BC-05 | ShopOwner (write), anonymous (read) | Built - no `price` field, commerce out of scope; an item takes its picture on `itemAdd` and there is no path to replace one | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-shopowner`, `marketplace-user` | [CATALOGUE.md](./CATALOGUE.md) — not under `epics/`, see §1 |
| E06 | Category Taxonomy | BC-06 | Admin (write only), ShopOwner + anonymous (read) | Built | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-admin-authenticated-resource`, `marketplace-dev-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-admin` | [E06.md](epics/E06.md) |
| E07 | Customer Account & Addresses | BC-07 | User | Built - identity/account only, no commerce | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-user-authenticated-resource`, `marketplace-dev-user-authenticated-authorization`, `marketplace-dev-public-resource`, `marketplace-user` | [E07.md](epics/E07.md) |
| E08 | Public Discovery / SSR Storefront | BC-08 | anonymous | Built | `marketplace-dev-public-resource`, `marketplace-user` | [E08.md](epics/E08.md) |
| E09 | Platform Operations & Quality Gates | BC-09 | cross-cutting - engineering concern, not a business tier | Built | all 16 repos' `.githooks/`, `marketplace-db-setup` (migration pipeline), `services-status` | [E09.md](epics/E09.md) |
| E10 | Shared Kernel (marketplace-common) | BC-10 | cross-cutting - consumed by all 9 backend services | Built | `marketplace-common` | [E10.md](epics/E10.md) |
| E11 | Ordering & Fulfilment [PLANNED - NOT BUILT] | BC-11 | User (intended, unbuilt) | **The context is not built and nothing here designs it** - no collection, no resolver, no price. Its one story is a *recording* story and **E11-S01 is `built` 2026-08-13**: the two criteria were run against the working tree and both found drift - BC-11 quoted `item.js` with a sentence that file does not contain, and the schemas listing was three entries stale. Neither changed a claim. §6 question 4 stays although it fails the "traceable upstream" criterion, because it is a tier-topology question rather than a commerce design and deleting it would hide a blocker | none | [E11.md](epics/E11.md) |
| E12 | Telemetry & Egress Hardening | hardens BC-09 | cross-cutting - all 9 backend services + the edge | Built - 26 of 26, closed 2026-08-11. E12-S12 and E12-S13 ran against the running Dev stack and found eight defects the static audit could not, which are the new E12-S16 … E12-S23, checking one of those against the frontends added E12-S24, the owner's log-retention answer added E12-S25, and the owner refusing to accept E12-S16's residual added E12-S26 — the customer reset link moves into the URL fragment, out of every log and cache at once, and its cache half is already built. **Every defect either investigation found is fixed**, the 🔴 among them: no service with a `DSN` set ships a request body any more, and E12-S24's browser capture closed the last one — the address bar, query string and fragment included, was reaching Sentry from all three frontends in five distinct places, and `urlQueryParams: false` never gated it. **One item is still not this repo's to close:** E12-S15's config is in the repo but Authenticated Origin Pulls must be switched on in Cloudflare **before** it is deployed, or every handshake fails from the reload. See [E12.md](epics/E12.md) §7 | all 9 backend services, `marketplace-common`, `marketplace-nginx`, `docker-DBs`, `marketplace-user`, `marketplace-admin`, `marketplace-shopowner` | [E12.md](epics/E12.md) |
| E13 | Session-Store Hardening & Recorded Decisions | hardens BC-01, BC-09, BC-10 | cross-cutting | **11 of 11 built** - ten on 2026-08-10, **E13-S10 on 2026-08-14**. It deleted the dual-read fallback, the `dual-read-hits` counter and `DUAL_READ_REMOVE_AFTER` across nine repos, reduced the dual delete to one key, and **inverted rather than deleted** the six E13-S02 tests, so an old-shape key now has a test proving it does *not* authenticate. ⚠️ **Both of its gates — the cutover date plus 90 days, and a zero counter — were moot: the platform has never been deployed**, so no pre-cutover session ever existed and the counter key was never created. `BGREWRITEAOF` run the same day; `RISK_REGISTER` R51 closed. See [E13.md](epics/E13.md) §7 | `marketplace-common`, `marketplace-dev-authenticated-logout`, the three resource services, the four authorization services, `docs/` | [E13.md](epics/E13.md) |
| E14 | Refresh Family, Reuse Detection & Absolute Lifetime | hardens BC-01, BC-10 | Admin, ShopOwner, User | Built 2026-08-10 - 9 of 9. E14-S09 was run against the Dev stack and `GRACE_SECONDS = 10` is confirmed on measurement; its finding names two defects *under* the epic that stay open. See [E14.md](epics/E14.md) §7 and [multi-tab-refresh-behaviour.md](../../report/multi-tab-refresh-behaviour.md) | `marketplace-common`, `marketplace-dev-public-authorization`, the three `*-authenticated-authorization` services, `marketplace-admin`, `marketplace-shopowner`, `marketplace-user` | [E14.md](epics/E14.md) |
| E15 | Session Index, Account Revocation & Credential Teardown | hardens BC-01, BC-02, BC-03 | Admin, ShopOwner, User | 9 of 9 built - E15-S01 closed the live `logout` no-op and E15-S09 the context type that hid it, both 2026-08-12; E15-S08 closed 2026-08-13 against a gate E01-S11 had already built. **E15-S02 built 2026-08-13: the account index exists** and every login and rotation files its session under it, with no keyspace scan anywhere. **E15-S03 the same day: it prunes itself** — rotation and logout unfile, everything else expires with a per-field `HEXPIRE` at the session's cap, which puts a checked Redis 7.4 floor under the platform. **E15-S04 the same day: one routine revokes an account**, so `marketplace-common` is finished for this epic. **E15-S05 the same day: a password change ends every session**, caller included, on the only two services that have a password-change mutation — which surfaced the public reset-password flow as an uncovered credential write (open question 4). **E15-S06 the same day: writing a login email ends that account's sessions**, at its one call site, with a per-repo enumeration test standing guard over the next one. **E15-S07 the same day: parking a ShopOwner ends the sessions they were holding**, so `disabled` and `waitApprov` stop being labels that only bite at the next rotation — while releasing an account deliberately revokes nothing. The epic is complete; what it leaves behind is the public reset-password flow (open question 4), which no story in it covers | `marketplace-dev-authenticated-logout`, `marketplace-common`, `marketplace-dev-public-authorization`, the three `*-authenticated-authorization` services, the three `*-resource` services, `docker-DBs` | [E15.md](epics/E15.md) |
| E16 | Signing-Key Custody & Rotation | BC-01, BC-10 | Admin (operates), all tiers (affected) | **Built 2026-08-13, by ADR-034's mechanism rather than this epic's** - S01, S02, S03, S05, S06 by E01-S12…E01-S15; S04, S07, S08, S09 in E16's own name. R02 `Mitigated`, residual at R47 | `marketplace-db-setup`, `marketplace-common`, the five cookie-touching services, `marketplace-dev-admin-authenticated-resource` | [E16.md](epics/E16.md) |
| E17 | Admin Session Console | BC-01, BC-10 | Admin | **Built 2026-08-13 - 9 of 9**, and all four open questions answered: the reuse trail is a **capped Redis list** (50 events) kept **30 days from its last event**, sessions are readable **per account only** — one `hGetAll`, no keyspace scan — and an operator's revoke is **not attributable**, which is a second store's decision rather than a third value in `REUSE_EVENT_ACTIONS`. E17-S04 landed as a *correction* to E15-S04's already-shipped routine: the index is re-read before it is deleted, bounded at three attempts, and left in place on exhaustion. E17-S07 is a gate rather than a convention — a loop over all seven operations on both sides, with fixtures carrying secrets in fields no document selects, a control test proving the app really authenticates, and a coverage test that fails when an eighth operation is added. E17-S09's decision note argues the ninth service from R02/R03/R04 and cites neither ADR-006 nor NFR-AV01, deliberately | `marketplace-dev-admin-authenticated-resource`, `marketplace-admin`, `marketplace-common`, `docs/` | [E17.md](epics/E17.md) |
| E18 | Auth Regression Coverage & Documentation Truth-Up | hardens BC-09, BC-10 | cross-cutting | **13 of 13 built** - **E18-S01 verified `built` 2026-08-13 and this epic did not build it**: all three resource services now test the wrong tier, the missing tier and 403-not-401 against their own middleware, having gained those tests with the tier discriminator itself. **E18-S02 built 2026-08-13** — eleven cases in `marketplace-common`, tagged in all seven authenticated services, a per-repo contract test that fails on a missing tag, the contract in `docs/testing.md`; it closed two real gaps in the three authorization services (the introspection allowlist, and the replay refusal asserted only from the writing side). **E18-S03 built 2026-08-13** — nine exact `REQUIRED_ENV_VARS` lists asserted by value and by order, nine services proved to reject out of `start()` before touching a datasource, and the silent **exit 0** on a failed required-env check fixed. **E18-S05 built 2026-08-13** — 30 encrypted field paths under 4 DEKs enumerated, the personal data left in the clear written down with a reason each, and the storage layer measured: MongoDB Community carries no encryption option in the binary and both volumes sit on an unencrypted filesystem, with every other environment **unknown** because none exists. It corrected two of its own premises — Redis session values carry a plaintext email into the AOF, and the keyspace stopped being credentials at E13-S01 — closed the audit §5 item and opened **R48**. **E18-S04 built 2026-08-13** — 54 advisories placed and judged across the 14 repos that have a tree, the whole auth path named and versioned and found clean, the external-and-unmodifiable boundary stated once; `yarn audit` turned out unusable here, seven services ship an `axios` they never load, and Qodana's vulnerable-dependency inspection runs on every commit and reports zero. It opened **E18-S10**, **E18-S11**, **E18-S12** and **R49**, and rewrote **R21**. **E18-S10 built 2026-08-13** — the mail SDK and its `axios@0.21.4` closure removed from the seven services that never loaded it, the credential pair no longer required by two services that cannot send mail, and all six mail variables finally required by the one that can. It established that `yarn install` cannot run anywhere in this workspace, so the seven lockfiles were pruned by a rewriter verified byte-identical on a control repo; and its new startup check caught `APP_DOMAIN_USER` missing from this machine's environment, meaning every customer verification link built here carried the string `undefined`. **E18-S13** opened for six variables two services require and nothing reads. **E18-S06 built 2026-08-13** — the audit report amended **in place** as open question 2 decided, an outcome appended under every finding and a §7 closing record added with nothing above it rewritten; the story's own table is 17 rows, the 15 findings plus §4 and §5, each naming the file and line where the document now reads true. `docs/architecture.md` gained *What one session is made of*; ADR-001, ADR-023, `SECURITY_AUTH.md` and `docs/testing.md` lost `KEYGRIP_KEY_1/2` as a live env value and Qodana as an SCA gate. **E18-S07 built 2026-08-13** — `RISK_REGISTER.md` v1.12: R21 and R02 closed, each naming the story that closed it, and R02's closure split its provisioning residual out as **R50** so a closed row carries no open one; **R51** (dual-read fallback, trigger is the cutover date *and* a zero counter) and **R52** (distinct-token flood against `refresh`) added; four of the six residuals the story listed already had rows, because E12, E13, E16 and E18's own investigations took R42–R49 as they found them. §4's totals were recounted and were wrong before the pass: 53 rows, not 49. **E18-S08, E18-S09, E18-S11, E18-S12 and E18-S13 are also `built` 2026-08-13** and are recorded story by story in [E18.md](epics/E18.md) rather than restated here | `marketplace-dev-authenticated-resource`, `marketplace-dev-admin-authenticated-resource`, all 9 services, `docs/` | [E18.md](epics/E18.md) |

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
  and are open only where each epic's §7 says so; **E15, E16 and E17 are complete since 2026-08-13** — E16 by
  ADR-034's mechanism rather than its own, retargeted in its v2.0 rather than rebuilt — and E18 is still
  open throughout. Unlike E11 they *do*
  carry design detail, because the §6 prohibition scopes to order/cart/delivery/payment, not to security
  hardening of shipped code.
- **Status tag vocabulary is two values only** - `built` and `not built`. E18 uses `not built`
  uniformly; E12-E17 now carry a marker per story, and E12-E14 each end with a §7 naming what stayed
  `not built` and why. **E17 has no §7**: all nine of its stories are `built`, every one carries an
  **Outcome** paragraph, and all four of its open questions are answered in its §6 rather than left for
  later. **E16 has no §7 either**: all nine of its stories are `built` and every one of them
  carries an **Outcome** paragraph instead, saying what satisfied the criteria, what was traded, and where a
  criterion was refused on the merits — E16-S08's R02 closure is the refusal. **E15 has no §7 and needs
  none** — all nine of its stories are `built`, and the one
  thing it leaves open is a credential write on a service its scope never named, recorded as open question
  4 rather than as an unbuilt story. A partially-correct mechanism is `not built` with the defect named in the
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
| §3.3 no credential write invalidates a session | E15, closed 2026-08-13 by E15-S05 (password) and E15-S06 (login email) — except the public reset-password flow, which is open question 4 and no story's scope |
| §3.4 old access token survives refresh | E14 |
| §3.5 `sendDefaultPii` + `rejectUnauthorized = false` | E12 |
| §3.6a raw tokens as Redis keys | E13 |
| §3.6b no account→sessions index | E15, surfaced by E17; closed 2026-08-13 by E15-S02 (written), E15-S03 (pruned) and E17-S02 (read by an operator) |
| §3.6c `INTROSPECTION_CODE` comparison and reachability | E13-S03 (comparison), E13-S11 (bypass disabled outside development), E13-S09 (reachability) |
| §3.6d `assertTier` reject path untested in 2 of 3 | E18-S01, verified closed 2026-08-13 — the two missing suites gained the tests with the tier discriminator itself, so E18 verified rather than built |
| §3.6e `waitApprov` claimed but not enforced | E15-S08, closed 2026-08-13 — the gate itself was built by E01-S11 on 2026-08-12 |
| §3.6f Keygrip rotation unused (= R02) | E16 — **closed 2026-08-13**, and operable since the same day: E17-S08's panel rotates and retires from a screen |
| §3.7a `rememberMe` inert | E14 |
| §3.7b Redis persistence / TLS undocumented | E13 |
| §3.7c `SameSite` in no ADR | E13 |
| §3.7d stale docstring | E13 |
| §4 ADR-018 prose wrong, scope load-bearing | E13-S07 - **prose only, the scope is not touched** |
| §5 all six blind spots | E12-S12, E12-S13, E14-S09, E16-S09, E18-S04, E18-S05, E18-S09 — four now run: E14-S09 ([finding](../../report/multi-tab-refresh-behaviour.md)), E12-S12 ([finding](../../report/log-sink-inventory.md)), E12-S13 ([finding](../../report/sentry-event-capture.md)) and E16-S09 ([finding](../../report/keygrip-rotation-propagation.md)) |

This map says which epic owns each finding. **What actually happened to each is in the report itself** —
[`token-handling-security-audit.md`](../../report/token-handling-security-audit.md) §7, written 2026-08-13 by
E18-S06, which carries the outcome and the landing story for all fifteen and names the four things this
backlog leaves open.

---

## 6. Out of scope (binding here too - `phase5/CONSTRAINTS.md` §6)

No story anywhere under `epics/` designs order, cart, delivery, or payment. E11 records the BC-11 gap and
its blocking open questions from `phase2/BOUNDED_CONTEXT.md` BC-11 - never a schema, a resolver signature,
a field, or a checkout sequence diagram. A risk-register row naming the gap is in scope for a sibling
Phase 5 doc; a story designing the fix is not in scope for [`epics/E11.md`](./epics/E11.md).
