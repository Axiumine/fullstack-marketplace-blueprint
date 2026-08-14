# E04 — Legal Entity / Company
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.5
**Date:** 2026-08-14
**Author:** epics-agent
**Bounded context:** BC-04 — Legal Entity / Company
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
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
v1.3 - 2026-08-14: it was put to the owner immediately after, and answered the same way — an operator
unpublishing and the shop owner publishing it again is fine. §6's closing paragraph is rewritten: the
decision now covers `item.published` too, closing R29, `phase2/EVENT_STORMING.md` §5 hotspot 4 and §6 q5,
`phase2/BOUNDED_CONTEXT.md` §7 q5, `phase4/DDD_AGGREGATES.md` §10 q4 and `epics/E05.md` §6.
`epics/E11.md` §6 q3 stays open, being about an order snapshotting catalogue state rather than the race.
v1.4 - 2026-08-14: accepting the race exposed the thing under it — `published` was a field of
`GraphQLInputCompany`, so every ordinary save of the card wrote the flag and an operator reopening a stale
card republished a shop somebody had just taken down. The platform owner asked for publishing to be a
separate operation on both tiers, and it is: `published` left both input types, `companyAdd` stamps `false`,
and `companyUpdatePublished(_id, published)` is the only writer on each tier. §2, §3 and the new **E04-S08**
record it; §6's "three fields outside the race" is now four. The race decision itself is untouched — two
writers of `companyUpdatePublished` still last-writer-wins.
v1.5 - 2026-08-14: **the file left `epics/` and became this record**, for the reason §0 gives. No story
changed, no ID moved, and nothing was dropped in the move — only the links, which now resolve from
`phase5/` rather than from `phase5/epics/`.

## 0. Why this record is not under `epics/`

It was `phase5/epics/E04.md` until 2026-08-14. The file was deleted and its record moved here in one pass,
the fourth to move for the reason [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md),
[`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md) and
[`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md) moved before it: nothing in it is
work still ahead. All eight stories are `built`, §6's one open question closed on 2026-08-14, and the
publish split that closed the last thing under it landed the same day — so the file had become the *record*
of a shipped surface rather than a backlog entry. `EPICS_STORIES.md` §1 still says stories live in
`epics/ENN.md`, and that stays true for E05..E18; E01, E02, E03 and E04 are the four whose records sit
beside the index instead of under it.

**The story IDs did not change.** `E04-S01` … `E04-S08` keep their names, cited as they are from
`phase2/BOUNDED_CONTEXT.md`, `phase2/EVENT_STORMING.md`, `phase4/API_CONTRACTS.md`,
`phase4/DDD_AGGREGATES.md`, `RISK_REGISTER.md`, `EPICS_STORIES.md`, `epics/E05.md` and `epics/E11.md`.
Renumbering them was refused for the reason E01 gives: an ID cited across files is a name, and moving a
file is not a reason to change a name.

⚠️ **One thing this record holds that no other file does:** §6, the two-writer race and what the platform
owner accepted about it — whole-card last-write-wins, no version field, and the four fields that sit
outside the race by construction. `RISK_REGISTER.md` §5 carries the decision as a bullet; the reasoning
about *what exactly* was accepted lives here and is cited from there.

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
| Public storefront fields (`publicName`,`slug`,`description`,`published`) | order/cart/delivery/payment | BC-11, unbuilt, no model to copy |
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
**Evidence:** `3a3874d` (ShopOwner service), `7a60574` (Admin service); the same split on `item` is [`epics/E05.md`](./epics/E05.md) E05-S08.

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
  case; an operator's save silently reverting a `vatNumber` the owner corrected ten minutes earlier is
  the same event, and is the one worth knowing about. The repair is the same either way — reload, retype
  — because every field is operator- or owner-typed and none is derived.

  **Four fields sit outside the race by construction and stay there.** `_id` and `idShopOwner` are
  omitted from both payload types, so no save moves a company between owners
  ([`RISK_REGISTER.md`](./RISK_REGISTER.md) R30). `deleted` is out too: the ShopOwner type excludes it
  outright, and on the Admin tier `ICompanyValidated` nominally admits it while `validateCompany` returns
  a literal that never sets it and `GraphQLInputCompany` declares no such field. Retiring and reviving
  therefore remain `companyDel`'s alone on both tiers, and a stale card cannot resurrect a retired
  company. ⚠️ **`published` joined them later the same day** (E04-S08): it was inside both input types when
  this paragraph was first written, which is exactly why a stale card republished a shop. It is now
  `companyUpdatePublished`'s alone. Two operators racing *that* mutation still resolve last-writer-wins —
  the decision above is narrowed to the flag's own writer, not reversed.

  ⚠️ **The same decision was extended to `item.published` hours later, on 2026-08-14.** It was recorded
  here first as covering `company` alone, because `published` is a moderation flag and the reverted-save
  outcome that is a re-edit here is a failed takedown there; the platform owner was asked and answered
  that an operator unpublishing and the owner publishing it again is equally fine. So
  [`RISK_REGISTER.md`](./RISK_REGISTER.md) R29, `phase2/EVENT_STORMING.md` §5 hotspot 4 and §6 q5,
  `phase2/BOUNDED_CONTEXT.md` §7 q5, `phase4/DDD_AGGREGATES.md` §10 q4 and [`epics/E05.md`](./epics/E05.md) §6 all close
  with this one. One question it does **not** close: [`epics/E11.md`](./epics/E11.md) §6 q3, whether an order snapshots
  the catalogue state it was placed against, which is BC-11 design work rather than this race.

  ⚠️ **Accepting the race is not accepting the trigger.** Hours after answering, the platform owner read
  the consequence in full — an ordinary save wrote the flag, so an operator reopening a stale card
  republished a shop somebody had just taken down without touching anything called "publish" — and asked
  for publishing to be its own operation on both tiers. It now is, for `company` (E04-S08) and for `item`
  ([`epics/E05.md`](./epics/E05.md) E05-S08). What the owner accepted stands: two deliberate publishers still resolve
  last-writer-wins. What went away is the accidental publisher.
