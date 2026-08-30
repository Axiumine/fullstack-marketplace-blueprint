# E06 — Category Taxonomy
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.15
**Date:** 2026-08-28
**Author:** epics-agent
**Bounded context:** BC-06 — Category Taxonomy
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
v1.15 - 2026-08-28, later the same day: §0's range narrows from "E16..E19" to **E19** —
`phase5/epics/E17.md` and `phase5/epics/E18.md` were **both** deleted and their records **distributed, not
moved**, the E11/E13/E14/E15/E16 way. E17's nine stories and E18's thirteen are `built`; E17's five open
questions and E18's three are all closed. What the audit found held nowhere else went to `EPICS_STORIES.md`
§2's E17 and E18 rows and §2.1's E17 row, `docs/testing.md`, and `PLATFORM_OPERATIONS_QUALITY_GATES.md` §6.
The count in §0 stays eleven — no new record joined it, and every story id survives. Nothing about this
record's own content or build state changed.
v1.14 - 2026-08-28, later the same day: §0's range narrows from "E15..E19" to **E16..E19** —
`phase5/epics/E15.md` was deleted and its record **distributed rather than moved**, the E11 / E13 / E14 way
and not E12's: all ten of its stories are `built`, so no twelfth record joined the eleven beside the index.
⚠️ Unlike E14's, **E15's §6 was not empty**: one Product question — whether a confirm-first email-change
flow should exist — moved to `IDENTITY_ACCESS.md` §6 as an **open** question 5 rather than dying with the
file. The other nine facts went to `EPICS_STORIES.md` §2 and §2.1, `ADR-INDEX.md` §4 (three refused
designs), `SESSION_TERMINATION.md` §3.1, `IDENTITY_ACCESS.md` §3.1, `SHOPOWNER_ONBOARDING_APPROVAL.md`
E03-S02, `PLATFORM_OPERATIONS_QUALITY_GATES.md` §3.1, `SECURITY_AUTH.md` §3 and `docs/data-model.md`. E15
keeps its id and all ten story ids. Nothing about this record's own content or build state changed.
v1.13 - 2026-08-28, later the same day: §0's range narrows from "E14..E19" to **E15..E19** —
`phase5/epics/E14.md` was deleted, its record distributed rather than moved, the E11 / E13 way and not
E12's: all nine of its stories are `built`, §6 read "None open.", and an audit found only nine facts held
nowhere else. No twelfth record joins §0's index — the count stays eleven, not twelve. E14 keeps its epic
id and all nine story ids. Nothing about this record's own content or build state changed.
v1.12 - 2026-08-28: §0's range narrows from "E13..E19" to **E14..E19** — `phase5/epics/E13.md` was deleted, its record distributed rather than moved, the E11 way and not E12's: all eleven of its stories are `built`. No twelfth record joins §0's index — the count stays eleven, not twelve. E13 keeps every story id. Nothing about this record's own content or build state changed.
v1.11 - 2026-08-27, later still: §0's range narrows from "E12..E19" to **E13..E19** — `phase5/epics/E12.md` was deleted and its record moved beside the index to [`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md), the eleventh to move and the first from the E12-E18 remediation block. Moved intact, the E01..E10 way, not distributed like E11: all twenty-six of its stories are `built`. The count in §0 is corrected with it — eleven records now sit beside the index, not ten. E12 keeps every story id. Nothing about this record's own content or build state changed.
v1.9 - 2026-08-27: The out-of-scope row said BC-11 was merely unbuilt. ADR-038 (2026-08-27) makes cart, order, delivery and payment permanently out of scope.
v1.1 - 2026-08-14: §6's first open question closes on the platform owner's decision — **the taxonomy needs
no intermediate draft state**, so no `published` flag and no `itemCategoryDisable` are coming. Nothing was
built: the shipped design already says so, in `itemCategories`' own docblock ("a category is not a draft"),
and the decision is what makes it deliberate rather than unexamined. Recorded as not-to-be-reopened in
[`phase3/adr/ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4, with the cost the answer accepts.
v1.2 - 2026-08-25: §6's second open question closes by inspection, on a premise that turned out to be
wrong — a direct GraphQL call against port 4024 meets the same three guards the Admin screen does, and has
since the resolvers first shipped, so a subcategory with a missing parent identifies no era of the API and
the collection's provenance cannot be read off its shape. One window that *can* produce that document is
newly recorded and left open: the three write paths read and then write with no transaction. DCON-05's
citation on E06-S02 corrected — the constraint is `phase4/CONSTRAINTS.md` §3, not `CONSTRAINTS.md` §2.
v1.3 - 2026-08-25: that window closes by implementation on the platform owner's call — the three write paths
are one transaction each, and the parent check reads with a write so the two racing transactions collide on
one document instead of committing past each other. The item half of `itemCategoryDel`'s refusal stays open
and is recorded as such: the write that races it is on another tier.
v1.4 - 2026-08-25: the item half closes too, from the tier that owns the racing write — branch
`fix/item-category-hold` in `marketplace-dev-authenticated-resource`. `itemAdd` and `itemUpdate` each open a
transaction and `$inc` the category they file under before writing the item, so `itemCategoryDel`'s item
count and the item write collide on one document instead of committing past each other. §6 has no open
question left.
v1.5 - 2026-08-25: ADR-012 amended on the platform owner's instruction rather than left pointing at this
file — its Decision quotes the guard with the `$inc` and the session, Negative carries the contention cost,
Risks carries the write-skew reasoning and the cross-repo coupling, Positive records the one exception to
"Admin-only writes", and Compliance gained two checks that catch either side of the collision being removed
alone.
v1.6 - 2026-08-25, last that day: **the file left `epics/` and became this record**, for the reason §0
gives. No story changed, no ID moved, and nothing was dropped in the move — only the links, which now
resolve from `phase5/` rather than from `phase5/epics/`, and three line citations into
`marketplace-dev-admin-authenticated-resource` that the transaction work under v1.3 had left pointing at
docblock prose. Four things this file held alone were copied out to where a reader looks for them without
knowing it exists: the `/categories` screen's own `position` bound and its orphan bucket are in
[`docs/frontends.md`](../../frontends.md), the reason `itemAdd`'s upload stays outside the transaction is
in [`ADR-012`](../phase3/adr/ADR-012-category-depth-cap-in-resolver.md), and `itemCategory`'s global
`slug` uniqueness, its sort ordinal, the absence of a cascade on delete and the fact that no migration
seeds a category are in [`docs/data-model.md`](../../data-model.md).
v1.7 - 2026-08-25, after the move: §1 and E06-S06 still read "no write path exists in this service for the
collection" of `marketplace-dev-authenticated-resource` — the flat opposite of what §6's third question had
answered hours earlier, and the sharpest of twelve files under `docs/` where the
pre-`holdItemCategory` absolute survived. Both now say what holds: every *mutation* is Admin-tier, one field is not. No story
changed state; E06-S06 stays `built`, since the read-only surface it was written to protect is intact.
v1.8 - 2026-08-25: the `epics/` range this record's §0 names is **E07..E19**, not E07..E18 — `epics/E19.md` opened that day (Customer Administration: the admin's missing customers list and the `user.disabled` writer, six stories, none built). Nothing about this record changes; the sentence states a range and the range grew.
v1.10 - 2026-08-27: §0's range narrows for the opposite reason it last grew — `phase5/epics/E11.md` was
deleted, not moved, so the range this record cites shrinks to **E12..E19** and E11 is named separately, as
distributed into [`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note
2026-08-27 and [`EPICS_STORIES.md`](./EPICS_STORIES.md) §6.1 rather than moved beside this index. Nothing
about BC-06 changes.

## 0. Why this record is not under `epics/`

It was `phase5/epics/E06.md` until 2026-08-25. The file was deleted and its record moved here in one pass,
the sixth to move for the reason [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md),
[`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md),
[`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md),
[`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md) and [`CATALOGUE.md`](./CATALOGUE.md) moved before
it: nothing in it is work still ahead. All seven stories are `built` and §6 has no open question left —
the draft state closed on 2026-08-14, and the collection's provenance and the read-then-write window both
on 2026-08-25, the last of them by an implementation in two repos that landed the same day. So the file
had become the *record* of a shipped surface rather than a backlog entry. `EPICS_STORIES.md` §1 still says
stories live in `epics/ENN.md`, and that stays true for E14..E19; E01..E10 and E12 are the eleven whose records sit
beside the index instead of under it — E07's, E08's and E09's are
[`CUSTOMER_ACCOUNT_ADDRESSES.md`](./CUSTOMER_ACCOUNT_ADDRESSES.md),
[`PUBLIC_DISCOVERY_STOREFRONT.md`](./PUBLIC_DISCOVERY_STOREFRONT.md) and
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md), all three moved
2026-08-26. E10's is [`SHARED_KERNEL.md`](./SHARED_KERNEL.md), moved 2026-08-27. E11's record sits at neither
address: its file was deleted on 2026-08-27 with no replacement of its own, distributed instead into
[`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note 2026-08-27 and
[`EPICS_STORIES.md`](./EPICS_STORIES.md) §6.1.

**The story IDs did not change.** `E06-S01` … `E06-S07` keep their names. ⚠️ **This is the first of the six
records to move with no citation in any other document at all** — `E06-S01`..`E06-S07` appear nowhere else
under `docs/`, and the only two references that exist anywhere are in code, both naming E06-S07: a comment
in `marketplace-admin/schema/admin-authenticated-resource.graphql:12` and one in
`marketplace-admin/test/features/categories/Categories.test.tsx:419`. Renumbering was refused all the same,
for the reason E01 gives — an ID cited across files is a name, and moving a file is not a reason to change
a name — and here the citations are in another repo, where nothing in this workspace fails if they stop
resolving.

⚠️ **What this record holds that no other file does, after the move.** Not the decisions: each of §6's
three answers was written out where a reader looks for it as it closed. The refusal of a draft state is a
row in [`phase3/adr/ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 and a paragraph in
[`docs/data-model.md`](../../data-model.md); the transaction, the `$inc` that supplies the collision, the
contention it costs and the one exception to "Admin-only writes" are in
[`ADR-012`](../phase3/adr/ADR-012-category-depth-cap-in-resolver.md), which was amended on the platform
owner's instruction rather than left pointing here. What stays here alone is the reasoning *under* those
answers: the inspection that killed the provenance question by finding no era of this API that ever
accepted a subcategory with a missing parent, and the two interleavings written as sequences of calls
rather than as a rule. Both describe how a shipped surface was reasoned about, which is what a record is
for and what an ADR deliberately is not.

⚠️ **Narrowed again 2026-08-27, later the same day.** The range above reads **E13..E19** because
`phase5/epics/E12.md` was deleted and its record moved beside this one to
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) — the **eleventh** record to make that move, and
the first from the E12-E18 remediation block, so the pattern is no longer about the ten bounded-context
epics alone. E12 lost its file, not its id: `E12-S01` … `E12-S26` are cited from 87 source files across
all fifteen sub-repos and resolve to sections of that record.

⚠️ **Narrowed again 2026-08-28.** The range above reads **E14..E19** because `phase5/epics/E13.md` was
deleted and its record **distributed rather than moved** — the E11 way, not E12's. No twelfth record
joined this index: the count stays the same eleven it became with E12's move, not twelve, since a
distributed record leaves no sibling file beside `EPICS_STORIES.md` for anything to count. All eleven of
E13's stories were `built` and its §6 read "None open.", so what the file held was not a backlog entry but
seven facts held nowhere else, and each went to the document that already owned its subject: the landing
order, the two `BGREWRITEAOF` passes and the "step four is the clock, not step one" rule are now in
[`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E13 row; the six `INTROSPECTION_CODE` comparison sites,
named by file and line, are in [`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3.6; and the seventh
site, upstream in `@axiumine/koa-utils`, is in
[`dependency-tree-advisory-scan.md`](../../report/dependency-tree-advisory-scan.md) §6.1. E13 lost its
file, not its id, the same way E12 did: `E13-S01` … `E13-S11` keep every story id and every build state.

⚠️ **Narrowed again 2026-08-28, later the same day.** The range above reads **E15..E19** because
`phase5/epics/E14.md` was deleted this same day too and its record **distributed rather than moved** — the
**E11 / E13** way, not E12's: all nine of E14's stories were `built`, its §6 read "None open. Every
decision this epic made is carried by the story that implements it, with its reasoning — this section
holds only what is still undecided.", and an audit of the file found only **nine** facts held nowhere
else. No twelfth record joined this index: the count stays the same eleven it has been since E12's move —
E01..E10 and E12 — unchanged by this pass. The nine facts went to
[`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E14 row (the seven-step landing order, and §2.1's "land
E13-S01 **and** E13-S02 first" instruction); [`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 (two rejected
alternatives — the tier-keyed privilege gradient for the session cap, and the cached-successor-pair grace
design); [`architecture.md`](../../architecture.md) (the abandoned `// if remember me, generate ?`
cookie-side comment in koa-utils' `setLoginCookies`, which E14-S07 does not revive);
[`RISK_REGISTER.md`](./RISK_REGISTER.md) R52 (two rate-limit windows, not one);
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) (the Cloudflare rate-limiting-rules
alternative to `limit_req_zone`); `epics/E17.md` §5 (why E17 depends on E14 for
`familyId`); and [`token-handling-security-audit.md`](../../report/token-handling-security-audit.md) §3.4
(E14-S06's accepted cross-service-harness residual). E14 lost its file, not its id: `E14-S01`..`E14-S09`
are cited from source files across the workspace and now resolve to the destinations above, every one
still `built`. The two defects E14-S09 found stay open and stay recorded in
[`multi-tab-refresh-behaviour.md`](../../report/multi-tab-refresh-behaviour.md) §4, §5 and §9 — that
report is not deleted.

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

Curate the two-level `itemCategory` tree every `item` files under. Every mutation on it is Admin-tier;
ShopOwner and public tiers read it — with the one field-level exception §6 records and ADR-012 carries. The depth cap lives in the resolver, not the validator, because a
`$jsonSchema` reads one document and cannot check whether a parent is itself a subcategory.

## 2. Scope

| In scope | Out of scope | Why |
|---|---|---|
| `itemCategory` `$jsonSchema` validator | `item` documents | BC-05 owns catalogue entries; deleting a category leaves its items resolvable, on purpose |
| Admin-tier `itemCategoryAdd`/`Update`/`Del` + depth cap | ShopOwner/public-tier writes | do not exist and must not — verified, see §3 |
| ShopOwner-tier read-only `itemCategories` query | `company` | BC-04, unrelated aggregate |
| Public-tier `itemCategories` query + customer category-browse pages | order/cart/delivery/payment | BC-11 `WILL NOT BUILD` — permanently out of scope ([ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)) |
| Admin-frontend category management screens | — | built — see §3 |

## 3. Build state

**Backend fully built, admin-only write, verified. The Admin frontend gap is closed — `/categories`
shipped with E06-S07 on 2026-08-13.**

- Schema builder: `BEs/marketplace-db-setup/lib/schemas/itemCategory.js` (83 lines), migration
  `BEs/marketplace-db-setup/migrations/20260301000400-create-itemCategory.js`.
- Model: `BEs/marketplace-common/src/models/MongoDB/ItemCategory.mts`, interface
  `BEs/marketplace-common/src/models/MongoDBInterfaces/IItemCategorySchema.mts`.
- Admin-tier writer (the ONLY writer): `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/itemCategoryAdd.mts`,
  `itemCategoryUpdate.mts`, `itemCategoryDel.mts`; depth-cap guard
  `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/funItemCategoryAdd.mts:44`,
  `throwIfParentNotTopLevel.mts:52-58`. Verified: no `itemCategoryAdd`/`Update`/`Del` file exists under either
  `marketplace-dev-authenticated-resource` or `marketplace-dev-public-resource`.
- ShopOwner-tier read: `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/queries/itemCategories.mts:9,23-24`.
- Public-tier read: `BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/queries/itemCategories.mts:37-38`.
- Customer-facing category browse: `marketplace-user/src/routes/category.$slug.index.tsx`,
  `category.$slug.$childSlug.tsx`; query wired at
  `marketplace-user/src/api/operations/publicResource/queries.ts:143` (`itemCategories`).
- Admin frontend, since E06-S07: `marketplace-admin/src/features/categories/Categories.tsx` (the screen),
  `refusals.ts` (the service's eight refusals rewritten as sentences naming a box), `src/pages/CategoriesPage.tsx`,
  route `/categories` in `src/router.tsx`, fifth section in `src/components/layout/SideMenu.tsx`. Operations:
  `ItemCategoriesDocument` in `src/api/operations/adminResource/queries.ts`, `ItemCategoryAdd`/`Update`/`Del`
  in `mutations.ts`, all four against the extended `schema/admin-authenticated-resource.graphql` slice.
  No backend change: the three resolvers were already there and already gated at 100/100
  (`BEs/dev/marketplace-dev-admin-authenticated-resource/test/`, 16 unit test files).
- ⚠️ The screen adds one bound that exists in no other layer: `position` is capped at 999999999. The
  resolver checks whole and non-negative only, so a wider value reaches the collection and fails
  `$jsonSchema` as a 500 naming no field.

## 4. Stories

### E06-S01 — `itemCategory` `$jsonSchema` validator, two-level shape `built`
Technical story. `idParent` optional (absent = top-level), `position` a required sort ordinal, `slug`
globally unique across both levels.
**domains:** database
**Acceptance criteria:**
- `slug` uniqueness is a single global index, not scoped per-parent — two subcategories named the same under different parents cannot both exist — `BEs/marketplace-db-setup/lib/schemas/itemCategory.js`.
- `position` is validated `int, min 0` and is unrelated to the GeoJSON `position` field on `company.address`/`user.addresses[]` — same name, different shape — `BEs/marketplace-db-setup/lib/schemas/itemCategory.js`.
**Traces:** NFR-SE11.
**Evidence:** `BEs/marketplace-db-setup/migrations/20260301000400-create-itemCategory.js`.

### E06-S02 — Admin creates a category or subcategory, depth capped at two `built`
**As an** Admin, **when** I create a category, **I want** `itemCategoryAdd` to reject a parent that is
itself a subcategory **so that** the taxonomy never grows a third level.
**domains:** database, backend, testing
**Acceptance criteria:**
- `throwIfParentNotTopLevel` is called only when `data.idParent !== undefined`; an absent `idParent` is accepted unconditionally as top-level — `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/funItemCategoryAdd.mts:44`.
- A duplicate `slug` throws a named "already taken" error, distinguished from other write failures — `funItemCategoryAdd.mts:49` (`duplicateKey(e)` branch).
**Traces:** DCON-05 (itemCategory depth cap in resolver, admin-only writes) per [`phase4/CONSTRAINTS.md`](../phase4/CONSTRAINTS.md) §3; ADR-012.
**Evidence:** `src/lib/itemCategory/funItemCategoryAdd.mts:43-46`, `src/lib/itemCategory/throwIfParentNotTopLevel.mts:52-58`.

### E06-S03 — Admin updates a category, same depth cap re-checked `built`
**As an** Admin, **when** I re-parent an existing category, **I want** `itemCategoryUpdate` to re-run the
same depth check **so that** an update cannot smuggle in a third level an add would have blocked.
**domains:** database, backend, testing
**Acceptance criteria:**
- `itemCategoryUpdate` answers `Boolean!` and re-invokes the same `throwIfParentNotTopLevel` guard — `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/itemCategoryUpdate.mts:26,27-30`.
- Changing `idParent` from absent to a value that is itself a subcategory is rejected identically to the add path — same guard function, same file.
**Traces:** DCON-05.
**Evidence:** `mutations/itemCategoryUpdate.mts:26,27-30`.

### E06-S04 — Admin deletes a category, items filed under it stay resolvable `built`
**As an** Admin, **when** I remove a category, **I want** `itemCategoryDel` to leave any `item` documents still
pointing at it resolvable **so that** deleting taxonomy metadata never breaks a live catalogue entry.
**domains:** database, backend, testing
**Acceptance criteria:**
- `itemCategoryDel` takes only `_id: ID!` and answers `Boolean!` — `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/itemCategoryDel.mts:18,19-21`.
- No cascading update touches `item.idCategory` on category delete — verified no such write exists in `itemCategoryDel.mts` or any file it imports.
**Traces:** DCON-03 (soft-delete convention — `deleted` date, not a hard remove).
**Evidence:** `mutations/itemCategoryDel.mts:18,19-21`.

### E06-S05 — ShopOwner reads the category tree, read-only `built`
**As a** ShopOwner, **when** I fill in an item's category, **I want** `itemCategories` to return the full
admin-curated tree **so that** I can file my catalogue correctly without being able to alter the taxonomy.
**domains:** database, backend, testing
**Acceptance criteria:**
- `itemCategories` on this tier takes no arguments and returns `[GraphQLItemCategory!]!`, and no *mutation* exists in this service for the collection — `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/queries/itemCategories.mts:9,23-24`. ⚠️ **The service does write the collection, in one field**: `lib/item/holdItemCategory.mts:41-53` `$inc`s `__v` on the named category inside every `itemAdd`/`itemUpdate` transaction. It is a concurrency guard, reachable through no mutation of its own and touching no domain field, so what this story protects — the read-only surface of the tier — is intact.
- The tier assertion still gates the call — a foreign-tier token gets 403, same as every other resource-service call on this tier.
**Traces:** NFR-SE05/SE06; DCON-05 (restated 2026-08-25: every `itemCategory` mutation is Admin-tier, one field is not).
**Evidence:** `queries/itemCategories.mts:9,23-24`.

### E06-S06 — Anonymous visitor and customer browse the category tree `built`
**As an** Anonymous Visitor, **when** I open a category page, **I want** `itemCategories` to return the
whole flat tree unauthenticated **so that** I can navigate category → subcategory without an account.
**domains:** database, backend, frontend, testing
**Acceptance criteria:**
- `itemCategories` on the public tier takes no arguments, no auth — `BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/queries/itemCategories.mts:37-38`.
- Both `category.$slug.index.tsx` and `category.$slug.$childSlug.tsx` routes render from this one query — `marketplace-user/src/routes/category.$slug.index.tsx`, `category.$slug.$childSlug.tsx`.
**Traces:** NFR-PF06 (`slug_unique` + `idParent_position` index-backed reads).
**Evidence:** `queries/itemCategories.mts:37-38`; `marketplace-user/src/api/operations/publicResource/queries.ts:143`.

### E06-S07 — Build the Admin category-management screens `built`
Technical story that closed the gap — the more severe of the two in this workspace, since the Admin tier
is the ONLY tier ever allowed to write this collection and had no UI to do so.
**domains:** frontend
**Acceptance criteria:**
- `marketplace-admin/src/api/operations/adminResource/mutations.ts` gains `ItemCategoryAddDocument`/`ItemCategoryUpdateDocument`/`ItemCategoryDelDocument`, generated via `yarn codegen` against the existing resolvers — no backend change required.
- The new screen surfaces the depth-cap rejection (`throwIfParentNotTopLevel`) and the duplicate-slug rejection as distinct, user-visible error states, not one generic failure message.
**Traces:** none — no Critical NFR blocks this; it was a coverage gap in the shipped surface.
**Evidence:** `marketplace-admin/src/api/operations/adminResource/mutations.ts` (the three documents) and
`queries.ts:ItemCategoriesDocument`; `src/features/categories/Categories.tsx`; `src/features/categories/refusals.ts`
maps the depth cap and the duplicate slug to two different sentences, each naming the box that has to
change, asserted apart in `test/features/categories/Categories.test.tsx` ("names the slug box for a
duplicate slug", "names the parent box for the depth cap") and per-sentence in `refusals.test.ts`.
The picker offers top-level categories minus the card itself, so the depth cap is also enforced forwards.
`/categories` in `src/router.tsx`, fifth section in `SideMenu.tsx`. Gates: 1022 tests, coverage 100 on
all four metrics, mutation score 100.

## 5. Dependencies

- No upstream dependency inside this epic — `idParent` is a self-FK, `itemCategory` consumes nothing from
  another bounded context (`phase2/BOUNDED_CONTEXT.md` BC-06 "Consumes: nothing from another context").
- BC-05 (Catalogue) depends on this epic landing first in practice — `itemAdd`/`itemUpdate` check
  `idCategory` existence via `throwIfItemCategoryMissing`, so an empty taxonomy fails every item write.
- E06-S07 depends on nothing else in this epic — the three resolvers it wires already exist and are
  already gated at 100/100.

## 6. Open questions

- No `itemCategoryDisable`/publish-toggle equivalent to `item.published` or `company.published` exists —
  a category is either present or soft-deleted, with no intermediate "draft" state. Whether the taxonomy
  needs one has not been asked of the user. ⚠️ **Closed 2026-08-14 by the platform owner: no intermediate
  draft state.** Present or soft-deleted stays the whole state space of a category — no `published` field
  on `itemCategory`, no disable mutation, and no third value between the two. The other two flags exist
  because a shop drafts its *own* public surface; the taxonomy is admin-written on the Admin tier alone
  (E06-S02, DCON-05), so the only person who could see a half-built category is the admin building it,
  and not creating it yet does what a draft flag would. `itemCategories` already reads this way — it
  filters `deleted` and nothing else, and says why in its own docblock
  (`BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/queries/itemCategories.mts`).
  ⚠️ **The accepted cost:** a category created ahead of the items that will fill it is public the moment
  it is created, and shows an empty listing until they arrive. The admin's lever is ordering — create
  it when it is wanted — or `itemCategoryDel`, which soft-deletes and leaves the items that already point
  at it resolvable. Recorded in [`phase3/adr/ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4.
- Until E06-S07 the taxonomy could be shaped only through a direct GraphQL call against port 4024, so
  whether any category documents already exist in `dbMarketplaceDev` from such a call is still unanswered.
  The screen no longer depends on the answer — it renders whatever is there, including a subcategory whose
  parent is missing, which is a document only a call of that kind could have produced. ⚠️ **Closed
  2026-08-25 by inspection, and the premise was the wrong one.** A direct call against port 4024 lands on
  the same three resolvers the screen calls and meets the same three guards: `throwIfParentNotTopLevel`
  wants the parent to exist, to be live and to be top-level; `throwIfHasChildren` refuses a parent to a
  category that already has children; `funItemCategoryDelete` refuses to retire a category while a live
  subcategory or a live item still points at it. All three are in `88bc0ac`, the commit that first shipped
  these resolvers on 2026-08-04 — **no version of this API has ever accepted a subcategory whose parent is
  missing**, so that shape is not the fingerprint of a pre-screen call, and nothing in the collection
  distinguishes a hand-shaped taxonomy from a screen-shaped one.
  Nor does anything seed one: `BEs/marketplace-db-setup/migrations/20260301000600-seed-demo.js` writes one
  `admin`, one `shopOwner` and one `company` and no category at all, so on any machine every `itemCategory`
  document that has ever existed came out of `itemCategoryAdd`. Read on this workspace's cluster on
  2026-08-25: `dbMarketplaceDev` is not on it — the three `rs0` nodes carry `admin`, `config` and `local`
  and nothing else — but that is one machine on one day and is not an answer that keeps.
  ⚠️ **So the orphan bucket on the Admin screen defends against a write made directly against MongoDB, and
  against the window below — not against a legacy API shape.** It stays either way: `orderedCategories`
  appends an orphan last instead of dropping it, `parentLabel` renders `---` for the parent it cannot find,
  and `marketplace-admin/test/features/categories/Categories.test.tsx` asserts both ("keeps a subcategory
  whose parent is gone, at the end").
- **Do the three write paths need a transaction, given that both halves of the depth cap carry a
  read-then-write window?** `funItemCategoryAdd` read the parent and then created; `funItemCategoryUpdate`
  read twice and then updated; `funItemCategoryDelete` counted twice and then stamped `deleted` — with no
  `startSession` or `withTransaction` anywhere in `marketplace-dev-admin-authenticated-resource` or in
  `marketplace-common`. Two concurrent Admin calls therefore reached, with neither write invalid on its
  own:
  - `itemCategoryAdd({ idParent: P })` passed its parent check, `itemCategoryDel(P)` counted zero live
    children and stamped `deleted`, then the create landed — a live subcategory under a retired parent,
    which is the exact document `funItemCategoryDelete` exists to prevent.
  - `itemCategoryUpdate(C, { idParent: P })` passed `throwIfHasChildren(C)`, `itemCategoryAdd({ idParent: C })`
    found `C` still top-level and created under it, then the update landed — three levels, with no single
    write naming the grandchild.

  ⚠️ **Closed 2026-08-25 by implementation, on the platform owner's decision to fix it rather than record
  it** — branch `fix/itemcategory-depth-cap-transactions` in `marketplace-dev-admin-authenticated-resource`.
  Each of the three paths now opens a session and does its reads and its write inside one
  `session.withTransaction`, and the guards take that session as an argument so nothing in them escapes it.

  ⚠️ **A transaction alone would not have closed either interleaving, and the `$inc` is what does.** MongoDB
  transactions are snapshot-isolated, not serialisable, and snapshot isolation permits *write skew*: two
  transactions that each read a document the other writes both commit, each having seen a consistent
  snapshot — which is the first interleaving exactly. `throwIfParentNotTopLevel` therefore reads the parent
  **with a write**, `findOneAndUpdate({ _id: idParent, deleted: { $exists: false } }, { $inc: { __v: 1 } })`,
  so the check lands on the very document a racing `itemCategoryDel` stamps. The two collide, the server
  aborts one with a `WriteConflict`, that error carries the `TransientTransactionError` label, and
  `withTransaction` retries the loser — which re-reads the parent, finds it retired and answers the 404 it
  should have. `__v` is the field to touch because nothing reads it and the validator already declares it
  `bsonType: 'int'`. The second interleaving closes on the same collision without a second `$inc`:
  `throwIfHasChildren(C)` guards an update that writes `C`, and the racing `itemCategoryAdd({ idParent: C })`
  writes `C` too.
  **The accepted cost is contention** — two subcategories filed under one parent at the same instant now
  serialise on it, one of them retried. On a taxonomy one admin tier writes, that is a retry nobody sees.

  ⚠️ **The other half was on another tier, and closed there the same day** — branch `fix/item-category-hold`
  in `marketplace-dev-authenticated-resource`. `funItemCategoryDelete`'s refusal over live *items* raced
  `itemAdd` on the ShopOwner tier: that write creates a document that does not exist yet, so the delete's
  transaction had nothing to collide with, and an item created in that instant ended up filed under a
  category retired in the same one. `holdItemCategory` supplies the missing collision on the item side —
  `itemAdd` and `itemUpdate` each open a transaction and `$inc` the category before the item write lands, so
  one of the two transactions loses that document and is retried: either the category is gone and the item
  write answers 404, or the item exists and the delete refuses with "the category still holds items". The
  upload stays outside the transaction, because `withTransaction` re-runs its callback and a ClamAV scan and
  a `rename` are not undone by an abort; `itemAdd` keeps its cheap `throwIfItemCategoryMissing` count ahead
  of that upload and the holding write does the enforcing. **The cost here is real contention** rather than
  the admin tier's theoretical kind — every item write on the platform now touches its category, and two
  owners stocking the same one serialise on it. ⚠️ **The two sides are one rule in two repos**, stated in
  both docblocks, and changing either alone reopens the window with nothing failing to say so.

  ⚠️ **ADR-012's "writes exist only on the Admin tier" now carries one exception, deliberately.**
  `holdItemCategory` writes `itemCategory` from `marketplace-dev-authenticated-resource` — `__v` and
  nothing else: no domain field, no `idParent`, no `deleted`. The depth cap therefore still has exactly one
  writer, and the ADR's own on-disk violation test still passes as written, since it looks for the three
  mutation names and for a `lib/itemCategory/` function writing `idParent`. **ADR-012 records the
  exception itself**, under Positive, and its Compliance section gained two checks: that both `$inc`s
  still exist — one without the other is a reopened window — and that the ShopOwner tier's only writes to
  `itemCategory` are still that one field.

  ADR-012 is unchanged in substance — the cap still lives in the resolver, for the reason it always did,
  since no `$jsonSchema` can read a second document — and it now carries the window and its answer, amended
  2026-08-25 on the platform owner's instruction. Three sections moved: the Decision quotes the guard as it
  stands, with the `$inc` and the session; Negative gains the contention the design accepts, real on the
  item side rather than theoretical; and Risks holds the write-skew reasoning, both interleavings and the
  cross-repo coupling. The raw-driver bypass it named before is unchanged and still open — transactions
  changed the concurrency story, not the application-code-not-database one.
