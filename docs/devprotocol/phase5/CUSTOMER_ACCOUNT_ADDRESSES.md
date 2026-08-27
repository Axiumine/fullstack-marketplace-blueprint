# E07 — Customer Account & Addresses
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.5
**Date:** 2026-08-26
**Author:** epics-agent
**Bounded context:** BC-07 — Customer Account & Addresses
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
v1.4 - 2026-08-26, later the same day: **§6's second open question closes, and it closes by being built.**
`addresses[].position` had no story saying who writes it; it now has E07-S11 — the account form carries a
MapLibre island with a draggable pin, so a picked geocoder suggestion places the address and the customer
can correct it or place a hand-typed one the geocoder never found. `position` stays optional, which was the
platform owner's decision when the alternative was offered: an address nothing can place still saves.
v1.3 - 2026-08-26: **`addresses[]` is bounded.** It was unbounded in every layer — no `maxItems`, no guard
in `funUserAddressAdd`, no ceiling in the account area — which is not a shipped decision so much as a
question nobody had asked: an array under a 16 MB document ceiling that `me` loads whole on every read. Six
is the answer, added on both sides in one piece of work, and E07-S10 is the story. §3's "built end to end"
is unchanged; this is the first thing built into this epic since it was baselined.
v1.1 - 2026-08-25: §6's first open question closes on the platform owner's decision — **`user` gets no
`waitApprov`-equivalent, and self-service is permanent**. Nothing was built; the shipped design already
says so in three places, and what was missing was whether it was a starting point or the answer. It is the
answer. Recorded in `phase3/adr/ADR-INDEX.md` §4. Closing it surfaced one thing the question had not
asked: `user.disabled` is read by every gate and written by nothing.
v1.2 - 2026-08-25, later the same day: that finding became an epic. [`E19.md`](./epics/E19.md) — Customer
Administration — owns the missing lever and the operator surface to reach it from, so §6's note names the
epic rather than leaving a finding with nobody holding it. The decision closed above is untouched and E19
does not reopen it: it adds no gate before a customer's first login, and its customers table queries no
encrypted field, so the sentence about a moderation table reversing ADR-029 is narrowed to the *searchable*
kind it was always about.
v1.5 - 2026-08-26, last that day: **the file left `epics/` and became this record**, for the reason §0
gives. No story changed, no ID moved, and nothing was dropped in the move — only the links, which now
resolve from `phase5/` rather than from `phase5/epics/`. Four things this file held alone were copied out
first, to where a reader looks for them without knowing it exists: the address form's single `"lon,lat"`
field and its three writers, the viewport exemption that stops the map chasing a dragged pin, and the
`[longitude, latitude]` order with its six-decimal rounding are in
[`docs/frontends.md`](../../frontends.md); the corrected meaning of `position` — a hand-typed address is
placed by the pin alone, rather than staying unplaced until re-picked — and `addresses`' `maxItems: 6` are
in [`phase2/UBIQUITOUS_LANGUAGE.md`](../phase2/UBIQUITOUS_LANGUAGE.md) §8, whose two entries still described
the platform as it stood before E07-S10 and E07-S11. Correcting them surfaced a third stale claim, in the
same glossary (§17) and in [`phase2/EVENT_STORMING.md`](../phase2/EVENT_STORMING.md) §4: both said `me` answers
"login/verify state", and it does not — the `select` is a positive list of six fields and `GraphQLUserMe`
has no field for `emailVerify` at all, which is E07-S01's whole point.

## 0. Why this record is not under `epics/`

It was `phase5/epics/E07.md` until 2026-08-26. The file was deleted and its record moved here in one pass,
the seventh to move for the reason [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md),
[`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md),
[`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md),
[`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md), [`CATALOGUE.md`](./CATALOGUE.md) and
[`CATEGORY_TAXONOMY.md`](./CATEGORY_TAXONOMY.md) moved before it: nothing in it is work still ahead. All
eleven stories are `built` and §6 has no open question left — the absent approval gate closed on
2026-08-25 by a decision, and `position`'s writer on 2026-08-26 by an implementation, which is also where
the two newest stories came from. So the file had become the *record* of a shipped surface rather than a
backlog entry. `EPICS_STORIES.md` §1 still says stories live in `epics/ENN.md`, and that stays true for
E11..E19; E01..E10 are the ten whose records sit beside the index instead of under it — E08's is
[`PUBLIC_DISCOVERY_STOREFRONT.md`](./PUBLIC_DISCOVERY_STOREFRONT.md) and E09's is
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md), both moved later the
same day. E10's is [`SHARED_KERNEL.md`](./SHARED_KERNEL.md), moved 2026-08-27.

**The story IDs did not change.** `E07-S01` … `E07-S11` keep their names. They are cited by
[`docs/data-model.md`](../../data-model.md) (E07-S11), [`phase3/adr/ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md)
§4 (E07-S11, twice), [`CONFLICT_REPORT.md`](./CONFLICT_REPORT.md) (E07-S03, E07-S05) and
[`EPICS_STORIES.md`](./EPICS_STORIES.md) §5, which uses `E07-S01` as the example of the ID format itself.
Every one of those resolves to a section of this file, and renumbering was refused for the reason E01
gives — an ID cited across files is a name, and moving a file is not a reason to change a name.

⚠️ **This is the first record to move while two of its stories are days old.** E07-S10 and E07-S11 both
landed in the week before the move, so unlike the six before it this file is not purely a retrospective:
§3's "built end to end" was written of a surface that has since grown a cap and a map. Both are recorded
outside this file as well — the cap as [`ADR-035`](../phase3/adr/ADR-035-user-addresses-capped-at-six.md)
and in [`docs/data-model.md`](../../data-model.md), the map in
[`docs/frontends.md`](../../frontends.md) and as two rows of ADR-INDEX §4 — so nothing about either
depends on this file being read.

⚠️ **What this record holds that no other file does, after the move.** Not the decisions, and not the
contracts: `me`'s six-field positive projection, `userAddressAdd`'s 400 at six and the filter clause that
buys atomicity, the ownership guard on the other three mutations and the pipeline delete with its two
Mongoose traps are all in [`phase4/API_CONTRACTS.md`](../phase4/API_CONTRACTS.md) §7.2, and the delete's
`$$REMOVE` is additionally in [`ADR-010`](../phase3/adr/ADR-010-default-address-pointer.md), DCON-06 and
R11. What stays here alone is the *shape of the work*: eleven stories with their acceptance criteria, in
the order they were written, and §6's two questions with the reasoning that closed each — why a customer
tier that self-serves permanently is not the same question as a shop owner's approval queue, and why an
address a geocoder cannot find is saved without a point rather than refused. Both describe how a shipped
surface was reasoned about, which is what a record is for and what an ADR deliberately is not.

## 1. Epic goal

Own everything a `User` can do to their own record past login: fill in optional `personalData`,
manage an `addresses[]` array of at most six, hold at most one `defaultAddress` pointer, change own
password.
No order/cart relationship exists yet — addresses point at nothing beyond the customer's own document.

## 2. Scope

| In scope | Out of scope | Why |
|---|---|---|
| `user.personalData`, `user.addresses[]`, `user.defaultAddress` shape | `user.login`, `emailVerify`, `resetPwd` sub-documents | BC-01 (Identity & Access) owns login/session content, same document, different context by convention |
| `me`, `userPersonalDataUpdate`, `userAddressAdd/Update/Del`, `userDefaultAddressSet`, `userUpdatePwd` resolvers | `userRegister`, `userVerifyEmailResend` | Those mutations live in `marketplace-dev-public-resource` (BC-08/BC-01), not this service |
| `marketplace-user` `/account/*` CSR routes reading/writing those ops | Any order/cart linkage from an address | BC-11 unbuilt, no model to copy — see [`CLAUDE.md`](../../../CLAUDE.md) §Build state |
| Ownership guard `throwIfUserDontOwnAddress` | `waitApprov`-style approval gate | Explicitly absent — customers self-serve, divergence #3 from `shopOwner` (`BEs/marketplace-db-setup/lib/schemas/user.js`) |

## 3. Build state

**Built end to end.** Collection, service, resolvers, frontend routes all exist.

- Schema: `BEs/marketplace-db-setup/lib/schemas/user.js` — `personalData` optional, `addresses[]` array of `{_id, label?, address block, position?}`, `defaultAddress` ObjectId, `$expr` guard lines 70-82.
- Migration: `BEs/marketplace-db-setup/migrations/20260301000300-create-user.js`.
- Service: `BEs/dev/marketplace-dev-user-authenticated-resource` — 1 query (`schema/queries/me.mts`) + 6 mutations under `schema/mutations/`: `userPersonalDataUpdate.mts`, `userUpdatePwd.mts`, `userAddressAdd.mts`, `userAddressUpdate.mts`, `userAddressDel.mts`, `userDefaultAddressSet.mts` (all confirmed present).
- Pipeline delete: `BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressDel.mts`.
- Frontend: `marketplace-user/src/routeOptions/accountAddresses.tsx`, `accountProfile.tsx`, `accountPassword.tsx`, `account.tsx` (the `ssr: false` boundary).
- Integration coverage: `BEs/dev/marketplace-dev-user-authenticated-resource/test/integration/account.itest.mts`, `addresses.itest.mts` (confirmed on disk — the BCON-04 zero-file gap is closed).

## 4. Stories

### E07-S01 — Read own account via `me`   `built`
**As a** `User`, **when** I open my account area, **I want** to read my own account **so that** I see my personal data and addresses without exposing anyone else's.
**domains:** backend, frontend
**Acceptance criteria:**
- `me` takes no `_id` argument; identity comes from `ctx.state.user._id` on the session, never client input (`BEs/dev/marketplace-dev-user-authenticated-resource/src/graphQLApi/schema/queries/me.mts:10-14`).
- The `select` behind `me` is a positive field list excluding `login.password`, `resetPwd`, `emailVerify` (`queries/me.mts:16-19`).

### E07-S02 — Fill in personal data after email confirm   `built`
**As a** `User`, **when** my email is confirmed, **I want** to fill in `personalData` **so that** the shop-owner-mirrored fields (name, contacts) exist on my account.
**domains:** backend, frontend
**Acceptance criteria:**
- `userPersonalDataUpdate(personalData: GraphQLInputUserPersonalData!)` returns `Boolean!` (`schema/mutations/userPersonalDataUpdate.mts:24`).
- `personalData` stays optional in the collection validator — registration requires only `login` + `registeredAt` (`BEs/marketplace-db-setup/lib/schemas/user.js`).

### E07-S03 — Add an address   `built`
**As a** `User`, **when** I add a delivery address, **I want** it appended to `addresses[]` **so that** I can later mark one default.
**domains:** backend, frontend
**Acceptance criteria:**
- `userAddressAdd(address: GraphQLInputUserAddress!)` answers `OnlyIdType`, returning the new element's `_id` (`schema/mutations/userAddressAdd.mts:29`).
- Each array element carries a required `_id`, an optional `label`, the shared address block and an optional `position` — divergence #2 from `shopOwner`'s single `personalData.address` (`lib/schemas/user.js`).

### E07-S04 — Update or delete an owned address only   `built`
**As a** `User`, **when** I edit or remove an address, **I want** the write refused if the `_id` is not mine **so that** I cannot touch another customer's address by guessing an id.
**domains:** backend, testing
**Acceptance criteria:**
- `userAddressUpdate` and `userAddressDel` both call `throwIfUserDontOwnAddress(ctx.state.user._id, args._id)` before writing (`mutations/userAddressUpdate.mts:32`, `mutations/userAddressDel.mts:34`).
- `test/integration/addresses.itest.mts` seeds two distinct `User` docs via the raw driver and asserts a cross-user address `_id` is rejected (BCON-09 — seed through `mongoose.connection.db!.collection(...)`, not the Mongoose model).

### E07-S05 — Delete an address clears a dangling default pointer atomically   `built`
**As a** `User`, **when** I delete my current default address, **I want** `defaultAddress` cleared in the same write **so that** the database never holds a pointer into a deleted element.
**domains:** backend, database, testing
**Acceptance criteria:**
- `funUserAddressDel.mts` runs one aggregation-pipeline `updateOne` with `{ updatePipeline: true }` that both `$filter`s the address out and `$unset`s `defaultAddress` via `$$REMOVE` when it pointed there (`BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressDel.mts:36-79`, lines 51-58 filter, line 66 unset).
- The address id is coerced with `new Types.ObjectId(addressId)` before entering the pipeline's `$ne`/`$eq` (`funUserAddressDel.mts:48`) — Mongoose casts a query filter against the schema but not the inside of a pipeline, so an uncoerced `GraphQLID` string would never match (DCON-06).
- Collection-level `$expr` (`lib/schemas/user.js`) still rejects any future write that leaves `defaultAddress` pointing at a non-existent element — this is the backstop, not the only guard.

### E07-S06 — Set default address as one atomic pointer write   `built`
**As a** `User`, **when** I choose a default address, **I want** one atomic `$set` **so that** there is never a window with zero or two defaults.
**domains:** backend
**Acceptance criteria:**
- `userDefaultAddressSet(_id: ID!)` returns `Boolean!` and performs a single `$set`, never a "clear all, then set one" two-step (`schema/mutations/userDefaultAddressSet.mts:31`).
- `throwIfUserDontOwnAddress` runs first — a foreign `_id` cannot become the caller's default (`mutations/userDefaultAddressSet.mts:34`).

### E07-S07 — Customer changes own password   `built`
**As a** `User`, **when** I know my old password, **I want** to set a new one **so that** I regain a private credential without an admin in the loop.
**domains:** backend
**Acceptance criteria:**
- `userUpdatePwd(passwordOld: String!, passwordNew: String!)` returns `Boolean!` (`schema/mutations/userUpdatePwd.mts:22-23`).
- New password is hashed via `@node-rs/bcrypt` at `SALT_ROUNDS=14`, never stored plaintext or reversibly — traces NFR-SE04.

### E07-S08 — Every resource-service call on this tier asserts `TIER.user`   `built`
Technical story: no session hash from another tier may be trusted here.
**domains:** backend, testing
**Acceptance criteria:**
- `assertTier(actual, TIER.user)` runs in this service's auth middleware before any resolver executes; a foreign-tier token gets `403`, never `401` — traces NFR-SE05, NFR-SE06.
- A missing `tier` field is rejected by the same `actual !== expected` branch, not treated as a wildcard — traces NFR-SE05.

### E07-S09 — Address writes validate against a strict schema   `built`
Technical story: `additionalProperties: false` on `user` closes the gap a resolver bug could open.
**domains:** database
**Acceptance criteria:**
- `BEs/marketplace-db-setup/lib/schemas/user.js` builder sets `additionalProperties: false` on the collection validator — traces NFR-SE11.
- `test/integration/addresses.itest.mts` and `account.itest.mts` exist on disk with real assertions — count the files, not the coverage percentage (BCON-04).

### E07-S10 — At most six saved addresses   `built`
**As a** `User`, **when** my address book is full, **I want** to be told the limit and the way past it **so that** I am not filling in a form that cannot be submitted, or reading a 500 that says nothing.
**domains:** backend, database, frontend, testing
**Acceptance criteria:**
- `maxItems: 6` on `addresses` in the collection validator is the rule — `BEs/marketplace-db-setup/lib/schemas/user.js`, applied to databases already built by `migrations/20260826000000-user-cap-addresses.js` (a `collMod`; the create migration `20260301000300` stays the statement of record and a fresh replay is unaffected).
- ⚠️ The cap is a **clause of the update filter**, not a count taken first: `{ _id, 'addresses.5': trusted({ $exists: false }) }` in `lib/user/funUserAddressAdd.mts`, so counting and appending are one atomic operation and two adds fired at once cannot both fit through. `$expr` cannot be used — koa-utils sets `sanitizeFilter` process-wide, which throws on it — and the `trusted()` wrapper is load-bearing, since an untrusted `{$exists: false}` is rewritten into a match-nothing `$eq` that would refuse every address including the first.
- A full account answers **400** with `extensions.description` = `addresses: at most 6 addresses can be saved`; an account that is *gone* answers 500. `matchedCount: 0` costs one `countDocuments` to tell the two apart.
- `marketplace-user`'s `AddressList.tsx` stops offering "Add an address" at six and replaces the line above the list with one naming the limit — a control that vanishes with no sentence beside it reads as a bug. It is a courtesy, not the enforcement: a second tab that added the sixth a moment ago is handled by the 400, which `AddressForm` already renders.
- Pinned on both sides: `test/integration/addresses.itest.mts` adds six through the real mutation and asserts the seventh's 400, plus a raw-driver counter-proof that MongoDB refuses a seventh element on insert and on `$push` (BCON-09 — seeded through the driver, and re-using ciphertext already at rest, since `db()` carries no automatic encryption). `migrations.test.mjs` asserts the validator refuses a seventh address and still accepts an edit to one of the six.
- ⚠️ Six is spelled in three repositories that share no library — the validator, the service, the account area. Raising it is three files plus a `collMod`, in one piece of work. Recorded as **ADR-035**, which also carries the replacement for ADR-014's first compliance grep: this is the platform's first `collMod`, so "a `collMod` call is the violation" stopped being true the day it landed.

### E07-S11 — Place an address on a map   `built`
**As a** `User`, **when** I save an address, **I want** to see it on a map and move the pin **so that** the point stored with it is where I actually live, including when the geocoder has never heard of the building.
**domains:** frontend, testing
**Acceptance criteria:**
- `marketplace-user/src/features/account/AddressForm.tsx` holds the point as one `"lon,lat"` string field and three surfaces write it: picking a geocoder suggestion, dropping or dragging the pin, and a "Remove position" control. The map reads that field back, so the three cannot disagree.
- The map is `src/features/map/PositionPicker.tsx` behind `PositionPickerIsland` — MapLibre GL over the same self-hosted Protomaps archive as `ShopMap`, never the OSM `export/embed.html` iframe the two panel apps use: that iframe shows one pin, cannot be dragged, and its tiles come from a service whose usage policy this app's scale violates.
- ⚠️ **The pin is a correction surface, not the primary one.** The address fields and their suggestions are the keyboard path and must stay sufficient on their own, and `position` stays **optional** — an address nobody could place is saved without one, and the sentence under the map says so rather than blocking the form.
- ⚠️ A point the map itself produced is never re-framed: a drag or a click leaves the viewport alone, while a point arriving from the geocoder eases to it at zoom 16. Without that exemption the map fights the customer, sliding the pin they just dragged back under the cursor.
- `[longitude, latitude]` on every boundary — GeoJSON's order, reversed from MapLibre's `{lng, lat}` and from Nominatim's `lat`/`lon`. Stored rounded to six decimals, which is ~11 cm and shorter than the float that reaches the field.
- Pinned by `test/features/map/PositionPicker.test.tsx` (MapLibre faked — jsdom has no WebGL), `PositionPickerIsland.test.tsx` and the `AddressForm map` block in `test/features/account/AddressForm.test.tsx`, which stubs the island and asserts the stored `position` after a drop and its absence after a removal.

## 5. Dependencies

- BC-01 (Identity & Access) ships first: `userRegister`/`verify-email-user` mint the `User` document this
  epic's mutations operate on — no landing-order issue for this retrofit, both already built.
- Shares `marketplace-common`'s `assertTier`/`TIER` (BC-10) — an edit there needs `./deploy-local.sh`
  before this service picks it up (BCON-07).
- `marketplace-user`'s `/account/*` routes (frontend half) depend on this service's schema slice under
  `marketplace-user/src/gql/` staying in sync with the resolvers — see [`docs/frontends.md`](../../frontends.md)'s warning that
  `schema/*.graphql` slices are hand-maintained, not the contract.

## 6. Open questions

- ~~No `waitApprov`-equivalent exists for `User` by design (self-service) — is there any future gate
  (fraud check, spam signup) planned for this tier, or is self-service permanent? Not answered in
  `phase2/BOUNDED_CONTEXT.md` BC-07 or [`CLAUDE.md`](../../../CLAUDE.md).~~ ⚠️ **Closed 2026-08-25 by
  the platform owner: self-service is permanent, and there is no equivalent for `user`.** No approval, no
  fraud check, no spam-signup hold between `userRegister` and the first login. `emailVerify.valid` stays
  the only gate, checked by `tryLoginUser`
  (`BEs/dev/marketplace-dev-public-authorization/src/lib/db/login/tryLoginUser.mts`), and the three places
  the code already states the absence — `lib/schemas/user.js:103`,
  `migrations/20260301000300-create-user.js:40` and `IUserLoginCheckData.mts:6-10` — were describing the
  decision, not a gap in it.
  The asymmetry with `shopOwner` is what each account gets, not how much either is trusted: approving a
  shop owner creates a public shop on this platform's own domain, and a customer's account reads that
  customer's own document. `waitApprov` is also only half a feature — the other half is the operator queue
  behind it (`shopOwnerUpdateStatus`, `shopOwnersActiveTblDb`), and `user` is the one collection encrypted
  whole *because* nothing sorts, searches or paginates it (ADR-029). A *searchable* moderation table over
  customers would reverse that decision rather than extend this one — which is why the one
  `phase5/epics/E19.md` opened the same day is not searchable: it orders and filters on `registeredAt` and
  the three status flags, every one of them clear, and never queries a field CSFLE touches.
  ⚠️ **Closing it surfaced something the question did not ask, and it is not refused — it is unbuilt.**
  `user.disabled` exists in the validator (`account.js` `DISABLED`) and every gate reads it —
  `tryLoginUser`, `tokenInfoUser`, `funUserUpdatePwd` all refuse a disabled customer — but **no mutation
  on any tier wrote it**: the Admin resource service had no `user*` mutation at all. So there was no gate
  before registration *and* no lever after it, and suspending a customer meant a write made straight
  against MongoDB. That was a missing Admin-tier mutation, not a second reading of this decision.
  Recorded in [`phase3/adr/ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4, and **closed the same day by
  [`E19.md`](./epics/E19.md)** — all six stories built 2026-08-25, `userUpdateStatus` the lever among them. The
  gate before registration stays absent, permanently; only the lever after it was the hole.
- ~~`addresses[].position` is optional — no story here defines when/how it gets populated (client
  geocode vs manual pin). Out of this epic's built scope; flagging because BC-08's map feature
  (`ShopMap.tsx`) already consumes `company.address.position`, and the customer-address analog has no
  resolver-side geocode step visible in `userAddressAdd.mts`.~~ ⚠️ **Closed 2026-08-26 by building it —
  E07-S11.** The answer is *both*, in the client, and neither in the resolver: picking a geocoder
  suggestion places the point, a draggable pin corrects it, and a hand-typed address the geocoder does not
  know is placed by the pin alone. `userAddressAdd.mts` still geocodes nothing, deliberately — a
  resolver-side lookup would put a Nominatim round trip inside a write and would have no answer at all for
  the address it cannot find.
  The question the closing had to settle was whether `position` should become **required** now that
  something writes it. The platform owner said no: it stays optional. The cost is that "sort shops by
  distance from my address" has no answer for an address without a point, and the alternative was refusing
  to save an address the customer had already typed because a map could not find it.
