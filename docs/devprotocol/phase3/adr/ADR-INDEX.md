# ADR Index
# Marketplace

**Status:** baselined
**Version:** 1.31
**Date:** 2026-08-31
**Author:** adr-agent
**Changelog:**
v1.31 - 2026-08-31, later still: **[ADR-053](./ADR-053-the-shared-half-of-the-environment-is-one-file.md)
added — the shared half of the environment is one file, loaded by direnv.** `RISK_REGISTER` **R04** has been
🟠 High with no mitigation since it was raised, on a stated enabling condition: *"the ~15 shared env keys
across 9 services, every time one is provisioned by copy from an unrelated project"*. Measuring the committed
templates rather than assuming gives **twenty-one** such keys, each stored between seven and eleven times —
`REDIS_*` in ten repos, the `MONGO_TEST_*` accounts in eleven, `MONGODB_URI`, `CSFLE_*` and `DSN` in nine,
`UPLOAD_DIR` in eight, `KEYGRIP_KEK` in seven — so rotating one secret is up to eleven edits and nothing
checks that the eleven agree. They now live once, in `.env.shared` at the workspace root, exported by one
root `.envrc`. ⚠️ **The layer answers first and cannot be overridden** — `dotenv` never overwrites an
exported variable — which is why membership is decided by measurement: `DOMAIN` is excluded on one
disagreement (`127.0.0.1` in `marketplace-services-status`), and `PORT`, `NODE_ENV`, `QODANA_TOKEN` and the
three keys naming each suite's throwaway test database with it. ⚠️ **An empty key in the layer is inert** —
`.envrc` unsets the blanks, so the committed `env.shared` is safe to copy verbatim and a blank cannot shadow
a repo's working value. The sixteen committed `env` templates **keep every key**: they answer what a service
reads, not where the value comes from. §2 gains the row, §3 files it under Infrastructure and delivery, and
§4 gains two — the per-repo `.envrc` and the not-quite-identical key. **R04 does not close**: shipped with it
but deliberately not part of it is `assertEnvShape` (`marketplace-common` v4.2.0), which refuses a value of
the wrong *kind* at boot in all nine services and attacks the likelihood; the residual is a
plausible-but-incorrect value of the right shape in a genuinely per-repo key, and the row wants re-scoring
rather than retiring
v1.30 - 2026-08-31, later the same day: **ADR-034 amended a third time — the sweep the second amendment
added is resumable.** That amendment's cost list sent a half-finished sweep to the admin session console, one
account at a time, with no count of what was missed; the clause is superseded. `keygripRetire` is **not** made
retryable — it removes the key before it sweeps, so a second attempt answers 404 correctly — so the sweep gains
the retry instead: one account's failure is caught and counted rather than ending that tier and every tier after
it, the sweep answers `{ ended, failed, reason }` with `failed` a count and never an account id, and
**`keygripResweep`** runs the whole walk again from the admin panel. ⚠️ **It touches the keygrip record not at
all** — no read, no KEK, no compare-and-set — so no 404, no 409 and no race with a rotation, and it is safe to
press twice because `revokeAllSessionsForAccount` deletes an account's index key last. §2's status cell records
the third amendment and §4 gains the row refusing the retryable retirement. **R55** becomes `Mitigated`, not
closed (`RISK_REGISTER` v1.46): a sweep can still fail part way, and nothing presses the button for you
v1.29 - 2026-08-31: **ADR-034 amended a second time — a retirement ends every live session on the
platform.** The fail-open half of the propagation window was the one residual ADR-034 shipped with and
`RISK_REGISTER` carried as **R47**: between a `keygripRetire` landing and a lagging service adopting it,
that service still verifies cookies signed with the key just retired — 8 ms measured, five minutes if the
nudge is lost. Neither poll tuning nor a per-request version check could close it, so the close came from
the other side: `funKeygripRetire` now sweeps every session on the platform after its compare-and-set
write, walking the three account collections through the per-account session index (no `SCAN`, BCON-08
intact). The lagging holder verifies a signature over a session that no longer exists and answers 498, so
the window is zero and the request path pays nothing. ⚠️ **The retiring admin is not exempt** — §4 gains
the row saying why, and the §2 status column now records this amendment and the 2026-08-28 one it never
carried. R47 closes with it (`RISK_REGISTER` v1.44)
v1.28 - 2026-08-30, after that: **ADR-052 added — a session entrance is a page load too.** ADR-051 closed
both exits and left the entrance open, and the entrance is a real door on exactly one app: `marketplace-user`
links to `/login` from the header and the footer of every page, so a signed-in customer reaches the sign-in
form without a document load and the client that answers `AccountGate`'s `Me` — a query with no variables —
is the one that already holds the previous account. A successful sign-in now ends in
`window.location.assign('/account')`, one call site, in `LoginForm`. The token and the session store are
still written first, for the interval before the unload; a `leaving` flag holds the button disabled for the
length of the load, since `isSubmitting` drops the moment the handler returns. A `beforeLoad` guard was the
option refused: `/login` is server-rendered and the session is browser-only module state, so the guard would
have to decide where the answer does not exist. The pair is now one rule — a session boundary is a page
load, in both directions. **ADR-044 gains a *Still undecided* section**: whether an admin may be *suspended*
is the one lifecycle question left open, and it is recorded there.
v1.27 - 2026-08-30, after that: **ADR-051 added — a session exit is a page load.** Each app builds one urql
client per page load and gives it a document cache keyed by query and variables alone, so a sign-out that
cleared the token and the session and then navigated with the router left every cached result standing —
and a second sign-in inside the same page load could be served the first one's. The queries that decide it
take no variables at all: `shopOwnerCompanies`, which the loading screen probes the session with, and `Me`,
which the customer's account gate asks before it renders anything private. Both exits — the logout button
and `onSessionLost` — now end in `window.location.assign('/')`, six call sites across the three apps, and a
full load rebuilds every module rather than the one store somebody remembered. ⚠️ **This covers the exit
and not the entrance**: `marketplace-user` has no guard on `/login`, so a signed-in customer can still
reach the form by ordinary links and sign in as somebody else without a load — left open here, and closed
by ADR-052 above. Filed under **Frontend**, beside ADR-027. §4 gains one row.
v1.26 - 2026-08-30, after that: **ADR-050 added — the scrub stops at the account collections.** The
platform owner answered *no* to widening the day-30 scrub: it overwrites `user` and `shopOwner`, and
`company.contactPerson` / `company.administrator` are not in its reach. ⚠️ **This turns a gap into a
boundary.** The keep-list is derived by exclusion on two collections, so a third one holding a natural
person's name was an open question rather than a decision; it is a decision now, and widening the sweep to
close it needs a superseding ADR. The reasons are all three of the kind that do not soften: the two fields
are `required` on `company` so they cannot be unset, they name whoever the registration named rather than
whoever is closing an account, and `company` carries no `scrubbedAt` at all — its `deleted` stamp is
`funCompanyDelete`'s, a shop the owner removed, on a timeline of its own. Filed
under **Data model** beside ADR-041 and ADR-029 — it bounds a destructive write's reach over collections,
which is where that write is described. One consequence is recorded rather than hidden: a closed shop
owner's name can stay legible on a company after the account that held it is scrubbed. §4 gains one row.
v1.25 - 2026-08-30, last that day: **ADR-049 added — the admin tables offer the four account states, on
both tiers.** It supersedes nothing and adds no field: `disabled` and `deleted` have always been
independent, and the two screens that list accounts offered fewer combinations than the two levers can
produce. `/customers` had two of the four, so a closed customer was unreachable and a customer suspended
**and then** closed belonged to no filter at all — the pair of levers could remove a row from the only
table that lists it. `/shopOwners` had none: `shopOwnersActiveTbl` hard-wired both flags absent, so a shop
owner left the table at the moment the admin acted on them. Both now filter by Active, Suspended, Closed
and Closed & suspended, out of one table of four in `marketplace-admin/src/lib/accountStatus.ts` that
drives both dropdowns, both `?status=` route schemas and both status columns. ⚠️ **The state crosses the
wire as two booleans and never as a status name**, which is the index constraint rather than a style
choice: `user.tbl_active_registeredAt` and all four `shopOwner.tbl_active_*` lead with `{deleted,
disabled}`, and an *either* — an *all accounts* view, an unchecked *include closed* box — unbinds a leading
field and turns the sort into a blocking in-memory one. Filed under **Frontend**: what an account may be
was decided by ADR-044, ADR-046 and ADR-048, and what changed here is what the admin app can show of it.
One row in §2, one number in §3's **Frontend** line, two rows in §4. It closes an open question about the admin tables' arrival state (ADR-049)
— the arrival state is Active and a hidden account is reached by naming its state, never by
being greyed in place — and it is the frontend half of the same parity ruling ADR-048 built the services
on, *"admin must act on shop owners and on customers in the same way"*. **No migration**: all five indexes
already lead with the pair the filter binds
v1.24 - 2026-08-30, last that day: **a false statement in an ADR is deleted and the text rewritten as
though it had been correct from the start** — platform owner, *"delete false ADR statements, rewrite ADR as
write correctly from day 0"*. The convention until then was to strike the sentence and append a dated
pointer, which had accumulated across seven ADRs; every one of them is rewritten and the corpus now holds
no `~~struck~~` text and no *"this stopped being true on"* note. ⚠️ **The immutability rule is unchanged
and this does not touch it**: a *decision* still changes only by a new ADR with `Supersedes` filled in.
What changed is what happens to a *fact* that stopped being true — it is simply made true, and the record
of the change lives here and in the `Superseded by` fields rather than in the body of the page. §1 gains
the rule. Rewritten: **ADR-011** (the amendment reads as the record of a reversed decision, in the past
tense), **ADR-015** (the bridge half likewise; the by-name consumption and the licence half are what remain
in force), **ADR-034**, **ADR-036** (both §Risks bullets now state live rules), **ADR-037** (property 2
states the rule ADR-047 left it in), **ADR-041**, **ADR-045** and this index's §5, where four closed gaps
become one line each instead of a struck paragraph
v1.23 - 2026-08-30, later the same day: **ADR-048 added — an admin closes a customer account, and the
retention clock starts once.** It supersedes nothing: it fills the hole ADR-036 recorded in its own
§Consequences and left a warning beside, on the platform owner's ruling that *"admin must act on shop
owners and on customers in the same way"*. One row in §2, one name in §3's **Identity and access** line,
two rows in §4. **The warning was answered rather than overtaken**, so ADR-036's bullet states the answer
as a live rule: an admin closing somebody else's account is not a data-subject right, and
ADR-048 keeps the two apart by keeping suspension and closure from ever writing each other's fields rather
than by making the admin's closure a weaker one. ⚠️ **The build also fixed something nobody had asked
about.** Diffing the two tiers to obey the parity instruction found `funUserDel` reading the document and
then writing it, so two closes fired at once could both stamp `deleted` and push the day-30 overwrite
thirty days out — the erasure ADR-041 measures and ADR-046 bounds. It is a guarded write now on both tiers,
and its 500 branch is gone with the second query that produced it
v1.22 - 2026-08-30: **ADR-047 added — a change to `marketplace-common` ships as a published release, and
`deploy-local.sh` is deleted.** It is the fifth supersession in this index and the first to reverse a
property of a decision this index called *partial on purpose*: ADR-037 kept the local-deploy bridge alive
in its §Decision property 2, and the platform owner ended it four days and two major releases later —
*"never use `./deploy-local.sh` in your development, always publish the package"*. ADR-015 loses the last
half it still governed except the licence one; ADR-037 keeps everything but property 2 and is what ADR-047
stands on. Both are corrected in place — ADR-015's bridge half in the past tense, ADR-037's property 2
restated in the form ADR-047 left it. One row in §2, two status changes, one name in §3's **Build and quality gates** line, one row in §4. **The reversal is
recorded as an inversion, not a mistake**: property 2 described what deletion does perfectly and read the
sign backwards — a consumer running the last *published* build is the state to want, because it is the only
one a lockfile names or a stranger can reproduce
v1.16 - 2026-08-28, later still: **three rows added to §4**, carrying three refused session-revocation
designs that no other document holds: the **lazy prune** the index's per-field `HEXPIRE` replaced, the
**"revoke all but me"** exemption a credential-change teardown does not grant, and the **`familyId`/cap
fields** the index value does not carry. Each is a platform-owner decision with a dated reason, recorded in
full in `phase5/SESSION_TERMINATION.md` §3.1, and each is the kind a later reader re-proposes precisely
because the shipped code looks arbitrary without it.
v1.15 - 2026-08-28, later the same day: **two rows added to §4**, carrying two refused token-handling
designs. The first row carries the two rejected session-cap designs — the `Tier`-keyed 7/30/90 gradient and
the fallback uniform seven — that lost to the checkbox split
(`SESSION_CAP_DAYS_DEFAULT`/`SESSION_CAP_DAYS_REMEMBERED`); the standing refusal of a `Tier`-keyed map
itself stays in `sessionLifetime.mts`'s docblock and is not repeated here. The second row carries the
dropped cached-successor-pair ("grace cache") design for the refresh race: its first reason (a replayable
credential as a Redis value) already stands in `throwRefreshRaceRetry.mts`'s docblock, and its second — no
implementable path, citing `authenticatedAuthorizationHandler.mts:26-51` and `refresh.mts:35` — is recorded
nowhere else and is written here in full, correcting an earlier citation of `refresh.mts:19-25`, the
comment block above that call rather than the call itself. No ADR, §2 row or §3 count
changed
v1.0 - 31 decisions, one per architectural choice this platform stands on
v1.1 - ADR-032 (production topology, recorded as owed) and ADR-033 (`SameSite=Strict` on the refresh
cookie) added from the token-handling security audit; two rows added to §4, and §5's topology gap now
points at the ADR that owns it
v1.2 - ADR-034 added: the Keygrip pair leaves the five `.env` files for one wrapped record in Redis, a
service that cannot unwrap it refuses to boot, and rotation becomes an admin mutation. Three rows in
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
it; it is accounted for here. The second is its consequence: the admin surface that decision leaves
missing reads clear fields only, so the temptation it creates — make a name or a
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
(`phase5/CUSTOMER_ACCOUNT_ADDRESSES.md` §4, *Place an address on a map*), and the obvious follow-on — now that a customer can place an address,
require the point — was offered and refused. It stays optional, so §4 carries the temptation. No ADR: the
map is the shipped stack used in one more place, and what was decided is one field's optionality

v1.7 - 2026-08-26: ADR-036 added — `userDel` does not gate on `disabled`, so a suspended customer can
still close their own account. One row in §2, one number in §3's **Identity and access** line, one row in
§4. Corrected with it: the §4 row from 2026-08-25 ended "nothing writes `user.disabled`, so an admin has
no lever after registration either", which stopped being true the same day — `userUpdateStatus`
is that lever, and this ADR is the question its arrival created

v1.8 - 2026-08-26: **ADR-011 amended in place** — the first and only amendment in this index, and the
owner's call rather than the convention's. The 30-day retention purge decided in `phase1/NFR.md` open
question 6 shipped as `user.deleted_ttl`, and `userRegister` now destroys a closed account so its address
can be registered again. Both remove documents, which ADR-011 was being read as forbidding platform-wide.
A new ADR would have left a reader of ADR-011 with a rule that is no longer true and no sign of it, so the
exception was written where the rule lives. ⚠️ **Both mechanisms this entry records were gone three days
later — see v1.18 and v1.21 below.** The amendment is superseded, `deleted_ttl` is dropped and a
re-registration restores the account it used to destroy; the entry stays as written because it was true on
its date. §1 records why the immutability rule was set aside here, the
§2 row carries the amended status, and §4 gains the `partialFilterExpression` refusal the amendment turns
on. ADR-036's §Risks bullet saying the purge does not exist was corrected with it. **No decision was
reversed:** row B still stands for `company`, `shopOwner`, `item` and `itemCategory`, and option C —
a partial unique index — is refused again in the amendment

v1.9 - 2026-08-26, last that day: **ADR-037 added — `@axiumine/marketplace-common` is published to npmjs,
the platform owner publishes it personally, and `deploy-local.sh` is not deleted** (that last half was
reversed on 2026-08-30 by ADR-047 — see v1.22). It is the first
supersession in this index and it is **partial on purpose**: ADR-015 said it would be "superseded, not
revised" on the day the owner decided to publish, but ADR-015 also carries the GPL-3.0-or-later licence
decision and the `deploy-local.sh` bridge, neither of which the registry touches and neither of which is
recorded anywhere else. Marking it wholly superseded would have orphaned a licence decision, so its §2 row
and its header read *superseded in part*, and the sentences the publish falsified are corrected in place —
the 404 stays as the dated premise its whole argument reasons from. One row in §2,
one name in §3's **Build and quality gates** line, one clarifying clause in §5. **The header was stale at
1.7 while this changelog already carried a v1.8**, so this entry is v1.9 and the header now agrees with it;
no entry was skipped. §5's git-hosting gap is **not** closed by ADR-037 and gains a clause saying so — where
the sixteen *repositories* live is a different question from which *registry* one npm package ships to, and
ADR-037 §Compliance lists conflating them as a violation
v1.10 - 2026-08-26: the stale "168 behavioural assertions" count replaced by a citation of `marketplace-nginx/test/suite.sh` itself. The number was stale by 67 — the suite ran 235 assertions before 2026-08-26 and 242 after — and a count written into prose goes stale silently every time an assertion is added. Nothing measured or decided changed. Four accepted ADRs carried the same number and were corrected with it — **ADR-018** §Consequences, **ADR-030** §Consequences (which claimed every pushed revision had had 168 assertions run against it, a false gate claim), **ADR-032** §Context and this index §5. No ADR's decision, status or consequence changed; only a number that had stopped being true. ⚠️ **Renumbered 2026-08-27.** This entry was written as `v1.6`, which another entry in this changelog already held — two different edits under one number, and a citation of "ADR-INDEX.md v1.6" could not be resolved to one of them. It takes the next free number instead. It is placed at the end, which is where this oldest-first list now carries it — it had been sitting between `v1.4` and `v1.5`, out of sequence as well as out of number. Nothing in the entry, and nothing in the document, changed with the renumber; no other document cited either number.

v1.11 - 2026-08-27: **ADR-038 added — cart, order, delivery and payment are permanently out of scope**, decided by the platform owner when asked who would sign off a first commerce schema — the answer being that none is coming. It is the ADR §5 said was owed "when the design starts", arriving because the design does not start, so the **Ordering** gap leaves §5 rather than being answered inside it. One row in §2, one number in §3's **Catalogue** line, and two rows in §4 — the existing `price` row keeps ADR-009 and gains ADR-038, because the reason changed from *no design yet* to *no design ever*. ADR-009 is **not** superseded: its decision is unchanged and its title's condition simply never arrives, which its own header now records. Corrected in the same pass: §1 said "no supersession exists", which stopped being true on 2026-08-26 when ADR-037 superseded ADR-015 in part — the sentence predates that row and nothing but the sentence was wrong. **ADR-010 also carries a dated note now** — its §Context called the cart/order model absent *"yet"*, which ADR-038 turns into absent permanently; its decision, taken on atomicity grounds that never depended on a consumer arriving, is untouched
v1.12 - 2026-08-27, later the same day: **ADR-038 gains a dated note of its own** — its §Context and §Consequences both cited `phase2/EVENT_STORMING.md` **§5** open question 4, and that question is in **§6**; §5 is the hotspot table. Both pointers now read §6, the correction is recorded at the foot of the ADR rather than made silently, and nothing it decides changed. No ADR status, decision or consequence moved.

v1.14 - 2026-08-28: **ADR-039 added — the production topology is decided, and ADR-032 is superseded.** The platform owner answered the four questions ADR-032 recorded as owed — Cloudflare is the outermost hop, one application host carries nginx and the twelve processes, a cloud security group closes every port but 443, and the Redis cluster and MongoDB replica set live on a separate host on a private LAN segment — and declared that segment **trusted**. One row added to §2, ADR-032's *Superseded by* cell filled in, one number added to §3's **Infrastructure and delivery** line, and §1's supersession count moves from one to two. §5 changes twice: the **Production topology** bullet is struck as answered, and the **shared secret** bullet loses the clause that blocked it — ADR-034's option E can be chosen now that a document says where any of this runs, though choosing it is still owed. ⚠️ **ADR-032's rule is narrowed, not deleted**: a boundary may be cited as a second layer for the legs ADR-039 describes and never as the whole argument, which is why §4's row against unwrapped Keygrip keys keeps its reasoning word for word. R46 closes in the risk register; **R45 does not** — the Redis leg is still cleartext and drops to 🟢 Low instead.

v1.15 - 2026-08-28, later the same day: **ADR-040 added — the secrets-manager vendor choice is delegated to the adopter, permanently.** v1.14 unblocked ADR-034's option E and said choosing it was still owed; asked to choose, the platform owner ruled that a blueprint cannot — *"Vault vs SOPS vs AWS KMS vs GCP depends on where the adopter deploys"* — so the decision leaves this corpus rather than being taken in it, the way ADR-037 already sends hosting to the adopter and ADR-038 sends commerce out of scope. One row in §2, one number in §3's **Identity and access** line, and a second dated clause on §5's **shared secret** bullet. ⚠️ **That bullet is narrowed, not struck, and §1's supersession count does not move**: ADR-034's decision is untouched — option D is still what this platform does — and only its *revisit condition* changes address, from an event in this tree to an event in an adopter's. The deliverable that replaces the integration is [`docs/PRODUCTION_HARDENING.md`](../../../PRODUCTION_HARDENING.md), the first adopter-facing page in the tree: three shared values, their swap points by file and line, and the invariants a swap must not break. In the risk register **R50** becomes `Accepted (see §5)` with its score and residual unchanged, and **R39** keeps its status and its five open items — only the wording of what is owed on secrets provisioning changes.

## 1. How to use this index

ADRs are immutable once accepted. Never edit one. To change a decision, write a new ADR and set its
`Supersedes` field, then flip the old one's `Superseded by`.

⚠️ **A statement that has become false is deleted, and the page rewritten as though it had been correct
from the start** — platform owner, 2026-08-30. No `~~struck~~` sentence, no *"this was true until"* note,
no paragraph explaining what an earlier paragraph used to say. **This is not licence to revise a
decision** — the rule above is untouched, and a decision changes only by a new ADR. It is about *facts*: a
fact that stopped being true is simply made true, and a decision that was superseded is written in the past
tense with its successor named in the header. A reader needs what holds now and which ADR holds it; the
record of the change is in this index's changelog and in the `Supersedes`/`Superseded by` fields, where it
can be read without wading through the version that is wrong. Every ADR below is `accepted`, and five
supersessions exist — ADR-037 supersedes ADR-015 *in part*, ADR-039 supersedes ADR-032, also in part (the
topology it recorded as *owed* is now written, while the rule it made about network boundaries survives in
narrowed form), and ADR-041 supersedes ADR-011 in part: its 2026-08-26 Amendment only, leaving the main
body and its refusal of Option C standing word for word. ⚠️ **A fourth landed the same day and is the
widest of them**: ADR-046 supersedes **ADR-041, ADR-042 and ADR-045, each in part**, on one ruling of the
owner's — the thirty days are an undo window — so three decisions taken that morning were narrowed that
afternoon by the person who took them rather than by a later reading. Nothing in the three is withdrawn:
closure still stamps, a registration still lives in Redis until the link is clicked, an inactive owner
still goes off-air. What changed is that `deleted` can be cleared. §2 says so in all nine rows. ⚠️ **A fifth landed on
2026-08-30 and is the only one that reverses rather than narrows**: ADR-047 supersedes **ADR-015 and
ADR-037, each in part**, deleting `deploy-local.sh` — the bridge ADR-015 built while nothing was on a
registry and ADR-037 deliberately kept afterwards. Nothing about the registry, the publisher or the gates
is withdrawn; what changed is that there is no longer a second way for code to reach a consumer. Every other
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

⚠️ **That amendment was itself superseded on 2026-08-29 — by a new ADR, the ordinary way.**
[ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md) reverses it: nothing on this
platform is destroyed, `user` included, and the address a closed account holds is freed by overwriting the
value rather than by removing the document. ADR-011 keeps the amendment as the record of a decision that
was taken and reversed — written in the past tense, with ADR-041 named in its header — which is the
convention working as intended, and is why the exception above did not have to be granted a second time.

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
| ADR-011 | Soft delete via `deleted` date, global uniques stay occupied | accepted, **amended 2026-08-26**, **that amendment superseded 2026-08-29** — nothing is destroyed, on any collection | 2026-08-04 | — | ADR-041, in part | Data model |
| ADR-012 | itemCategory depth capped at two, in the resolver, admin-only writes | accepted | 2026-08-05 | — | — | Catalogue |
| ADR-013 | English-only naming, with no carve-out | accepted | 2026-08-04 | — | — | Data model |
| ADR-014 | Migrations immutable, `$jsonSchema` shapes shared in lib/schemas/ | accepted | 2026-08-04 | — | — | Data model |
| ADR-015 | marketplace-common: package-name consumption, unpublished, deploy-local.sh bridges | accepted, **superseded in part twice** — 2026-08-26, the publication half; 2026-08-30, the bridge half. The GPL-3.0-or-later licence decision is what still stands here | 2026-08-04 | — | ADR-037 and ADR-047, each in part | Build and quality gates |
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
| ADR-034 | Keygrip keys live in Redis, wrapped under a KEK, boot fails on disagreement | accepted, **amended 2026-08-28** — the retirement clock runs from a key's demotion, not from its minting; **amended 2026-08-31** — a retirement ends every live session on the platform, the retiring admin's included; **amended again 2026-08-31** — that sweep tolerates one account's failure, reports `{ ended, failed, reason }`, and is re-runnable on its own through `keygripResweep` | 2026-08-12 | — | — | Identity and access |
| ADR-035 | `user.addresses` capped at six, in the validator and in the write that appends | accepted | 2026-08-26 | — | — | Data model |
| ADR-036 | Erasure is not something the platform suspends: `userDel` does not gate on `disabled` | accepted | 2026-08-26 | — | — | Identity and access |
| ADR-037 | `@axiumine/marketplace-common` is published to npmjs; the owner publishes, `deploy-local.sh` stays | accepted, **superseded in part 2026-08-30** — §Decision property 2 only, the half that kept the script | 2026-08-26 | ADR-015, in part | ADR-047, in part | Build and quality gates |
| ADR-038 | Cart, order, delivery and payment are permanently out of scope | accepted | 2026-08-27 | — | — | Catalogue |
| ADR-039 | The production topology, decided: Cloudflare, one app host, datastores on a trusted segment | accepted | 2026-08-28 | ADR-032, in part | — | Infrastructure and delivery |
| ADR-040 | The secrets-manager vendor choice is the adopter's, not this blueprint's | accepted, **amended 2026-08-28** — the KEK decode is one site, not three | 2026-08-28 | — | — | Identity and access |
| ADR-041 | Nothing is destroyed: closure is a stamp, retention expiry overwrites the personal data in place | accepted, **superseded in part 2026-08-29** — the thirty days are an undo window | 2026-08-29 | ADR-011, in part — the 2026-08-26 Amendment | ADR-046, in part | Data model |
| ADR-042 | A registration lives in Redis until the link is clicked; no account document exists before then | accepted, **superseded in part 2026-08-29** — the confirmation restores a closed holder instead of scrubbing it | 2026-08-29 | — | ADR-046, in part | Identity and access |
| ADR-043 | The pending registration carries the destination collection's own field encryption | accepted | 2026-08-29 | — | — | Data model |
| ADR-044 | Suspension names an actor and a reason; the database enforces presence, the service enforces length | accepted | 2026-08-29 | — | — | Identity and access |
| ADR-045 | An inactive shop owner takes the storefront off-air; only the owner puts it back | accepted, **amended 2026-08-29** — the cascade reaches `item`, fires from either tier, and gains a bulk control; **superseded in part the same day** — a closed owner returns and re-enables | 2026-08-29 | — | ADR-046, in part | Catalogue |
| ADR-046 | The retention window is an undo window: re-registering at the same address restores the account | accepted | 2026-08-29 | ADR-041, ADR-042 and ADR-045, each in part | — | Identity and access |
| ADR-047 | A change to `marketplace-common` ships as a published release; `deploy-local.sh` is deleted | accepted | 2026-08-30 | ADR-015 and ADR-037, each in part | — | Build and quality gates |
| ADR-048 | An admin closes a customer account, and the retention clock starts once | accepted | 2026-08-30 | — | — | Identity and access |
| ADR-049 | The admin tables offer the four account states, on both tiers | accepted | 2026-08-30 | — | — | Frontend |
| ADR-050 | The scrub stops at the account collections | accepted | 2026-08-30 | — | — | Data model |
| ADR-051 | A session exit is a page load | accepted | 2026-08-30 | — | — | Frontend |
| ADR-052 | A session entrance is a page load too | accepted | 2026-08-30 | — | — | Frontend |
| ADR-053 | The shared half of the environment is one file at the workspace root, loaded by direnv | accepted | 2026-08-31 | — | — | Infrastructure and delivery |

## 3. By area

**Identity and access** — ADR-002, ADR-003, ADR-004, ADR-005, ADR-006, ADR-033, ADR-034, ADR-036, ADR-040,
ADR-042, ADR-044, ADR-046, ADR-048

**Data model** — ADR-007, ADR-010, ADR-011, ADR-013, ADR-014, ADR-029, ADR-035, ADR-041, ADR-043,
ADR-050

**Catalogue** — ADR-008, ADR-009, ADR-012, ADR-038, ADR-045

**Frontend** — ADR-018, ADR-019, ADR-020, ADR-021, ADR-027, ADR-049, ADR-051, ADR-052

**Build and quality gates** — ADR-015, ADR-016, ADR-017, ADR-023, ADR-024, ADR-025, ADR-026, ADR-030,
ADR-037, ADR-047

**Infrastructure and delivery** — ADR-001, ADR-022, ADR-028, ADR-031, ADR-032, ADR-039, ADR-053

## 4. Decisions deliberately NOT re-opened

| Temptation | Settled by | Why not |
|---|---|---|
| Give a sub-repo its own `.envrc`, so it can add to the shared layer | [ADR-053](./ADR-053-the-shared-half-of-the-environment-is-one-file.md) | direnv loads the **nearest** `.envrc` walking up the filesystem and does not stop at a git boundary, so a second one does not extend the root layer — it **replaces** it for that subtree, silently, and every shared value the sub-repo did not repeat simply vanishes. `source_up` makes it work and makes sixteen more files to keep honest, to solve a problem the single root file does not have. The root `.envrc` is already in force in all sixteen repos; a repo that needs a value nobody else has puts it in its own `.env`, which is what that file is for. Violation looks like `find . -name .envrc` returning anything but `./.envrc` |
| Add one more key to `.env.shared` because it looks the same everywhere | [ADR-053](./ADR-053-the-shared-half-of-the-environment-is-one-file.md) | the layer is exported and `dotenv` never overwrites an exported variable, so a key here is not a default a repo can override — it is a value a repo can no longer change. `DOMAIN` looks shared in ten templates and differs in one (`127.0.0.1` in `marketplace-services-status`); `MONGO_TEST_DB`, `MONGO_TEST_AUTH_ADMIN` and `MONGO_TEST_CONN_STRING` look shared because the templates ship them empty, and sharing them would have two suites drop each other's database in parallel with no error. Membership is decided by measuring the real files, which is what `scripts/env-shared-migrate.sh seed` does — it omits any key the repos disagree on and names it with a count. Violation looks like a `⚠️ KEPT` line from `strip`, or a repo that quietly stopped being able to point somewhere else |
| Bring back a local-deploy shortcut for `marketplace-common` — a script, an alias, a `yarn link`, a `file:` path, or an `rsync` in someone's shell history | [ADR-047](./ADR-047-a-common-change-ships-as-a-published-release.md) | it is ten lines to recreate and it costs the one property the registry was published for. A copied build has no version, no integrity hash and no `yarn.lock` entry, so it is reproducible on exactly one machine — and the next `yarn install` in that consumer silently puts the released tarball back over it, making "which build is this running?" a question about command order. ADR-037 §Decision property 2 argued the other way and was reversed by the platform owner on 2026-08-30 in his own words, *"never use `./deploy-local.sh` in your development, always publish the package"*: the gap between an edit and a release is closed by cutting the release, and a patch release costs nine gated steps and no consumer left running code nobody else can obtain. Violation looks like a `node_modules/@axiumine/marketplace-common` whose contents do not match the version its lockfile names |
| Merge the three authorization services into one | ADR-006 | dispatching on a tier read from the session is the pattern ADR-002 rejects; one `process.exit(1)` for three tiers is an availability cost paid by customers |
| Fold `logout` back into the three `*-authenticated-authorization` services, or add a tier-named `adminLogout`/`shopOwnerLogout`/`userLogout` | ADR-005 | the resolver reads no `tier` and opens no collection, so three copies could never diverge — it is one `del` per key either way — while each copy pays the full CON-08 gate cost (lint, 100% coverage, mutation 100, Qodana) for a failure isolation session teardown has no use for; it also reintroduces the tier-dispatch pattern ADR-002 rejects. Stated as a standing boundary in `phase5/SESSION_TERMINATION.md` §4, *Merging BC-02 into BC-01 stays rejected*, which is what a PR proposing it has to answer. Violation looks like a `logout*.mts` appearing under any authorization service's `schema/mutations/`, or `assertTier` appearing inside `marketplace-dev-authenticated-logout/src/` |
| Per-tier `REDIS_KEY` prefixes | ADR-004 | breaks the single logout service (ADR-005), which finds a session by token content alone; the tier assertion is the layer that holds even if a prefix is reused by mistake |
| Add a `role` field / permission enum | ADR-002 | role = which collection you authenticate against, by design; a role field duplicates that |
| Add a shop collection | ADR-007 | a shop is a company; a separate shop collection splits one record in two and puts the storefront fields on the wrong side of the split |
| Add a `price` field to `item` | ADR-009, ADR-038 | there is nothing to buy and there never will be — ADR-038 makes ADR-009's "until ordering is designed" permanent, so the four decisions a price drags behind it (currency, precision, VAT, discount) are not pending, they are moot. `price` on `item` is a banned term in `phase2/UBIQUITOUS_LANGUAGE.md` §19 |
| Design or build cart, order, delivery or payment — a schema, a mutation, a state machine, a checkout sequence diagram, or "a first small step" toward any of them | ADR-038 | permanently out of scope by the platform owner's decision, 2026-08-27. The blueprint demonstrates multi-tenant identity, tenancy and catalogue; a checkout demonstrates none of that a second time. The four stay named in `BOUNDED_CONTEXT.md` BC-11, `UBIQUITOUS_LANGUAGE.md` §18 and `EVENT_STORMING.md` §2.9 so they are recognisable enough to refuse — presence is not a plan. Re-opening needs an ADR superseding ADR-038, not a story |
| Add `sparse` or a `partialFilterExpression` to `login.email_unique` so a closed account stops occupying its address | ADR-011, ADR-041 | refused twice, on the same three call sites both times — `tryLoginUser.mts`, `userForRegistration.mts` and the verify-email flow read an account by email with **no liveness filter**, so two documents holding one address make `findOne` return an arbitrary one of them: login becomes a coin toss and re-registration a race. `sparse` is the same mistake wearing a different hat — the index has none today, which is why an `$unset` of `login.email` would index as `null` and the *second* scrubbed account would collide. ADR-041 frees the address by changing the **value**, never by teaching the index to ignore a document. Violation looks like either option appearing on `INDEXES_LOGIN_EMAIL` in `lib/schemas/account.js` |
| Hard-delete a closed account — a `deleteOne`, or a TTL index that does it for you | ADR-041 | the platform kept exactly one hard delete for three days and retired it. The document is two things, a container for personal data and the record that the person existed, and only the first is erasable; on `shopOwner` removal was never available at all, since `company.idShopOwner` points at it. Retention is an **overwrite in place** at the same thirty days. ⚠️ A TTL index is a hard delete: it can only remove a whole document, never modify a field, which is also why no index can carry this out. Violation looks like `expireAfterSeconds` reappearing in `lib/schemas/`, or any `deleteOne`/`deleteMany`/`findOneAndDelete` under `BEs/dev/*/src/` |
| Create the account document at registration submit, and let the confirmation flip a flag on it | ADR-042 | it is what the platform did until 2026-08-29, and it is the root of three defects at once: an admin-closed shop owner revivable by an anonymous form post (`restartShopOwnerRegistration.mts` `$unset`ting `deleted`, `waitApprov` never restored), an address held **forever** by a registration nobody ever clicked, and one `deleted` field meaning both *closed* and *abandoned*. It also cannot honour the days-1-to-30 re-registration window without either a hard delete or two documents on one address. The account document has exactly one writer, the confirmation handler; abandonment is a Redis key expiring |
| Put one cleartext field in the pending registration record — "just for support", or to key it by `sha256(email)` | ADR-043 | the record is nothing but personal data, it crosses the `redis://` leg R45 still covers, and Redis persistence writes it to disk where a three-day TTL means nothing. Every field is encrypted exactly when its destination path is, with the destination's own algorithm and data key — so confirm is a byte copy, no re-encryption, and the plaintext never exists in memory for the trip. The deterministic ciphertext of `login.email` is already a stable lookup value; a digest would work and would silently cost that |
| Put `maxLength: 1000` on `disabledReason` in the validator, the way ADR-035 caps `user.addresses` | ADR-044 | it would mean the field had stopped being encrypted. An encrypted path declares `bsonType: 'binData'` and nothing else — no `pattern`, no `maxLength` — and a suspension reason is admin prose about a person, so ADR-029 applies to it. The database enforces **presence** (`dependencies: { disabled: ['disabledReason'] }`, which needs no access to the value) and the service enforces length. ADR-035 is not reversed: it governs wherever the validator can see the value, and here it cannot |
| Build a "restore my account" login, or any undo that starts from a session — ADR-046's Option B | [ADR-046](./ADR-046-the-retention-window-is-an-undo-window.md) | it cannot exist without weakening the gate it would have to pass. `checkUserAuthorizationDisDel` refuses a `deleted` account at login on all three tiers, and that is the same gate stopping a **suspended** account logging in — so an undo reachable from a session is a hole in the suspension lever as well. The platform owner ruled it in four words: *"re-registration is the undo, not a login"*. The door is the confirmation click, which already proves mailbox control, and there is exactly one of them. Violation looks like a `deleted` branch appearing under `marketplace-dev-public-authorization/src/lib/db/login/`, or any resolver that clears `deleted` |
| Scrub a closed account at the confirmation click, to "free the address" for the new registration | [ADR-046](./ADR-046-the-retention-window-is-an-undo-window.md) | it is what the code did on the morning of 2026-08-29, and it makes *close, then re-register an hour later* an instant self-erasure — defeating the only thing the retention window was still for. The address needs no freeing inside the window: the closed document **is** the account being handed back, `_id`, shops and all. `buildAccountScrub` has exactly one caller, the day-30 sweep, and a second one deletes accounts people are in the middle of recovering. Violation looks like `buildAccountScrub` imported anywhere under `marketplace-dev-public-resource/src/` |
| Skip `waitApprov` when restoring a shop owner, because the account was approved once already | [ADR-046](./ADR-046-the-retention-window-is-an-undo-window.md) | approval is not a property an account keeps through a closure. The platform owner made the gate the whole human checkpoint on this flow — *"the state of waitApprove is true, so admin can not approve the user if it is a problem"* — and it is the only defence against a recycled mailbox recovering somebody else's seller account. The customer tier has none, which is a known and accepted asymmetry. Violation looks like a restore path that does not `$set` `waitApprov` on the seller tier |
| Clear `disabled` as part of an undo, alongside `deleted` | [ADR-046](./ADR-046-the-retention-window-is-an-undo-window.md), [ADR-044](./ADR-044-suspension-names-an-actor-and-a-reason.md) | the two stamps mean opposite things: `deleted` is the subject giving the account up, `disabled` is the platform taking it away. An undo is performed by the subject, so one that lifted a suspension would be a sanction a person can clear themselves by closing their account and signing up again. A suspended-then-closed account comes back **still suspended**, and only `shopOwnerUpdateStatus` / `userUpdateStatus` lift it. Violation looks like `disabled` in the `$unset` of any registration path |
| Fold closure into `userUpdateStatus` — one admin mutation that can suspend *and* close, since both end in a revoke | [ADR-048](./ADR-048-an-admin-closes-a-customer-account.md) | it makes one mutation able to trade a sanction for a closure. `deleted` says whether the account is still held and `disabled` says whether it may be used; a caller that can write both can lift the second by setting the first, which is the laundering ADR-046 keeps the `disabled*` trio across an undo to prevent. The two are separate mutations on both tiers and neither writes the other's fields |
| Drop the `deleted: {$exists: false}` clause from a closure's filter — the write is idempotent, so a second close is harmless | [ADR-048](./ADR-048-an-admin-closes-a-customer-account.md), [ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md) | it is not idempotent: the value written is `new Date()`, so a second stamp moves the day-30 overwrite thirty days further out and postpones an erasure the first closure already promised. The clause is what makes the clock start exactly once, and it is what a 404 or a 410 on a re-close is telling the caller |
| Add a field naming which collection `deletedBy` points at, so the two closures can be told apart without knowing the tier | [ADR-048](./ADR-048-an-admin-closes-a-customer-account.md), [ADR-002](./ADR-002-role-is-authentication-collection.md) | there is exactly one possible actor collection per stamp, so the field's own name carries it. A second field saying which is a `role` field arriving by the back door |
| Collapse the two admin tables' four filters into a three-value status enum — Active, Suspended, Closed — because that is how a status reads | [ADR-049](./ADR-049-the-admin-tables-offer-the-four-account-states.md), [ADR-048](./ADR-048-an-admin-closes-a-customer-account.md) | `disabled` and `deleted` are independent and no path writes one while writing the other, so *closed after being suspended* is a state accounts reach the moment an admin uses both levers — and it is the one a three-value enum cannot name. Under it that account answers to no filter and is invisible on the only screen that lists it, which is the defect ADR-049 exists to remove. The enum also has to be mapped back to the two index-leading fields on both tiers, so it buys one argument and owes two translations. Violation looks like a `status`/`state` enum argument on `usersActiveTbl` or `shopOwnersActiveTbl`, or a fifth `ACCOUNT_FILTER` entry that is not a `{disabled, deleted}` pair |
| Add an *all accounts* option to either table, or an *include closed* checkbox alongside the filter | [ADR-049](./ADR-049-the-admin-tables-offer-the-four-account-states.md) | both mean *either* on a field that leads every index these tables page on — `{deleted, disabled, …}` on `user.tbl_active_registeredAt` and on all four `shopOwner.tbl_active_*`. An unbound leading field loses the index for the sort as well as the match, so the page becomes a blocking in-memory sort under a 32 MB cap on the two collections most certain to grow, and it fails by growing slow rather than by erroring. Greying closed rows in place is the same request wearing a different control: it needs the rows fetched. Violation looks like a nullable `disabled` or `deleted` argument on either table query, or a filter branch that omits one of them |
| Turn either session exit back into a router navigation — the reload is jarring and the stores are cleared anyway | [ADR-051](./ADR-051-a-session-exit-is-a-page-load.md) | the stores an app knows about are cleared; the urql client is not one of them. It is a module singleton with a document cache keyed by query and variables and by nothing that names a session, so a navigation leaves the previous session's `shopOwnerCompanies` and `Me` — both variable-free, both certain to collide — answering the next sign-in inside the same page load. A load rebuilds every module at once, including the next one somebody adds at module scope. Violation looks like `navigate({ to: '/' })` or `router.navigate` in `useLogout` or in an `onSessionLost`, on any of the three apps |
| Turn the sign-in back into a router navigation, or guard `/login` with a `beforeLoad` instead | [ADR-052](./ADR-052-a-session-entrance-is-a-page-load-too.md) | same cache, other direction. `marketplace-user` links to `/login` from the header and the footer, so the form is reachable without a load and `Me` — no variables — would answer the second customer with the first one's account. The guard is the shape that cannot work: `/login` is server-rendered and the session is browser-only module state, so a `beforeLoad` either never fires or fires on a guess the first client render contradicts. Violation looks like `useNavigate` in `LoginForm`, or a `beforeLoad:` in `routeOptions/login.tsx` |
| Widen the day-30 retention sweep to overwrite `company.contactPerson` and `company.administrator` when the owner who holds the company is scrubbed | [ADR-050](./ADR-050-the-scrub-stops-at-the-account-collections.md), [ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md) | the two fields are `required` on a validator with `additionalProperties: false`, so they cannot be unset and can only be falsified; they name whoever the registration named, which may be two people who never held an account here; and `company` has no `scrubbedAt` — its `deleted` stamp is a shop removal on a timeline of its own — so every run would re-derive its work from somebody else's document. The reach of a mass overwrite with no undo is a ruling, not a patch — the platform owner answered *no* on 2026-08-30. Violation looks like a third member on `ScrubbableTier`, a `Company` import in `retentionSweep.mts`, or any `$set` on `company` inside a retention path |
| Republish a shop owner's companies when their suspension is cleared — "restore what we took down" | [ADR-045](./ADR-045-an-inactive-shop-owner-takes-the-storefront-off-air.md) | suspending or closing an owner writes `published: false` on every company they own; clearing `disabled` writes **nothing**. The platform owner ruled it directly: *"un-suspending must not re-enable in the same place the companies, shopOwner must re-enable them by hands"*. The symmetry is the trap — restoring the flag means remembering its old value, which is the extra field this decision was chosen to avoid, and it would republish a shop the owner had deliberately taken down. ⚠️ **This does not reopen the 2026-08-14 ruling two rows above**: the cascade writes `published: false` only, never `true`, from a named status path — `companyUpdatePublished` is still the only writer of `true`, on either tier. ⚠️ **Amended the same day**: the cascade reaches `item` as well, it fires from *any* path that makes an owner inactive — the owner's own self-closure as much as an admin's — and restoring an owner writes to the `shopOwner` document **alone**, never to `company` and never to `item`. Violation looks like `published: true` in a status or closure path, an `ownerInactive`-style second flag on `company`, a missing item cascade, or a restore path that reads or writes either collection |
| Lower a coverage or mutation threshold | ADR-016 | the rule that outlived every other instruction here; a commit that needs a threshold lowered needs a test instead |
| Add `ignoreStatic` to a Stryker config | ADR-016 | masks real gaps; the survivor it appears to fix is usually a load-time mutant needing a dynamic import instead |
| Reintroduce vocabulary that presumes what is sold | ADR-008 | catalogue is domain-neutral on purpose; nothing in item/itemCategory presumes a product type and nothing should |
| Collapse the sixteen repos into a monorepo | ADR-001, ADR-031 | sixteen separate histories, hook sets, gates and Qodana projects would have to merge, and path-scoped CI would have to be invented to recover what repo boundaries give for free; ADR-031 answers reconstruction and cross-repo state without touching this |
| Put the sub-repo paths back in the parent's `.gitignore`, or commit a sub-repo's files into the parent | ADR-031 | the first makes `git submodule add` refuse the path and un-tracks fifteen gitlinks; the second dissolves the boundary ADR-001 set — a submodule pins a sub-repo, it never absorbs one |
| Give `marketplace-nginx` a `package.json` so its hooks self-arm | ADR-030 | it ships no JavaScript, so the file would exist to hold one line of git config and would invite a `lint`/`test` script with nothing behind it — the appearance of a gate, which is exactly what ADR-025 refuses to accept for `marketplace-services-status` |
| Move `marketplace-nginx`'s test suite into its `pre-commit`, or add a skip variable to its `pre-push` | ADR-030 | the suite needs a container engine and an image, and the ordinary commit there is one directive; a per-commit container run is how a hook gets `--no-verify`d out of habit |
| Encrypt `shopOwner.personalData.firstName` / `lastName` / `address.city` too | ADR-029 | they are the sort keys and `/^term/i` targets of the admin's shop-owner table, and neither CSFLE algorithm survives a sort or a prefix match; encrypting them makes that table silently wrong rather than slow |
| Switch another field to deterministic so it can be queried | ADR-029 | equal plaintext gives equal ciphertext, which is an equality oracle for anyone holding a read; the five deterministic fields are the ones a login or a verification link must *find*, and the list does not grow for convenience |
| Narrow the refresh cookie's `path` to the authorization routes | ADR-018 | the root scope is what makes `conf.d/30-cache.conf:32-35` work: nginx decides whether to cache a public catalogue page by whether the request carries `refresh_token`, and a cookie the browser withholds on that path makes a logged-in customer look anonymous — their personalised HTML is then stored and served to the next visitor (NFR-SE09). ADR-018's prose said "scoped to API paths" and was wrong about it; the sentence was corrected, the scope is not to be |
| Put the Keygrip keys in Redis unwrapped, or drop the `KEYGRIP_KEK` because "Redis is internal" | ADR-034 | the signature is the one layer a Redis read does not already defeat: an attacker holding the session tokens still cannot sign a cookie. Unwrapped keys hand that away. ADR-032 forbade arguing it back with a network boundary nobody had written down; ADR-039 (2026-08-28) writes one and keeps the refusal intact — the trusted segment is a second layer, never the whole argument, and it is the same segment the session tokens already cross in the clear |
| Give the mint to `marketplace-dev-authenticated-logout` because all three tiers already reach it | ADR-034 | that is the reason not to: it is the one service a customer's traffic touches on every tier, and minting a signing key is an admin act that belongs behind the Admin tier's own resource service |
| Reintroduce `KEYGRIP_KEY_1`/`_2` into an `env` template "as a fallback" | ADR-034 | a fallback is a second source of truth for the value the whole decision exists to make single, and it fails in the one shape that is invisible — a service that quietly boots on the env pair while the other four follow the record |
| Add a version or optimistic-lock field to `company` or `item`, or a read-then-compare precondition on either tier's update | platform owner, 2026-08-14 — `phase5/COMPANY_LEGAL_ENTITY.md` §6, `phase5/RISK_REGISTER.md` §5 (R29 Accepted) | two writers on one document is the design, and last writer wins is the accepted outcome: an admin unpublishes, the shop owner publishes again, and that is normal. Both tiers `$set` a whole enumerated object rather than a diff, so what was accepted is whole-card last-write-wins — a story proposing a lock reverses the decision instead of extending it |
| Put `published` back inside `GraphQLInputItem` or `GraphQLInputCompany`, "so a save can set it too" | platform owner, 2026-08-14 — `phase5/COMPANY_LEGAL_ENTITY.md` §4, *Publishing a company is a separate operation, on both tiers*; `phase5/CATALOGUE.md` §4, *Publishing is a separate operation, on both tiers* | that is the bug the split removed: a whole-object `$set` makes every save a write of the flag, so reopening a stale card republished what somebody had just taken down, without touching anything named publish. `itemUpdatePublished` / `companyUpdatePublished` are the only writers, one pair per tier, and `itemAdd`/`companyAdd` stamp `false`. The DB `$expr` `PUBLISHED_IMPLIES_LINKABLE` then makes save-then-publish two calls by construction |
| Give `itemCategory` a `published` flag or an `itemCategoryDisable`, "for symmetry with `item` and `company`" | platform owner, 2026-08-14 — `phase5/CATEGORY_TAXONOMY.md` §6 | the symmetry is the misreading: those two flags exist because a shop drafts its own public surface, and the taxonomy has no owner but the admin. Present or soft-deleted is the whole state space, and `itemCategories` filters `deleted` alone. Accepted with it: a category created before its items is public and empty until they arrive — the lever is when it is created, not a flag on it |
| Move the item picture into an `itemImage` collection, or drop the `image` field and derive the name from `_id` | platform owner, 2026-08-14 — `phase5/CATALOGUE.md` §4, *A ShopOwner gives an item a picture while adding it* | both were offered and both were refused: a collection is a second document to keep in step with an item that has exactly one picture, and deriving the name means an item with no picture is indistinguishable from one whose file is missing — the optional field *is* how a card knows to draw a placeholder. The value is a file name only — the item's own `_id` plus an extension — because `STATIC_FOLDER/item/<idCompany>/` is reconstructible from the document and a stored path is one more way to escape the directory |
| Add a second write path for `image` — a replace mutation, or the key back inside `itemUpdate` | platform owner, 2026-08-14 — `phase5/CATALOGUE.md` §4, *A ShopOwner gives an item a picture while adding it* | `itemAdd` being the only writer is what keeps the file name derivable from the document and the temp-store/insert/publish ordering in one resolver. Replacing a picture is unbuilt, not forgotten; it needs the orphaned-file question answered first, which the failed-publish-after-insert case already raises and nothing repairs today |
| Give `user.login.email_unique` a `partialFilterExpression` so a closed account stops occupying its address | ADR-011 §Amendment, 2026-08-26 — ⚠️ **the amendment is superseded, the refusal is not**: [ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md) refuses it again on the same three call sites, and frees the address by overwriting the value at day 30 rather than by removing the document | it is the wrong half of the problem and it breaks login. Three call sites look an account up by address with no liveness filter — `tryLoginUser`, `userForRegistration` and koa-utils' verify-email flow — so two documents holding one address makes `findOne` return an arbitrary one of them. The address is freed because the *document* goes, never because the index learns to ignore it: `user.deleted_ttl` removes it after 30 days and `purgeClosedUser` removes it sooner if somebody registers the address again. Option C was refused in 2026-08-04 for `company` and is refused again here for `user`, on a different reason each time |
| Hard-delete `company`, `shopOwner`, `item` or `itemCategory` "for consistency with `user`" | ADR-011 §Amendment, 2026-08-26 — ⚠️ **moot since 2026-08-29 and stronger for it**: there is no consistency to argue from, because [ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md) removed the `user` exception itself. Nothing on this platform hard-deletes | the amendment turns on one fact that only `user` has: **nothing references it**. `company.idShopOwner`, `item.idCompany`, `item.idCategory` and `itemCategory.idParent` all point at the other four, a removed document strands every one of those, and no retention period has been decided for any of them. `user`'s unique key is also a credential rather than a legal identity — the VAT argument in ADR-011's §Decision is about a key `user` does not have. Per collection, in that ADR, never by pattern |
| Give `user` a `waitApprov`-equivalent — an admin approval, a fraud check or a spam-signup hold between `userRegister` and the first login | platform owner, 2026-08-25 — `phase5/CUSTOMER_ACCOUNT_ADDRESSES.md` §6 | self-service is what a customer account *is*, and the asymmetry with `shopOwner` is what each account gets rather than how far either is trusted: clearing `waitApprov` publishes a shop on this platform's own domain, while a customer's account reads that customer's own document. The flag is also only half a feature — the other half is the admin queue behind it, and `user` is the one collection encrypted whole precisely because nothing sorts, searches or paginates it (ADR-029), so a moderation table over customers reverses that decision instead of extending this one. `emailVerify.valid` stays the only gate. Separate and not refused: at the time this was taken nothing wrote `user.disabled`, so an admin had no lever after registration either — `userUpdateStatus` became that lever the same day, and what it may reach is ADR-036 |
| Make `user.personalData.firstName` / `lastName` / `addresses[].city` deterministic or clear, "so the customers table can sort and search them like the shop-owner one" | platform owner, 2026-08-25 — the customers table, ADR-049 | the mirror image of the `shopOwner` row above, and refused for the same reason from the other side: `shopOwner` pays for its admin table in plaintext, and `user` was designed not to have that bill — every personal field on it is encrypted *because* nothing sorts, searches or paginates customers. The customers table does not change that; it orders and filters on `registeredAt` and the status flags, which were never encrypted, and returns `login.email` without ever ordering or prefix-matching it. Making one more field queryable to add a column is how the collection loses the property, one column at a time |
| Drop `maxItems` from the `user` validator and keep the cap in `funUserAddressAdd` alone, "so the number lives in one place" | ADR-035 | the two copies do different jobs, and the validator's is the one that is *true*: it holds against a fixture, a script, a migration and a second service, none of which call the lib function. The service's copy buys the shape of the refusal — a 400 naming the limit instead of a 500 — and buys nothing else. Deleting the validator rule to remove a duplicated constant is how `itemCategory`'s depth cap ended up enforceable only by the one path that remembers to check (ADR-012), which that ADR records as a cost it had no choice about; here there is a choice |
| Make `user.addresses[].position` required, now that the account form can place one | platform owner, 2026-08-26 — `phase5/CUSTOMER_ACCOUNT_ADDRESSES.md` §4, *Place an address on a map* | the point is placed by a geocoder the customer can overrule and by a pin they drag, and the case that decides this is the address neither can resolve: a new building, a rural one, anything OpenStreetMap does not carry. Required means that customer cannot save an address they typed correctly, to satisfy a sort they never asked for. The accepted cost is the other side of it — an address with no point cannot be ordered by distance, and any feature that sorts by proximity has to treat a missing `position` as a real state rather than as bad data. Not the same question as `company.address.position`, which *is* required: a shop is a public listing on a map, and an admin or shop owner placing it is doing the platform's work rather than their own |
| Geocode an address server-side in `userAddressAdd` / `userAddressUpdate`, "so the point cannot be wrong or missing" | platform owner, 2026-08-26 — `phase5/CUSTOMER_ACCOUNT_ADDRESSES.md` §4, *Place an address on a map* | it puts a Nominatim round trip inside every address write, on a tier where the write is otherwise one `updateOne`, and it has no answer for the address the geocoder cannot find — the resolver would have to save without a point anyway, which is what the client already does with the customer watching. The client is also where the correction lives: a pin the customer drags is worth more than a lookup they never see |
| Gate `userDel` on `disabled` — refuse a suspended customer the close, "like every other write on the tier" | ADR-036 | the premise is wrong twice over. Only `funUserUpdatePwd` gates on `disabled` here, one lib function out of seven, and it does so because re-keying an account is taking it over — closing one is giving it up. And the gate would hand an admin a way to withhold an Art. 17 right by flipping one boolean, with no review, no recorded refusal and no expiry. Nothing is lost by leaving it out: the delete is soft (ADR-011), so the document, the personal data and `disabled: true` itself all survive the close. If `disabled` ever also means a legal hold, that is a new field with its own semantics, not this gate re-added |
| Loosen `sameSite: 'Strict'` to `'Lax'` or `'None'` to fix a cross-site redirect | ADR-033 | the cost is known and accepted — a return trip from an external site does not carry the session, and the customer lands logged out. `'Lax'` re-opens top-level-GET CSRF against the authorization services, and the value lives in `@axiumine/koa-utils` anyway, so this is not a change this workspace can make by editing itself |
| Key the session cap on `Tier` — Admin 7 days, ShopOwner 30, User 90 — or fall back to one uniform seven days for all three | platform owner, 2026-08-10 — `report/token-handling-security-audit.md` §3.4 | both were the drafted alternatives to the cap actually shipped, and both lost to splitting on the control the user operates instead: an unchecked login is a shared-device login and dies overnight (one day), a checked one is the thirty days every login form already implied. A `Tier`-keyed map was the harder refusal — three entries holding numbers a mutant could swap with no test able to tell, so mutation score 100 becomes reachable only through a suppression this workspace does not allow — and that standing refusal is carried in full by `BEs/marketplace-common/src/others/sessionLifetime.mts`'s docblock, not repeated here. The drafted numbers themselves — Admin 7 / ShopOwner 30 / User 90, and the fallback uniform seven — are recorded nowhere else, the record that held them being deleted the day this row was added |
| Cache the winning refresh pair under a Redis key (`${REDIS_KEY}grace:${sha256(token)}`) and replay it to the race's loser, instead of returning a retry | platform owner, 2026-08-10 — `report/token-handling-security-audit.md` §3.4 | dropped for two independent reasons. The first — a cached pair is a directly replayable credential stored as a Redis *value*, which is exactly what the dependency and advisory scanning pass (`phase3/SECURITY_AUTH.md` §3.6) removed from this platform — is carried in full by `throwRefreshRaceRetry.mts`'s docblock. The second is recorded nowhere else: the design had no implementable path. `resolveAuthorizationSession` runs inside the koa middleware (`authenticatedAuthorizationHandler.mts:26-51`), takes no `ctx` and returns `TAuthorizationSession \| null`, so it cannot call `setLoginCookies`; and `refresh.mts:35` calls `refreshSessionTokens` unconditionally in all three authorization services (an earlier citation pointed at `19-25`, the comment block above the call, and has drifted since), so a "grace hit" would have minted a third pair regardless. The retry needs neither call: the middleware throws before any resolver runs, and by the time the client retries its cookie jar already holds the winner's `Set-Cookie` |
| Replace the index's per-field `HEXPIRE` with a lazy prune on read — "check whether each session key still exists when the index is read, and `hDel` the corpses" | platform owner, 2026-08-10 — `phase5/SESSION_TERMINATION.md` §3.1 | the two are not two implementations of one idea: **they ask different questions**. A lazy prune's liveness test is *does the session key still exist*, and since the session-cap split decided above a session key outlives the session it holds — the key carries koa-utils' sliding 90-day `REFRESH_TOKEN_EXPIRY` while the session is refused at its absolute cap of one day, or thirty when remembered. A prune built on key existence therefore keeps naming logins that cannot log in, and the admin session console renders that list to an admin. A field TTL set to the cap expires the row when the session stops working, enforced by Redis rather than by a read path remembering to run. The rest follows: lazy costs `hKeys` + one `EXISTS` per field + an `hDel` per corpse on **every** read — every revoke, every console render — against one extra single-key write per login; its stale-field bound is not zero but "logins in thirty days" for an account that never revokes and never opens the console, since nothing prunes an index nobody reads; and it is the larger test surface. What the choice costs is a Redis floor of 7.4.0, recorded operationally in `marketplace-docker-DBs/README.md` §Redis (where the refusal of **Valkey** as a target, same date, is also recorded). ⚠️ **If a deployment ever genuinely cannot offer hash-field TTLs, the lazy prune returns as a code change and not a config flag** — because of the predicate difference above, the two are not drop-in for one another |
| Exempt the calling session from a credential-change revoke — "revoke all but me", keeping the user who just changed their password signed in on the device they are holding | platform owner, 2026-08-10 — `phase5/SESSION_TERMINATION.md` §3.1 | it defeats the one scenario the feature exists for. The user changing a password because they believe someone else is inside the account cannot tell which live session is theirs, and neither can the server: the exemption is granted to *whichever session sent the mutation*, and an attacker holding the victim's password can send it. "Revoke all but me" is not a weaker version of "revoke all" — it is a rule an attacker can aim at. **It also cannot be built honestly here**: `revokeAllSessionsForAccount` takes `{ tier, accountId }` and has four callers, so sparing the caller means a fifth parameter carrying a session identity into a routine whose whole point is that no caller can get the shape wrong, plus a branch at every call site that the admin session console's revoke must always pass as false. ⚠️ **The accepted cost, recorded so a reversal is a decision rather than a discovery**: a password change is a logout on every device, and the three frontends must treat the refusal that follows as "log in again" rather than as an error state. No story owns that screen — see `phase5/SESSION_TERMINATION.md` §3.1. Reversing this is a product decision, not a patch to the routine |
| Add `familyId`, the session cap, or any other field to the account index's value | platform owner, 2026-08-13 — `phase5/SESSION_TERMINATION.md` §3.1 | the agreed value is `{ tier, mintedAt }` and nothing else. `familyId` and the cap are **state that token rotation already maintains on the session hash**, and duplicating them here would mean two writers keeping one truth in step across every rotation. Nothing device- or network-derived is in the set either, so the standing GDPR decision needs no exception for this key. ⚠️ **One of the two original reasons for `tier` turned out to be wrong once built**: the key a revocation rebuilds is `${REDIS_KEY}${field}` and needs no tier at all, because the tier is in the *index key's own name*. `tier` stays on the second reason alone — a row the admin session console can render without parsing a key name — and the pair was agreed as a pair, so re-litigating either half re-opens both |
| Make `keygripRetire` retryable — reorder it to sweep before the compare-and-set, or have a second call finish an unfinished one | [ADR-034](./ADR-034-keygrip-keys-live-in-redis-wrapped-under-a-kek.md) §Amendment 2026-08-31 (second that day) | sweeping first logs the whole platform out while leaving the suspect key in the keyring, which is the worst of both, and a second `keygripRetire` on a retired id answers **404** because the key really is gone — that answer is right and making it wrong would mean keeping retired keys around to be retried against. The half that is safe to repeat is the sweep, so the sweep is what got its own mutation: **`keygripResweep`**, no arguments, no record read, no CAS, therefore no 404, no 409 and no race with a rotation. A resweep that carried a list of missed accounts was refused with it — that list is personal data on an error path, and it is stale the moment anybody signs back in |
| Exempt the retiring admin's own session from `keygripRetire`'s sweep, or narrow the sweep to "only the sessions that key signed" | [ADR-034](./ADR-034-keygrip-keys-live-in-redis-wrapped-under-a-kek.md) §Amendment 2026-08-31 | neither is computable and the first is backwards. **Nothing anywhere records which key signed which cookie** — a cookie carries a signature, not a key id — so the narrow sweep has no query behind it. The exemption keeps alive the one session most likely to be the attacker's, since an admin account is a thing that leaks too, and it is the same shape as the credential-change *revoke all but me* this table already refuses. A retirement is the incident lever: it ends every session or it is not worth clicking |

## 5. Gaps

Decisions this platform still owes an ADR, once taken:

- **Where a shared secret is provisioned.** ADR-034 takes the Keygrip pair out of five `.env` files and
  leaves one `KEYGRIP_KEK` in their place, which is a smaller version of the same unanswered question,
  not an answer to it — `REDIS_PASSWORD` and `REDIS_KEY` are untouched and still have to be
  identical across nine files that nothing compares (`INFRA.md` §8 q8). Option E of ADR-034 — a secrets
  manager — is the destination, and it was blocked on ADR-032 saying where any of this runs.
  ⚠️ **That block is gone since 2026-08-28**: [`ADR-039`](./ADR-039-production-topology-cloudflare-app-host-trusted-datastore-segment.md)
  answers it — one application host behind Cloudflare, datastores on their own host — so option E is
  choosable now. The bullet stays open because nobody has chosen it: the nine files are still nine.
  ⚠️ **Narrowed a second time, later the same day, by [`ADR-040`](./ADR-040-the-secrets-manager-vendor-choice-is-the-adopters.md)**:
  asked to choose now that the blocker was gone, the platform owner ruled that this blueprint never
  chooses — *"a blueprint cannot make the vendor decision — Vault vs SOPS vs AWS KMS vs GCP depends on
  where the adopter deploys"* — so the choice is delegated permanently to whoever deploys it, and
  [`docs/PRODUCTION_HARDENING.md`](../../../PRODUCTION_HARDENING.md) ships the swap points instead of an
  integration. **The bullet stays open, and open is the honest state**: nothing about the files changed,
  nothing compares them, and the nine are still nine. What changed is the reason — *"nobody has chosen it"*
  became *"this blueprint has decided not to"*, which is a decided state rather than a closed one. ⚠️ Do
  not strike this bullet on the strength of ADR-040, and do not cite ADR-040 as having closed the
  cross-file agreement check: that check needs no vendor, is not declined, and stays open under **R39**
  and `INFRA.md` §14 q8.
- **Ordering — closed 2026-08-27, and declined rather than answered.** Cart, order state machine, delivery and payment have no collection, no resolver and no design, and [ADR-038](./ADR-038-commerce-is-permanently-out-of-scope.md) records the platform owner's decision that the four are **permanently out of scope**, so none of it starts. ADR-009's *no price on `item`* follows from that and is not a gap either. This is a refusal, not a hole: re-opening it takes a superseding ADR and is the platform owner's call alone.
- **Does suspending or closing a shop owner take their storefront off-air? Closed 2026-08-29 — yes, it
  cascades.** [ADR-045](./ADR-045-an-inactive-shop-owner-takes-the-storefront-off-air.md) records it: the
  two writers of the owner's state unpublish every `company` and every `item` beneath it, and the public
  read is untouched — `BEs/dev/marketplace-dev-public-resource/src/lib/catalogue/publicRead.mts:32-34`
  still filters on `company`'s **own** fields, `{ published: true, deleted: trusted({ $exists: false }) }`,
  and reads nothing on `shopOwner`. ⚠️ **Un-suspending restores nothing** — *"shopOwner must re-enable them
  by hands"* — so there is nothing to remember and the cheap read needed no new field, no clause and no
  read change. One question stays open and is framed in ADR-045 rather than here: whether `waitApprov`
  should hide a storefront the same way.
- **Where the sixteen repos get published**, and under which org. No ADR yet — it is explicitly the user's undecided call (see [`docs/workflow.md`](../../../workflow.md), *Repo layout*). ⚠️ **This is git hosting, not the npm registry.** [`ADR-037`](./ADR-037-marketplace-common-is-published-to-npm.md) decides where one *package* ships — `@axiumine/marketplace-common` to npmjs — and closes nothing here; the two were conflated once, in what is now [`phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md`](../../phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md) §6, which cited this bullet for a question ADR-015 §Risks had owned all along. Do not delete this bullet on the strength of ADR-037.
- **Production topology — closed 2026-08-28 by [`ADR-039`](./ADR-039-production-topology-cloudflare-app-host-trusted-datastore-segment.md)**, which answers the four questions [`ADR-032`](./ADR-032-production-topology-owed.md) had recorded as *owed*: **Cloudflare** is the outermost hop and the origin refuses anything without its client certificate (`snippets/origin-pull.conf`, `ssl_verify_client on`); **one application host** carries nginx, the nine services, the SSR renderer and both SPAs' static output; **a cloud security group** closes every port but 443 to Cloudflare's ranges, which is what ADR-022's wildcard bind sits behind; and **Redis and MongoDB run on a separate host on a private LAN segment** the platform owner has declared **trusted**. ⚠️ **Two of the three findings this gap bounded do not move**: service-port reachability and the floodable `refresh` keep their controls, **R46** closes, and **R45 stays open at 🟢 Low** — the Redis leg is still plaintext `redis://`, now crossing a segment declared trusted rather than a network nobody had described. What is not closed left this bullet for **R39**: node counts, sizing, supervision, secrets provisioning, CI/CD and backups. The edge itself was always written down: `marketplace-nginx/` carries a vhost per hostname — apex, `shopowner.`, `admin.` — terminating TLS for all three and proxying eleven loopback upstreams (the nine backend services, the SSR renderer and Nominatim) while serving both SPAs and the SSR app's static output off disk. `marketplace-nginx/test/run.sh` exercises it in a container: `nginx -t` plus every behavioural assertion in `test/suite.sh`, including that both session cookies come back `Secure` from every endpoint that mints one. What no ADR records is where that instance *runs*: which host, whether anything sits in front of it, how the service ports are closed to everything but it — the nine bind the wildcard address by decision (ADR-022) — and where Redis and MongoDB sit relative to them, `marketplace-docker-DBs/` being dev-only by its own decision. Three audit findings are bounded by that answer and by nothing else: every service port answers wherever its host answers (`phase3/SECURITY_AUTH.md` §2), `refresh` is floodable with distinct garbage tokens (`phase5/RISK_REGISTER.md` R52), and the Redis leg is plaintext `redis://` (R45). ⚠️ **ADR-032's rule survives in narrowed form**: a boundary may be cited as a second layer for the legs ADR-039 describes, never as the whole argument for a control being closed.

v1.17 - 2026-08-28, later the same day: **ADR-040 amended in place, hours after acceptance, at the platform
owner's instruction — the second exception to §1's immutability rule after ADR-011, and the first taken by
editing the body rather than appending a section.** The decision is untouched: the vendor choice is still the
adopter's, still permanently, and no option, risk or reopening trigger moves. What changed is that the ADR
described three raw `process.env.KEYGRIP_KEK` decodes as a standing consequence, and the same day's work
collapsed them into one — `readKek` in `marketplace-common`, called by `readKeygrip` and by both reseal
mutations in `marketplace-dev-admin-authenticated-resource`. Its *Compliance* greps named those three call
sites as the allowed set, so leaving them would have left an accepted ADR greping for a state the tree no
longer has. ⚠️ **Two defects in those greps are corrected in the same pass, and both predate this refactor:**
the count of shared values used `grep -c`, which counts lines and returned seventeen against a stated four,
and the call-site grep had no way to express "zero outside `readKek.mts`". Both now produce the number they
claim. ⚠️ **The amendment does not say the split-brain is solved.** One decode site is one place to edit; the
six services and the seed script are seven processes, and seven independent resolutions of a manager can
still hold seven values. `docs/PRODUCTION_HARDENING.md` §1 says so in the same pass, and its
resolve-once-per-process rule is unchanged and still the control that matters.

v1.18 - 2026-08-29: **four ADRs added — the account lifecycle is rewritten end to end, and ADR-011's
2026-08-26 Amendment is superseded in part.** The platform owner reversed the erasure mechanism —
*"stamp-only forever but allow re register again with that email. after that period of 30 days, clear user
personal data but do not delete the user document that record him. same for shopOwner"* — and
**[ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md)** records it: closure stamps,
day 30 **overwrites** the personal data in place, and nothing on this platform is destroyed. `deleted_ttl`
is dropped and `purgeClosedUser` is deleted, so the one hard delete ADR-011's amendment permitted lasted
three days. ⚠️ **The reversal is what let the rule reach `shopOwner`**, which the amendment had explicitly
left open — *"whoever builds one inherits this question"* — because the objection there was to *deletion*
(`company.idShopOwner` points at it) and an overwrite strands no reference. The owner's harder requirement,
*"days 1-30 the user must be able to register again !!"* with the closed account untouched *"when he will
click the link to confirm the email, not before that"*, is answered by
**[ADR-042](./ADR-042-registration-is-a-pending-redis-record.md)**: a registration is one Redis key until
the link is clicked, so no account document exists to collide, on either tier — *"yes I like to uniform, all
registration live in redis a spending"*. That deletes both `restart*Registration.mts` files and, with them,
a live defect the corpus had never recorded: an admin-closed unverified shop owner was revivable through an
unauthenticated public mutation with a caller-supplied password and no `waitApprov`, asserted as correct by
`test/shopOwnerRegisterMutation.test.mts:236-248`. **[ADR-043](./ADR-043-pending-registration-carries-csfle-ciphertext.md)**
carries ADR-029's field encryption into that record — *"yes keep in Redis same encription on filds that we
planned for mongodb"* — which is what keeps **R45** where ADR-039 left it: the cleartext `redis://` leg
carries ciphertext, so registration PII is not added to a risk the topology decision deliberately left
standing. ADR-029 is **extended, not amended**: no field, algorithm or key changes, only the reach of the
rule. **[ADR-044](./ADR-044-suspension-names-an-actor-and-a-reason.md)** gives `disabled` an actor and a
mandatory reason on both collections. ⚠️ **Its split of enforcement is the entry worth reading twice** —
the reason is admin prose about a person, so it is encrypted, and an encrypted path admits no
`maxLength`: the database enforces *presence* via `dependencies` and the service enforces the 1000
characters. That is not ADR-035 being reversed, and §4 now carries the temptation to "fix" it. Four rows in
§2, four in §4 plus one more against `sparse`/`partialFilterExpression`, two numbers in §3's **Data model**
and **Identity and access** lines, and §1's supersession count moves from two to three. ⚠️ **§1's ADR-011
exception is not extended**: the amendment was superseded by a new ADR the ordinary way, and is struck in
place with forward pointers rather than rewritten. One bullet **opens** in §5 — whether suspending or
closing a shop owner takes their storefront off-air; `publicRead.mts:32-34` reads nothing on `shopOwner`
today, so it does not, and nobody has decided whether it should.

v1.19 - 2026-08-29, later the same day: **[ADR-045](./ADR-045-an-inactive-shop-owner-takes-the-storefront-off-air.md) added — the §5 bullet v1.18
opened is struck the same day it was written, and the decision is the opposite of the one the bullet
expected.** Asked whether suspending or closing a shop owner takes the storefront off-air, the platform
owner answered *"yes"*, asked for a *"cheap read so denormalised flag on company"*, and then added the
ruling that settles the mechanism: *"un-suspending must not re-enable in the same place the companies,
shopOwner must re-enable them by hands"*. ⚠️ **That third ruling dissolves the objection this ADR was
expected to work around.** Writing `published: false` was the obvious cascade and the obvious mistake —
irreversible, and unable to tell a shop the owner had taken down from one the platform hid. It is only a
mistake if un-suspending is meant to restore something. It is not: coming back is an act the owner
performs, through `companyUpdatePublished`, which already exists, is gated by `idShopOwner`, and is already
how an owner republishes after an admin unpublishes them (the 2026-08-14 pair of §4 rows). So the whole
decision is two `updateMany` calls in the same transaction as the `shopOwner` write, and **nothing else** —
no new field, no `collMod`, no migration, no Mongoose model edit, no backfill, no reconciliation sweep, and
`livePublic()` is not modified, because `{ published: true }` already excludes what has to be excluded. The
cheapest possible reading of *cheap read*. ⚠️ **What is paid for it is stated rather than hidden**: the
owner's prior publish state is lost, so after un-suspension neither the platform nor the owner can say
which shops were live, and a shop whose owner never logs back in stays dark for good. Both are the ruling
working as instructed, not defects to be repaired later by remembering the old value — remembering it is
the rejected option. `item` is deliberately not cascaded, so item-level publish state survives and one call
per shop restores the catalogue. One row in §2, one number in §3's **Catalogue** line, one row in §4
forbidding the helpful-looking restore. No ADR status moved and §1's supersession count is unchanged.

v1.20 - 2026-08-29, third revision that day: **[ADR-045](./ADR-045-an-inactive-shop-owner-takes-the-storefront-off-air.md) amended within hours of
being accepted — the cascade reaches `item` too, and the objection that killed that idea is answered
rather than overruled.** The accepted page argued `item` should be left alone so that republishing one
company restores a whole catalogue, and that cascading would hand the owner hundreds of buttons to press.
The platform owner ruled the cascade in anyway — *"item must cascade to unpublish"* — and supplied the
answer to the objection in the same sentence: *"allow shopowner to select items, one-by-one or all by a
checkbox next to it in the page that displays them for enable them in one click"*. ⚠️ **So the bulk control
is part of the decision, not a follow-up story** — a checkbox per item card, a select-all in the `Items`
heading, and a mutation the ShopOwner tier does not have: `itemsUpdatePublished(_ids, published)`, guarded
by `shopOwnerCompanyIds` and all-or-nothing, because a filter that silently skips ids the caller does not
own leaks which ids exist. Its list needs a bound, for the reason `publicRead.mts` has a `MAX_LIMIT`. A
second ruling the same day settles both ends of the lifecycle: the cascade hangs off the **state**, not the
tier that changed it, so a shop owner closing their own account fires it exactly as an admin's closure
does — *"by shop owner or by admin"* — and ⚠️ **restoring an owner touches the `shopOwner` document alone**:
*"restoring a shopowner, restore only his account"*. The account comes back, the storefront does not, and
the owner republishes it. §2's status column and §4's row carry both. One phrase is deliberately **not**
turned into a rule — *"in 30 days windows"* is read as ADR-041's existing retention window, not a new
deadline on republishing; for a closed owner it has no mechanism behind it yet, since closure is one-way
today and re-registering inside the window mints a new `_id` owning no company. Whether an admin may
lift a `deleted` stamp inside the thirty days is left open for the platform owner rather than answered by
analogy.

v1.21 - 2026-08-29, fourth revision that day: **[ADR-046](./ADR-046-the-retention-window-is-an-undo-window.md)
is registered here.** Its §2 row, its four §4 rows and its §3 area line landed with the ADR itself; what was
missing was this changelog, the version, and §1's count — which now says **four supersessions**, ADR-046
superseding ADR-041, ADR-042 and ADR-045 each in part, and **nine** §2 rows carrying one. The decision is the
platform owner's, in one sentence — *"the 30 days windows is for undo too !"* — and it reverses a decision he
had taken the same morning after asking the question that broke it: *"in the 1-30 days window, what the
purpose to keep the user data if he register in that window and new document will be created ?!?!?"* None.
The window protected nobody while the flow inside it destroyed the data twenty-seven days early. ⚠️ **What
this entry corrects beyond the count is v1.20's closing paragraph, which is now wrong and is annotated in
place**: it read the owner's *"in 30 days windows"* as having no mechanism for a closed owner, *"since
closure is one-way today and re-registering inside the window mints a new `_id` owning no company"*, and
left the question of lifting a `deleted` stamp open. ADR-046 answers all of it — the same `_id` comes back,
owning the same companies, unpublished, behind `waitApprov`, and the stamp is lifted by the confirmation
click rather than by an admin. ⚠️ **`disabled` is not cleared by any of it**, which is the one line every
ADR in this block shares. Four stale citations of the superseded mechanism were annotated at the same time,
in `data-model.md`, `phase4/ERD.md`, `phase1/NFR.md` and `phase5/RISK_REGISTER.md`, plus the §Note bullet of
[ADR-036](./ADR-036-erasure-is-not-something-the-platform-suspends.md).
