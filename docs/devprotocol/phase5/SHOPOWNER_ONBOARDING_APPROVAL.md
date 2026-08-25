# E03 — Shop Owner Onboarding & Approval
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.4
**Date:** 2026-08-14
**Author:** epics-agent
**Bounded context:** BC-03 — Shop Owner Onboarding & Approval

## 0. Why this record is not under `epics/`

It was `phase5/epics/E03.md` until 2026-08-14. The file was deleted and its record moved here in one pass,
for the same reason [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md) and
[`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md) moved on 2026-08-13: nothing in it was work still
ahead. All eight stories are `built`, and §6's last open question closed the day this moved — so the file
had become the *record* of a shipped surface rather than a backlog entry. `EPICS_STORIES.md` §1 still says
stories live in `epics/ENN.md`, and that stays true for E07..E18; E01..E06 are the six whose
records sit beside the index instead of under it — E05's is [`CATALOGUE.md`](./CATALOGUE.md), moved later
the same day, and E06's is [`CATEGORY_TAXONOMY.md`](./CATEGORY_TAXONOMY.md), moved 2026-08-25.

**The story IDs did not change.** `E03-S01` … `E03-S08` are cited by sixteen files:
`phase2/BOUNDED_CONTEXT.md`, `phase2/EVENT_STORMING.md`, `phase2/UBIQUITOUS_LANGUAGE.md`,
`phase3/C4_CONTEXT.md`, `phase3/CONSTRAINTS.md`, `phase3/SECURITY_AUTH.md`, `phase4/API_CONTRACTS.md`,
`phase4/DDD_AGGREGATES.md`, `phase4/ERD.md`, `EPICS_STORIES.md`, `IDENTITY_ACCESS.md` §6 q3,
`RISK_REGISTER.md`, `SEQUENCE_DIAGRAMS.md`, `epics/E15.md`, `docs/architecture.md` and
`BEs/marketplace-common/CLAUDE.md`. Every one of those resolves to a section of this file. Renumbering
them was refused for the reason E01 gives: an ID cited across sixteen files is a name, and moving a file
is not a reason to change a name. A further set — `phase1/NFR.md`, `COMPANY_LEGAL_ENTITY.md`, `epics/E13.md`,
`epics/E14.md`, `epics/E17.md`, `CONFLICT_REPORT.md` and `STATUS.md` — names the epic **E03** without a
story suffix, and reads the same way.

**What is deliberately not repeated here.** The login gate that *reads* `waitApprov` is E01-S11's story,
recorded in [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md) — this context writes the field and never reads
it. The write-scoping that keeps `notes` and `waitApprov` out of ShopOwner-tier reach is CON-12, owned by
E01-S10. What follows says what each story had to satisfy and where the code is.

## 1. Epic goal

Provision a `ShopOwner` account — by an Admin, or since E03-S08 by the person themselves through the
public site — and gate its ability to log in behind manual approval (`waitApprov`). Own the
operator-private annotation (`notes`) and the onboarding-preference fields, none of which the ShopOwner
tier itself can read or write.

⚠️ **The two provisioning routes differ in exactly one field, and it is the one this epic is named
after.** `shopOwnerRegister` (public) writes `waitApprov: true`; `shopOwnerAdd` (Admin) writes nothing
there. An operator who typed the account in has approved it by the act of creating it; a stranger who
typed it in themselves has been approved by nobody, and waits.

## 2. Scope

| Item | In/Out | Why |
|---|---|---|
| `shopOwnerAdd` | In | Admin-side creation, from a full set of fields, already approved |
| `shopOwnerRegister` | In | public self-service creation, from an address and a password, parked on `waitApprov` |
| `shopOwnerUpdateStatus` (`disabled` + `waitApprov`) | In | the approval lever |
| `shopOwnerUpdateNote` | In | operator-only annotation |
| `shopOwnerUpdatePreferences` (`onboardingStep`/`onboardingDone`/`rememberMe`) | In | onboarding-state writes |
| `shopOwnerUpdate` (personalData replace), `shopOwnerUpdateEmail`, `shopOwnerDel` | In | rest of the CRUD surface on the same collection, same repo |
| The `login` attempt itself, reading `waitApprov` to refuse it | Out | BC-01 — this context only writes the field |
| `personalData.address`/`contacts` as read by any other tier | Out | still `shopOwner`-owned data, but consuming it is BC-01/BC-04's concern, not this epic's |
| The activation mail and the link behind it | In | E03-S08 — a self-registered account confirms its address the way a customer's does, and cannot log in until it has |
| The seller's registration form on the public site | In | E03-S08 — `/register/seller` in `marketplace-user`, a page of its own beside the customer's |
| Onboarding itself — the shop owner filling in `personalData` | Out | not built anywhere; a self-registered account has no name, no address and no contacts until it exists (§6) |
| `company` creation on the ShopOwner's behalf | Out | BC-04 Legal Entity / Company — this epic only provisions the account the FK later points at |

## 3. Build state

Fully built. Seven mutations on the Admin service, one on the public one:

- `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/shopOwnerAdd.mts`
- `.../mutations/shopOwnerUpdateStatus.mts`
- `.../mutations/shopOwnerUpdateNote.mts`
- `.../mutations/shopOwnerUpdatePreferences.mts`
- `.../mutations/shopOwnerUpdate.mts`
- `.../mutations/shopOwnerUpdateEmail.mts`
- `.../mutations/shopOwnerDel.mts`
- `BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/mutations/shopOwnerRegister.mts`
  and the three writes behind it — `src/lib/db/registerNewShopOwner.mts`,
  `src/lib/db/restartShopOwnerRegistration.mts`, `src/lib/db/shopOwnerForRegistration.mts`
- Shared shape: `BEs/marketplace-db-setup/lib/schemas/shopOwner.js`

⚠️ **`shopOwnerUpdatePreferences` is where a long-standing document error lived.** Four other documents
claimed no mutation anywhere writes `onboardingStep`/`onboardingDone`; that mutation writes both, and
always did. Corrected 2026-08-13 by E03-S04, which also closed §6's onboarding question as a deferral: the
operator's hand is the writer by decision, and the shop-owner-side flow is future work (`RISK_REGISTER.md`
R53).

## 4. Stories

### E03-S01 — Admin provisions a ShopOwner account   `built`
**As an** Admin, **when** I submit a new shop owner's login and personal data, **I want** a `shopOwner` document
created with input validated and normalised **so that** an account exists for a person the platform already
knows, without them queueing behind an approval.
**domains:** backend, database
**Acceptance criteria:**
- `shopOwnerAdd` accepts `login: GraphQLInputLogin!`, `personalData: GraphQLInputShopOwnerPersonalData!`,
  answers `Boolean!` —
  `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/shopOwnerAdd.mts:17,18-21`
- ⚠️ **`shopOwnerAdd` writes no `waitApprov`, and E03-S08 did not change that.** The public
  `shopOwnerRegister` writes it `true`; this one deliberately leaves the key absent, because the operator
  performing the creation *is* the approval. Both mutations write the same collection through the same
  `$jsonSchema`, so the asymmetry lives in the two resolvers and nowhere else — the acceptance criterion
  this bullet replaced ("no such mutation exists anywhere") was true until 2026-08-12 and is now the
  wrong shape of check entirely
**Traces:** ADR-004 (tier stamped at first login, downstream of this write); NFR-SE11 (`$jsonSchema`
validation on the write)
**Evidence:** `mutations/shopOwnerAdd.mts:17,18-21`

### E03-S02 — Admin grants or withholds login access as one full-state write   `built`
**As an** Admin, **when** I approve or disable a shop owner, **I want** `disabled` and `waitApprov` written
together in one call **so that** there is never a window where the two fields disagree.
**domains:** backend, database
**Acceptance criteria:**
- `shopOwnerUpdateStatus` requires both `disabled: Boolean!` and `waitApprov: Boolean!` as non-null args —
  neither is optional, so a caller cannot patch one without restating the other —
  `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/shopOwnerUpdateStatus.mts:6-10,25,28-30`
- `waitApprov` exists on `shopOwner` only, never on `user` — checked against
  `BEs/marketplace-db-setup/lib/schemas/user.js` carrying no `waitApprov` field
**Traces:** NFR-SE05 (downstream: BC-01's `login` reads this field before minting a session)
**Evidence:** `mutations/shopOwnerUpdateStatus.mts:6-10,25,28-30`

### E03-S03 — Admin records an operator-private note   `built`
**As an** Admin, **when** I add a note to a shop owner's record, **I want** it stored where no ShopOwner
tier query can ever read it **so that** internal commentary never leaks to the account it is about.
**domains:** backend, database
**Acceptance criteria:**
- `shopOwnerUpdateNote` accepts `_id: ID!`, `notes: String!`, answers `Boolean!` —
  `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/shopOwnerUpdateNote.mts:24,25-28`
- No query or resolver under `BEs/dev/marketplace-dev-authenticated-resource` (the ShopOwner-tier service)
  selects `shopOwner.notes` — checked by grepping `notes` under that repo's `src/`
**Traces:** NFR-SE05
**Evidence:** `mutations/shopOwnerUpdateNote.mts:24,25-28`

### E03-S04 — Admin sets onboarding and session preferences   `built 2026-08-13`
**As an** Admin, **when** I set a shop owner's `rememberMe`, `onboardingDone` and optional `onboardingStep`,
**I want** them persisted in one call **so that** the login response (`LoginAppType`) has a value to
return.
**domains:** backend, database
**Acceptance criteria:**
- `shopOwnerUpdatePreferences` accepts `_id: ID!`, `rememberMe: Boolean!`, `onboardingDone: Boolean!`,
  optional `onboardingStep: String`, answers `Boolean!` —
  `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/shopOwnerUpdatePreferences.mts:25,26-31`
- No other mutation under any `mutations/` directory on the platform writes `onboardingStep` or
  `onboardingDone` — verified by grep across all nine services' `schema/mutations/` trees; this is
  `EVENT_STORMING.md` §5 hotspot 2, recorded here rather than silently assumed solved
**Traces:** NFR-SE05
**Evidence:** `mutations/shopOwnerUpdatePreferences.mts:25,26-31`

**Built 2026-08-13 — and the residual closes as a decision, not as code.** This heading carried
"onboarding-progress writes `not built`" for as long as the story existed. It comes off on the platform
owner's call: **the operator's hand is the writer, and a shop-owner-side advance is future work.** Nothing
was invented here — the wizard that would justify a self-advancing write does not exist as a design
anywhere on this platform (what the ≤4-character steps are, what "done" means, whether the shop-owner app
writes them itself or asks for an operator's review), and `CLAUDE.md` §Build state says to ask rather than
guess at exactly this shape.

Both criteria were re-run rather than trusted, and the second one is why this story took a doc sweep:

- **Criterion 1 holds.** `shopOwnerUpdatePreferences.mts:25,26-31` accepts the four arguments and answers
  `Boolean!`; `funShopOwnerUpdatePreferences` writes all three under `login.`, `$unset`ting
  `login.onboardingStep` when it arrives blank, because the collection types it `string` and would refuse
  a `null` for the whole write.
- **Criterion 2 holds — and it is the only place on the platform that ever stated it correctly.** The word
  that matters is **other**. Four documents dropped it and asserted that *no* mutation writes either field:
  `phase2/BOUNDED_CONTEXT.md` (twice), `phase3/SECURITY_AUTH.md`, `phase4/DDD_AGGREGATES.md` (four places)
  and `phase5/RISK_REGISTER.md` R27, which existed **because** of that claim. All are corrected in this
  change and R27 is closed on the evidence: its named failure — onboarding permanently stuck because no
  write path genuinely exists — cannot happen, because the write path was always there.

⚠️ **The gap outlives the question, and is `RISK_REGISTER.md` R53** — 🟢 Low, on a fact this pass measured
instead of assuming: `grep` over all three frontends finds **no reader of either field**. `LoginAppType`
returns `onboardingStep` and `onboardingDone` to a client that ignores both, so no screen is waiting on a
value only an operator can set. The day one gates on `onboardingDone` is the day R53 stops being Low, and
that is the trigger written on the row.

### E03-S05 — Admin replaces a ShopOwner's registry data   `built`
**As an** Admin, **when** I edit a shop owner's `personalData`, **I want** the whole sub-document replaced
**so that** the record matches what was submitted, not a partial merge of old and new.
**domains:** backend, database
**Acceptance criteria:**
- `shopOwnerUpdate` accepts `_id: ID!`, `personalData: GraphQLInputShopOwnerPersonalData!`, answers
  `Boolean!` — `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/shopOwnerUpdate.mts:14,15-18`
- Write validated against `BEs/marketplace-db-setup/lib/schemas/shopOwner.js`'s `$jsonSchema`,
  `additionalProperties: false`
**Traces:** NFR-SE11
**Evidence:** `mutations/shopOwnerUpdate.mts:14,15-18`

### E03-S06 — Admin changes a ShopOwner's login email   `built`
**As an** Admin, **when** I change a shop owner's login email, **I want** the unique-index key updated in
one call **so that** the account's credential and its identity stay in sync.
**domains:** backend, database
**Acceptance criteria:**
- `shopOwnerUpdateEmail` accepts `_id: ID!`, `email: String!`, answers `Boolean!` —
  `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/shopOwnerUpdateEmail.mts:20,21-24`
- Write is checked against `shopOwner.login.email`'s unique index (`INDEXES_LOGIN_EMAIL`,
  `BEs/marketplace-db-setup/lib/schemas/account.js`) — a duplicate is rejected, producing "Duplicate Login
  Email Rejected"
**Traces:** NFR-SE11
**Evidence:** `mutations/shopOwnerUpdateEmail.mts:20,21-24`

### E03-S07 — Admin soft-deletes a ShopOwner   `built`
**As an** Admin, **when** I remove a shop owner, **I want** a `deleted` date stamped rather than the document
removed **so that** the account's history and any FK pointing at it (e.g. `company.idShopOwner`) stay
intact.
**domains:** backend, database
**Acceptance criteria:**
- `shopOwnerDel` accepts `_id: ID!`, answers `Boolean!`, stamps `deleted` — never a hard `deleteOne`/`remove`
  — `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/shopOwnerDel.mts:11,12-14`
- `checkUserAuthorizationDisDel` (shared kernel) subsequently refuses a login for the deleted account
  (`docs/architecture.md` §Auth model)
**Traces:** NFR-SE05
**Evidence:** `mutations/shopOwnerDel.mts:11,12-14`

### E03-S08 — A seller registers themselves and waits for an operator   `built`
**As a** prospective shop owner, **when** I fill in the seller form on the public site, **I want** an
account created from my address and a password and held until the platform approves it **so that** I can
apply to sell without an operator having to type my details in for me, and so that nobody trades here
before a human has looked at them.
**domains:** frontend, backend, database
**Acceptance criteria:**
- `shopOwnerRegister` accepts `email: String!`, `password: String!`, `repeatPassword: String!`,
  `turnstileToken: String`, answers `Boolean!` — the same four arguments `userRegister` takes, on the
  same public service —
  `BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/mutations/shopOwnerRegister.mts:61-70`
- The document it writes carries `waitApprov: true` —
  `BEs/dev/marketplace-dev-public-resource/src/lib/db/registerNewShopOwner.mts:44`
- ⚠️ **`personalData` is no longer in the `shopOwner` validator's `required` list**, and everything
  *inside* it still is: a registration writes a `login` and a `registeredAt`, and the block arrives whole
  at onboarding or not at all —
  `BEs/marketplace-db-setup/lib/schemas/shopOwner.js` (`required: ['login', 'registeredAt']`). A shared
  `lib/schemas/` edit means a full database rebuild in the same piece of work, which is what happened
- Both account-state gates run **after** the password check in `tryLoginShopOwner`, verification first
  and approval second, and both throw the same `throwUnauthorizedError` every other failure on that path
  throws — `BEs/dev/marketplace-dev-public-authorization/src/lib/db/login/tryLoginShopOwner.mts:39-54`
- The answer is `true` whether or not the address was free: `shopOwnerRegister` has its own rate-limit
  bucket rather than sharing `userRegister`'s, and the copy on the form says "if that address can be
  registered" — neither the mutation nor the page tells a caller whether a seller already exists
- The operator's two screens survive a document with no `personalData`: `GraphQLShopOwnerActiveTbl` and
  `GraphQLShopOwnerById` both declare it **nullable**, and the table gained `email` (flattened from
  `login`) and `waitApprov`. Under the old `NonNull` a single pending registration turned the whole
  listing into an error — a non-null list of non-null rows propagates one null all the way up — so the
  page an operator needs in order to approve that account was the page it broke
- `/register/seller` is a route of its own in `marketplace-user`, `noindex`, linked from the footer and
  from `/register`; it links back to `/register` and offers **no** sign-in link, because `/login` on that
  site authenticates against the `user` collection and would refuse a seller with a wrong-password error
**Traces:** ADR-002 (the role is the collection: this writes `shopOwner`, `userRegister` writes `user`,
and nothing moves an account between them); NFR-SE05; NFR-SE11; CON-12 (the write scoping that keeps
`waitApprov` out of ShopOwner-tier reach)
**Evidence:** `mutations/shopOwnerRegister.mts:61-70`; `registerNewShopOwner.mts:44`;
`tryLoginShopOwner.mts:39-54`; `lib/schemas/shopOwner.js`

## 5. Dependencies

- BC-01 (E01, [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md)) depends on this epic: `login` cannot correctly
  refuse an unapproved or deleted account until `shopOwnerAdd`/`shopOwnerUpdateStatus`/`shopOwnerDel`
  exist and are deployed — landing order is E03 before E01's approval-gate behaviour is testable. Both are
  already built, so no live ordering risk remains, but a future edit to either side must respect it.
- BC-04 (Legal Entity / Company) depends on this epic for `company.idShopOwner` to point at a real account
  — a `company` cannot be created for a shop owner this epic has not provisioned, and since 2026-08-14
  that is stated as enforcement rather than as convention: `funCompanyAdd` 404s an `idShopOwner` naming no
  live `shopOwner` ([`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md) §5).
- Shares the `shopOwner` collection with BC-01 through no schema-level wall — only
  `BEs/marketplace-db-setup/lib/schemas/shopOwner.js` keeps both sides' writes honest about the shape
  (BCON-05 applies: an edit to that builder is a `marketplace-db-setup` commit plus a full database
  rebuild, never a same-commit edit alongside a resolver change).

## 6. Open questions — all four closed

None open. Kept because each closure is cited elsewhere and the *shape* of the answer is the knowledge,
not the fact that a question existed.

| # | Question | Closed by | Answer |
|---|---|---|---|
| 1 | Does a freshly created `ShopOwner` start with `waitApprov` `true` (gated) or `false`/absent (ungated)? | E03-S08, 2026-08-12 | **It depends on who created it.** `shopOwnerRegister` writes it `true`, `shopOwnerAdd` writes nothing, and the schema comment that conflated "awaiting approval" with "deleted" (`EVENT_STORMING.md` §5 hotspot 1) was rewritten to say what the field actually holds and who writes it. No migration for the existing rows: every document on disk predates the public form, so every one of them was Admin-created and is correctly ungated |
| 2 | What advances `onboardingStep`/`onboardingDone` outside of an Admin manually calling `shopOwnerUpdatePreferences`? | E03-S04, 2026-08-13 | **Nothing does, by decision.** `shopOwnerUpdatePreferences` (Admin tier) is the only writer and stays the only writer until a shop-owner onboarding flow is designed; the platform owner deferred that flow rather than have it invented here. The premise the question carried was also wrong in one word: it read "no mutation … writes either field", when the true statement is **no *other* mutation writes them** — a dropped "other" that had propagated into four documents and into `RISK_REGISTER.md` R27, all corrected in the same change. ⚠️ **E03-S08 raised the stakes, and that part survives the closure** as **R53** (🟢 Low). An approved self-registered account has a login and nothing else: no name, no date of birth, no address, no contacts, no company. Onboarding is the flow that would collect them and it does not exist — so today the operator either types the details in through `shopOwnerUpdate`, or the account trades under an empty `personalData`. Whoever builds it decides whether the shop-owner app writes those fields directly or asks for an Admin review, which is a product question wearing an implementation question's clothes. R53 is Low because no frontend reads either field today, so nothing is blocked while the flow is missing |
| 3 | Does self-service ShopOwner registration ever get built, or does Admin-provisioning stay permanent? | E03-S08, 2026-08-12 | **Built, and the two coexist.** Admin-provisioning did not go away — it is the route for a shop the platform recruited, and it skips the queue for that reason |
| 4 | What `idShopOwner` does an Admin-created `company` (BC-04) get absent an owning ShopOwner having created it first via this epic? | 2026-08-14, outside any story | **The case the question describes cannot occur: there is no Admin-created `company` absent an owning ShopOwner.** Admin-tier `companyAdd` takes `idShopOwner: ID!` as an explicit argument, and `funCompanyAdd` (`BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/company/funCompanyAdd.mts:34-36`) resolves it before writing — `ShopOwner.exists({ _id: idShopOwner, deleted: { $exists: false } })`, 404 `shopOwner not found` otherwise. A soft-deleted owner counts as absent. So an Admin-created company is stamped with the id of a live `shopOwner` document or it is not created at all, and the order this epic worried about is the enforced one: the account exists first, whether it self-registered (E03-S08) or the operator provisioned it. What survives is not a design gap but operator error — a valid id naming the *wrong* ShopOwner — and `idShopOwner` reaches the mutation from the URL of the owner detail page the operator is already on. Closed alongside `EVENT_STORMING.md` §5 hotspot 5 and §6 question 6, `DDD_AGGREGATES.md` question 3, and `RISK_REGISTER.md` **R30** |

## 7. Changelog

| Version | Date | What changed |
|---|---|---|
| 1.0 | — | Initial retrofit, reverse-engineered from the 15-repo working tree |
| 1.1 | 2026-08-12 | E03-S08 adds public self-service registration, and with it the answer to two of §6's open questions — a `ShopOwner` starts parked when they registered themselves and ungated when an operator created them. The epic goal, §2, §3 and E03-S01's second acceptance criterion all changed: "no self-service registration exists on this platform" was true until this story and is now the opposite of the code. `personalData` left the `shopOwner` validator's `required` list in the same change, which is what made both operator screens' `NonNull` on that field a page-breaking bug rather than a type detail |
| 1.2 | 2026-08-13 | E03-S04 closes, and §6's onboarding question closes with it — on the platform owner's call, the operator's hand is the only writer of `onboardingStep`/`onboardingDone` until a shop-owner onboarding flow is designed. Nothing was built. What the pass did produce is a correction: E03-S04's second acceptance criterion was the only place on the platform that said "no **other** mutation", and four documents plus `RISK_REGISTER.md` R27 had dropped that word into the false claim that *nothing* writes those fields. R27 closes on a premise that was never true; the surviving gap is the new **R53** (🟢 Low, Low because no frontend reads either field). §3's closing line no longer calls the hotspot unresolved |
| 1.3 | 2026-08-14 | **§6's last open question closes, and like R27 before it, on a premise that was never true.** It asked what `idShopOwner` an Admin-created `company` gets absent an owning ShopOwner; the Admin tier cannot produce that state, because `funCompanyAdd` resolves the explicit `idShopOwner: ID!` against a live, non-soft-deleted `shopOwner` and 404s otherwise. §6 carries no open question at all. The same false premise sat in five other documents — `EVENT_STORMING.md` §5 hotspot 5 and §6 q6, `DDD_AGGREGATES.md` in three places, `RISK_REGISTER.md` R30 and `COMPANY_LEGAL_ENTITY.md` §2/§5 — and is corrected in all of them in the same pass |
| 1.4 | 2026-08-14 | Record moved out of `phase5/epics/E03.md` to this file — see §0. No story, criterion, trace or evidence path changed in the move; the four open questions were folded into one table (§6) and the changelog into this one, both because every entry in them was already closed. §5's BC-04 dependency now states the enforcement v1.3 established rather than restating the old "nothing enforces the reference" |
