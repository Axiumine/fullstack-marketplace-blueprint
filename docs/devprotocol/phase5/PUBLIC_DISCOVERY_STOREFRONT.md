# E08 — Public Discovery / SSR Storefront
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.10
**Date:** 2026-08-28
**Author:** epics-agent
**Bounded context:** BC-08 — Public Discovery / SSR Storefront
**Changelog:** v1.10 - 2026-08-28, later the same day: §0's range narrows from "E16..E19" to **E19** —
`phase5/epics/E17.md` and `phase5/epics/E18.md` were **both** deleted and their records **distributed, not
moved**, the E11/E13/E14/E15/E16 way. E17's nine stories and E18's thirteen are `built`; E17's five open
questions and E18's three are all closed. What the audit found held nowhere else went to `EPICS_STORIES.md`
§2's E17 and E18 rows and §2.1's E17 row, `docs/testing.md`, and `PLATFORM_OPERATIONS_QUALITY_GATES.md` §6.
The count in §0 stays eleven — no new record joined it, and every story id survives. Nothing about this
record's own content or build state changed.
v1.9 - 2026-08-28, later the same day: §0's range narrows from "E15..E19" to **E16..E19** —
`phase5/epics/E15.md` was deleted and its record **distributed rather than moved**, the E11 / E13 / E14 way
and not E12's: all ten of its stories are `built`, so no twelfth record joined the eleven beside the index.
⚠️ Unlike E14's, **E15's §6 was not empty**: one Product question — whether a confirm-first email-change
flow should exist — moved to `IDENTITY_ACCESS.md` §6 as an **open** question 5 rather than dying with the
file. The other nine facts went to `EPICS_STORIES.md` §2 and §2.1, `ADR-INDEX.md` §4 (three refused
designs), `SESSION_TERMINATION.md` §3.1, `IDENTITY_ACCESS.md` §3.1, `SHOPOWNER_ONBOARDING_APPROVAL.md`
E03-S02, `PLATFORM_OPERATIONS_QUALITY_GATES.md` §3.1, `SECURITY_AUTH.md` §3 and `docs/data-model.md`. E15
keeps its id and all ten story ids. Nothing about this record's own content or build state changed.
v1.8 - 2026-08-28, later still: §0's range narrows from "E14..E19" to **E15..E19** — `phase5/epics/E14.md` was deleted, its record **distributed rather than moved**, the E11 way and not E12's: all nine of its stories were `built`, its §6 read "None open.", and an audit of the file found only nine facts held nowhere else, so no twelfth sibling record exists to join the eleven beside the index. Those nine went to [`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E14 row (the seven-step landing order, and the E13-S01+S02 ordering in §2.1), [`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 (two rejected alternatives), [`architecture.md`](../../architecture.md) (the abandoned `setLoginCookies` cookie-side comment), [`RISK_REGISTER.md`](./RISK_REGISTER.md) R52, [`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md), `epics/E17.md` §5, and [`token-handling-security-audit.md`](../../report/token-handling-security-audit.md) §3.4. The count in §0 stays eleven, not twelve. E14 keeps its id and all nine story ids. Nothing about this record's own content or build state changed.
v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
v1.6 - 2026-08-27, later still: §0's range narrows from "E12..E19" to **E13..E19** — `phase5/epics/E12.md` was deleted and its record moved beside the index to [`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md), the eleventh to move and the first from the E12-E18 remediation block. Moved intact, the E01..E10 way, not distributed like E11: all twenty-six of its stories are `built`. The count in §0 is corrected with it — eleven records now sit beside the index, not ten. E12 keeps every story id. Nothing about this record's own content or build state changed.
v1.7 - 2026-08-28: §0's range narrows from "E13..E19" to **E14..E19** — `phase5/epics/E13.md` was deleted, its record **distributed rather than moved**, the E11 way and not E12's: all eleven of its stories were `built`, its §6 read "None open.", and only seven facts survived an audit as held nowhere else, so no twelfth sibling record exists to join the eleven beside the index. Those seven went to [`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E13 row, [`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3.6, and [`dependency-tree-advisory-scan.md`](../../report/dependency-tree-advisory-scan.md) §6.1. The count in §0 stays eleven, not twelve. E13 keeps its id and all eleven story ids. Nothing about this record's own content or build state changed.
v1.1 - 2026-08-26: search paginated and split by kind. The single `search` field and
`GraphQLPublicSearchResult` are gone, replaced by `searchCompanies` / `searchItems`, each answering the
page envelope the listings already use; the visitor picks which, items by default. E08-S05 rewritten and
the second open question in §6 answered — per-resolver bounding stays, and `offset` joins the bounds it
enforces.
v1.2 - 2026-08-26: NFR-PF09 is no longer assertion-free. `marketplace-nginx/test/run.sh` now sends a
`Range:` header at `/tiles/` and asserts 206, the `Content-Range` total, the exact byte slice and a 416
on an unsatisfiable range — before this the archive path was probed for security headers only, so a
`proxy_pass` dropped into that location would have answered 200 with the whole file and passed. First
open question in §6 rewritten: what is open is the topology decision, not a missing or untested config.
v1.3 - 2026-08-26, later the same day: that work gets the story it was missing. NFR-PF09 was in §2's
scope and traced from no story at all — E08-S08 owned the cache half of the edge and nothing owned the
tiles. E08-S10 owns it now, same shape and same citation style. Nothing was built for it; the story
records what already stands.
v1.4 - 2026-08-26, last that day: **the file left `epics/` and became this record**, for the reason §0
gives. No story changed, no ID moved, nothing was dropped — only the one link inside it, which now resolves
from `phase5/` rather than from `phase5/epics/`. §6's live question went with the move, and it went as a
duplicate rather than as an answer: `phase1/NFR.md` §Open questions item 2 names PF08 and PF09, names the
owner, and is where that question has always belonged. One thing this file held alone was copied out first
— the public search's bounds and their asymmetry, `clampLimit`, `COUNT_CAP`, `MAX_OFFSET` against
`MAX_CROSS_SHOP_OFFSET`, and why `totalIsExact` is `false` on every cross-shop item read — into
[`phase4/API_CONTRACTS.md`](../phase4/API_CONTRACTS.md) §4.2, whose table still listed the `search` field
and the `GraphQLPublicSearchResult` type that the split deleted.
v1.5 - 2026-08-27: §0's range narrows from "E11..E19" to **E12..E19** — `phase5/epics/E11.md` was deleted
with no replacement record of its own, unlike the ten epics named beside it here. Its knowledge was
distributed to [`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note 2026-08-27
and [`EPICS_STORIES.md`](./EPICS_STORIES.md) §6.1 instead. Nothing about BC-08 changes.

## 0. Why this record is not under `epics/`

It was `phase5/epics/E08.md` until 2026-08-26. The file was deleted and its record moved here in one pass,
the eighth to move for the reason [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md),
[`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md),
[`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md),
[`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md), [`CATALOGUE.md`](./CATALOGUE.md),
[`CATEGORY_TAXONOMY.md`](./CATEGORY_TAXONOMY.md) and
[`CUSTOMER_ACCOUNT_ADDRESSES.md`](./CUSTOMER_ACCOUNT_ADDRESSES.md) moved before it: nothing in it is work
still ahead. All ten stories are `built` and §6 has no live question left. `EPICS_STORIES.md` §1 still says
stories live in `epics/ENN.md`, and that stays true for E14..E19; E01..E10 and E12 are the eleven whose records sit
beside the index instead of under it — E09's is
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md), moved later the same day. E10's is [`SHARED_KERNEL.md`](./SHARED_KERNEL.md),
moved 2026-08-27. E11's joined neither list: its file was deleted the same day with no record of its own to
move, its knowledge distributed instead into
[`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note 2026-08-27 and
[`EPICS_STORIES.md`](./EPICS_STORIES.md) §6.1.

⚠️ **§6's last live question left as a duplicate, not as an answer.** It asked when `NFR-PF08`/`NFR-PF09`
stop being 🟡 Medium, and the answer is "the day the edge is deployed" — which is not a decision this
context can take, record, or be blocked by. [`phase1/NFR.md`](../phase1/NFR.md) §Open questions item 2 asks
it properly: *who installs the nginx configs that carry PF08, PF09, SE09, SE10, SC01, SC02, and on what
host*, owner platform owner / ops. Keeping a second copy here meant one question with two homes and no
owner in this one. What this file does still hold is the mechanism either NFR refers to — E08-S08 for the
cache, E08-S10 for the tiles — and both are asserted against a live nginx by `marketplace-nginx/test/run.sh`.
Neither is deployed anywhere; do not read a `built` tag on those two as a deployment.

**The story IDs did not change.** `E08-S01` … `E08-S10` keep their names. They are cited by
[`CONFLICT_REPORT.md`](./CONFLICT_REPORT.md) (E08-S03, E08-S07, E08-S09) and reached through
[`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E08 row, which now links here. Both resolve to a section of
this file, and renumbering was refused for the reason E01 gives — an ID cited across files is a name, and
moving a file is not a reason to change a name.

⚠️ **E08-S10 is one day old at the move.** Like E07 before it, this record is not purely retrospective:
the story was written on 2026-08-26 for assertions added the same day, so §3's "built end to end" describes
a surface whose test suite grew that morning. The mechanism it records is older than the story — the
`location /tiles/` block was written with the rest of the edge; what was new is that anything checked it.

⚠️ **Narrowed again 2026-08-27, later the same day.** The range above reads **E13..E19** because
`phase5/epics/E12.md` was deleted and its record moved beside this one to
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) — the **eleventh** record to make that move, and
the first from the E12-E18 remediation block, so the pattern is no longer about the ten bounded-context
epics alone. E12 lost its file, not its id: `E12-S01` … `E12-S26` are cited from 87 source files across
all fifteen sub-repos and resolve to sections of that record.

⚠️ **Narrowed again 2026-08-28.** The range above reads **E14..E19** because `phase5/epics/E13.md` was
deleted — but unlike E12's move, no record of its own took its place beside this one: E13 was
**distributed**, the E11 way, not moved, the E12 way. All eleven of its stories were `built`, its own §6
read "None open.", and an audit of the 592-line file found only seven facts held nowhere else, so there
was nothing left to move into a twelfth sibling. Those seven went to
[`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E13 row — the landing order, its two `BGREWRITEAOF` passes,
and the "step four is the clock, not step one" rule; to
[`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3.6 — the six `INTROSPECTION_CODE` comparison sites
named with file and line; and to
[`dependency-tree-advisory-scan.md`](../../report/dependency-tree-advisory-scan.md) §6.1 — the seventh
site, upstream in `@axiumine/koa-utils`. The count of records sitting beside the index stays **eleven**,
not twelve: E13 joins neither this list nor a new one of its own, because no file survived for it to join
one with. E13 lost its file, not its id, same as E12: `E13-S01` … `E13-S11` keep their names and their
`built` state.

⚠️ **Narrowed again 2026-08-28.** The range above reads **E15..E19** because `phase5/epics/E14.md` was
deleted — like E13's, not E12's move: E14 was **distributed**, no record of its own taking its place
beside this one. All nine of its stories were `built`, its own §6 read "None open.", and an audit of the
file found only nine facts held nowhere else, so there was nothing left to move into a twelfth sibling.
Those nine went to [`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E14 row — the seven-step landing order,
and "land E13-S01 **and** E13-S02 first" in §2.1; to [`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 —
the rejected tier-keyed privilege gradient for the session cap, and the rejected cached-successor-pair
grace design; to [`architecture.md`](../../architecture.md) — the abandoned `// if remember me, generate
?` cookie-side comment in koa-utils' `setLoginCookies`, which E14-S07 does not revive; to
[`RISK_REGISTER.md`](./RISK_REGISTER.md) R52 — two rate-limit windows, not one; to
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) — the Cloudflare rate-limiting-rules
alternative to `limit_req_zone`; to `epics/E17.md` §5 — why E17 depends on E14 for
`familyId` and can never key a session by a token value; and to
[`token-handling-security-audit.md`](../../report/token-handling-security-audit.md) §3.4 — E14-S06's
accepted cross-service-harness residual. The count of records sitting beside the index stays **eleven**,
not twelve: E14 joins neither this list nor a new one of its own, because no file survived for it to join
one with. E14 lost its file, not its id, same as E12 and E13: `E14-S01` … `E14-S09` keep their names and
their `built` state. The two defects E14-S09 found — both explicitly outside E14's scope — stay open and
stay recorded in [`multi-tab-refresh-behaviour.md`](../../report/multi-tab-refresh-behaviour.md) §4, §5
and §9, which is not deleted.

⚠️ **Narrowed again 2026-08-28, later the same day.** The range above now reads **E16..E19** because
`phase5/epics/E15.md` was deleted and its record **distributed, not moved** — the E11 / E13 / E14 way and
not E12's: all ten of its stories are `built`, and no twelfth record joined the index, so the count above
stays **eleven** (E01..E10 and E12). ⚠️ **One thing differs from the last three deletions: E15's §6 was not
empty.** One row survived — a **Product** question, whether a confirm-first email-change flow should exist
at all — and it was relocated to [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md) §6 as its question 5, open,
rather than deleted with the file. E15's other nine facts went to
[`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E15 row and §2.1 (the seven-step landing order, and why the
E13-S01 dependency is hard), [`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 (three refused designs — the
lazy prune, "revoke all but me", and `familyId`/the cap in the index value),
[`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md) §3.1, [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md)
§3.1, [`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md) E03-S02,
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md) §3.1,
[`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3 and [`data-model.md`](../../data-model.md). E15 lost
its file, not its id: `E15-S01` … `E15-S10` keep their names and their `built` state.

⚠️ **Narrowed again 2026-08-28, later the same day.** The range above now reads **E19** — one file, no
longer a range — because `phase5/epics/E17.md` and `phase5/epics/E18.md` were **both** deleted and their
records **distributed, not moved**, the E11 / E13 / E14 / E15 / E16 way. Both qualified on the same test,
*what a record still has to do*: E17's nine stories and E18's thirteen are all `built`, and both §6s are
fully closed — E18's three on 2026-08-13, E17's fifth and last earlier the same day as this deletion, in the
record before the code. An audit of the two files, 1 255 lines together, found almost everything already
verbatim in the source docblocks the epics themselves caused to be written and in the reports they produced.
What survived went to [`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E17 and E18 rows and §2.1's E17 row (the
story ids written one by one, E17's five-step landing order, its two permanent scope refusals, and the reason
it keys a session by `familyId` and can never key one by a token value), to
[`docs/testing.md`](../../testing.md) (E18-S09's generalised lesson — a file-and-line citation proves the
line exists, not that the path reaches it — and the `REQUIRED_ENV_VARS` trap E18-S13 walked into), and to
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md) §6, which gains the one live open question either file still carried: nobody owns a newly-red advisory
under a pinned `trivy` image whose advisory database is not pinned, and nobody owns the first `.trivyignore`
line. **No twelfth record joined the eleven beside the index — that count stays eleven** (E01..E10 and E12).
E17 and E18 kept their epic ids and every story id, `E17-S01` … `E17-S09` and `E18-S01` … `E18-S13`; only the
two files are gone.

## 1. Epic goal

Serve anonymous and customer traffic a read-only, published-only projection of `company`/`item`/
`itemCategory`. The only context with no domain event — nothing here mutates state. Own the SSR half
of `marketplace-user` (every route except `/account/*`) and the security boundary that keeps it
anonymous-safe.

## 2. Scope

| In scope | Out of scope | Why |
|---|---|---|
| `companies`, `companiesNearby`, `companyBySlug`, `items`, `itemBySlug`, `itemCategories`, `searchCompanies`, `searchItems`, `sitemapEntries` queries | Any write to `company`/`item`/`itemCategory` | BC-04/05/06 own the writes; this context is read-only by construction |
| `livePublic`/`LIVE_PUBLIC_PIPELINE` shared filter stage | `userRegister` mutation's own account effects | Mutation lives here (`marketplace-dev-public-resource`) but the account it creates belongs to BC-01/BC-07, not this context |
| SSR routes of `marketplace-user` (all but `/account/*`) | `/account/*` CSR routes | Security boundary — SSR renders only anonymous-safe HTML (CON-10, NFR-SE09) |
| `company.address.position_2dsphere` geo index and its two query paths | Nominatim geocoding of a customer's own address | That's BC-07's address-entry flow, self-hosted-proxy concern is BC-08's map only |
| The edge config under `marketplace-nginx/` at the workspace root, and its container test | Installing nginx anywhere on this machine | Written and container-tested, installed nowhere — no `/etc/nginx`, no nginx binary (`docs/architecture.md` §Services, `marketplace-nginx/README.md`) |

## 3. Build state

**Built end to end**, both backend read surface and SSR frontend.

- Resolvers: `BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/queries/` — confirmed
  files `companies.mts`, `companiesNearby.mts`, `companyBySlug.mts`, `itemBySlug.mts`,
  `itemCategories.mts`, `items.mts`, `search.mts`, `sitemapEntries.mts`.
- Shared filter: `BEs/dev/marketplace-dev-public-resource/src/lib/catalogue/publicRead.mts`.
- Registration mutation lives in the same service: `.../schema/mutations/userRegister.mts` (confirmed).
- Rate-limit/Turnstile guard on public writes: `BEs/dev/marketplace-dev-public-resource/src/lib/access/guardPublicWrite.mts`.
- Geo index: `BEs/marketplace-db-setup/migrations/20260301000200-create-company.js`
  (`address.position_2dsphere`); listing-sort indexes in
  `BEs/marketplace-db-setup/migrations/20260301000200-create-company.js`,
  `20260301000500-create-item.js`.
- Frontend: `marketplace-user/src/routeOptions/home.tsx`, `category.tsx`, `categoryChild.tsx`,
  `categoryCommon.tsx`; map island `marketplace-user/src/features/map/ShopMap.tsx`; geocode client
  `marketplace-user/src/lib/nominatim.ts`.
- nginx config (written and container-tested, installed nowhere): `marketplace-nginx/conf.d/30-cache.conf`,
  `20-rate-limit.conf`, `marketplace-nginx/snippets/security-headers-public.conf`,
  `marketplace-nginx/sites-available/marketplace-domain.com.conf` — the PMTiles archive is served from
  that vhost's `location /tiles/` (`:121-129`), a static `alias`, no tile process behind it.
  `marketplace-nginx/test/run.sh` asserts both performance claims against a live nginx: the cache sequence
  (NFR-PF08, E08-S08) and the byte ranges (NFR-PF09). The customer-only copy this epic first cited,
  `marketplace-user/docs/nginx/`, is deleted.

## 4. Stories

### E08-S01 — Anonymous visitor browses a published company by slug   `built`
**As an** Anonymous Visitor, **when** I open a shop page, **I want** the published company projected by slug **so that** an unpublished/retired shop never leaks its page.
**domains:** backend
**Acceptance criteria:**
- `companyBySlug(slug: String!)` returns `GraphQLPublicCompany` or `null` — never throws on a
  not-found or unpublished slug (`queries/companyBySlug.mts:29-33`).
- Query runs through `livePublic`/`LIVE_PUBLIC_PIPELINE`, the one shared stage every public read uses
  rather than a per-query re-implementation (`src/lib/catalogue/publicRead.mts`).

### E08-S02 — Paginated company listing without a blocking sort   `built`
**As an** Anonymous Visitor, **when** I browse `/shops` or `/shops/:city`, **I want** results paginated and index-sorted **so that** the page loads without a 32 MB in-memory sort throwing `QueryExceededMemoryLimitNoDiskUseAllowed`.
**domains:** backend, database
**Acceptance criteria:**
- `companies(limit, offset, city)` answers `GraphQLPublicCompanyPage!` (`queries/companies.mts:48-53`).
- `.explain()` on the listing query shows the winning plan uses `published_publicName` or
  `published_city_publicName` (`BEs/marketplace-db-setup/migrations/20260301000200-create-company.js`), never a blocking `SORT` stage — traces NFR-PF02.

### E08-S03 — "Shops near me" resolves via 2dsphere, never a collection scan   `built`
**As an** Anonymous Visitor, **when** I search shops near a point or inside a bounding box, **I want** the geo query index-backed **so that** it stays fast at anonymous-traffic scale.
**domains:** backend, database
**Acceptance criteria:**
- `companiesNearby(bbox, near, limit)` runs exactly one of two disjoint code paths — `$geoNear`
  (reports+sorts by distance) or `centerSphereFilter` (no distance, relevance sort, shared with
  `search`) — never both in one call (`queries/companiesNearby.mts:1-4,44-48`).
- `.explain()` shows `IXSCAN` on `address.position_2dsphere`
  (`BEs/marketplace-db-setup/migrations/20260301000200-create-company.js`), never
  `COLLSCAN` — traces NFR-PF01, mechanically checkable per BCON-01.

### E08-S04 — Item catalogue reads scoped to one company or one category   `built`
**As an** Anonymous Visitor, **when** I open a shop's item list or a category page, **I want** only published items returned **so that** drafts never appear on an indexed page.
**domains:** backend, database
**Acceptance criteria:**
- `items(companySlug, idCategory, limit, offset)` answers `GraphQLPublicItemPage!`
  (`queries/items.mts:54-61`); `itemBySlug(companySlug!, slug!)` answers `GraphQLPublicItemHit` or `null`
  (`queries/itemBySlug.mts:42-47`).
- Listing path is index-backed by `idCompany_published_name`/`idCategory_published_name`
  (`BEs/marketplace-db-setup/migrations/20260301000500-create-item.js`, replacing the
  3-key indexes once a `name` sort was needed) — traces NFR-PF04.

### E08-S05 — Full-text search across companies and items, paginated and one kind at a time   `built`
**As an** Anonymous Visitor, **when** I type a search term, **I want** one page of matches over shops *or* over items, my choice **so that** I find something without knowing the exact shop name and without waiting on a result set nobody reads to the end.
**domains:** backend, database, frontend
**Acceptance criteria:**
- `searchCompanies(q: String!, near, limit, offset)` answers `GraphQLPublicCompanyPage!` and
  `searchItems(q: String!, near, limit, offset)` answers `GraphQLPublicItemPage!`
  (`queries/search.mts`) — the same page envelope the listings use, so `total`/`totalIsExact`/`hasMore`
  mean here exactly what they mean on `/shops`.
- ⚠️ **Two root fields, not one `search(kind:)` returning a union.** `textScore` is computed against each
  collection's own term statistics and field weights, so a shop's 1.4 and an item's 1.1 have never been
  compared and interleaving them produces an order that looks authoritative and is arbitrary. A union
  would add `resolveType` on the server and `... on` fragments in every document to deliver what two
  field names deliver for free.
- Bounds, all enforced in the resolver: `q` trimmed, non-empty, ≤ 120 characters; `limit` clamped by
  `clampLimit` (24 / 60); `offset` by `assertOffset` — `MAX_OFFSET` (10 000) on the company half,
  ⚠️ `MAX_CROSS_SHOP_OFFSET` (2 000) on the item half, where every skipped document is multiplied by
  `OVERFETCH` and fed through a `$lookup`.
- ⚠️ `totalIsExact` is `false` on **every** item search, and not because of the cap: the count runs on
  `item` alone, where it can see neither `company.published` nor the radius. Same precedent as
  `itemsOfCategory`. On the company half the count carries the whole filter, geo bound included, so it is
  exact up to `COUNT_CAP`.
- `hasMore` comes from `limit + 1` fetched-then-popped, never derived from the capped `total` — derived,
  the listing would end at whatever `COUNT_CAP` happens to be.
- The radius is `$geoWithin`/`$centerSphere`, never `$near`/`$geoNear`: a query has exactly one sort and
  a text search's sort is its relevance, so a proximity admin that also sorts cannot combine with
  `$text` at all. Within the radius a closer shop does not outrank a better-matching one — accepted.
- `marketplace-user` renders one kind per request at `/search?q=&kind=&page=&near=`, `kind` defaulting to
  items and **absent from the URL when it is the default** (`src/lib/search.ts`,
  `src/routeOptions/search.tsx`). Tabs and pagination are plain `<a href>`; the page stays `noindex` with
  a canonical of the bare `/search`.
- `.explain()` on the query shows the winning plan uses `search_text` on `item` and on `company`
  (`BEs/marketplace-db-setup/migrations/20260301000500-create-item.js` /
  `20260301000200-create-company.js:61-68`), never `COLLSCAN` — traces NFR-PF05. Both text
  indexes are deliberately non-compound (a compound text index would force an equality predicate on
  every prefix key, foreclosing free-text search).

### E08-S06 — Sitemap generation is keyset-paginated, never offset   `built`
Technical story: SSR sitemap must scale past whatever `offset` would blow up on at high `afterId`.
**domains:** backend, frontend
**Acceptance criteria:**
- `sitemapEntries(kind: GraphQLSitemapKind!, afterId: ID, limit: Int)` answers `GraphQLSitemapPage!`,
  paginated by `_id` (`queries/sitemapEntries.mts:63-69`).
- `marketplace-user`'s sitemap generation consumes this query rather than iterating `companies`/`items`
  with `offset` — cite the SSR route file that calls it before marking a future edit "built".

### E08-S07 — Customer self-registration lives on this service, not on BC-07   `built`
**As an** Anonymous Visitor, **when** I sign up, **I want** to register with email+password and a Turnstile token **so that** an activation link is sent and no bot can flood registrations.
**domains:** backend
**Acceptance criteria:**
- `userRegister(email!, password!, repeatPassword!, turnstileToken)` returns `Boolean!`
  (`mutations/userRegister.mts:50-58`) and runs behind `guardPublicWrite`
  (`src/lib/access/guardPublicWrite.mts:43-50`), Turnstile checked *after* the Redis rate counter so a
  tokenless flood never reaches the Cloudflare round trip — traces NFR-SC02, NFR-AV03.
- The account this mutation creates belongs to BC-01/BC-07 (`user` collection) — this story owns only
  the registration call itself, not the account lifecycle past it.

### E08-S08 — SSR never renders authenticated HTML; `/account/*` never renders server-side   `built`
Technical story: the security boundary that keeps a shared `proxy_cache` from leaking one customer's page to another.
**domains:** frontend, infra
**Acceptance criteria:**
- `marketplace-user/src/routeOptions/account.tsx:59` sets `{ ssr: false as const, ... }` on every
  account route — grep confirms no `/account/*` route option omits it.
- `marketplace-nginx/conf.d/30-cache.conf:32-35` bypasses cache on session-cookie presence via
  `map $http_cookie $mkt_user_no_cache { default 0; "~*(^|;\s*)refresh_token(\.sig)?=" 1; }` — traces
  NFR-SE09. `marketplace-nginx/test/run.sh` asserts the MISS → HIT → BYPASS sequence, so the mechanism is verified;
  nginx is installed on no host, so do not report this as "deployed." (The `$mkt_user_has_session` relay
  map this criterion used to quote no longer exists — one map feeds both `proxy_cache_bypass` and
  `proxy_no_cache`.)

### E08-S09 — SSR server builds a new urql client per request against `PUBLIC_RESOURCE_URL`   `built`
Technical story: a shared client would leak one visitor's cached GraphQL response to the next.
**domains:** backend, frontend
**Acceptance criteria:**
- `PUBLIC_RESOURCE_URL` is read server-side only, deliberately not `VITE_`-prefixed so a loopback
  address never inlines into the client bundle (per [`docs/frontends.md`](../../frontends.md) §marketplace-user).
- `serve.mjs` binds `127.0.0.1` only, the one deliberate loopback exception on the platform — traces
  NFR-AV04 (partial-negotiable row).

### E08-S10 — The PMTiles archive is a static file answered by byte ranges   `built`
Technical story: a tile-serving process behind `/tiles/` would be invisible from the browser.
**domains:** frontend, infra
**Acceptance criteria:**
- `marketplace-nginx/sites-available/marketplace-domain.com.conf:121-129` serves `/tiles/` from a static
  `alias` with `Accept-Ranges: bytes` and `Cache-Control: public, max-age=604800` — no `proxy_pass` and no
  upstream, so the archive is read by the client and never assembled by the edge.
- `marketplace-nginx/test/run.sh` asserts against a live nginx that `Range: bytes=4-6` answers `206` with
  `Content-Range: bytes 4-6/8` and a body of exactly the three bytes asked for, and that an unsatisfiable
  range answers `416` — traces NFR-PF09.
- ⚠️ **The status code is the only place the difference shows.** A `proxy_pass` dropped into that location
  would answer `200` with the whole archive and the map would still draw, the client silently refetching
  every byte for every tile. Asserting the headers alone — which is all this path had until 2026-08-26 —
  passes against exactly that.
- Consumed client-side through `maplibregl.addProtocol('pmtiles', new Protocol().tile)`
  (`marketplace-user/src/features/map/ShopMap.tsx:41-48`), which issues the ranges.
- nginx is installed on no host, so do not report this as "deployed": the mechanism is verified, the
  deployment is `phase1/NFR.md` §Open questions item 2.

## 5. Dependencies

- BC-04 (Company) and BC-05/BC-06 (Catalogue/Taxonomy) ship first — this context reads their published
  projection and adds nothing of its own to the collections.
- BC-01 mints the `User` session that `guardPublicWrite`'s Turnstile/rate-limit path protects, but this
  epic's `userRegister` runs before any session exists — no landing-order dependency there.
- the config under `marketplace-nginx/` at the workspace root is the deploy target for whoever stands up the real
  edge — three vhosts, not one, and the host it runs on is still undecided (`docs/architecture.md`
  §Services, [`marketplace-nginx/README.md`](https://github.com/Axiumine/marketplace-nginx/blob/main/README.md) §Installing).

## 6. Open questions

- `NFR-PF08`/`NFR-PF09` (cache, PMTiles range requests) are Medium priority *today* and become
  🟠 High "the day it is deployed" — ⚠️ **and the question is asked once, in
  [`phase1/NFR.md`](../phase1/NFR.md) §Open questions item 2**, owner platform owner / ops, where it covers
  SE09, SE10, SC01 and SC02 as well as these two. It is not asked again here, because the transition is an
  operational event rather than a code change and no story in any epic can mark it. Both mechanisms *are*
  written and *are* verified: E08-S08 drives the cache through MISS → HIT → BYPASS and E08-S10 drives a
  `Range:` request to a `206` with the exact slice, both against a live nginx in
  `marketplace-nginx/test/run.sh`. Only the deployment is absent.
- `search`'s `near` radius bound and `limit` bound are enforced in the resolver, not upstream — is
  there a platform-wide max worth codifying once traffic is real, or is per-resolver bounding the
  permanent design? **Answered v1.1: per-resolver, and it stays that way.** The bound that matters is
  not the same number twice — `offset` is capped at 10 000 on `searchCompanies` and at 2 000 on
  `searchItems`, because a skipped item is multiplied by `OVERFETCH` and joined, and a skipped company is
  one index entry. A platform-wide maximum would be the loosest of them, which bounds nothing, or the
  tightest, which shortens the half that could afford the depth. What *is* shared is the code:
  `clampLimit`, `assertOffset`, `COUNT_CAP` and `livePublic` live in `lib/catalogue/publicRead.mts`, so
  the numbers are named once even though each field picks which it enforces. Revisit only if a limit ever
  has to change per deployment rather than per query.
