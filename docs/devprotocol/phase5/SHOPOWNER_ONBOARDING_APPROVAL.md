# E03 — Shop Owner Onboarding & Approval
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.11
**Date:** 2026-08-28
**Author:** epics-agent
**Bounded context:** BC-03 — Shop Owner Onboarding & Approval

## 0. Why this record is not under `epics/`

It was `phase5/epics/E03.md` until 2026-08-14. The file was deleted and its record moved here in one pass,
for the same reason [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md) and
[`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md) moved on 2026-08-13: nothing in it was work still
ahead. All eight stories are `built`, and §6's last open question closed the day this moved — so the file
had become the *record* of a shipped surface rather than a backlog entry. `EPICS_STORIES.md` §1 still says
stories live in `epics/ENN.md`, and that stays true for E15..E19; E01..E10 and E12 are the eleven whose
records sit beside the index instead of under it — E05's is [`CATALOGUE.md`](./CATALOGUE.md), moved later
the same day, E06's is [`CATEGORY_TAXONOMY.md`](./CATEGORY_TAXONOMY.md), moved 2026-08-25, and E07's, E08's
and E09's are [`CUSTOMER_ACCOUNT_ADDRESSES.md`](./CUSTOMER_ACCOUNT_ADDRESSES.md),
[`PUBLIC_DISCOVERY_STOREFRONT.md`](./PUBLIC_DISCOVERY_STOREFRONT.md) and
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md), all three moved
2026-08-26. E10's is [`SHARED_KERNEL.md`](./SHARED_KERNEL.md), moved 2026-08-27. E11's is beside neither
list: its file was deleted on 2026-08-27 with no record of its own to move, its knowledge distributed
instead into [`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note 2026-08-27
and [`EPICS_STORIES.md`](./EPICS_STORIES.md) §6.1.

**The story IDs did not change.** `E03-S01` … `E03-S08` are cited by sixteen files:
`phase2/BOUNDED_CONTEXT.md`, `phase2/EVENT_STORMING.md`, `phase2/UBIQUITOUS_LANGUAGE.md`,
`phase3/C4_CONTEXT.md`, `phase3/CONSTRAINTS.md`, `phase3/SECURITY_AUTH.md`, `phase4/API_CONTRACTS.md`,
`phase4/DDD_AGGREGATES.md`, `phase4/ERD.md`, `EPICS_STORIES.md`, `IDENTITY_ACCESS.md` §6 q3,
`RISK_REGISTER.md`, `SEQUENCE_DIAGRAMS.md`, `docs/architecture.md` and
`BEs/marketplace-common/CLAUDE.md`. Every one of those resolves to a section of this file. Renumbering
them was refused for the reason E01 gives: an ID cited across sixteen files is a name, and moving a file
is not a reason to change a name. A further set — `phase1/NFR.md`, `COMPANY_LEGAL_ENTITY.md`,
`CONFLICT_REPORT.md` and `STATUS.md` — names the epic **E03** without a
story suffix, and reads the same way. (`epics/E17.md` was a sixth until 2026-08-28, when it was deleted
and its record distributed; the citation did not move, it ended.)

**What is deliberately not repeated here.** The login gate that *reads* `waitApprov` is E01-S11's story,
recorded in [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md) — this context writes the field and never reads
it. The write-scoping that keeps `notes` and `waitApprov` out of ShopOwner-tier reach is CON-12, owned by
E01-S10. What follows says what each story had to satisfy and where the code is.

⚠️ **Narrowed again 2026-08-27, later the same day.** The range above reads **E13..E19** because
`phase5/epics/E12.md` was deleted and its record moved beside this one to
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) — the **eleventh** record to make that move, and
the first from the E12-E18 remediation block, so the pattern is no longer about the ten bounded-context
epics alone. E12 lost its file, not its id: `E12-S01` … `E12-S26` are cited from 87 source files across
all fifteen sub-repos and resolve to sections of that record.

⚠️ **Narrowed again 2026-08-28.** The range above reads **E14..E19** because `phase5/epics/E13.md` was
deleted on 2026-08-28 — distributed rather than moved, the way E11 went and not the way E12 did: all
eleven of its stories were already `built`, its §6 read "None open.", and an audit of the file found only
seven facts held nowhere else. No twelfth record joined the index beside this one, so the count of eleven
established at v1.7 is unchanged — [`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) is
still the eleventh and last. E13's seven facts went to three documents that already owned each subject
instead: the E13 row of [`EPICS_STORIES.md`](./EPICS_STORIES.md) §2 — the landing order, its two
`BGREWRITEAOF` passes, and the "step four is the clock, not step one" rule; §3.6 of
[`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) — the six `INTROSPECTION_CODE` comparison sites named
with file and line; and §6.1 of
[`dependency-tree-advisory-scan.md`](../../report/dependency-tree-advisory-scan.md) — the seventh site,
upstream in `@axiumine/koa-utils`. E13 lost its file, not its id: it kept `E13` and all eleven story ids,
`E13-S01` … `E13-S11`, unchanged.

⚠️ **Narrowed again 2026-08-28, later still.** The range above reads **E15..E19** because
`phase5/epics/E14.md` was deleted the same day — distributed rather than moved, the way E11 and E13 went
and not the way E12 did: all nine of its stories were already `built`, its §6 read "None open. Every
decision this epic made is carried by the story that implements it, with its reasoning — this section
holds only what is still undecided.", and an exhaustive audit of all 163 facts in the file found only nine
held nowhere else. No twelfth record joined the index beside this one, so the count of eleven established
at v1.7 is still unchanged — [`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) remains
the eleventh and last. E14's nine facts went to seven destinations: the E14 row of
[`EPICS_STORIES.md`](./EPICS_STORIES.md) §2 — the seven-step landing order, and "land E13-S01 **and
E13-S02** first" at §2.1; §4 of [`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) — two rejected alternatives,
the tier-keyed privilege gradient for the session cap and the cached-successor-pair grace design;
[`docs/architecture.md`](../../architecture.md) — the abandoned `// if remember me, generate ?`
cookie-side comment in koa-utils' `setLoginCookies`, which E14-S07 explicitly does not revive;
[`RISK_REGISTER.md`](./RISK_REGISTER.md) R52 — "two windows, not one";
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) — the Cloudflare rate-limiting-rules
alternative to `limit_req_zone`; §5 of `epics/E17.md` — why E17 depends on E14 for
`familyId`; and §3.4 of
[`token-handling-security-audit.md`](../../report/token-handling-security-audit.md) — E14-S06's accepted
cross-service-harness residual. The two defects E14-S09 found stay open, recorded in
[`multi-tab-refresh-behaviour.md`](../../report/multi-tab-refresh-behaviour.md) §4, §5 and §9 — that
report is not deleted. E14 lost its file, not its id: it kept `E14` and all nine story ids, `E14-S01` …
`E14-S09`, unchanged.

⚠️ **Narrowed once more 2026-08-28, later the same day.** The range above reads **E16..E19** because
`phase5/epics/E15.md` was deleted, distributed the same way and for the same reason — ten of ten stories
`built` — so the eleven records beside this one are still eleven. **E15's §6 was not empty, unlike E14's**:
one row survived, a Product question about a confirm-first email-change flow that does not exist, and it
moved to [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md) rather than dying with the file. ⚠️ **This record was
a receiver in that pass, not just a witness to it**: E15-S07's parking rule — a revoke when either flag goes
on, none when it comes off, and a gate that reads the target state rather than a transition — is now
recorded under E03-S02 above, because `shopOwnerUpdateStatus` is this epic's mutation and that is where
someone about to change it will look. §0's list of files citing an `E03-Snn` id drops `epics/E15.md`, which
no longer exists. E15 kept `E15` and all ten story ids.

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

Provision a `ShopOwner` account — by an Admin, or since E03-S08 by the person themselves through the
public site — and gate its ability to log in behind manual approval (`waitApprov`). Own the
admin-private annotation (`notes`) and the onboarding-preference fields, none of which the ShopOwner
tier itself can read or write.

⚠️ **The two provisioning routes differ in exactly one field, and it is the one this epic is named
after.** `shopOwnerRegister` (public) writes `waitApprov: true`; `shopOwnerAdd` (Admin) writes nothing
there. An admin who typed the account in has approved it by the act of creating it; a stranger who
typed it in themselves has been approved by nobody, and waits.

## 2. Scope

| Item | In/Out | Why |
|---|---|---|
| `shopOwnerAdd` | In | Admin-side creation, from a full set of fields, already approved |
| `shopOwnerRegister` | In | public self-service creation, from an address and a password, parked on `waitApprov` |
| `shopOwnerUpdateStatus` (`disabled` + `waitApprov`) | In | the approval lever |
| `shopOwnerUpdateNote` | In | admin-only annotation |
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
admin's hand is the writer by decision, and the shop-owner-side flow is future work (`RISK_REGISTER.md`
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
  `shopOwnerRegister` writes it `true`; this one deliberately leaves the key absent, because the admin
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

⚠️ **Since E15-S07 (2026-08-13) this mutation also ends sessions, and the rule is asymmetric on purpose.**
Parking an account — either flag going **on** — calls `revokeAllSessionsForAccount` for that ShopOwner, so
`disabled` and `waitApprov` stop being labels that only bite at the next rotation and a parked owner is out
of every device immediately. **Releasing an account revokes nothing**, deliberately: an admin restoring
access has no reason to sign anyone out, and there is nothing to end anyway — the sessions were already
destroyed on the way in. ⚠️ **The gate reads the target state, never a transition.** Because both flags
arrive on every call (that is this story's whole point), the mutation cannot tell an approve-then-approve
from a first approval, so it asks *is the account parked after this write* rather than *did this write park
it*. A re-park of an already-parked account therefore revokes again and finds nothing, which is correct and
free. Anyone rewriting this to compare old and new values reintroduces the window E03-S02 exists to close.
### E03-S03 — Admin records an admin-private note   `built`
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
owner's call: **the admin's hand is the writer, and a shop-owner-side advance is future work.** Nothing
was invented here — the wizard that would justify a self-advancing write does not exist as a design
anywhere on this platform (what the ≤4-character steps are, what "done" means, whether the shop-owner app
writes them itself or asks for an admin's review), and `CLAUDE.md` §Build state says to ask rather than
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
value only an admin can set. The day one gates on `onboardingDone` is the day R53 stops being Low, and
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

### E03-S08 — A seller registers themselves and waits for an admin   `built`
**As a** prospective shop owner, **when** I fill in the seller form on the public site, **I want** an
account created from my address and a password and held until the platform approves it **so that** I can
apply to sell without an admin having to type my details in for me, and so that nobody trades here
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
- The admin's two screens survive a document with no `personalData`: `GraphQLShopOwnerActiveTbl` and
  `GraphQLShopOwnerById` both declare it **nullable**, and the table gained `email` (flattened from
  `login`) and `waitApprov`. Under the old `NonNull` a single pending registration turned the whole
  listing into an error — a non-null list of non-null rows propagates one null all the way up — so the
  page an admin needs in order to approve that account was the page it broke
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
| 2 | What advances `onboardingStep`/`onboardingDone` outside of an Admin manually calling `shopOwnerUpdatePreferences`? | E03-S04, 2026-08-13 | **Nothing does, by decision.** `shopOwnerUpdatePreferences` (Admin tier) is the only writer and stays the only writer until a shop-owner onboarding flow is designed; the platform owner deferred that flow rather than have it invented here. The premise the question carried was also wrong in one word: it read "no mutation … writes either field", when the true statement is **no *other* mutation writes them** — a dropped "other" that had propagated into four documents and into `RISK_REGISTER.md` R27, all corrected in the same change. ⚠️ **E03-S08 raised the stakes, and that part survives the closure** as **R53** (🟢 Low). An approved self-registered account has a login and nothing else: no name, no date of birth, no address, no contacts, no company. Onboarding is the flow that would collect them and it does not exist — so today the admin either types the details in through `shopOwnerUpdate`, or the account trades under an empty `personalData`. Whoever builds it decides whether the shop-owner app writes those fields directly or asks for an Admin review, which is a product question wearing an implementation question's clothes. R53 is Low because no frontend reads either field today, so nothing is blocked while the flow is missing |
| 3 | Does self-service ShopOwner registration ever get built, or does Admin-provisioning stay permanent? | E03-S08, 2026-08-12 | **Built, and the two coexist.** Admin-provisioning did not go away — it is the route for a shop the platform recruited, and it skips the queue for that reason |
| 4 | What `idShopOwner` does an Admin-created `company` (BC-04) get absent an owning ShopOwner having created it first via this epic? | 2026-08-14, outside any story | **The case the question describes cannot occur: there is no Admin-created `company` absent an owning ShopOwner.** Admin-tier `companyAdd` takes `idShopOwner: ID!` as an explicit argument, and `funCompanyAdd` (`BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/company/funCompanyAdd.mts:34-36`) resolves it before writing — `ShopOwner.exists({ _id: idShopOwner, deleted: { $exists: false } })`, 404 `shopOwner not found` otherwise. A soft-deleted owner counts as absent. So an Admin-created company is stamped with the id of a live `shopOwner` document or it is not created at all, and the order this epic worried about is the enforced one: the account exists first, whether it self-registered (E03-S08) or the admin provisioned it. What survives is not a design gap but admin error — a valid id naming the *wrong* ShopOwner — and `idShopOwner` reaches the mutation from the URL of the owner detail page the admin is already on. Closed alongside `EVENT_STORMING.md` §5 hotspot 5 and §6 question 6, `DDD_AGGREGATES.md` question 3, and `RISK_REGISTER.md` **R30** |

## 7. Changelog

| Version | Date | What changed |
|---|---|---|
| 1.0 | — | Initial retrofit, reverse-engineered from the 15-repo working tree |
| 1.1 | 2026-08-12 | E03-S08 adds public self-service registration, and with it the answer to two of §6's open questions — a `ShopOwner` starts parked when they registered themselves and ungated when an admin created them. The epic goal, §2, §3 and E03-S01's second acceptance criterion all changed: "no self-service registration exists on this platform" was true until this story and is now the opposite of the code. `personalData` left the `shopOwner` validator's `required` list in the same change, which is what made both admin screens' `NonNull` on that field a page-breaking bug rather than a type detail |
| 1.2 | 2026-08-13 | E03-S04 closes, and §6's onboarding question closes with it — on the platform owner's call, the admin's hand is the only writer of `onboardingStep`/`onboardingDone` until a shop-owner onboarding flow is designed. Nothing was built. What the pass did produce is a correction: E03-S04's second acceptance criterion was the only place on the platform that said "no **other** mutation", and four documents plus `RISK_REGISTER.md` R27 had dropped that word into the false claim that *nothing* writes those fields. R27 closes on a premise that was never true; the surviving gap is the new **R53** (🟢 Low, Low because no frontend reads either field). §3's closing line no longer calls the hotspot unresolved |
| 1.3 | 2026-08-14 | **§6's last open question closes, and like R27 before it, on a premise that was never true.** It asked what `idShopOwner` an Admin-created `company` gets absent an owning ShopOwner; the Admin tier cannot produce that state, because `funCompanyAdd` resolves the explicit `idShopOwner: ID!` against a live, non-soft-deleted `shopOwner` and 404s otherwise. §6 carries no open question at all. The same false premise sat in five other documents — `EVENT_STORMING.md` §5 hotspot 5 and §6 q6, `DDD_AGGREGATES.md` in three places, `RISK_REGISTER.md` R30 and `COMPANY_LEGAL_ENTITY.md` §2/§5 — and is corrected in all of them in the same pass |
| 1.4 | 2026-08-14 | Record moved out of `phase5/epics/E03.md` to this file — see §0. No story, criterion, trace or evidence path changed in the move; the four open questions were folded into one table (§6) and the changelog into this one, both because every entry in them was already closed. §5's BC-04 dependency now states the enforcement v1.3 established rather than restating the old "nothing enforces the reference" |
| 1.6 | 2026-08-27 | §0's range narrowed from "E11..E19" to **E12..E19**: `phase5/epics/E11.md` was deleted with no replacement record of its own, unlike the ten epics named beside it — its knowledge was distributed to [`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note 2026-08-27 and [`EPICS_STORIES.md`](./EPICS_STORIES.md) §6.1 instead. Nothing about BC-03 changed |
| 1.7 | 2026-08-27, later still | §0's range narrows from "E12..E19" to **E13..E19** — `phase5/epics/E12.md` was deleted and its record moved beside the index to [`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md), the eleventh to move and the first from the E12-E18 remediation block. Moved intact, the E01..E10 way, not distributed like E11: all twenty-six of its stories are `built`. The count in §0 is corrected with it — eleven records now sit beside the index, not ten. E12 keeps every story id. Nothing about this record's own content or build state changed. |
| 1.8 | 2026-08-28 | §0's range narrows from "E13..E19" to **E14..E19** — `phase5/epics/E13.md` was deleted and its knowledge distributed rather than moved, the E11 way and not E12's: all eleven of `E13-S01`…`E13-S11` were already `built`, §6 read "None open.", and only seven facts in the file were held nowhere else. Those went to the E13 row of `EPICS_STORIES.md` §2, `SECURITY_AUTH.md` §3.6, and `dependency-tree-advisory-scan.md` §6.1. No twelfth record joined the index, so the count beside it stays the eleven v1.7 established. §0's list of files naming E03 without a story suffix drops `epics/E13.md`, which no longer exists. E13 keeps its id and all eleven story ids; nothing about this record's own content or build state changed. |
| 1.9 | 2026-08-28, later still | §0's range narrows from "E14..E19" to **E15..E19** — `phase5/epics/E14.md` was deleted and its knowledge distributed rather than moved, the E11 and E13 way and not E12's: all nine of `E14-S01`…`E14-S09` were already `built`, §6 read "None open.", and an exhaustive audit of all 163 facts in the file found only nine held nowhere else. Those went to the E14 row of `EPICS_STORIES.md` §2 (the seven-step landing order and the E13-S01+S02 ordering at §2.1), `ADR-INDEX.md` §4 (the rejected tier-keyed session cap and the rejected cached-successor-pair grace design), `docs/architecture.md` (the abandoned `setLoginCookies` cookie-side comment), `RISK_REGISTER.md` R52 (two rate-limit windows, not one), `TELEMETRY_EGRESS_HARDENING.md` (the Cloudflare rate-limiting-rules alternative), `epics/E17.md` §5 (why E17 depends on E14 for `familyId`), and `token-handling-security-audit.md` §3.4 (E14-S06's accepted cross-service residual). No twelfth record joined the index, so the count beside it stays the eleven v1.7 established. §0's list of files naming E03 without a story suffix drops `epics/E14.md`, which no longer exists. E14 keeps its id and all nine story ids; the two defects E14-S09 found stay open in `multi-tab-refresh-behaviour.md` §4, §5 and §9. Nothing about this record's own content or build state changed. |
| 1.10 | 2026-08-28, later the same day | §0's range narrows from "E15..E19" to **E16..E19** — `phase5/epics/E15.md` deleted and distributed, the E11/E13/E14 way, no twelfth record joining the index. **This file received content rather than only a range edit:** E03-S02 gained the E15-S07 note — parking a ShopOwner ends every session that account holds, releasing one revokes nothing, and the gate reads the *target state* because both flags arrive on every call, so an old-vs-new comparison would reopen the window E03-S02 exists to close. §0's citation list drops `epics/E15.md`. E15's surviving §6 question (a confirm-first email-change flow) moved to [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md). E15 keeps its id and all ten story ids. Nothing about BC-03's own build state changed |
| 1.11 | 2026-08-28, later the same day | §0's range narrows from "E16..E19" to **E19** — `phase5/epics/E17.md` and `phase5/epics/E18.md` were **both** deleted and their records **distributed, not moved**, the E11/E13/E14/E15/E16 way. E17's nine stories and E18's thirteen are `built`; E17's five open questions and E18's three are all closed. What the audit found held nowhere else went to `EPICS_STORIES.md` §2's E17 and E18 rows and §2.1's E17 row, `docs/testing.md`, and `PLATFORM_OPERATIONS_QUALITY_GATES.md` §6. The count in §0 stays eleven — no new record joined it, and every story id survives. Nothing about this record's own content or build state changed. |
