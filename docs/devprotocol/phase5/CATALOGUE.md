# E05 — Catalogue
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.10
**Date:** 2026-08-28
**Author:** epics-agent
**Bounded context:** BC-05 — Catalogue
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
v1.10 - 2026-08-28, later the same day: §0's range narrows from "E14..E19" to **E15..E19** — `phase5/epics/E14.md` was deleted and its record **distributed rather than moved**, the E11 / E13 way and not E12's: all nine of its stories are `built`, its §6 read "None open.", and an audit of the file found only nine facts held nowhere else, which went to `EPICS_STORIES.md` §2's E14 row, `phase3/adr/ADR-INDEX.md` §4, `docs/architecture.md`, `RISK_REGISTER.md` R52, `TELEMETRY_EGRESS_HARDENING.md`, `epics/E17.md` §5 and `report/token-handling-security-audit.md` §3.4 rather than to a twelfth record beside this index. The count in §0 stays eleven — no new record joined it. E14 keeps its id and all nine story ids. The two defects E14-S09 found stay open, recorded in `report/multi-tab-refresh-behaviour.md` §4, §5 and §9. Nothing about this record's own content or build state changed.
v1.9 - 2026-08-28: §0's range narrows from "E13..E19" to **E14..E19** — `phase5/epics/E13.md` was deleted and its record **distributed rather than moved**, the E11 way and not E12's: all eleven of its stories are `built`, its §6 read "None open.", and an audit of the file found only seven facts held nowhere else, which went to `EPICS_STORIES.md` §2's E13 row, `phase3/SECURITY_AUTH.md` §3.6 and `report/dependency-tree-advisory-scan.md` §6.1 rather than to a twelfth record beside this index. The count in §0 stays eleven — no new record joined it. E13 keeps its id and all eleven story ids. Nothing about this record's own content or build state changed.
v1.8 - 2026-08-27, later still: §0's range narrows from "E12..E19" to **E13..E19** — `phase5/epics/E12.md` was deleted and its record moved beside the index to [`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md), the eleventh to move and the first from the E12-E18 remediation block. Moved intact, the E01..E10 way, not distributed like E11: all twenty-six of its stories are `built`. The count in §0 is corrected with it — eleven records now sit beside the index, not ten. E12 keeps every story id. Nothing about this record's own content or build state changed.
v1.7 - 2026-08-27: `phase5/epics/E11.md` is deleted, its two-story record absorbed into ADR-038's closing
note and `EPICS_STORIES.md` §6.1, rather than replaced by a record file of its own the way E01..E10's were.
§0's boilerplate range narrows to E12..E19, since E11 now holds neither a file under `epics/` nor one beside
the index. The citing-files list for `E05-S01`..`E05-S09` drops `epics/E11.md` — `EPICS_STORIES.md`, already
in that list, is where the same ids are still cited — and the paragraph gains an explicit line drawing the
connection its own renumbering-refusal argument already implied: the same reason `E05-S01`..`E05-S09` kept
their names across a file move is the reason the epic id `E11` keeps its own across a file's deletion
([ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Consequences). Nothing about
`item.published` or the race this file's §6 already closed changes.
v1.6 - 2026-08-27: The out-of-scope column said BC-11 was "unbuilt, no model to copy", which reads as pending. ADR-038 (2026-08-27) makes cart, order, delivery and payment permanently out of scope, so price/cart-membership/order-lines are refused rather than deferred, and §1 says the deliberate absence of a price is permanent.
v1.1 - 2026-08-14: §6's `item.published` race closes on the platform owner's decision — last writer wins,
no lock field, an owner republishing after an operator's unpublish is accepted. Taken with the same
decision for `company` ([`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md) §6). The bullet now also records the asymmetry the finding never
named: the owner writes the whole card and the Admin writes one flag, so an ordinary save undoes a takedown
without touching it. The image-upload question above it is untouched and still open.
v1.2 - 2026-08-14, later the same day: **publishing became a separate operation and the asymmetry above is
gone.** `published` left `GraphQLInputItem` and `IItemUpdate`, `itemAdd` stamps `false`, and the ShopOwner
tier got an `itemUpdatePublished` of its own — mirrored in `marketplace-shopowner`, where the catalogue
card publishes from a button in its header and Save no longer carries the flag. The v1.1 decision stands;
only the "an ordinary save undoes a takedown" half is struck. §2 gains the two mutations.
v1.3 - 2026-08-14, later still: **the image-upload question in §6 closes.** `itemAdd` takes the picture in
the same call that creates the item — an `Upload` inside `GraphQLInputItem`, not a mutation of its own —
and the reference lands in a new optional `image` field on `item`, chosen by the platform owner over the
two alternatives. New story E05-S09; §2's out-of-scope row and §3 updated. Read-side exposure is this tier
only: `GraphQLItemFrag` is untouched, so neither the Admin nor the public tier sees the field yet, and no
frontend consumes it.
v1.4 - 2026-08-14, last that day: **the file left `epics/` and became this record**, for the reason §0
gives. No story changed, no ID moved, and nothing was dropped in the move — only the links, which now
resolve from `phase5/` rather than from `phase5/epics/`. Two things E05-S09 put here alone were copied out
to where a reader looks for them without knowing this file exists: the `image` field is now in
[`docs/data-model.md`](../../data-model.md) §`item`, and the choice of a field over an `itemImage`
collection is a row in [`phase3/adr/ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4.
v1.5 - 2026-08-25: the `epics/` range this record's §0 names is **E07..E19**, not E07..E18 — `epics/E19.md` opened that day (Customer Administration: the operator's missing customers list and the `user.disabled` writer, six stories, none built). Nothing about this record changes; the sentence states a range and the range grew.

## 0. Why this record is not under `epics/`

It was `phase5/epics/E05.md` until 2026-08-14. The file was deleted and its record moved here in one pass,
the fifth to move for the reason [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md),
[`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md),
[`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md) and
[`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md) moved before it: nothing in it is work still ahead.
All nine stories are `built`, and §6's two open questions both closed on 2026-08-14 — the publish split
(E05-S08) and the picture upload (E05-S09) — so the file had become the *record* of a shipped surface
rather than a backlog entry. `EPICS_STORIES.md` §1 still says stories live in `epics/ENN.md`, and that
stays true for E14..E19 — E11 lost its file, not its id (below); E01..E10 and E12 are the eleven whose records sit beside the index instead of under it —
E06's is [`CATEGORY_TAXONOMY.md`](./CATEGORY_TAXONOMY.md), moved 2026-08-25, and E07's, E08's and E09's
are [`CUSTOMER_ACCOUNT_ADDRESSES.md`](./CUSTOMER_ACCOUNT_ADDRESSES.md),
[`PUBLIC_DISCOVERY_STOREFRONT.md`](./PUBLIC_DISCOVERY_STOREFRONT.md) and
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md), all three moved
2026-08-26. E10's is [`SHARED_KERNEL.md`](./SHARED_KERNEL.md), moved 2026-08-27.

**The story IDs did not change.** `E05-S01` … `E05-S09` keep their names, cited as they are from
`COMPANY_LEGAL_ENTITY.md`, `RISK_REGISTER.md`, `EPICS_STORIES.md`, `CONFLICT_REPORT.md` and
`phase3/adr/ADR-INDEX.md`. Renumbering them was refused for the reason E01 gives: an ID cited across files
is a name, and moving a file is not a reason to change a name.

⚠️ **That is the same rule under which the epic id `E11` outlives its file.** `phase5/epics/E11.md` was
deleted on 2026-08-27 — no replacement record file was written the way E01..E10's were, because by then
there was no shipped surface left to record, only a decision — and its content moved into
[`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)'s closing note and
`EPICS_STORIES.md` §6.1. The id did not move with it as a rename: `E11` stays in the epic numbering and in
`EPICS_STORIES.md` exactly where it always was
([ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Consequences), for the identical
reason `E05-S01`..`E05-S09` above kept theirs — an id cited across files is a name regardless of whether the
file it once labelled still exists to be moved. This is the rule that governs the whole change: the file
dies, the id does not.

⚠️ **Two things this record holds that no other file does.** E05-S09's failure ordering — store the upload
in the temp directory, insert the document, publish the file — and the state a failed third step leaves
behind, which nothing repairs. And E05-S07's two frontend traps: the shop is page state rather than a URL
segment, and a first item added to an empty shop cannot arrive by cache invalidation because
`companyItems: []` carries no typename to match. `docs/data-model.md` carries the `image` field itself;
the ordering and what it costs are here.

⚠️ **Narrowed again 2026-08-27, later the same day.** The range above reads **E13..E19** because
`phase5/epics/E12.md` was deleted and its record moved beside this one to
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) — the **eleventh** record to make that move, and
the first from the E12-E18 remediation block, so the pattern is no longer about the ten bounded-context
epics alone. E12 lost its file, not its id: `E12-S01` … `E12-S26` are cited from 87 source files across
all fifteen sub-repos and resolve to sections of that record.

⚠️ **Narrowed again 2026-08-28.** The range above reads **E14..E19** because `phase5/epics/E13.md` was
deleted and its record **distributed rather than moved** — the E11 way, not E12's. All eleven of its
stories were `built`, its §6 read "None open.", and an audit of the file found only seven facts held
nowhere else, so no twelfth record joined this index and the count of eleven above is unchanged. Those
seven facts went to [`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E13 row — the landing order, its two
`BGREWRITEAOF` passes, and the "step four is the clock, not step one" rule —, to
[`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3.6 — the six `INTROSPECTION_CODE` comparison sites
named with file and line —, and to
[`dependency-tree-advisory-scan.md`](../../report/dependency-tree-advisory-scan.md) §6.1 — the seventh
site, upstream in `@axiumine/koa-utils`. E13 lost its file, not its id: it stays in the epic numbering
exactly where it always was, and every one of `E13-S01` … `E13-S11` keeps its name, for the identical
reason `E11` and `E05-S01`..`E05-S09` kept theirs above.

⚠️ **Narrowed again 2026-08-28, later the same day.** The range above reads **E15..E19** because
`phase5/epics/E14.md` was deleted this same day and its record **distributed rather than moved** — the
**E11 / E13** way, not E12's: all nine of E14's stories were `built`, its §6 read "None open.", and an
audit of the file found only nine facts held nowhere else. No twelfth record joined this one beside the
index, so the count stays **eleven** — E01..E10 and E12, unchanged by this pass. The nine facts went to
[`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E14 row (the seven-step landing order, and "land
E13-S01 **and E13-S02** first" in §2.1), to [`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 (the two
rejected alternatives: a tier-keyed privilege gradient for the session cap, and a cached-successor-pair
grace design), to [`architecture.md`](../../architecture.md) (the abandoned `// if remember me, generate
?` cookie-side comment in koa-utils' `setLoginCookies`, which E14-S07 does not revive), to
[`RISK_REGISTER.md`](./RISK_REGISTER.md) R52 ("two windows, not one"), to
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) (the Cloudflare rate-limiting-rules
alternative to `limit_req_zone`), to [`epics/E17.md`](./epics/E17.md) §5 (why E17 depends on E14 for
`familyId` and can never key a session by a token value), and to
[`token-handling-security-audit.md`](../../report/token-handling-security-audit.md) §3.4 (E14-S06's
accepted cross-service-harness residual). E14 lost its file, not its id: `E14-S01`..`E14-S09` are
unchanged and every build state with them. The two defects E14-S09 found were both explicitly outside
E14's scope and stay open, recorded in
[`multi-tab-refresh-behaviour.md`](../../report/multi-tab-refresh-behaviour.md) §4, §5 and §9 — that
report is not deleted.

## 1. Epic goal

Own `item` — the single generic, domain-neutral catalogue entry. One thing a `Company` sells, filed
under an `itemCategory`, deliberately and permanently carrying no price (ADR-009 + ADR-038). Backend writers and public reads are complete;
the ShopOwner-facing management UI is not.

## 2. Scope

| In scope | Out of scope | Why |
|---|---|---|
| `item` `$jsonSchema` validator | `company` aggregate | BC-04 owns it, `item` only holds `idCompany` |
| ShopOwner-tier `itemAdd`/`Update`/`UpdatePublished`/`Del` | `itemCategory` writes | BC-06, admin-only |
| Admin-tier `itemUpdatePublished`/`itemDel` (moderation) | price, cart membership, order lines | BC-11 `WILL NOT BUILD` — permanently out of scope, [ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) |
| Public catalogue reads (`items`, `itemBySlug`, `searchItems`) | replacing or removing an item's picture | `itemAdd` is the only writer of `image`; there is no second upload path and `itemUpdate` drops the key |
| Item picture upload on `itemAdd`, ShopOwner tier (E05-S09) | the picture on the Admin and public tiers | `image` is on this tier's `GraphQLItem` alone — `GraphQLItemFrag` is shared by three services and stays as it is |
| Public/customer catalogue frontend (`marketplace-user`) | — | ShopOwner-facing item management screens were the one gap; E05-S07 closed it |

## 3. Build state

**Backend fully built, both writers, verified on disk. ShopOwner frontend built by E05-S07 — the gap
recorded below is closed; the paragraph is kept because it is what the story was written against.**

- Schema builder: `BEs/marketplace-db-setup/lib/schemas/item.js`, migration
  `BEs/marketplace-db-setup/migrations/20260301000500-create-item.js`. ⚠️ Since 2026-08-14 it carries an
  optional `image` — a file name, pattern-anchored to `<24 hex>.<ext>`, never a path or a URL.
- Picture upload, ShopOwner tier: `image: Upload` in `GraphQLInputItem`, consumed by `itemAdd.mts` alone
  through `src/lib/item/storeItemImage.mts` (koa-utils 7.0.0 `uploadTempImage`) and
  `moveFileStaticDomain`. `STATIC_FOLDER` is required at boot in that service.
- Model: `BEs/marketplace-common/src/models/MongoDB/Item.mts`, interface
  `BEs/marketplace-common/src/models/MongoDBInterfaces/IItemSchema.mts`.
- ShopOwner-tier writer: `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/itemAdd.mts`,
  `itemUpdate.mts`, `itemUpdatePublished.mts` (⚠️ since 2026-08-14 — publishing is a separate operation on
  this tier too, and `published` is no longer a field of `GraphQLInputItem`), `itemDel.mts`; guards `throwIfShopOwnerDontOwnCompany.mts` (own package,
  `src/lib/company/`) and `throwIfItemCategoryMissing.mts` (`src/lib/item/throwIfItemCategoryMissing.mts:19`).
- Admin-tier moderation: `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/itemUpdatePublished.mts`,
  `itemDel.mts`.
- Public reads: `BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/queries/items.mts`,
  `itemBySlug.mts`, filtered through `BEs/dev/marketplace-dev-public-resource/src/lib/catalogue/publicRead.mts`.
- Public/customer frontend: `marketplace-user/src/features/catalogue/ItemGrid.tsx`,
  `ItemCard.tsx`, route `marketplace-user/src/routes/shop.$slug.item.$itemSlug.tsx`.
- ✅ **ShopOwner frontend, since E05-S07:** `marketplace-shopowner/src/features/items/Items.tsx`,
  `src/pages/ItemsPage.tsx`, route `/items`. The paragraph below is the state it was written against.
- ⚠️ **ShopOwner frontend had no item screens.** Verified: `grep -rliE "\bitem"
  marketplace-shopowner/src` returns zero feature files (only UI kit components whose names happen to
  contain the substring, e.g. `TextField.tsx`). `marketplace-shopowner/src/api/operations/shopOwnerResource/mutations.ts`
  declares only `CompanyAddDocument`/`CompanyUpdateDocument`/`CompanyDelDocument` — no `ItemAdd`,
  no `ItemUpdate`, no `ItemDel`, and `queries.ts` declares only `ShopOwnerCompaniesDocument` — no
  `CompanyItems` query. The three resolvers `itemAdd.mts`/`itemUpdate.mts`/`itemDel.mts` exist and are
  gated at 100/100 (`BEs/dev/marketplace-dev-authenticated-resource/test/`, 11 unit test files), but no
  shipped screen calls them. A ShopOwner today can register a company and see it, but has no UI path to
  add what it sells.

## 4. Stories

### E05-S01 — `item` `$jsonSchema` validator, no price field `built`
Technical story. `additionalProperties:false` and the deliberate absence of a price field must both hold.
**domains:** database
**Acceptance criteria:**
- `item.js` schema has no `price` key anywhere in its `properties` block — `BEs/marketplace-db-setup/lib/schemas/item.js`.
- `slug` is unique per `idCompany`, not globally — `idCompany_slug_unique` compound index, `BEs/marketplace-db-setup/migrations/20260301000500-create-item.js`.
**Traces:** NFR-SE11; decision-not-reopened "price field" (`phase3/adr/ADR-INDEX.md` §4, per CONSTRAINTS.md §2).
**Evidence:** `BEs/marketplace-db-setup/lib/schemas/item.js` (comment explaining the omission).

### E05-S02 — ShopOwner adds an item to an owned company `built`
**As a** ShopOwner, **when** I add a new catalogue entry, **I want** `itemAdd` to check company ownership
before category existence **so that** a caller who does not own the shop learns nothing about which
category ids are real.
**domains:** database, backend, testing
**Acceptance criteria:**
- `itemAdd` calls `throwIfShopOwnerDontOwnCompany` before `throwIfItemCategoryMissing`, in that order — `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/itemAdd.mts:39-46`.
- `itemAdd` answers `OnlyIdType!`, matching `companyAdd`'s divergence from the Admin tier's bare `Boolean` — `itemAdd.mts:29,34-39`.
**Traces:** NFR-SE05 (tier assertion gates all six ShopOwner-resource mutations, `phase4/API_CONTRACTS.md` §5.2).
**Evidence:** `mutations/itemAdd.mts:39-46`; guard `src/lib/item/throwIfItemCategoryMissing.mts:19`. Frontend since E05-S07: `ItemAddDocument` in `marketplace-shopowner/src/api/operations/shopOwnerResource/mutations.ts`, called from `src/features/items/Items.tsx`.

### E05-S03 — ShopOwner updates or retires an owned item `built`
**As a** ShopOwner, **when** I edit or remove a catalogue entry, **I want** `itemUpdate`/`itemDel` scoped
to items on companies I own **so that** I cannot alter another shop's catalogue.
**domains:** database, backend, testing
**Acceptance criteria:**
- `itemDel` stamps the `deleted` date field, never a hard remove — `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/itemDel.mts:21-26`.
- `itemUpdate` answers `Boolean!` (not `OnlyIdType`, unlike `itemAdd`) — `mutations/itemUpdate.mts:27-33`.
**Traces:** DCON-03 (soft-delete convention).
**Evidence:** `mutations/itemUpdate.mts:27-33`, `mutations/itemDel.mts:21-26`. Frontend since E05-S07: `ItemUpdateDocument` / `ItemDelDocument`, same file. ⚠️ `itemUpdate` is a transfer as well as an edit — `idCompany` travels inside `GraphQLInputItem`, so the mutation that renames an item can also move it between the owner's shops; the screen sends the field back unchanged and offers no control for that yet.

### E05-S04 — Admin moderates any item regardless of owner `built`
**As an** Admin, **when** a catalogue entry needs takedown or correction, **I want**
`itemUpdatePublished`/`itemDel` to act on any shop's item **so that** moderation does not depend on the
owning ShopOwner's session.
**domains:** database, backend, testing
**Acceptance criteria:**
- `itemUpdatePublished` takes `_id: ID!` + `published: Boolean!`, distinct from the ShopOwner tier's own `itemUpdate` which is scoped to the caller's companies — `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/itemUpdatePublished.mts:21,24-25`.
- Both Admin-tier item mutations answer plain `Boolean!` — verified `type: new GraphQLNonNull(GraphQLBoolean)` in both files.
**Traces:** NFR-SE05/SE06 (tier assertion, 403 on foreign-tier token).
**Evidence:** `marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/itemUpdatePublished.mts`, `itemDel.mts:17,18-20`.

### E05-S05 — Anonymous visitor and customer browse published items `built`
**As an** Anonymous Visitor, **when** I open a shop page or category page, **I want** `items`/`itemBySlug`
to return only published entries of a published company **so that** unpublished drafts never leak.
**domains:** database, backend, frontend, testing
**Acceptance criteria:**
- `items` filters by `companySlug` or `idCategory`, paginated (`limit`/`offset` bounded server-side, no auth middleware runs on this service) — `BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/queries/items.mts:54-61`.
- Every read goes through `LIVE_PUBLIC_PIPELINE`/`livePublic` — `BEs/dev/marketplace-dev-public-resource/src/lib/catalogue/publicRead.mts`.
**Traces:** NFR-PF04 (index-backed listing, no blocking sort), NFR-PF05 (`search_text`, weights `name:10, description:1`).
**Evidence:** `queries/items.mts:54-61`, `queries/itemBySlug.mts:42-47`; frontend `marketplace-user/src/features/catalogue/ItemGrid.tsx`, `ItemCard.tsx`, route `marketplace-user/src/routes/shop.$slug.item.$itemSlug.tsx`.

### E05-S06 — Item listing indexes hold at catalogue scale `built`
Technical story. Both listing indexes carry the sort key, so neither listing blocking-sorts.
**domains:** database, testing
**Acceptance criteria:**
- `idCompany_published_name` and `idCategory_published_name` are **4-key**, ending in `name` — a 3-key `{idCompany, published, deleted}` would answer the filter and hand every match to a blocking SORT — `BEs/marketplace-db-setup/migrations/20260301000500-create-item.js`.
- A `.explain()` on either listing query shows `IXSCAN`, never `COLLSCAN` or a blocking in-memory `SORT`.
**Traces:** NFR-PF04 — measured 100 000 keys/170 ms without the sort key vs 24 keys/3 ms with it, on a 100 000-item category.
**Evidence:** `BEs/marketplace-db-setup/migrations/20260301000500-create-item.js` header comment.

### E05-S07 — Build the ShopOwner item-management screens `built`
Technical story that closed the verified gap. A ShopOwner now creates, edits, lists and deletes their own
items from a shipped screen; no backend change was needed, as recorded when the gap was written down.
**domains:** frontend
**Acceptance criteria:**
- `marketplace-shopowner/src/api/operations/shopOwnerResource/mutations.ts` gains `ItemAddDocument`/`ItemUpdateDocument`/`ItemDelDocument`, generated via `yarn codegen` against the existing `itemAdd`/`itemUpdate`/`itemDel` resolvers — no backend change required. **Met**, and the three carry `additionalTypenames` for the same reason the company writes do.
- `marketplace-shopowner/src/api/operations/shopOwnerResource/queries.ts` gains a `CompanyItemsDocument` for `companyItems(idCompany: ID!)`. **Met**, alongside an `ItemCategoriesDocument` the acceptance criteria did not ask for and the form cannot be built without — the category is a required field and its picker has to be populated from somewhere.
**Traces:** none — no Critical NFR blocks this; it is a coverage gap in the shipped surface, not a quality regression.
**Evidence:** `marketplace-shopowner/src/features/items/Items.tsx`, `src/pages/ItemsPage.tsx`, route `/items` in
`src/router.tsx`, sidebar entry in `src/components/layout/SideMenu.tsx`; documents in
`src/api/operations/shopOwnerResource/{queries,mutations}.ts` typed from the extended
`schema/authenticated-resource.graphql` slice. Tests: `test/features/items/Items.test.tsx`,
`itemSchema.test.ts`, `test/pages/ItemsPage.test.tsx` — repo green at 662 tests, 100% on all four
coverage metrics and mutation score 100.
⚠️ **The shop is page state, not a URL segment.** `companyItems` takes an `idCompany`, so `/items/$idCompany`
would have worked; it was refused because it puts back into the address bar the one id this tier's URL space
has always been free of. `throwIfShopOwnerDontOwnCompany` is what makes the argument safe either way.
⚠️ **A first item added to an empty shop does not appear by cache invalidation.** urql's document cache
matches `additionalTypenames` against typenames a *cached response carries*, and `companyItems: []` carries
none. The new-item card drops itself on success instead of relying on the refetch.

### E05-S08 — Publishing is a separate operation, on both tiers `built`
The platform owner's call, taken on 2026-08-14: saving an item must not publish it. `published` was a
`Boolean!` inside `GraphQLInputItem` and both update paths `$set` the whole object, so every save wrote the
flag — an owner who reopened a card after the operator took it down republished it on Save, without asking
to and without a control on screen saying so.
**domains:** backend, frontend, testing
**Acceptance criteria:**
- `published` leaves `GraphQLInputItem` on both tiers and `IItemUpdate` with it; `itemAdd` stamps `false`. **Met.**
- The ShopOwner tier gains an `itemUpdatePublished(_id, published)` of its own, guarded by `throwIfShopOwnerDontOwnCompany` like every other write there. **Met** — `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/itemUpdatePublished.mts:27,31-32`.
- Both tiers gain `companyUpdatePublished(_id, published)` for the same reason on `company`. **Met** — see [`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md).
- `marketplace-shopowner`'s catalogue card publishes from a control of its own and its Save carries no flag. **Met** — the header states `Published:` and offers one button, which writes immediately and reads the result back from the refetched `companyItems`; the card's zod schema has no `published` and drops one that reaches it anyway.
**Traces:** none — a correctness decision on the write shape, not an NFR.
**Evidence:** `BEs/dev/marketplace-dev-authenticated-resource` `3a3874d`, `BEs/dev/marketplace-dev-admin-authenticated-resource` `7a60574`, `marketplace-shopowner` `11500cc`, `marketplace-admin` `36b99f4` (record only — that app never sent the flag). All four repos green on their own gates.
⚠️ **The Admin app has no publish control at all**, on either aggregate: it calls neither `*UpdatePublished` and shows the shop's public fields nowhere. That is a screen nobody has built, not a resolver anybody removed — `marketplace-admin/README.md` §"Decisions that look wrong until you know why".
⚠️ **`companyUpdatePublished` has no call site anywhere yet.** The owner's app has no box for `publicName`/`slug`/`description`, and the collection's `$expr` refuses `published: true` without the first two, so publishing a *shop* needs that form before it needs anything else.

### E05-S09 — A ShopOwner gives an item a picture while adding it `built`
**As a** ShopOwner, **when** I add a catalogue entry, **I want** to send its picture in the same call
**so that** an item and the image that sells it are one operation rather than two, with no window in
which one exists without the other.
Closes the first §6 open question. The platform owner chose, of the three places the reference could
live, a new `image` field on `item` — over an `itemImage` collection and over deriving the name from
`_id` alone with no field at all.
**domains:** database, backend, testing
**Acceptance criteria:**
- `item.js` gains an optional `image`, and it is a **file name only**: `^[a-f0-9]{24}\.[a-z0-9]{3,4}$`,
  anchored at both ends. **Met.** The directory is `STATIC_FOLDER/item/<idCompany>/`, and both segments
  are already on the document, so a stored path would be three ways of saying the same thing and one way
  of escaping it. Not in `required` — an item without a picture is ordinary, and that absence is what a
  card reads before choosing a placeholder.
- `GraphQLInputItem` gains `image: Upload`, nullable, and `itemAdd` is its only consumer. **Met.**
- The three steps straddle the insert, in this order: store the upload in the temp directory, write the
  document, publish the file. **Met** — `itemAdd.mts`. Nothing reaches the static domain before the
  document exists, so the ordinary failure here (a slug already taken in the shop, 409) leaves the
  re-encoded file in the temp directory where no URL points.
- The picture is named after the item's `_id`, never after the client's filename. **Met** —
  `storeItemImage.mts`.
- `itemUpdate` cannot write the field. **Met** — `IItemUpdate` omits `image` *and* `funItemUpdate` drops
  the key at the `$set`, because the shared input means a save can arrive carrying an `Upload` whatever
  the type says.
**Traces:** NFR-SE11 (validator holds the shape); the re-encode is the security step — koa-utils
`uploadTempImage` checks extension and MIME, scans with ClamAV, then rebuilds the file from decoded
pixels, so a payload smuggled inside a valid image does not survive the round trip.
**Evidence:** `BEs/marketplace-db-setup/lib/schemas/item.js`; `BEs/marketplace-common/src/models/MongoDB/Item.mts`
and `MongoDBInterfaces/IItemSchema.mts`; `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/GraphQLInput/GraphQLInputItem.mts`,
`mutations/itemAdd.mts`, `src/lib/item/storeItemImage.mts`, `types/GraphQLItem.mts`. Tests:
`test/itemMutations.test.mts`, `test/itemLib.test.mts`, `test/schema.test.mts`, `test/index.unit.test.mts`;
db-setup `test/migrations.test.mjs`. All three repos green at 100% on all four coverage metrics.
⚠️ **A failed move after a successful insert is not repaired.** The client gets a 500 and the item exists
all the same, so a retry collides with its own slug and comes back 409. No compensating delete was
written: a rollback is a second write that can fail in turn, and the state it would clean up is one an
operator can see. Recorded here rather than left to be discovered.
⚠️ **There is no way to change or remove a picture yet**, and no screen sends one. `itemAdd` is the only
writer of the field, `GraphQLItemFrag` does not carry it, and the two other tiers cannot read it.

## 5. Dependencies

- BC-04 (Legal Entity / Company) lands first — `item.idCompany` needs an existing, owned `company` document.
- BC-06 (Category Taxonomy) lands first — `item.idCategory` is checked against `itemCategory` at write
  time by `throwIfItemCategoryMissing`; an empty taxonomy makes every `itemAdd` fail that check.
- E05-S07 depends on nothing else in this epic landing first — the resolvers it wires already exist.

## 6. Open questions

- ~~No image-upload mutation exists despite the middleware being mounted (`graphqlUploadKoa`, 30 MB/file,
  10 files max — `marketplace-dev-authenticated-resource/src/index.mts:132-133`). `itemAdd.mts`'s own doc
  comment gestures at "uploading its image, most obviously" but no mutation declares a `GraphQLUpload`
  argument (`phase4/API_CONTRACTS.md` §5.2). Whether this ships as a follow-up field on `itemAdd` or a
  separate mutation has not been asked of the user.~~ ⚠️ **Closed 2026-08-14 — E05-S09.** A field on
  `itemAdd`, not a separate mutation: the `Upload` sits inside `GraphQLInputItem`, so adding an item and
  giving it a picture are one call. The reference lives in a new optional `image` on `item`, which was the
  platform owner's choice; it widened the shared `$jsonSchema`, so every database that has run these
  migrations is replayed in the same piece of work. Two things stayed deliberately out: the field is not
  on `GraphQLItemFrag`, so the Admin and public tiers cannot read it, and no frontend sends or renders one.
- ~~Two independent writers of `item.published` (ShopOwner's `itemUpdate`, Admin's `itemUpdatePublished`)
  with no version/lock field in `item.js` — the same race class as E04's open question, unexamined
  (`EVENT_STORMING.md` §5 hotspot 4).~~ ⚠️ **Closed 2026-08-14 by the platform owner: last writer wins, no
  lock field.** An operator unpublishes, the owner publishes it again, and that is an accepted outcome —
  decided together with the same race on `company` ([`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md) §6) and recorded in
  [`RISK_REGISTER.md`](./RISK_REGISTER.md) §5. ⚠️ ~~Worth knowing when writing any story here: the owner
  need not republish deliberately. `funItemUpdatePublished` sets that one flag, `funItemUpdate` `$set`s the
  whole card and `IItemUpdate` keeps `published`, so **an ordinary save of any other field restores the
  owner's value of the flag**.~~ **Struck later the same day**: publishing was split out of `itemUpdate` on
  both tiers, so a republish is now always deliberate. The operator action that survives it is `itemDel` —
  `deleted` is outside every input.
