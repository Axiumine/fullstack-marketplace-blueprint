# E04 — Legal Entity / Company
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.13
**Date:** 2026-08-28
**Author:** epics-agent
**Bounded context:** BC-04 — Legal Entity / Company
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
v1.13 - 2026-08-28, later the same day: §0's range narrows from "E16..E19" to **E19** —
`phase5/epics/E17.md` and `phase5/epics/E18.md` were **both** deleted and their records **distributed, not
moved**, the E11/E13/E14/E15/E16 way. E17's nine stories and E18's thirteen are `built`; E17's five open
questions and E18's three are all closed. What the audit found held nowhere else went to `EPICS_STORIES.md`
§2's E17 and E18 rows and §2.1's E17 row, `docs/testing.md`, and `PLATFORM_OPERATIONS_QUALITY_GATES.md` §6.
The count in §0 stays eleven — no new record joined it, and every story id survives. Nothing about this
record's own content or build state changed.
v1.12 - 2026-08-28, later the same day: §0's range narrows from "E15..E19" to **E16..E19** —
`phase5/epics/E15.md` was deleted and its record **distributed rather than moved**, the E11 / E13 / E14 way
and not E12's: all ten of its stories are `built`, so no twelfth record joined the eleven beside the index.
⚠️ Unlike E14's, **E15's §6 was not empty**: one Product question — whether a confirm-first email-change
flow should exist — moved to `IDENTITY_ACCESS.md` §6 as an **open** question 5 rather than dying with the
file. The other nine facts went to `EPICS_STORIES.md` §2 and §2.1, `ADR-INDEX.md` §4 (three refused
designs), `SESSION_TERMINATION.md` §3.1, `IDENTITY_ACCESS.md` §3.1, `SHOPOWNER_ONBOARDING_APPROVAL.md`
E03-S02, `PLATFORM_OPERATIONS_QUALITY_GATES.md` §3.1, `SECURITY_AUTH.md` §3 and `docs/data-model.md`. E15
keeps its id and all ten story ids. Nothing about this record's own content or build state changed.
v1.11 - 2026-08-28, later the same day: §0's range narrows from "E14..E19" to **E15..E19** —
`phase5/epics/E14.md` was deleted and its record **distributed**, not moved: no twelfth file joins the
eleven beside the index, the **E11 / E13** way, not E12's. All nine of its stories were `built`, its §6
read "None open.", and an audit found only nine facts held nowhere else — they went to `EPICS_STORIES.md`
§2's E14 row, `phase3/adr/ADR-INDEX.md` §4, `architecture.md`, `RISK_REGISTER.md` R52,
`TELEMETRY_EGRESS_HARDENING.md`, `epics/E17.md` §5 and `report/token-handling-security-audit.md` §3.4.
E14 keeps its id, and `E14-S01`..`E14-S09` keep theirs. The two defects E14-S09 found stay recorded in
`report/multi-tab-refresh-behaviour.md` §4, §5 and §9. Nothing about this record's own content or build
state changed.
v1.10 - 2026-08-28: §0's range narrows from "E13..E19" to **E14..E19** — `phase5/epics/E13.md` was deleted and its record **distributed**, not moved: no twelfth file joins the eleven beside the index, unlike E12's move, the E11 way instead. All eleven of its stories were `built`, its §6 read "None open.", and the seven facts an audit found held nowhere else went to `EPICS_STORIES.md` §2's E13 row, `phase3/SECURITY_AUTH.md` §3.6 and `report/dependency-tree-advisory-scan.md` §6.1. E13 keeps its id, and `E13-S01`..`E13-S11` keep theirs. Nothing about this record's own content or build state changed.
v1.9 - 2026-08-27, later still: §0's range narrows from "E12..E19" to **E13..E19** — `phase5/epics/E12.md` was deleted and its record moved beside the index to [`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md), the eleventh to move and the first from the E12-E18 remediation block. Moved intact, the E01..E10 way, not distributed like E11: all twenty-six of its stories are `built`. The count in §0 is corrected with it — eleven records now sit beside the index, not ten. E12 keeps every story id. Nothing about this record's own content or build state changed.
v1.8 - 2026-08-27: `phase5/epics/E11.md` is deleted, its two-story record absorbed into ADR-038's closing
note and `EPICS_STORIES.md` §6.1, rather than replaced by a record file of its own the way E01..E10's were.
§0's boilerplate range narrows to E12..E19, since E11 now holds neither a file under `epics/` nor one beside
the index. The citing-files list for `E04-S01`..`E04-S08` drops `epics/E11.md` — `EPICS_STORIES.md`, already
in that list, is where the same ids are still cited. §6's closing paragraph is rewritten: the question
`epics/E11.md` §6 q3 carried — whether an order snapshots the catalogue state it was placed against — is no
longer merely uncited by this file's decision, it is closed, moot, on the same day and by the same decision
([ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)) that closed BC-11 itself. What
E11.md recorded before it went is kept here: the publish split (E04-S08) made the flip deliberate rather
than answering the snapshot-versus-live-reference question, so the half died with the context that would
have asked it, not with an answer of its own. `item.published` itself is untouched by any of this —
last-writer-wins stands, and the two publish operations stand.
v1.7 - 2026-08-27: Two BC-11 references framed commerce as pending. ADR-038 (2026-08-27) makes it permanently out of scope, so the out-of-scope row says refused rather than unbuilt and the "which is BC-11 design work" aside notes that design work is never happening.
v1.1 - 2026-08-14: §2 and §5 both said the `idShopOwner` reference was enforced by nothing. MongoDB enforces
nothing, which is what they meant; application code does — `funCompanyAdd` 404s an `idShopOwner` that names
no live `shopOwner` before it inserts. Both lines now separate the two. Landed with the closure of
`EVENT_STORMING.md` §5 hotspot 5, `RISK_REGISTER.md` R30 and E03 §6's last open question, which
all rested on the same reading. E03's record moved to
[`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md) later the same day; the
question is §6 q4 there.
v1.2 - 2026-08-14: §6's only open question is closed by the platform owner's decision — two writers on one
`company` is fine, last writer wins, no version or lock field. §3 no longer calls that race the epic's one
open piece, and §6 spells out what was accepted: whole-card last-write-wins, since both tiers `$set` an
object enumerating every field rather than a diff. Recorded as accepted in
[`RISK_REGISTER.md`](./RISK_REGISTER.md) §5. The `item.published` race the question compared itself to
(R29) stays **Open** — same race class, opposite cost — and was not put to the owner in this pass.
v1.3 - 2026-08-14: it was put to the owner immediately after, and answered the same way — an admin
unpublishing and the shop owner publishing it again is fine. §6's closing paragraph is rewritten: the
decision now covers `item.published` too, closing R29, `phase2/EVENT_STORMING.md` §5 hotspot 4 and §6 q5,
`phase2/BOUNDED_CONTEXT.md` §7 q5, `phase4/DDD_AGGREGATES.md` §10 q4 and `epics/E05.md` §6 (that record moved to
[`CATALOGUE.md`](./CATALOGUE.md) later on 2026-08-14).
~~`epics/E11.md` §6 q3 stays open, being about an order snapshotting catalogue state rather than the race.~~
⚠️ **It does not stay open.** It closed moot on 2026-08-27, together with the four other BC-11 questions
([ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)), and `epics/E11.md` — the file
that carried it — is deleted; see §6 below for what its record said before it went.
v1.4 - 2026-08-14: accepting the race exposed the thing under it — `published` was a field of
`GraphQLInputCompany`, so every ordinary save of the card wrote the flag and an admin reopening a stale
card republished a shop somebody had just taken down. The platform owner asked for publishing to be a
separate operation on both tiers, and it is: `published` left both input types, `companyAdd` stamps `false`,
and `companyUpdatePublished(_id, published)` is the only writer on each tier. §2, §3 and the new **E04-S08**
record it; §6's "three fields outside the race" is now four. The race decision itself is untouched — two
writers of `companyUpdatePublished` still last-writer-wins.
v1.5 - 2026-08-14: **the file left `epics/` and became this record**, for the reason §0 gives. No story
changed, no ID moved, and nothing was dropped in the move — only the links, which now resolve from
`phase5/` rather than from `phase5/epics/`.
v1.6 - 2026-08-25: the `epics/` range this record's §0 names is **E07..E19**, not E07..E18 — `epics/E19.md` opened that day (Customer Administration: the admin's missing customers list and the `user.disabled` writer, six stories, none built). Nothing about this record changes; the sentence states a range and the range grew.

## 0. Why this record is not under `epics/`

It was `phase5/epics/E04.md` until 2026-08-14. The file was deleted and its record moved here in one pass,
the fourth to move for the reason [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md),
[`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md) and
[`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md) moved before it: nothing in it is
work still ahead. All eight stories are `built`, §6's one open question closed on 2026-08-14, and the
publish split that closed the last thing under it landed the same day — so the file had become the *record*
of a shipped surface rather than a backlog entry. `EPICS_STORIES.md` §1 still says stories live in
`epics/ENN.md`, and that stays true for E14..E19 — E11 is neither under `epics/` nor beside the index; its
epic id survives its file, per the note in §6 below and [ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)'s
closing section. E01..E10 and E12 are the eleven whose records sit
beside the index instead of under it — E05's is [`CATALOGUE.md`](./CATALOGUE.md), moved later the same day,
E06's is [`CATEGORY_TAXONOMY.md`](./CATEGORY_TAXONOMY.md), moved 2026-08-25, and E07's, E08's and E09's are
[`CUSTOMER_ACCOUNT_ADDRESSES.md`](./CUSTOMER_ACCOUNT_ADDRESSES.md),
[`PUBLIC_DISCOVERY_STOREFRONT.md`](./PUBLIC_DISCOVERY_STOREFRONT.md) and
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md), all three moved
2026-08-26. E10's is [`SHARED_KERNEL.md`](./SHARED_KERNEL.md), moved 2026-08-27.

**The story IDs did not change.** `E04-S01` … `E04-S08` keep their names, cited as they are from
`phase2/BOUNDED_CONTEXT.md`, `phase2/EVENT_STORMING.md`, `phase4/API_CONTRACTS.md`,
`phase4/DDD_AGGREGATES.md`, `RISK_REGISTER.md`, `EPICS_STORIES.md` and `CATALOGUE.md`.
Renumbering them was refused for the reason E01 gives: an ID cited across files is a name, and moving a
file is not a reason to change a name.

⚠️ **One thing this record holds that no other file does:** §6, the two-writer race and what the platform
owner accepted about it — whole-card last-write-wins, no version field, and the four fields that sit
outside the race by construction. `RISK_REGISTER.md` §5 carries the decision as a bullet; the reasoning
about *what exactly* was accepted lives here and is cited from there.

⚠️ **Narrowed again 2026-08-27, later the same day.** The range above reads **E13..E19** because
`phase5/epics/E12.md` was deleted and its record moved beside this one to
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) — the **eleventh** record to make that move, and
the first from the E12-E18 remediation block, so the pattern is no longer about the ten bounded-context
epics alone. E12 lost its file, not its id: `E12-S01` … `E12-S26` are cited from 87 source files across
all fifteen sub-repos and resolve to sections of that record.

⚠️ **Narrowed again 2026-08-28.** The range above reads **E14..E19** because `phase5/epics/E13.md` was
deleted and its record **distributed rather than moved** — the **E11** way, not E12's. All eleven of
E13's stories were `built`, its §6 read "None open.", and an audit of the file found only seven facts held
nowhere else, so unlike E12 there is no successor file for this record's boilerplate to count: no twelfth
record joined the index, and the eleven sitting beside it (E01..E10 and E12) is unchanged. The seven facts
went to three homes already carrying the subject: [`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E13 row
picked up the landing order, its two `BGREWRITEAOF` passes, and the "step four is the clock, not step
one" rule; [`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3.6 picked up the six `INTROSPECTION_CODE`
comparison sites, each named with file and line; and
[`dependency-tree-advisory-scan.md`](../../report/dependency-tree-advisory-scan.md) §6.1 picked up the
seventh comparison site, upstream in `@axiumine/koa-utils`, outside the twelve consumers this repo can
edit itself. E13 kept its id, and all eleven of `E13-S01`..`E13-S11` keep theirs — nothing about a story
id or a build state changed with the file's deletion, only where its record can be read.

⚠️ **Narrowed again 2026-08-28.** The range above reads **E15..E19** because `phase5/epics/E14.md` was
deleted this same day and its record **distributed rather than moved** — the **E11 / E13** way, not
E12's. All nine of E14's stories were `built`, its §6 read "None open.", and an audit of the file found
only nine facts held nowhere else, so unlike E12 there is no successor file for this record's boilerplate
to count: no twelfth record joined the index, and the eleven sitting beside it (E01..E10 and E12) is
unchanged by this pass. E14 kept its id, and all nine of `E14-S01`..`E14-S09` keep theirs, cited from
source files across the workspace and now resolving to: [`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E14
row (the seven-step landing order, and "land E13-S01 **and** E13-S02" first, per §2.1);
[`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 (the rejected tier-keyed privilege gradient for the
session cap, and the rejected cached-successor-pair grace design); [`architecture.md`](../../architecture.md)
(the abandoned `// if remember me, generate ?` cookie-side comment in koa-utils' `setLoginCookies`, which
E14-S07 does not revive); [`RISK_REGISTER.md`](./RISK_REGISTER.md) R52 (two rate-limit windows, not one);
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) (the Cloudflare rate-limiting-rules
alternative to `limit_req_zone`); `epics/E17.md` §5 (why E17 depends on E14 for
`familyId`); and [`token-handling-security-audit.md`](../../report/token-handling-security-audit.md)
§3.4 (E14-S06's accepted cross-service-harness residual). The two defects E14-S09 found stay open and
stay recorded in
[`multi-tab-refresh-behaviour.md`](../../report/multi-tab-refresh-behaviour.md) §4, §5 and §9 — that
report is not deleted. Nothing about a story id or a build state changed with the file's deletion, only
where its record can be read.

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

Own `company` — legal entity AND the shop, no separate shop collection exists or will
(`CLAUDE.md` §Terminology). Two writers by design: `ShopOwner` on own companies, `Admin` on any company. Give the
shop a public storefront face on top of the legal shape. Deliver the two divergent delete-semantics
answers as correct, not a bug to unify.

## 2. Scope

| In scope | Out of scope | Why |
|---|---|---|
| `company` `$jsonSchema` + `$expr` validator | `item` documents | BC-05 owns catalogue entries |
| ShopOwner-tier `companyAdd`/`Update`/`UpdatePublished`/`Del` | public read projection of `company` | BC-08 reads through a fixed pipeline, never writes here |
| Admin-tier `companyAdd`/`Update`/`UpdatePublished`/`Del` | `itemCategory` | BC-06 owns the taxonomy |
| Public storefront fields (`publicName`,`slug`,`description`,`published`) | order/cart/delivery/payment | BC-11 `WILL NOT BUILD` — permanently out of scope ([ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)) |
| `Company` Mongoose model in `marketplace-common` | `idShopOwner` FK enforcement in MongoDB | unenforced by the database by design (`docs/data-model.md`); application code checks it at read/ownership time, and at insert on the Admin tier, where `funCompanyAdd` 404s an `idShopOwner` naming no live `shopOwner` |
| ShopOwner + Admin frontend company CRUD screens | — | — |

## 3. Build state

**Built**, both writers, both frontends, verified on disk:

- Schema builder: `BEs/marketplace-db-setup/lib/schemas/company.js` — one shape, legal fields and
  storefront fields together, called by `20260301000200-create-company`.
- Model shared by both writer services: `BEs/marketplace-common/src/models/MongoDB/Company.mts`,
  interface `BEs/marketplace-common/src/models/MongoDBInterfaces/ICompanySchema.mts`.
- ShopOwner-tier resolvers: `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts`,
  `companyUpdate.mts`, `companyUpdatePublished.mts`, `companyDel.mts`; ownership guard
  `BEs/dev/marketplace-dev-authenticated-resource/src/lib/company/throwIfShopOwnerDontOwnCompany.mts`.
- Admin-tier resolvers: `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts`,
  `companyUpdate.mts`, `companyUpdatePublished.mts`, `companyDel.mts`.
- Frontend: `marketplace-shopowner/src/features/companies/Companies.tsx` (629 lines) +
  `saving.tsx` (246 lines), documents in
  `marketplace-shopowner/src/api/operations/shopOwnerResource/mutations.ts:24,32,38`
  (`CompanyAddDocument`/`CompanyUpdateDocument`/`CompanyDelDocument`) — verified wired, not stubs.
  `marketplace-admin/src/features/shopOwners/Companies.tsx` (614 lines) — verified `useMutation` calls at
  lines 247-249 for all three ops, documents from
  `marketplace-admin/src/api/operations/adminResource/mutations.ts:99,105,111`.

⚠️ **`companyUpdatePublished` exists on both tiers and is called by neither frontend.** Both company
screens save the card and publish nothing, because `published` was never a box on either form — it rode
inside the whole-card `$set` and moved only as a side effect. Splitting it out did not remove a control,
it revealed that there had never been one. A shop is therefore unpublishable from any screen on the
platform today; the mutation is there, the caller is the gap (E04-S08).

Nothing else in this epic is unbuilt, and since 2026-08-14 nothing in it is open either. The one piece that
was — the two-writer race in §6 — was settled by a decision rather than by code: last writer wins.

## 4. Stories

### E04-S01 — Company `$jsonSchema` + `$expr` validator `built`
Technical story. `company.js`'s `validatorCompany()` must produce the legal fields and the public
storefront fields as one shape, plus the cross-field publish invariant a `$jsonSchema` alone cannot
express.
**domains:** database
**Acceptance criteria:**
- `validatorCompany()` takes no arguments and returns `$and: [{$jsonSchema}, {$expr}]`; `published` is in `required`, `publicName`/`slug`/`description` are not — `BEs/marketplace-db-setup/lib/schemas/company.js`.
- `PUBLISHED_IMPLIES_LINKABLE` rejects `published:true` unless both `slug` and `publicName` are typed `string` — `BEs/marketplace-db-setup/lib/schemas/company.js`.
**Traces:** NFR-SE11 (strict `$jsonSchema`, `additionalProperties:false`), CON-07 (migration immutable).
**Evidence:** `BEs/marketplace-db-setup/migrations/20260301000200-create-company.js`, `BEs/marketplace-db-setup/migrations/20260301000200-create-company.js`.

### E04-S02 — `Company` model shared by both writer services `built`
Technical story. One Mongoose model consumed by `marketplace-dev-authenticated-resource` and
`marketplace-dev-admin-authenticated-resource` so the shape cannot drift between the two writers.
**domains:** backend
**Acceptance criteria:**
- `BEs/marketplace-common/src/models/MongoDB/Company.mts` has exactly one `exports` entry in `marketplace-common/package.json` — no second copy exists in either resource service's own `src/models`.
- A field added to `ICompanySchema.mts` is visible to both resource services after `./deploy-local.sh`, without editing either service's own source.
**Traces:** BCON-07 (edit invisible until `deploy-local.sh` run).
**Evidence:** `BEs/marketplace-common/src/models/MongoDB/Company.mts`, `BEs/marketplace-common/src/models/MongoDBInterfaces/ICompanySchema.mts`.

### E04-S03 — ShopOwner registers a company `built`
**As a** ShopOwner, **when** I submit the registration form, **I want** `companyAdd` to create a `company`
document owned by me **so that** I have a shop to attach items to.
**domains:** database, backend, frontend, testing
**Acceptance criteria:**
- `companyAdd` on this tier answers `OnlyIdType!` (the new `_id`), not `Boolean` — `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts:22,27-32`.
- A duplicate `vatNumber` or `certifiedEmail` is rejected by the global unique index, not by application code — `company.vatNumber_unique`/`certifiedEmail_unique`, `BEs/marketplace-db-setup/lib/schemas/company.js`.
**Traces:** NFR-SE11, BCON-01 (100/100 gate proves it, `BEs/dev/marketplace-dev-authenticated-resource/vitest.config.mts`).
**Evidence:** `mutations/companyAdd.mts:22,27-32`; frontend form `marketplace-shopowner/src/features/companies/saving.tsx`, wired at `marketplace-shopowner/src/api/operations/shopOwnerResource/mutations.ts:24`.

### E04-S04 — ShopOwner updates or retires an owned company `built`
**As a** ShopOwner, **when** I edit or delete a company document I own, **I want** `companyUpdate`/`companyDel`
to act only on my own companies **so that** I cannot touch another shop owner's shop.
**domains:** database, backend, frontend, testing
**Acceptance criteria:**
- `companyDel` on an already-retired, owned company answers 403, because `throwIfShopOwnerDontOwnCompany` filters `deleted` — `BEs/dev/marketplace-dev-authenticated-resource/src/lib/company/throwIfShopOwnerDontOwnCompany.mts:17`.
- `companyDel` stamps the `deleted` date field, never issues a hard remove — `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/companyDel.mts:20-25`.
**Traces:** DCON-03 (soft-delete-not-hard-remove), NFR-SE11.
**Evidence:** `mutations/companyUpdate.mts:16-22`, `mutations/companyDel.mts:20-25`.

### E04-S05 — Admin manages any company on any shop owner's behalf `built`
**As an** Admin, **when** a shop owner needs support, **I want** `companyAdd`/`Update`/`Del` to operate on
any `company` document regardless of owner **so that** platform operations do not depend on the shop owner's
own session.
**domains:** database, backend, frontend, testing
**Acceptance criteria:**
- Admin-tier `companyAdd` takes an explicit `idShopOwner: ID!` argument the ShopOwner-tier version cannot have — `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts:23,26-27`.
- All three Admin-tier company mutations answer plain `Boolean!`, diverging on purpose from the ShopOwner tier's `OnlyIdType` on `companyAdd` — `phase4/API_CONTRACTS.md` §6.2, verified `type: new GraphQLNonNull(GraphQLBoolean)` in each file under `schema/mutations/`.
**Traces:** NFR-SE05/SE06 (tier assertion, 403 not 401, on every Admin-resource call).
**Evidence:** `marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts`, `companyUpdate.mts:26,27-30`, `companyDel.mts:18,21`; frontend `marketplace-admin/src/features/shopOwners/Companies.tsx:247-249`.

### E04-S06 — Admin `companyDel` on an already-retired company answers 200, not 403 `built`
Technical story, records a deliberate two-tier divergence so nobody "fixes" it into agreement.
**domains:** backend, testing
**Acceptance criteria:**
- Admin-tier delete guard does not filter `deleted` — [`docs/data-model.md`](../../data-model.md), confirmed no `deleted` check in `marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/companyDel.mts`.
- `vatNumber_unique`/`certifiedEmail_unique` carry no `partialFilterExpression`, so a retired company keeps its `vatNumber` occupied — `BEs/marketplace-db-setup/lib/schemas/company.js`.
**Traces:** NFR-SE11; policy row "Liveness filters belong on read paths and existence/ownership guards" (`docs/data-model.md`).
**Evidence:** `marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/companyDel.mts:18,21`.

### E04-S07 — Company gets a public storefront face `built`
Technical story. `publicName`/`slug`/`description`/`published` added on top of the legal shape, defaulted
closed.
**domains:** database, backend, testing
**Acceptance criteria:**
- `published` has no default other than absent/false — nothing is indexable until the owner opts in — `BEs/marketplace-db-setup/migrations/20260301000200-create-company.js`. Since 2026-08-14 `companyAdd` stamps that `false` explicitly and only `companyUpdatePublished` ever changes it (E04-S08).
- `slug` is unique via a partial index on `{$type:'string'}`, so companies with no slug yet do not collide on a shared `null` — `BEs/marketplace-db-setup/migrations/20260301000200-create-company.js`.
**Traces:** NFR-PF03 (`slug_unique` lookup index).
**Evidence:** `BEs/marketplace-db-setup/lib/schemas/company.js,111-125` (`PUBLISHED_IMPLIES_LINKABLE`).

### E04-S08 — Publishing a company is a separate operation, on both tiers `built`
**As a** ShopOwner or Admin, **when** I save a company card, **I want** the save to leave `published` exactly
as it was **so that** editing an address never republishes a shop that was deliberately taken down.
**domains:** backend, frontend, testing
**Acceptance criteria:**
- `published` is absent from `GraphQLInputCompany` on both services, so no save can carry it — ShopOwner `graphQLApi/schema/types/inputs/GraphQLInputCompany.mts`, Admin the same path.
- `companyAdd` stamps `published: false` on both tiers; a new company is never born public.
- `companyUpdatePublished(_id: ID!, published: Boolean!) : Boolean!` is the single writer on each tier, ownership-guarded on the ShopOwner one — `marketplace-dev-authenticated-resource/…/mutations/companyUpdatePublished.mts:25,28-30`, `marketplace-dev-admin-authenticated-resource/…/mutations/companyUpdatePublished.mts:21,24-26`.
- `PUBLISHED_IMPLIES_LINKABLE` still refuses `published: true` without a stored `slug` and `publicName`, so the sequence is compulsory: save the card, then publish — two calls, in that order.
**Traces:** E04-S07 (the storefront fields the `$expr` requires); the §6 race decision, which this narrows without reversing.
**Evidence:** `3a3874d` (ShopOwner service), `7a60574` (Admin service); the same split on `item` is [`CATALOGUE.md`](./CATALOGUE.md) E05-S08.

⚠️ **No frontend calls it yet, on either tier.** Neither company screen has ever had a publish control —
the flag moved as a side effect of the whole-card `$set`, and nothing on screen said so. The missing screen
is recorded in `marketplace-admin/README.md` and `marketplace-shopowner`'s slice; it is a UI story nobody
has written, not a resolver gap.

## 5. Dependencies

- BC-01 (Identity & Access) lands first — `company.idShopOwner` needs a `shopOwner` document to point at,
  and on the Admin tier that is enforced rather than assumed: `funCompanyAdd` 404s when the id names no
  live owner. MongoDB itself still holds no constraint.
- BC-05 (Catalogue) depends on this epic, not the reverse — `item.idCompany` needs an existing `company`.
- BC-08 (Public Discovery) reads `company` through `LIVE_PUBLIC_PIPELINE` but never writes it; landing
  order does not matter for this epic's own stories.
- Model change flow if `company.js` ever changes: `marketplace-common` model → `./deploy-local.sh` → both
  resource services' consumers bumped — separate commits per BCON-05.

## 6. Open questions — the one there was is closed

- ~~Two independent writers of the same company (`ShopOwner` and `Admin`) with no version/lock field on
  `company` — same unexamined race class the EVENT_STORMING doc flags for `item.published`
  (`EVENT_STORMING.md` §5), just not yet named for `company`. No optimistic-lock field exists in
  `company.js` today; whether one is needed has not been asked of the user.~~

  ⚠️ **Closed 2026-08-14 by the platform owner: two writers on one company is fine, last writer wins.**
  No version field, no lock, no read-then-compare precondition on either tier. `company.js` stays as it
  is, and a story proposing an optimistic-lock field reverses this decision rather than extending it.

  **What was accepted is whole-card last-write-wins, not field-level.** Both tiers write the card in a
  single `$set` of an object that enumerates every field — Admin `Company.updateOne({ _id }, { $set: data })`
  with `data` from `validateCompany()`, ShopOwner `Company.updateOne({ _id, idShopOwner }, { $set: data })`
  — and neither builds a diff against what it read. So the loser of a race does not lose only the field
  both writers touched: it loses every field the other writer changed since the form was loaded,
  including fields it never opened. Two people overwriting each other's `description` is the obvious
  case; an admin's save silently reverting a `vatNumber` the owner corrected ten minutes earlier is
  the same event, and is the one worth knowing about. The repair is the same either way — reload, retype
  — because every field is admin- or owner-typed and none is derived.

  **Four fields sit outside the race by construction and stay there.** `_id` and `idShopOwner` are
  omitted from both payload types, so no save moves a company between owners
  ([`RISK_REGISTER.md`](./RISK_REGISTER.md) R30). `deleted` is out too: the ShopOwner type excludes it
  outright, and on the Admin tier `ICompanyValidated` nominally admits it while `validateCompany` returns
  a literal that never sets it and `GraphQLInputCompany` declares no such field. Retiring and reviving
  therefore remain `companyDel`'s alone on both tiers, and a stale card cannot resurrect a retired
  company. ⚠️ **`published` joined them later the same day** (E04-S08): it was inside both input types when
  this paragraph was first written, which is exactly why a stale card republished a shop. It is now
  `companyUpdatePublished`'s alone. Two admins racing *that* mutation still resolve last-writer-wins —
  the decision above is narrowed to the flag's own writer, not reversed.

  ⚠️ **The same decision was extended to `item.published` hours later, on 2026-08-14.** It was recorded
  here first as covering `company` alone, because `published` is a moderation flag and the reverted-save
  outcome that is a re-edit here is a failed takedown there; the platform owner was asked and answered
  that an admin unpublishing and the owner publishing it again is equally fine. So
  [`RISK_REGISTER.md`](./RISK_REGISTER.md) R29, `phase2/EVENT_STORMING.md` §5 hotspot 4 and §6 q5,
  `phase2/BOUNDED_CONTEXT.md` §7 q5, `phase4/DDD_AGGREGATES.md` §10 q4 and [`CATALOGUE.md`](./CATALOGUE.md) §6 all close
  with this one. One question this did **not** close, and now never will by an answer: whether an order
  snapshots the catalogue state it was placed against, rather than referencing a flag either writer can flip
  afterwards — `phase5/epics/E11.md` §6 q3, carried from `phase2/BOUNDED_CONTEXT.md` §7 q5 originally, the
  same race this paragraph closes. It survived this decision and the publish split above (E04-S08): a
  dedicated writer per flag makes the flip deliberate rather than accidental, but an order holding a live
  reference would still see whatever the last deliberate publisher left, so the split narrowed the race
  without ever choosing between snapshot and live reference.

  ⚠️ **It closed anyway, on 2026-08-27 — moot, not answered.** The platform owner decided that cart, order,
  delivery and payment are permanently out of scope
  ([ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)), so there is no order to hold
  either a snapshot or a live reference, and the question asking which one it should hold has no subject
  left to be about. `phase5/epics/E11.md`, the file that carried it, is deleted; its closing note is in
  ADR-038 and its two recording stories are in `EPICS_STORIES.md` §6.1. The half that outlived three earlier
  passes died with the context that would have asked it, not with an answer of its own — and none of this
  touches `item.published` itself: last-writer-wins stands, and the two publish operations, this one and
  [`CATALOGUE.md`](./CATALOGUE.md) E05-S08's, stand exactly as decided.

  ⚠️ **Accepting the race is not accepting the trigger.** Hours after answering, the platform owner read
  the consequence in full — an ordinary save wrote the flag, so an admin reopening a stale card
  republished a shop somebody had just taken down without touching anything called "publish" — and asked
  for publishing to be its own operation on both tiers. It now is, for `company` (E04-S08) and for `item`
  ([`CATALOGUE.md`](./CATALOGUE.md) E05-S08). What the owner accepted stands: two deliberate publishers still resolve
  last-writer-wins. What went away is the accidental publisher.
