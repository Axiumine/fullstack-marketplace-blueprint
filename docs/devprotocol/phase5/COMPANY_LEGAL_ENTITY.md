# Legal Entity / Company
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.14
**Date:** 2026-08-30
**Author:** records-agent
**Bounded context:** BC-04 — Legal Entity / Company
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
v1.14 - 2026-08-30: the two places that named `./deploy-local.sh` as how a `marketplace-common` model
change reaches the two resource services now name a published release — the platform owner ruled that an
edit there reaches a consumer by that route and by no other, and the script is deleted
([`ADR-047`](../phase3/adr/ADR-047-a-common-change-ships-as-a-published-release.md)). No story, field,
acceptance criterion or open question changed.
v1.8 - 2026-08-27: the two-story record covering ordering & fulfilment is absorbed into ADR-038's closing
note rather than becoming a record file of its own. §6's closing paragraph is rewritten: the question of
whether an order snapshots the catalogue state it was placed against is no longer merely uncited by this
file's decision, it is closed, moot, on the same day and by the same decision
([ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)) that closed BC-11 itself. What
that question's record held before its file went is kept here: the publish split (*Publishing a company
is a separate operation, on both tiers*) made the flip deliberate rather than answering the
snapshot-versus-live-reference question, so the half died with the context that would have asked it, not
with an answer of its own. `item.published` itself is untouched by any of this —
last-writer-wins stands, and the two publish operations stand.
v1.7 - 2026-08-27: Two BC-11 references framed commerce as pending. ADR-038 (2026-08-27) makes it permanently out of scope, so the out-of-scope row says refused rather than unbuilt and the "which is BC-11 design work" aside notes that design work is never happening.
v1.1 - 2026-08-14: §2 and §5 both said the `idShopOwner` reference was enforced by nothing. MongoDB enforces
nothing, which is what they meant; application code does — `funCompanyAdd` 404s an `idShopOwner` that names
no live `shopOwner` before it inserts. Both lines now separate the two. Landed with the closure of
`EVENT_STORMING.md` §5 hotspot 5, `RISK_REGISTER.md` R30 and
[`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md) §6's last open question (§6 q4
there), which all rested on the same reading.
v1.2 - 2026-08-14: §6's only open question is closed by the platform owner's decision — two writers on one
`company` is fine, last writer wins, no version or lock field. §3 no longer calls that race this record's one
open piece, and §6 spells out what was accepted: whole-card last-write-wins, since both tiers `$set` an
object enumerating every field rather than a diff. Recorded as accepted in
[`RISK_REGISTER.md`](./RISK_REGISTER.md) §5. The `item.published` race the question compared itself to
(R29) stays **Open** — same race class, opposite cost — and was not put to the owner in this pass.
v1.3 - 2026-08-14: it was put to the owner immediately after, and answered the same way — an admin
unpublishing and the shop owner publishing it again is fine. §6's closing paragraph is rewritten: the
decision now covers `item.published` too, closing R29, `phase2/EVENT_STORMING.md` §5 hotspot 4 and §6 q5,
`phase2/BOUNDED_CONTEXT.md` §7 q5, `phase4/DDD_AGGREGATES.md` §10 q4 and [`CATALOGUE.md`](./CATALOGUE.md) §6.
⚠️ **The order-snapshot question — whether an order snapshots the catalogue state it was placed against,
rather than the race itself — closed moot on 2026-08-27**, together with the four other BC-11 questions
([ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)); §6 below holds its record.
v1.4 - 2026-08-14: accepting the race exposed the thing under it — `published` was a field of
`GraphQLInputCompany`, so every ordinary save of the card wrote the flag and an admin reopening a stale
card republished a shop somebody had just taken down. The platform owner asked for publishing to be a
separate operation on both tiers, and it is: `published` left both input types, `companyAdd` stamps `false`,
and `companyUpdatePublished(_id, published)` is the only writer on each tier. §2, §3 and the new story
— *Publishing a company is a separate operation, on both tiers* — record it; §6's "three fields outside
the race" is now four. The race decision itself is untouched — two
writers of `companyUpdatePublished` still last-writer-wins.

## 1. Goal

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
platform today; the mutation is there, the caller is the gap (see *Publishing a company is a separate
operation, on both tiers*, below).

Nothing else here is unbuilt, and since 2026-08-14 nothing in it is open either. The one piece that
was — the two-writer race in §6 — was settled by a decision rather than by code: last writer wins.

## 4. Stories

### Company `$jsonSchema` + `$expr` validator `built`
Technical story. `company.js`'s `validatorCompany()` must produce the legal fields and the public
storefront fields as one shape, plus the cross-field publish invariant a `$jsonSchema` alone cannot
express.
**domains:** database
**Acceptance criteria:**
- `validatorCompany()` takes no arguments and returns `$and: [{$jsonSchema}, {$expr}]`; `published` is in `required`, `publicName`/`slug`/`description` are not — `BEs/marketplace-db-setup/lib/schemas/company.js`.
- `PUBLISHED_IMPLIES_LINKABLE` rejects `published:true` unless both `slug` and `publicName` are typed `string` — `BEs/marketplace-db-setup/lib/schemas/company.js`.
**Traces:** NFR-SE11 (strict `$jsonSchema`, `additionalProperties:false`), CON-07 (migration immutable).
**Evidence:** `BEs/marketplace-db-setup/migrations/20260301000200-create-company.js`, `BEs/marketplace-db-setup/migrations/20260301000200-create-company.js`.

### `Company` model shared by both writer services `built`
Technical story. One Mongoose model consumed by `marketplace-dev-authenticated-resource` and
`marketplace-dev-admin-authenticated-resource` so the shape cannot drift between the two writers.
**domains:** backend
**Acceptance criteria:**
- `BEs/marketplace-common/src/models/MongoDB/Company.mts` has exactly one `exports` entry in `marketplace-common/package.json` — no second copy exists in either resource service's own `src/models`.
- A field added to `ICompanySchema.mts` is visible to both resource services once the version carrying it is published and each service's range has moved, without editing either service's own source.
**Traces:** BCON-07 (edit invisible until published — ADR-047).
**Evidence:** `BEs/marketplace-common/src/models/MongoDB/Company.mts`, `BEs/marketplace-common/src/models/MongoDBInterfaces/ICompanySchema.mts`.

### ShopOwner registers a company `built`
**As a** ShopOwner, **when** I submit the registration form, **I want** `companyAdd` to create a `company`
document owned by me **so that** I have a shop to attach items to.
**domains:** database, backend, frontend, testing
**Acceptance criteria:**
- `companyAdd` on this tier answers `OnlyIdType!` (the new `_id`), not `Boolean` — `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts:22,27-32`.
- A duplicate `vatNumber` or `certifiedEmail` is rejected by the global unique index, not by application code — `company.vatNumber_unique`/`certifiedEmail_unique`, `BEs/marketplace-db-setup/lib/schemas/company.js`.
**Traces:** NFR-SE11, BCON-01 (100/100 gate proves it, `BEs/dev/marketplace-dev-authenticated-resource/vitest.config.mts`).
**Evidence:** `mutations/companyAdd.mts:22,27-32`; frontend form `marketplace-shopowner/src/features/companies/saving.tsx`, wired at `marketplace-shopowner/src/api/operations/shopOwnerResource/mutations.ts:24`.

### ShopOwner updates or retires an owned company `built`
**As a** ShopOwner, **when** I edit or delete a company document I own, **I want** `companyUpdate`/`companyDel`
to act only on my own companies **so that** I cannot touch another shop owner's shop.
**domains:** database, backend, frontend, testing
**Acceptance criteria:**
- `companyDel` on an already-retired, owned company answers 403, because `throwIfShopOwnerDontOwnCompany` filters `deleted` — `BEs/dev/marketplace-dev-authenticated-resource/src/lib/company/throwIfShopOwnerDontOwnCompany.mts:17`.
- `companyDel` stamps the `deleted` date field, never issues a hard remove — `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/companyDel.mts:20-25`.
**Traces:** DCON-03 (soft-delete-not-hard-remove), NFR-SE11.
**Evidence:** `mutations/companyUpdate.mts:16-22`, `mutations/companyDel.mts:20-25`.

### Admin manages any company on any shop owner's behalf `built`
**As an** Admin, **when** a shop owner needs support, **I want** `companyAdd`/`Update`/`Del` to operate on
any `company` document regardless of owner **so that** platform operations do not depend on the shop owner's
own session.
**domains:** database, backend, frontend, testing
**Acceptance criteria:**
- Admin-tier `companyAdd` takes an explicit `idShopOwner: ID!` argument the ShopOwner-tier version cannot have — `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts:23,26-27`.
- All three Admin-tier company mutations answer plain `Boolean!`, diverging on purpose from the ShopOwner tier's `OnlyIdType` on `companyAdd` — `phase4/API_CONTRACTS.md` §6.2, verified `type: new GraphQLNonNull(GraphQLBoolean)` in each file under `schema/mutations/`.
**Traces:** NFR-SE05/SE06 (tier assertion, 403 not 401, on every Admin-resource call).
**Evidence:** `marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts`, `companyUpdate.mts:26,27-30`, `companyDel.mts:18,21`; frontend `marketplace-admin/src/features/shopOwners/Companies.tsx:247-249`.

### Admin `companyDel` on an already-retired company answers 200, not 403 `built`
Technical story, records a deliberate two-tier divergence so nobody "fixes" it into agreement.
**domains:** backend, testing
**Acceptance criteria:**
- Admin-tier delete guard does not filter `deleted` — [`docs/data-model.md`](../../data-model.md), confirmed no `deleted` check in `marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/companyDel.mts`.
- `vatNumber_unique`/`certifiedEmail_unique` carry no `partialFilterExpression`, so a retired company keeps its `vatNumber` occupied — `BEs/marketplace-db-setup/lib/schemas/company.js`.
**Traces:** NFR-SE11; policy row "Liveness filters belong on read paths and existence/ownership guards" (`docs/data-model.md`).
**Evidence:** `marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/companyDel.mts:18,21`.

### Company gets a public storefront face `built`
Technical story. `publicName`/`slug`/`description`/`published` added on top of the legal shape, defaulted
closed.
**domains:** database, backend, testing
**Acceptance criteria:**
- `published` has no default other than absent/false — nothing is indexable until the owner opts in — `BEs/marketplace-db-setup/migrations/20260301000200-create-company.js`. Since 2026-08-14 `companyAdd` stamps that `false` explicitly and only `companyUpdatePublished` ever changes it (see *Publishing a company is a separate operation, on both tiers*).
- `slug` is unique via a partial index on `{$type:'string'}`, so companies with no slug yet do not collide on a shared `null` — `BEs/marketplace-db-setup/migrations/20260301000200-create-company.js`.
**Traces:** NFR-PF03 (`slug_unique` lookup index).
**Evidence:** `BEs/marketplace-db-setup/lib/schemas/company.js,111-125` (`PUBLISHED_IMPLIES_LINKABLE`).

### Publishing a company is a separate operation, on both tiers `built`
**As a** ShopOwner or Admin, **when** I save a company card, **I want** the save to leave `published` exactly
as it was **so that** editing an address never republishes a shop that was deliberately taken down.
**domains:** backend, frontend, testing
**Acceptance criteria:**
- `published` is absent from `GraphQLInputCompany` on both services, so no save can carry it — ShopOwner `graphQLApi/schema/types/inputs/GraphQLInputCompany.mts`, Admin the same path.
- `companyAdd` stamps `published: false` on both tiers; a new company is never born public.
- `companyUpdatePublished(_id: ID!, published: Boolean!) : Boolean!` is the single writer on each tier, ownership-guarded on the ShopOwner one — `marketplace-dev-authenticated-resource/…/mutations/companyUpdatePublished.mts:25,28-30`, `marketplace-dev-admin-authenticated-resource/…/mutations/companyUpdatePublished.mts:21,24-26`.
- `PUBLISHED_IMPLIES_LINKABLE` still refuses `published: true` without a stored `slug` and `publicName`, so the sequence is compulsory: save the card, then publish — two calls, in that order.
**Traces:** *Company gets a public storefront face* (the storefront fields the `$expr` requires); the §6 race decision, which this narrows without reversing.
**Evidence:** `3a3874d` (ShopOwner service), `7a60574` (Admin service); the same split on `item` is [`CATALOGUE.md`](./CATALOGUE.md)'s *Publishing is a separate operation, on both tiers*.

⚠️ **No frontend calls it yet, on either tier.** Neither company screen has ever had a publish control —
the flag moved as a side effect of the whole-card `$set`, and nothing on screen said so. The missing screen
is recorded in `marketplace-admin/README.md` and `marketplace-shopowner`'s slice; it is a UI story nobody
has written, not a resolver gap.

## 5. Dependencies

- BC-01 (Identity & Access) lands first — `company.idShopOwner` needs a `shopOwner` document to point at,
  and on the Admin tier that is enforced rather than assumed: `funCompanyAdd` 404s when the id names no
  live owner. MongoDB itself still holds no constraint.
- BC-05 (Catalogue) depends on BC-04, not the reverse — `item.idCompany` needs an existing `company`.
- BC-08 (Public Discovery) reads `company` through `LIVE_PUBLIC_PIPELINE` but never writes it; landing
  order does not matter for the stories in §4.
- Model change flow if `company.js` ever changes: `marketplace-common` model → publish the release → both
  resource services' ranges moved — separate commits per BCON-05.

## 6. Open questions — the one there was is closed

- Two independent writers of the same company (`ShopOwner` and `Admin`) with no version/lock field on
  `company` — same unexamined race class the EVENT_STORMING doc flags for `item.published`
  (`EVENT_STORMING.md` §5), just not yet named for `company`. No optimistic-lock field exists in
  `company.js` today; whether one is needed has not been asked of the user.

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
  company. ⚠️ **`published` joined them later the same day** (see *Publishing a company is a separate
  operation, on both tiers*): it was inside both input types when
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
  afterwards — recorded in [ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)'s
  closing section, carried from `phase2/BOUNDED_CONTEXT.md` §7 q5 originally, the
  same race this paragraph closes. It survived this decision and the publish split above: a
  dedicated writer per flag makes the flip deliberate rather than accidental, but an order holding a live
  reference would still see whatever the last deliberate publisher left, so the split narrowed the race
  without ever choosing between snapshot and live reference.

  ⚠️ **It closed anyway, on 2026-08-27 — moot, not answered.** The platform owner decided that cart, order,
  delivery and payment are permanently out of scope
  ([ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)), so there is no order to hold
  either a snapshot or a live reference, and the question asking which one it should hold has no subject
  left to be about. The record that carried it is deleted; its closing note is in
  ADR-038, which also names the two stories that recorded it. The half that outlived three earlier
  passes died with the context that would have asked it, not with an answer of its own — and none of this
  touches `item.published` itself: last-writer-wins stands, and the two publish operations, this one and
  [`CATALOGUE.md`](./CATALOGUE.md)'s *Publishing is a separate operation, on both tiers*, stand exactly as decided.

  ⚠️ **Accepting the race is not accepting the trigger.** Hours after answering, the platform owner read
  the consequence in full — an ordinary save wrote the flag, so an admin reopening a stale card
  republished a shop somebody had just taken down without touching anything called "publish" — and asked
  for publishing to be its own operation on both tiers. It now is, for `company` (*Publishing a company is
  a separate operation, on both tiers*) and for `item` ([`CATALOGUE.md`](./CATALOGUE.md)'s *Publishing is a
  separate operation, on both tiers*). What the owner accepted stands: two deliberate publishers still
  resolve last-writer-wins. What went away is the accidental publisher.
