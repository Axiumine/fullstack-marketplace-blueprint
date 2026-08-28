# ADR Index
# Marketplace

**Status:** baselined
**Version:** 1.14
**Date:** 2026-08-28
**Author:** adr-agent
**Changelog:**
v1.0 - 31 decisions, one per architectural choice this platform stands on
v1.1 - ADR-032 (production topology, recorded as owed) and ADR-033 (`SameSite=Strict` on the refresh
cookie) added from the token-handling security audit; two rows added to §4, and §5's topology gap now
points at the ADR that owns it
v1.2 - ADR-034 added: the Keygrip pair leaves the five `.env` files for one wrapped record in Redis, a
service that cannot unwrap it refuses to boot, and rotation becomes an operator mutation. Three rows in
§4 and one line in §5 — the KEK is the value a secrets manager would take over, so the ADR-032 gap now
names it
v1.3 - 2026-08-14: two rows added to §4 from a decision the platform owner took directly rather than
through an ADR — the two-writer race on `company` and `item.published` is accepted, and publishing is a
separate operation on both tiers. Neither is an architectural choice this platform stands on, so neither
became an ADR; both are the kind of settled question §4 exists to keep settled, and both are cited to the
record that holds the reasoning
v1.4 - 2026-08-25: two more rows from the platform owner, both about the `user` collection and both taken
directly rather than through an ADR. The first closes `phase5/CUSTOMER_ACCOUNT_ADDRESSES.md` §6 — `user` gets no
`waitApprov`-equivalent, ever — and was added to §4 on the day it was taken without this header following
it; it is accounted for here. The second is its consequence: the operator surface that decision leaves
missing (`phase5/epics/E19.md`) reads clear fields only, so the temptation it creates — make a name or a
city queryable so the customers table can sort and search like the shop-owner one — is refused in the same
words ADR-029 refuses the opposite move on `shopOwner`. Neither is an architectural choice this platform
stands on, so neither became an ADR

v1.5 - 2026-08-26: ADR-035 added — `user.addresses` is capped at six, and the cap is written twice on
purpose: `maxItems` in the validator is the rule, the service's copy exists only to make the refusal a 400
that names the limit. One row in §2, one number in §3's **Data model** line, one row in §4. It is the first
decision here that deliberately duplicates a constant across repos that share no library, so §4 carries the
temptation that duplication creates

v1.6 - 2026-08-26, later the same day: one row from the platform owner, taken directly rather than through
an ADR. `user.addresses[].position` had nothing writing it until the account form got a map
(`phase5/CUSTOMER_ACCOUNT_ADDRESSES.md` E07-S11), and the obvious follow-on — now that a customer can place an address,
require the point — was offered and refused. It stays optional, so §4 carries the temptation. No ADR: the
map is the shipped stack used in one more place, and what was decided is one field's optionality

v1.7 - 2026-08-26: ADR-036 added — `userDel` does not gate on `disabled`, so a suspended customer can
still close their own account. One row in §2, one number in §3's **Identity and access** line, one row in
§4. Corrected with it: the §4 row from 2026-08-25 ended "nothing writes `user.disabled`, so an operator has
no lever after registration either", which stopped being true the same day — `userUpdateStatus` (E19-S03)
is that lever, and this ADR is the question its arrival created

v1.8 - 2026-08-26: **ADR-011 amended in place** — the first and only amendment in this index, and the
owner's call rather than the convention's. The 30-day retention purge decided in `phase1/NFR.md` open
question 6 shipped as `user.deleted_ttl`, and `userRegister` now destroys a closed account so its address
can be registered again. Both remove documents, which ADR-011 was being read as forbidding platform-wide.
A new ADR would have left a reader of ADR-011 with a rule that is no longer true and no sign of it, so the
exception was written where the rule lives. §1 records why the immutability rule was set aside here, the
§2 row carries the amended status, and §4 gains the `partialFilterExpression` refusal the amendment turns
on. ADR-036's §Risks bullet saying the purge does not exist was corrected with it. **No decision was
reversed:** row B still stands for `company`, `shopOwner`, `item` and `itemCategory`, and option C —
a partial unique index — is refused again in the amendment

v1.9 - 2026-08-26, last that day: **ADR-037 added — `@axiumine/marketplace-common` is published to npmjs,
the platform owner publishes it personally, and `deploy-local.sh` is not deleted.** It is the first
supersession in this index and it is **partial on purpose**: ADR-015 said it would be "superseded, not
revised" on the day the owner decided to publish, but ADR-015 also carries the GPL-3.0-or-later licence
decision and the `deploy-local.sh` bridge, neither of which the registry touches and neither of which is
recorded anywhere else. Marking it wholly superseded would have orphaned a licence decision, so its §2 row
and its header read *superseded in part*, and the two now-false sentences in its body are struck in place
with a pointer rather than deleted — the 404 is the premise its whole argument reasons from. One row in §2,
one name in §3's **Build and quality gates** line, one clarifying clause in §5. **The header was stale at
1.7 while this changelog already carried a v1.8**, so this entry is v1.9 and the header now agrees with it;
no entry was skipped. §5's git-hosting gap is **not** closed by ADR-037 and gains a clause saying so — where
the sixteen *repositories* live is a different question from which *registry* one npm package ships to, and
ADR-037 §Compliance lists conflating them as a violation
v1.10 - 2026-08-26: the stale "168 behavioural assertions" count replaced by a citation of `marketplace-nginx/test/suite.sh` itself. The number was stale by 67 — the suite ran 235 assertions before 2026-08-26 and 242 after — and a count written into prose goes stale silently every time an assertion is added. Nothing measured or decided changed. Four accepted ADRs carried the same number and were corrected with it — **ADR-018** §Consequences, **ADR-030** §Consequences (which claimed every pushed revision had had 168 assertions run against it, a false gate claim), **ADR-032** §Context and this index §5. No ADR's decision, status or consequence changed; only a number that had stopped being true. ⚠️ **Renumbered 2026-08-27.** This entry was written as `v1.6`, which another entry in this changelog already held — two different edits under one number, and a citation of "ADR-INDEX.md v1.6" could not be resolved to one of them. It takes the next free number instead. It is placed at the end, which is where this oldest-first list now carries it — it had been sitting between `v1.4` and `v1.5`, out of sequence as well as out of number. Nothing in the entry, and nothing in the document, changed with the renumber; no other document cited either number.

v1.11 - 2026-08-27: **ADR-038 added — cart, order, delivery and payment are permanently out of scope**, decided by the platform owner when asked what to do with `phase5/epics/E11.md` §6 question 1. It is the ADR §5 said was owed "when the design starts", arriving because the design does not start, so the **Ordering** gap leaves §5 rather than being answered inside it. One row in §2, one number in §3's **Catalogue** line, and two rows in §4 — the existing `price` row keeps ADR-009 and gains ADR-038, because the reason changed from *no design yet* to *no design ever*. ADR-009 is **not** superseded: its decision is unchanged and its title's condition simply never arrives, which its own header now records. Corrected in the same pass: §1 said "no supersession exists", which stopped being true on 2026-08-26 when ADR-037 superseded ADR-015 in part — the sentence predates that row and nothing but the sentence was wrong. **ADR-010 also carries a dated note now** — its §Context called the cart/order model absent *"yet"*, which ADR-038 turns into absent permanently; its decision, taken on atomicity grounds that never depended on a consumer arriving, is untouched
v1.12 - 2026-08-27, later the same day: **ADR-038 gains a dated note of its own** — its §Context and §Consequences both cited `phase2/EVENT_STORMING.md` **§5** open question 4, and that question is in **§6**; §5 is the hotspot table. Both pointers now read §6, the correction is recorded at the foot of the ADR rather than made silently, and nothing it decides changed. The same wrong section number was corrected in `phase5/epics/E11.md`. ⚠️ **That file no longer exists** — see v1.13 below; the correction itself is unaffected, since it lived in prose the deletion carried elsewhere rather than erased. No ADR status, decision or consequence moved.

v1.13 - 2026-08-27, later still: **`phase5/epics/E11.md` is deleted; the epic id E11 is not.** ADR-038 §Consequences already said the id "stays in the epic numbering and in `EPICS_STORIES.md`" — this is that happening, on the same day it was promised. The file's record is distributed rather than replaced: the two recording stories move to [`phase5/EPICS_STORIES.md`](../../phase5/EPICS_STORIES.md) §6.1, *"The two recording stories (absorbed from `epics/E11.md`, deleted 2026-08-27)"*, and ADR-038 itself gains a matching final section, §Note — 2026-08-27: *"`phase5/epics/E11.md` deleted, its record absorbed here"*. §4's row for ADR-038 above cited `phase5/epics/E11.md` as one of four places the four commerce concepts stay named to be "recognisable enough to refuse"; that pointer is repointed to `phase5/EPICS_STORIES.md` §6.1, which now does the naming — the refusal itself is unchanged, only the address of its evidence. v1.12's own citation of the file, two entries above, is annotated rather than rewritten, per this corpus's rule against silent correction. Nothing else in this index — no ADR, no §2 row, no §3 count — changed.

v1.14 - 2026-08-28: **ADR-039 added — the production topology is decided, and ADR-032 is superseded.** The platform owner answered the four questions ADR-032 recorded as owed — Cloudflare is the outermost hop, one application host carries nginx and the twelve processes, a cloud security group closes every port but 443, and the Redis cluster and MongoDB replica set live on a separate host on a private LAN segment — and declared that segment **trusted**. One row added to §2, ADR-032's *Superseded by* cell filled in, one number added to §3's **Infrastructure and delivery** line, and §1's supersession count moves from one to two. §5 changes twice: the **Production topology** bullet is struck as answered, and the **shared secret** bullet loses the clause that blocked it — ADR-034's option E can be chosen now that a document says where any of this runs, though choosing it is still owed. ⚠️ **ADR-032's rule is narrowed, not deleted**: a boundary may be cited as a second layer for the legs ADR-039 describes and never as the whole argument, which is why §4's row against unwrapped Keygrip keys keeps its reasoning word for word. R46 closes in the risk register; **R45 does not** — the Redis leg is still cleartext and drops to 🟢 Low instead.

## 1. How to use this index

ADRs are immutable once accepted. Never edit one. To change a decision, write a new ADR and set its
`Supersedes` field, then flip the old one's `Superseded by`. Every ADR below is `accepted`, and two
supersessions exist — ADR-037 supersedes ADR-015 *in part*, and ADR-039 supersedes ADR-032, also in part:
the topology it recorded as *owed* is now written, while the rule it made about network boundaries survives
in narrowed form. §2 says so in all four rows. Every other
decision stands as written, and none contradicts another. Where two ADRs touch
the same subject they divide it rather than overlap: ADR-001 decides that the platform is sixteen
independent histories, ADR-031 decides what the parent workspace records about the fifteen it contains.

⚠️ **One exception exists, and it is the owner's rather than the convention's: ADR-011 carries an
amendment dated 2026-08-26.** The rule above assumes a superseding ADR is the safer record, and here it
was not. ADR-011 is *cited* as the statement of the platform's soft-delete convention — by ADR-036, by
three repository `CLAUDE.md` files and by `funUserDel`'s own header — so a second ADR contradicting it
would have left every one of those readers with a rule that had stopped being true and nothing on the
page to say so. The amendment is appended, scoped to the `user` collection alone, and the original
decision is left standing word for word above it. **This is not licence to edit an ADR**: the next
change of a decision writes a new one, and an amendment needs the owner to say so, as this one did.

New ADR: copy [`ADR-000-template.md`](./ADR-000-template.md), next free number, fill in `Status`, `Date`, `Deciders`.

Enterprise fields (Security Review, Privacy Review, Cost Estimate, Compliance Impact) are **not**
required in this repo's ADRs — there is no `agents.config.yaml`, so `compliance.profile` is `none`.

## 2. Index

| ADR | Title | Status | Date | Supersedes | Superseded by | Area |
|---|---|---|---|---|---|---|
| ADR-001 | Polyrepo over monorepo | accepted | 2026-08-04 | — | — | Infrastructure and delivery |
| ADR-002 | Role is the authentication collection | accepted | 2026-08-04 | — | — | Identity and access |
| ADR-003 | Opaque tokens, Redis sessions, not JWT | accepted | 2026-08-04 | — | — | Identity and access |
| ADR-004 | Per-tier session assertion (fail closed, 403, shared REDIS_KEY) | accepted | 2026-08-05 | — | — | Identity and access |
| ADR-005 | Single logout service, all tiers | accepted | 2026-08-05 | — | — | Identity and access |
| ADR-006 | Authorization services share body, keep three deployables | accepted | 2026-08-07 | — | — | Identity and access |
| ADR-007 | A shop is a company, never an embedded subdocument | accepted | 2026-08-03 | — | — | Data model |
| ADR-008 | Domain-neutral catalogue (item + itemCategory) | accepted | 2026-08-05 | — | — | Catalogue |
| ADR-009 | No price on item | accepted | 2026-08-05 | — | — | Catalogue |
| ADR-010 | Default-address pointer, not a per-address boolean | accepted | 2026-08-05 | — | — | Data model |
| ADR-011 | Soft delete via `deleted` date, global uniques stay occupied | accepted, **amended 2026-08-26** — `user` is destroyed, by TTL and by one write | 2026-08-04 | — | — | Data model |
| ADR-012 | itemCategory depth capped at two, in the resolver, admin-only writes | accepted | 2026-08-05 | — | — | Catalogue |
| ADR-013 | English-only naming, with no carve-out | accepted | 2026-08-04 | — | — | Data model |
| ADR-014 | Migrations immutable, `$jsonSchema` shapes shared in lib/schemas/ | accepted | 2026-08-04 | — | — | Data model |
| ADR-015 | marketplace-common: package-name consumption, unpublished, deploy-local.sh bridges | accepted, **superseded in part 2026-08-26** — the publication half only; the bridge and the licence stay | 2026-08-04 | — | ADR-037, in part | Build and quality gates |
| ADR-016 | 100% coverage on all four metrics + 100 mutation score, everywhere | accepted | 2026-08-06 | — | — | Build and quality gates |
| ADR-017 | Hooks via core.hooksPath + prepare script, Qodana in pre-commit and pre-push | accepted | 2026-08-07 | — | — | Build and quality gates |
| ADR-018 | SSR public routes, CSR-only /account/*, cache bypasses on session cookie | accepted | 2026-08-05 | — | — | Frontend |
| ADR-019 | New urql client per SSR request, un-prefixed PUBLIC_RESOURCE_URL | accepted | 2026-08-05 | — | — | Frontend |
| ADR-020 | Route files as one-line createFileRoute, behaviour in routeOptions | accepted | 2026-08-05 | — | — | Frontend |
| ADR-021 | preferGetMethod stays false (csrfPrevention everywhere) | accepted | 2026-08-05 | — | — | Frontend |
| ADR-022 | Nine services bind wildcard; SSR server binds loopback | accepted | 2026-08-07 | — | — | Infrastructure and delivery |
| ADR-023 | Per-repo integration database, named identically in three variables | accepted | 2026-08-07 | — | — | Build and quality gates |
| ADR-024 | Tabs everywhere, eslint + prettier together, tree-wide | accepted | 2026-08-07 | — | — | Build and quality gates |
| ADR-025 | marketplace-services-status has no repo of its own, gated by parent hooks | accepted | 2026-08-07 | — | — | Build and quality gates |
| ADR-026 | engines.node = ^24.18.0 everywhere, caret included | accepted | 2026-08-07 | — | — | Build and quality gates |
| ADR-027 | One frontend app per tier, not one app that switches on role | accepted | 2026-08-05 | — | — | Frontend |
| ADR-028 | GraphQL is the whole API; three REST endpoints serve email verify only | accepted | 2026-08-05 | — | — | Infrastructure and delivery |
| ADR-029 | PII at rest: explicit CSFLE, deterministic on the five lookup keys | accepted | 2026-08-08 | — | — | Data model |
| ADR-030 | marketplace-nginx gates on its own suite at push, on the secret guard at commit | accepted | 2026-08-09 | — | — | Build and quality gates |
| ADR-031 | The fifteen sub-repos are tracked as submodules of the parent workspace | accepted | 2026-08-09 | — | — | Infrastructure and delivery |
| ADR-032 | The production topology is owed, and no control may assume it | accepted | 2026-08-10 | — | ADR-039, in part | Infrastructure and delivery |
| ADR-033 | `SameSite=Strict` on the refresh cookie, enforced twice | accepted | 2026-08-10 | — | — | Identity and access |
| ADR-034 | Keygrip keys live in Redis, wrapped under a KEK, boot fails on disagreement | accepted | 2026-08-12 | — | — | Identity and access |
| ADR-035 | `user.addresses` capped at six, in the validator and in the write that appends | accepted | 2026-08-26 | — | — | Data model |
| ADR-036 | Erasure is not something the platform suspends: `userDel` does not gate on `disabled` | accepted | 2026-08-26 | — | — | Identity and access |
| ADR-037 | `@axiumine/marketplace-common` is published to npmjs; the owner publishes, `deploy-local.sh` stays | accepted | 2026-08-26 | ADR-015, in part | — | Build and quality gates |
| ADR-038 | Cart, order, delivery and payment are permanently out of scope | accepted | 2026-08-27 | — | — | Catalogue |
| ADR-039 | The production topology, decided: Cloudflare, one app host, datastores on a trusted segment | accepted | 2026-08-28 | ADR-032, in part | — | Infrastructure and delivery |

## 3. By area

**Identity and access** — ADR-002, ADR-003, ADR-004, ADR-005, ADR-006, ADR-033, ADR-034, ADR-036

**Data model** — ADR-007, ADR-010, ADR-011, ADR-013, ADR-014, ADR-029, ADR-035

**Catalogue** — ADR-008, ADR-009, ADR-012, ADR-038

**Frontend** — ADR-018, ADR-019, ADR-020, ADR-021, ADR-027

**Build and quality gates** — ADR-015, ADR-016, ADR-017, ADR-023, ADR-024, ADR-025, ADR-026, ADR-030,
ADR-037

**Infrastructure and delivery** — ADR-001, ADR-022, ADR-028, ADR-031, ADR-032, ADR-039

## 4. Decisions deliberately NOT re-opened

| Temptation | Settled by | Why not |
|---|---|---|
| Merge the three authorization services into one | ADR-006 | dispatching on a tier read from the session is the pattern ADR-002 rejects; one `process.exit(1)` for three tiers is an availability cost paid by customers |
| Fold `logout` back into the three `*-authenticated-authorization` services, or add a tier-named `adminLogout`/`shopOwnerLogout`/`userLogout` | ADR-005 | the resolver reads no `tier` and opens no collection, so three copies could never diverge — it is one `del` per key either way — while each copy pays the full CON-08 gate cost (lint, 100% coverage, mutation 100, Qodana) for a failure isolation session teardown has no use for; it also reintroduces the tier-dispatch pattern ADR-002 rejects. Stated as a standing boundary in `phase5/SESSION_TERMINATION.md` §E02-S05, which is what a PR proposing it has to answer. Violation looks like a `logout*.mts` appearing under any authorization service's `schema/mutations/`, or `assertTier` appearing inside `marketplace-dev-authenticated-logout/src/` |
| Per-tier `REDIS_KEY` prefixes | ADR-004 | breaks the single logout service (ADR-005), which finds a session by token content alone; the tier assertion is the layer that holds even if a prefix is reused by mistake |
| Add a `role` field / permission enum | ADR-002 | role = which collection you authenticate against, by design; a role field duplicates that |
| Add a shop collection | ADR-007 | a shop is a company; a separate shop collection splits one record in two and puts the storefront fields on the wrong side of the split |
| Add a `price` field to `item` | ADR-009, ADR-038 | there is nothing to buy and there never will be — ADR-038 makes ADR-009's "until ordering is designed" permanent, so the four decisions a price drags behind it (currency, precision, VAT, discount) are not pending, they are moot. `price` on `item` is a banned term in `phase2/UBIQUITOUS_LANGUAGE.md` §19 |
| Design or build cart, order, delivery or payment — a schema, a mutation, a state machine, a checkout sequence diagram, or "a first small step" toward any of them | ADR-038 | permanently out of scope by the platform owner's decision, 2026-08-27. The blueprint demonstrates multi-tenant identity, tenancy and catalogue; a checkout demonstrates none of that a second time. The four stay named in `BOUNDED_CONTEXT.md` BC-11, `UBIQUITOUS_LANGUAGE.md` §18, `EVENT_STORMING.md` §2.9 and `phase5/EPICS_STORIES.md` §6.1 so they are recognisable enough to refuse — presence is not a plan. Re-opening needs an ADR superseding ADR-038, not a story |
| Lower a coverage or mutation threshold | ADR-016 | the rule that outlived every other instruction here; a commit that needs a threshold lowered needs a test instead |
| Add `ignoreStatic` to a Stryker config | ADR-016 | masks real gaps; the survivor it appears to fix is usually a load-time mutant needing a dynamic import instead |
| Reintroduce vocabulary that presumes what is sold | ADR-008 | catalogue is domain-neutral on purpose; nothing in item/itemCategory presumes a product type and nothing should |
| Collapse the sixteen repos into a monorepo | ADR-001, ADR-031 | sixteen separate histories, hook sets, gates and Qodana projects would have to merge, and path-scoped CI would have to be invented to recover what repo boundaries give for free; ADR-031 answers reconstruction and cross-repo state without touching this |
| Put the sub-repo paths back in the parent's `.gitignore`, or commit a sub-repo's files into the parent | ADR-031 | the first makes `git submodule add` refuse the path and un-tracks fifteen gitlinks; the second dissolves the boundary ADR-001 set — a submodule pins a sub-repo, it never absorbs one |
| Give `marketplace-nginx` a `package.json` so its hooks self-arm | ADR-030 | it ships no JavaScript, so the file would exist to hold one line of git config and would invite a `lint`/`test` script with nothing behind it — the appearance of a gate, which is exactly what ADR-025 refuses to accept for `marketplace-services-status` |
| Move `marketplace-nginx`'s test suite into its `pre-commit`, or add a skip variable to its `pre-push` | ADR-030 | the suite needs a container engine and an image, and the ordinary commit there is one directive; a per-commit container run is how a hook gets `--no-verify`d out of habit |
| Encrypt `shopOwner.personalData.firstName` / `lastName` / `address.city` too | ADR-029 | they are the sort keys and `/^term/i` targets of the operator's shop-owner table, and neither CSFLE algorithm survives a sort or a prefix match; encrypting them makes that table silently wrong rather than slow |
| Switch another field to deterministic so it can be queried | ADR-029 | equal plaintext gives equal ciphertext, which is an equality oracle for anyone holding a read; the five deterministic fields are the ones a login or a verification link must *find*, and the list does not grow for convenience |
| Narrow the refresh cookie's `path` to the authorization routes | ADR-018 | the root scope is what makes `conf.d/30-cache.conf:32-35` work: nginx decides whether to cache a public catalogue page by whether the request carries `refresh_token`, and a cookie the browser withholds on that path makes a logged-in customer look anonymous — their personalised HTML is then stored and served to the next visitor (NFR-SE09). ADR-018's prose said "scoped to API paths" and was wrong about it; the sentence was corrected, the scope is not to be |
| Put the Keygrip keys in Redis unwrapped, or drop the `KEYGRIP_KEK` because "Redis is internal" | ADR-034 | the signature is the one layer a Redis read does not already defeat: an attacker holding the session tokens still cannot sign a cookie. Unwrapped keys hand that away. ADR-032 forbade arguing it back with a network boundary nobody had written down; ADR-039 (2026-08-28) writes one and keeps the refusal intact — the trusted segment is a second layer, never the whole argument, and it is the same segment the session tokens already cross in the clear |
| Give the mint to `marketplace-dev-authenticated-logout` because all three tiers already reach it | ADR-034 | that is the reason not to: it is the one service a customer's traffic touches on every tier, and minting a signing key is an operator act that belongs behind the Admin tier's own resource service |
| Reintroduce `KEYGRIP_KEY_1`/`_2` into an `env` template "as a fallback" | ADR-034 | a fallback is a second source of truth for the value the whole decision exists to make single, and it fails in the one shape that is invisible — a service that quietly boots on the env pair while the other four follow the record |
| Add a version or optimistic-lock field to `company` or `item`, or a read-then-compare precondition on either tier's update | platform owner, 2026-08-14 — `phase5/COMPANY_LEGAL_ENTITY.md` §6, `phase5/RISK_REGISTER.md` §5 (R29 Accepted) | two writers on one document is the design, and last writer wins is the accepted outcome: an operator unpublishes, the shop owner publishes again, and that is normal. Both tiers `$set` a whole enumerated object rather than a diff, so what was accepted is whole-card last-write-wins — a story proposing a lock reverses the decision instead of extending it |
| Put `published` back inside `GraphQLInputItem` or `GraphQLInputCompany`, "so a save can set it too" | platform owner, 2026-08-14 — `phase5/COMPANY_LEGAL_ENTITY.md` E04-S08, `phase5/CATALOGUE.md` E05-S08 | that is the bug the split removed: a whole-object `$set` makes every save a write of the flag, so reopening a stale card republished what somebody had just taken down, without touching anything named publish. `itemUpdatePublished` / `companyUpdatePublished` are the only writers, one pair per tier, and `itemAdd`/`companyAdd` stamp `false`. The DB `$expr` `PUBLISHED_IMPLIES_LINKABLE` then makes save-then-publish two calls by construction |
| Give `itemCategory` a `published` flag or an `itemCategoryDisable`, "for symmetry with `item` and `company`" | platform owner, 2026-08-14 — `phase5/CATEGORY_TAXONOMY.md` §6 | the symmetry is the misreading: those two flags exist because a shop drafts its own public surface, and the taxonomy has no owner but the operator. Present or soft-deleted is the whole state space, and `itemCategories` filters `deleted` alone. Accepted with it: a category created before its items is public and empty until they arrive — the lever is when it is created, not a flag on it |
| Move the item picture into an `itemImage` collection, or drop the `image` field and derive the name from `_id` | platform owner, 2026-08-14 — `phase5/CATALOGUE.md` E05-S09 | both were offered and both were refused: a collection is a second document to keep in step with an item that has exactly one picture, and deriving the name means an item with no picture is indistinguishable from one whose file is missing — the optional field *is* how a card knows to draw a placeholder. The value is a file name only — the item's own `_id` plus an extension — because `STATIC_FOLDER/item/<idCompany>/` is reconstructible from the document and a stored path is one more way to escape the directory |
| Add a second write path for `image` — a replace mutation, or the key back inside `itemUpdate` | platform owner, 2026-08-14 — `phase5/CATALOGUE.md` E05-S09 | `itemAdd` being the only writer is what keeps the file name derivable from the document and the temp-store/insert/publish ordering in one resolver. Replacing a picture is unbuilt, not forgotten; it needs the orphaned-file question answered first, which the failed-publish-after-insert case already raises and nothing repairs today |
| Give `user.login.email_unique` a `partialFilterExpression` so a closed account stops occupying its address | ADR-011 §Amendment, 2026-08-26 | it is the wrong half of the problem and it breaks login. Three call sites look an account up by address with no liveness filter — `tryLoginUser`, `userForRegistration` and koa-utils' verify-email flow — so two documents holding one address makes `findOne` return an arbitrary one of them. The address is freed because the *document* goes, never because the index learns to ignore it: `user.deleted_ttl` removes it after 30 days and `purgeClosedUser` removes it sooner if somebody registers the address again. Option C was refused in 2026-08-04 for `company` and is refused again here for `user`, on a different reason each time |
| Hard-delete `company`, `shopOwner`, `item` or `itemCategory` "for consistency with `user`" | ADR-011 §Amendment, 2026-08-26 | the amendment turns on one fact that only `user` has: **nothing references it**. `company.idShopOwner`, `item.idCompany`, `item.idCategory` and `itemCategory.idParent` all point at the other four, a removed document strands every one of those, and no retention period has been decided for any of them. `user`'s unique key is also a credential rather than a legal identity — the VAT argument in ADR-011's §Decision is about a key `user` does not have. Per collection, in that ADR, never by pattern |
| Give `user` a `waitApprov`-equivalent — an operator approval, a fraud check or a spam-signup hold between `userRegister` and the first login | platform owner, 2026-08-25 — `phase5/CUSTOMER_ACCOUNT_ADDRESSES.md` §6 | self-service is what a customer account *is*, and the asymmetry with `shopOwner` is what each account gets rather than how far either is trusted: clearing `waitApprov` publishes a shop on this platform's own domain, while a customer's account reads that customer's own document. The flag is also only half a feature — the other half is the operator queue behind it, and `user` is the one collection encrypted whole precisely because nothing sorts, searches or paginates it (ADR-029), so a moderation table over customers reverses that decision instead of extending this one. `emailVerify.valid` stays the only gate. Separate and not refused: at the time this was taken nothing wrote `user.disabled`, so an operator had no lever after registration either — `userUpdateStatus` (E19-S03) became that lever the same day, and what it may reach is ADR-036 |
| Make `user.personalData.firstName` / `lastName` / `addresses[].city` deterministic or clear, "so the customers table can sort and search them like the shop-owner one" | platform owner, 2026-08-25 — `phase5/epics/E19.md` E19-S05 | the mirror image of the `shopOwner` row above, and refused for the same reason from the other side: `shopOwner` pays for its operator table in plaintext, and `user` was designed not to have that bill — every personal field on it is encrypted *because* nothing sorts, searches or paginates customers. The customers table added by E19 does not change that; it orders and filters on `registeredAt` and the status flags, which were never encrypted, and returns `login.email` without ever ordering or prefix-matching it. Making one more field queryable to add a column is how the collection loses the property, one column at a time |
| Drop `maxItems` from the `user` validator and keep the cap in `funUserAddressAdd` alone, "so the number lives in one place" | ADR-035 | the two copies do different jobs, and the validator's is the one that is *true*: it holds against a fixture, a script, a migration and a second service, none of which call the lib function. The service's copy buys the shape of the refusal — a 400 naming the limit instead of a 500 — and buys nothing else. Deleting the validator rule to remove a duplicated constant is how `itemCategory`'s depth cap ended up enforceable only by the one path that remembers to check (ADR-012), which that ADR records as a cost it had no choice about; here there is a choice |
| Make `user.addresses[].position` required, now that the account form can place one | platform owner, 2026-08-26 — `phase5/CUSTOMER_ACCOUNT_ADDRESSES.md` E07-S11 | the point is placed by a geocoder the customer can overrule and by a pin they drag, and the case that decides this is the address neither can resolve: a new building, a rural one, anything OpenStreetMap does not carry. Required means that customer cannot save an address they typed correctly, to satisfy a sort they never asked for. The accepted cost is the other side of it — an address with no point cannot be ordered by distance, and any feature that sorts by proximity has to treat a missing `position` as a real state rather than as bad data. Not the same question as `company.address.position`, which *is* required: a shop is a public listing on a map, and an operator or shop owner placing it is doing the platform's work rather than their own |
| Geocode an address server-side in `userAddressAdd` / `userAddressUpdate`, "so the point cannot be wrong or missing" | platform owner, 2026-08-26 — `phase5/CUSTOMER_ACCOUNT_ADDRESSES.md` E07-S11 | it puts a Nominatim round trip inside every address write, on a tier where the write is otherwise one `updateOne`, and it has no answer for the address the geocoder cannot find — the resolver would have to save without a point anyway, which is what the client already does with the customer watching. The client is also where the correction lives: a pin the customer drags is worth more than a lookup they never see |
| Gate `userDel` on `disabled` — refuse a suspended customer the close, "like every other write on the tier" | ADR-036 | the premise is wrong twice over. Only `funUserUpdatePwd` gates on `disabled` here, one lib function out of seven, and it does so because re-keying an account is taking it over — closing one is giving it up. And the gate would hand an operator a way to withhold an Art. 17 right by flipping one boolean, with no review, no recorded refusal and no expiry. Nothing is lost by leaving it out: the delete is soft (ADR-011), so the document, the personal data and `disabled: true` itself all survive the close. If `disabled` ever also means a legal hold, that is a new field with its own semantics, not this gate re-added |
| Loosen `sameSite: 'Strict'` to `'Lax'` or `'None'` to fix a cross-site redirect | ADR-033 | the cost is known and accepted — a return trip from an external site does not carry the session, and the customer lands logged out. `'Lax'` re-opens top-level-GET CSRF against the authorization services, and the value lives in `@axiumine/koa-utils` anyway, so this is not a change this workspace can make by editing itself |

## 5. Gaps

Decisions this platform still owes an ADR, once taken:

- **Where a shared secret is provisioned.** ADR-034 takes the Keygrip pair out of five `.env` files and
  leaves one `KEYGRIP_KEK` in their place, which is a smaller version of the same unanswered question,
  not an answer to it — `INTROSPECTION_CODE` and `REDIS_PASSWORD` are untouched and still have to be
  identical across nine files that nothing compares (`INFRA.md` §8 q8). Option E of ADR-034 — a secrets
  manager — is the destination, and it was blocked on ADR-032 saying where any of this runs.
  ⚠️ **That block is gone since 2026-08-28**: [`ADR-039`](./ADR-039-production-topology-cloudflare-app-host-trusted-datastore-segment.md)
  answers it — one application host behind Cloudflare, datastores on their own host — so option E is
  choosable now. The bullet stays open because nobody has chosen it: the nine files are still nine.
- ~~**Ordering.** Cart, order state machine, delivery, payment — no collection, no resolver, no design. ADR-009 records only that item has no price *because* of this gap. Needs its own ADR when the design starts.~~ **Closed 2026-08-27 — it is no longer a gap, and it got the ADR from the other side.** [ADR-038](./ADR-038-commerce-is-permanently-out-of-scope.md) records the platform owner's decision that the four are permanently out of scope, so the design this bullet was waiting on does not start. Struck rather than deleted because the wait is the reason the bullet was here for thirty-seven ADRs, and because the sentence it ends on — *needs its own ADR when the design starts* — is what ADR-038 answers. Everything the bullet asserts about the working tree is still true and stays true: no collection, no resolver, no design, and `item` still has no price.
- **Where the sixteen repos get published**, and under which org. No ADR yet — it is explicitly the user's undecided call (see [`docs/workflow.md`](../../../workflow.md), *Repo layout*). ⚠️ **This is git hosting, not the npm registry.** [`ADR-037`](./ADR-037-marketplace-common-is-published-to-npm.md) decides where one *package* ships — `@axiumine/marketplace-common` to npmjs — and closes nothing here; the two were conflated once, in `phase5/epics/E09.md` §6 — now [`phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md`](../../phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md) — which cited this bullet for a question ADR-015 §Risks had owned all along. Do not delete this bullet on the strength of ADR-037.
- ~~**Production topology — now owned by [`ADR-032`](./ADR-032-production-topology-owed.md), which records it as *owed* rather than answering it.** The edge itself is written down: `marketplace-nginx/` carries a vhost per hostname — apex, `shopowner.`, `admin.` — terminating TLS for all three and proxying eleven loopback upstreams (the nine backend services, the SSR renderer and Nominatim) while serving both SPAs and the SSR app's static output off disk. `marketplace-nginx/test/run.sh` exercises it in a container: `nginx -t` plus every behavioural assertion in `test/suite.sh`, including that both session cookies come back `Secure` from every endpoint that mints one. What no ADR records is where that instance *runs*: which host, whether anything sits in front of it, how the service ports are closed to everything but it — the nine bind the wildcard address by decision (ADR-022) — and where Redis and MongoDB sit relative to them, `marketplace-docker-DBs/` being dev-only by its own decision. Three audit findings are bounded by that answer and by nothing else: `INTROSPECTION_CODE` is reachable wherever a service port is (E13-S11), `refresh` is floodable with distinct garbage tokens (E14-S08), and the Redis leg is plaintext `redis://` (R45). ADR-032 names the owner and the date, and rules that until it is superseded **no control may be argued closed by appeal to a network boundary** — so the gap stays open here, deliberately, rather than being closed by an assumption.~~ **Closed 2026-08-28 — the topology is written, and this bullet is what it was written against.** [ADR-039](./ADR-039-production-topology-cloudflare-app-host-trusted-datastore-segment.md) answers all four questions the struck text lists: **Cloudflare** is the outermost hop and the origin refuses anything without its client certificate (`snippets/origin-pull.conf`, `ssl_verify_client on`); **one application host** carries nginx, the nine services, the SSR renderer and both SPAs' static output; **a cloud security group** closes every port but 443 from Cloudflare's ranges, which is what ADR-022's wildcard bind now sits behind; and **Redis and MongoDB run on a separate host on a private LAN segment** the platform owner has declared **trusted**. Struck rather than deleted because the three findings named above are the reason this bullet existed, and only two of them move: **R46** closes, E13-S11 and E14-S08 keep their controls unchanged, and **R45 stays open at 🟢 Low** — the Redis leg is still plaintext `redis://`, now crossing a segment declared trusted rather than a network nobody had described. What is *not* closed left this bullet for **R39**: node counts, sizing, supervision, secrets provisioning, CI/CD and backups.
