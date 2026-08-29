# Epics + Stories
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.53
**Date:** 2026-08-29
**Author:** epics-agent
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
v1.53 - 2026-08-29: **[`E20.md`](epics/E20.md) — The Account Lifecycle — opens, and `epics/` grows for the
first time in this changelog's history.** Every entry above it narrows the directory; this one widens it, and
`epics/` now holds `E19.md` and `E20.md` and nothing else. The epic came out of one question from the platform
owner — *"admin must be able to soft deactivate/suspend an user, not hard delete"* — and the eleven rulings that
followed it in one conversation; six ADRs ([ADR-041](../phase3/adr/ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md)
to [ADR-046](../phase3/adr/ADR-046-the-retention-window-is-an-undo-window.md)) answer them and **twelve
repositories carry a commit**, the widest single change the platform has taken. §1's count is 20, §2 has an E20
row, §2.1's closing sentence — which predicted this epic before it existed — is annotated rather than rewritten
per this document's v1.40 rule, §3's §7 note names E20 beside E15, E16, E17 and E19, and §4 gains E20 on BC-01,
BC-03 and BC-07. ⚠️ **It is not E19's sequel and does not close E19's questions by existing**: E19 gave the
operator a switch, and what the switch *means* was open behind it. Of the two E19 §6 questions it reaches,
question 1 is **answered** (a reason exists, is capped at 1000 characters and is mandatory whenever `disabled`
is true) and question 3 is **corrected, not closed** — its TTL-index and destroy-on-re-registration premises are
reversed by ADR-041 and ADR-046, while the Admin counterpart to `shopOwnerDel` it really asks for is still
absent and is E20 §6 question 5 now. `E19.md` goes to v1.6 in the same pass. ⚠️ **Nothing is merged**: twelve
branches, none pushed, so E20's build state describes twelve working trees rather than `main`.
v1.52 - 2026-08-28, later still: **`phase5/epics/E17.md` and `phase5/epics/E18.md` are deleted — the twelfth and
thirteenth records to leave `epics/`, both distributed rather than moved.** E17's nine stories and E18's thirteen
are `built`; E17's five open questions and E18's three are all closed, so neither file still had work to do. §2's
E17 row absorbs the render-only goal framing, the two *permanent* scope refusals — no token, prefix or key on a
screen, ever, and nothing network- or device-derived on a session row — and the four story outcomes that were
stated nowhere else (**E17-S01**, **E17-S03**, **E17-S05**, **E17-S06**, the last of which is **E16-S07**'s only
consumer). §2.1's E17 row absorbs the five-step landing order and the constraint underneath it: **an operator
console addresses a session by a non-secret id and can never be built on a token value**, which is why `familyId`
is what it keys them by. §2's E18 row stops deferring five stories to a file that no longer exists and restates
**E18-S08**, **E18-S09**, **E18-S11**, **E18-S12** and **E18-S13** in full, and its E18-S06 sentence now names the
six stories that closed the audit's documentation findings, re-anchoring **E13-S06** and **E13-S08**. E14's row
stops citing `epics/E17.md` §5 and points at §2.1 instead. Two changelog links to deleted files became backticked
paths — `epics/E11.md` was dangling before this pass and is fixed with it. **No story id was destroyed and no
build state moved.** The two remaining destinations are `docs/testing.md` (E18-S08's checks and E18-S13's trap)
and `PLATFORM_OPERATIONS_QUALITY_GATES.md` §6, which now carries the only thing either epic left genuinely open:
who reviews a newly-red advisory under a pinned scanner image, and who decides a `.trivyignore` line.
v1.51 - 2026-08-28, later still: **E17 question 5 is answered — the operator is named by digest.** The owner
ruled against both dropping the name and leaving the raw id: `funKeygripRotate`/`funKeygripRetire` now hash
`_id` with `sha256Hex`, because the audit line becomes `event.message` and `sentryBeforeSend` does not walk it.
`marketplace-dev-admin-authenticated-resource` carries the change and one test per writer; §2's E17 row is
updated. **E17 has no open questions left.**
v1.50 - 2026-08-28, later still: **E17 carries a fifth open question and §2's E17 row says so.** A pass that
re-verified E17's four answers against the code found all four true — including question 2's arithmetic,
`SESSION_CAP_DAYS_REMEMBERED = 30` — and found that E17 decides operator attribution *twice*: question 4 rules
it out for `funRevokeSession`/`funRevokeAllSessions`, which write no operator id anywhere, while E17-S08's
`funKeygripRotate`/`funKeygripRetire` write `by admin <id>` to Sentry and call that line the only record the
operation leaves. Neither this file, `E17.md`, any ADR, `RISK_REGISTER.md` nor `report/sentry-event-capture.md`
had recorded the second decision. Question 4's answer is bounded to what it decided rather than corrected, and
question 5 asks the owner to rule on the asymmetry. `E17.md` goes to v1.6 in the same pass. The two changelog
entries below that read "all four" — v1.22 and the E17 line further down — are records of 2026-08-13 and stay
as written; they were true on their date.
v1.49 - 2026-08-28, later still: **`phase5/epics/E15.md` is deleted and its record distributed** — the
E11/E13/E14 pattern, no replacement file, so `epics/` now narrows to **E16..E19**. All ten stories are
`built`; unlike E14 its §6 was **not** empty, and the one row that survived is relocated rather than dropped
(see below). Nine facts held nowhere else were placed: the **seven-step landing order** folds into §2's E15
row above and the **greppable-hash reason** for depending on E13-S01 into §2.1's; three refused designs — the
**lazy prune**, **"revoke all but me"**, and **`familyId`/the cap in the index value** — become rows in
[`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4; the frontends' unowned "log in again" screen goes to
[`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md); the parking/releasing asymmetry to
[`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md); the email-change findings **and the
surviving Product question** to [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md); the
`credentialWriteRevokes.test.mts` convention to
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md); and the timing-oracle
reason for where `checkShopOwnerApproval` is called to [`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3.
The epic id and all ten story ids stay citable; four of them — E15-S02, S06, S09, S10 — are cited by no other
file under `epics/`, which is what moves that count.
v1.48 - 2026-08-28: **E15 reads 10 of 10 and leaves nothing behind.** Open question 4 — the public
reset-password flow writes a new password for two tiers and revokes nothing — was answered as **E15-S10**, a
story inside E15 rather than an epic of its own, and built the same day. The §2 E15 row said the epic was
complete *and* named an uncovered credential write in the same sentence; it no longer has to. The build's one
finding, recorded on the story: koa-utils exposes no way to learn the account id from the confirm path, so
`marketplace-dev-public-resource` reads it itself by `login.email` after the delegate returns — which also
makes it the tenth repo E15 touches.
v1.47 - 2026-08-28, later still: **`phase5/epics/E14.md` is deleted and its record distributed, not
moved** — the E11/E13 pattern again, not E12's. All nine stories are `built`, its §6 read *None open*, and
what survived an audit of the 521-line file was nine facts held nowhere else. The seven-step landing order
and its three `deploy-local.sh` boundaries fold into §2's E14 row above, the only part a future rebuild
would reuse; the **E13-S01** hard-ordering constraint, and **land E13-S01 and E13-S02 first** — a deviation
from the audit's own §6 suggested sequence — fold into §2.1's E14 row. The other seven facts went to the
documents that already own their subject: [`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 (two rejected
alternatives — the tier-keyed privilege gradient for the session cap, and the cached-successor-pair grace
design), [`docs/architecture.md`](../../architecture.md) (the abandoned `// if remember me, generate ?`
cookie-side comment in koa-utils' `setLoginCookies`, which E14-S07 does not revive),
[`RISK_REGISTER.md`](./RISK_REGISTER.md) R52 (two windows, not one),
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) (the Cloudflare rate-limiting-rules
alternative to `limit_req_zone`), `epics/E17.md` §5 (why E17 depends on E14 for `familyId`) and
[`token-handling-security-audit.md`](../../report/token-handling-security-audit.md) §3.4 (the
cross-service-harness residual). The two defects E14-S09 found stay live in
[`multi-tab-refresh-behaviour.md`](../../report/multi-tab-refresh-behaviour.md) §4, §5 and §9, which is not
deleted. `epics/` now holds `E15..E19`. ⚠️ **The epic id and all nine story ids, `E14-S01`..`E14-S09`, are
untouched; only the file is gone.**
v1.42 - 2026-08-27: E11 stops being planned. ADR-038 (2026-08-27) makes cart, order, delivery and payment permanently out of scope, so §1's row reads `[WILL NOT BUILD]` and gains E11-S02, the recording story that landed the decision; §3's "Open story" definition notes E11 has no open story left; and §6 says the prohibition is now backed by an ADR rather than by this document alone. E05's "commerce out of scope" becomes permanent too.
v1.43 - 2026-08-27, later still: **`phase5/epics/E11.md` is deleted — the eleventh record to leave `epics/`, and the first to leave with no destination file of its own.** E01-E10 each got a sibling document beside this index when their turn came; E11 gets a subsection instead, because a context that will never be built earns no standing record beyond the two stories that said so — §6.1 below now carries E11-S01 and E11-S02 in full, in this file's own voice, since this is where every other epic's stories already live. The epic id is untouched and the §2 table keeps its E11 row; only its File column repoints, from ``epics/E11.md`` to §6.1 and [ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note — 2026-08-27, which holds the deeper correction ledger and the five §6 questions' own closure detail, so the two records point at each other rather than duplicate — save for the owner-cell finding, carried on both sides on purpose, since it is E11-S02's finding here and question 1's reason for closing there. §3's "no open story left" note and §6's own out-of-scope prose lose the same link the same way. The v1.39 entry below, which counted `epics/` as holding `E11..E19` the day E10 left, is annotated rather than rewritten, per this document's own v1.40 rule against editing its history silently.
v1.44 - 2026-08-27, later still: E12's §1 row stops describing E12-S15 as an outstanding item. Its repo half is complete and gated; enabling Authenticated Origin Pulls in Cloudflare and placing the zone CA needs a zone and a host, and this workspace has neither — so it is an **adopter deployment step**, owned by whoever deploys this blueprint (`ADR-037`). This is §6.1's own reading applied once more: the owner cell was the tell. ⚠️ No score moved and no control closed — R44 and R46 stand, because `ADR-032` forbids closing a control by appeal to a network boundary. No story, count or state changed.
v1.1 - added E12-E18, the remediation backlog for `docs/report/token-handling-security-audit.md` v1.1.
These seven do **not** follow the one-epic-per-BC rule; see §2.2. ⚠️ That rule no longer exists — read the
v1.4 line below before treating this sentence as a live caveat.
v1.2 - E12, E13 and E14 implemented 2026-08-10; their story markers and the three §1 rows now read per
story, and each of those epics carries a §7 saying what did not land and what blocks it.
v1.3 - E14-S09 run the same day against the running Dev stack, closing E14 at 9 of 9. Its finding is
[`docs/report/multi-tab-refresh-behaviour.md`](../../report/multi-tab-refresh-behaviour.md).
v1.4 - 2026-08-11: the one-epic-per-BC rule is gone from [`CONSTRAINTS.md`](./CONSTRAINTS.md) §5, which is
the record of that decision, so the v1.1 note above is history rather than a live caveat — E12-E18 break no
rule. §1, §2.2 and §4 rewritten accordingly, the index's context column is now marked informational, and the
BC-12 once proposed for E16 and E17 is withdrawn: it existed only to satisfy the removed rule, so with the
rule gone there is nothing left for it to do, and `phase2/BOUNDED_CONTEXT.md` keeps its eleven contexts.
v1.5 - 2026-08-11: E12-S12 and E12-S13 run, closing E12's two investigations. Findings at
[`docs/report/log-sink-inventory.md`](../../report/log-sink-inventory.md) and
[`docs/report/sentry-event-capture.md`](../../report/sentry-event-capture.md). They opened E12-S16 … E12-S23,
so E12 is now 15 of 24 rather than 13 of 15, and one of the eight is 🔴 and live.
v1.6 - 2026-08-11: E12-S24 added, so E12 reads 15 of 24. E12-S22 claimed the transaction-scrubbing gap was
latent because no service sets a `tracesSampleRate`; the three frontends set `0.1` and configure no
`beforeSend`, and none depends on the package holding the scrubber.
v1.7 - 2026-08-11: the platform owner answered E12 §6 question 1 — raw addresses stay in the nginx
error log, rotation 14–30 days with `shred`, no personal data in the access log, two lines in a privacy
policy. E12-S19 stops waiting on it and E12-S25 is added to write the notice, so E12 reads 15 of 25.
v1.8 - 2026-08-11: the owner chose the mechanism for question 2 and **E12-S16 is built** — the mailed
`:email/:hash` links are redacted out of the nginx access log and out of the `Referer` beside it, at http
level, because four link shapes carry them and only two have a `location` block. E12 reads 16 of 25.
v1.9 - 2026-08-11: **E12-S26 added**, from the owner asking whether E12-S16's residual — the credential still
travelling in the URL — can be closed instead of accepted. It can, for the customer reset flow: the link
moves into the URL fragment, which no browser sends, so the value stops reaching the log, the `Referer`, the
cache key and Cloudflare at once. It cannot for the two verify flows, which are REST `GET`s. E12 reads 16 of 26.
v1.10 - 2026-08-11: E12-S26's **cache criterion is built** the same day, ahead of the fragment itself — nginx
no longer stores a response whose URL carries a mailed credential. That one was not merely prospective: with
the bypass reverted, a second request to a reset link answers `HIT`, so the address and the live hash were
being kept as a cache key under `inactive=24h`. The session-cookie map could not have caught it, because a
visitor following a reset link is anonymous. E12-S26 is `partly built`; E12 still reads 16 of 26.
v1.27 - 2026-08-13: **E03-S04 closes on the platform owner's call, and the closure is a correction rather
than a build.** Onboarding progress is written by `shopOwnerUpdatePreferences` on the Admin tier — the only
writer, deliberately, until a shop-owner onboarding flow is designed, which is future work. Six documents
said no mutation anywhere writes those fields; only E03-S04's own acceptance criterion had it right, because
only it kept the word **other**. `EVENT_STORMING.md` hotspot 2, `BOUNDED_CONTEXT.md` q2, `SECURITY_AUTH.md`
q3, `DDD_AGGREGATES.md` q2 (four separate false claims), `UBIQUITOUS_LANGUAGE.md` §6 and E03 §6 are all
corrected and closed; `RISK_REGISTER.md` R27 closes on a premise that was never true, and the real residual
— no shop-owner-side flow — opens as **R53** (🟢 Low, measured: no frontend reads either field). E03's build
state reads per that decision now instead of "onboarding itself still has no flow".
v1.26 - 2026-08-13: **E18-S10 is built**, across eight services and eight commits. `@socketlabs/email` and
its whole `axios@0.21.4` closure — six lockfile blocks, 38 lines, all deletions — leave the seven trees that
never executed a line of it; `public-resource` keeps it and is now the only tree in the workspace that
reaches it. The mail credential pair stops being required by the two services that cannot send mail, and the
one that can gains all six variables its client reads. Two things the story did not anticipate: **`yarn
install` cannot run anywhere in this workspace** — `@axiumine/marketplace-common` answers 404 on both
registries and yarn 1 aborts the whole resolution over it — so the lockfiles were pruned by a rewriter proven
byte-identical on an untouched control repo; and the new startup check immediately caught `APP_DOMAIN_USER`
missing from this machine's environment, which means every customer verification link built here carried the
string `undefined`. **E18-S13** opens for six variables two services require and nothing reads. E18 reads
6 of 13.
v1.25 - 2026-08-13: **E18-S04 is built** — `docs/report/dependency-tree-advisory-scan.md`. **54 advisories
match installed versions across the 14 repos that have a dependency tree; 29 reach a production zone and
none of the 29 is reachable through an attacker-influenced path.** The auth path itself is clean —
`keygrip@1.1.0`, `cookies@0.9.1`, `koa@3.2.1`, `redis@6.2.0`, both Sentry packages, `@axiumine/koa-utils@6.0.0`,
zero advisories — and every one of them except `@axiumine/marketplace-common` is external and unmodifiable
from this workspace, stated once so the next epic stops rediscovering it. Three things the story did not
anticipate: `yarn audit` **cannot run here at all** (yarn 1 aborts the whole run over the unpublished
`@axiumine/marketplace-common`, so the scan reads the tree from disk and queries npm's bulk endpoint);
**seven of the eight services that ship `@socketlabs/email`'s `axios@0.21.4` never load a line of it**; and
the env contract is backwards — two services that send no mail require the SocketLabs credentials, and the
one that sends all of it requires neither. **E18-S10**, **E18-S11** and **E18-S12** open, **R49** opens for
the residual `axios`, and **R21 is rewritten and promoted to 🟠 High**: it assumed no dependency gate
existed, and the measurement is worse — Qodana's `VulnerableLibrariesLocal` runs on every commit and every
push and reports **0 problems in every repo**. E18 reads 5 of 12.
v1.24 - 2026-08-13: **E18-S05 is built** — `docs/report/encryption-at-rest-coverage.md` separates the two
things called encryption at rest. Field level: **30 paths across 4 of the 6 collections, 4 DEKs, 5 of them
deterministic**, enumerated, with the not-encrypted personal data written down for the first time and a
reason per omission. Storage level: **none, and MongoDB Community cannot** — `mongod --help` matches
`encrypt` zero times, both volumes are on an unencrypted filesystem, and every other environment is
**unknown** because none exists. Two of the story's own premises were wrong: Redis session values *are*
personal data (the access-token hash carries a plaintext email into the AOF, where it outlives the session's
TTL), and the keyspace stopped being credentials when E13-S01 landed. The audit §5 item is closed; **R48**
opens for the storage residual, owned by the platform owner and coupled to ADR-032. E18 reads 4 of 9.
v1.23 - 2026-08-13: **E18-S03 is built** in all nine services — each `REQUIRED_ENV_VARS` asserted with
`toStrictEqual` against its exact list *and* its order, since the boot names the first missing variable, and
each service proved to reject out of `start()` before a datasource is touched. It also fixed the defect
E16-S09 found and handed here: a service failing its required-env check exited **0**, because the throw
reached only the entrypoint's `.catch` and a Sentry client with no DSN discards what it is given. Docker and
every restart policy reading the code saw a clean shutdown. It now logs to stderr and exits 1. E18 reads
3 of 9.
v1.22 - 2026-08-13: **E17 is complete — 9 of 9**, and all four of its open questions are answered from the
code. A platform operator can now list the sessions an account holds, end one or all of them, and read the
reuse trail beside the table, at `/security` in `marketplace-admin`. No token, a prefix of one, or anything
network- or device-derived appears anywhere in it, which a dedicated no-leak suite asserts rather than
assumes. E17.md v1.2 also corrects its own §3 port table against `docs/architecture.md`.
v1.21 - 2026-08-13: **E16 is complete, and ADR-034 built five of its nine stories before it was opened.**
The epic specified a CSFLE-encrypted `signingKey` collection with a three-state lifecycle; what shipped is
one AES-256-GCM-wrapped Redis record with an ordered list, built by E01-S12 through E01-S15. E16 v2.0
retargets onto that rather than demanding a second custody store — which is exactly what E16-S06 calls worse
than either alone — and every story keeps its criteria and gains an **Outcome** paragraph. S04 and S07 were
built in E16's own name; S08 and S09 close it today. Two departures are recorded rather than papered over:
**R02 stays `Mitigated`, not `Closed`** (the KEK is still hand-provisioned per machine) — ⚠️ **reversed the
same day by E18-S07**, which closed R02 on the failure it actually names, two live services holding different
keys, and moved the hand-provisioned KEK out to its own row **R50**, since a closed row may not carry an open
residual — and the residual row opened at **R47**, R42 through R46 having been taken since the epic was written. E16-S09 ran the first
rotation this platform has ever performed — 37 ms to all five signers, 8 ms for the retirement — and found a
defect that belongs to E18-S03: a service failing its required-env check exits **0** in silence.
v1.20 - 2026-08-13: **E18-S02 is built** — eleven auth-boundary cases AB-01..AB-11 single-sourced in
`marketplace-common`, tagged above the covering test in all seven authenticated services, each with a
contract test that fails when a required tag is absent, and the whole thing written up in `docs/testing.md`.
It was not bookkeeping: the three authorization services were missing the introspection allowlist case
(E13-S11) entirely, and their replay refusal (E14-S02) was asserted only as a tombstone written, never as a
token refused. E18 reads 2 of 9.
v1.19 - 2026-08-13: **E18-S01 verified `built`, and E18 did not build it** — all three resource services
already test the wrong tier, the missing tier and 403-not-401 against their own middleware, having gained
those tests with the tier discriminator itself. The audit's §3.6d is closed and E18's §3 no longer claims
otherwise. The check is also the argument for E18-S02: three suites agreeing is not a contract, and nothing
in the workspace fails when a service is added carrying none of the cases. E18 reads 1 of 9.
v1.18 - 2026-08-13: **E15-S07, and E15 is complete at 9 of 9** — parking a ShopOwner ends the sessions they
were holding, so `disabled` and `waitApprov` stop being labels that only bite at the next rotation. The gate
reads the target state rather than a transition (both flags arrive on every save, so no previous state is in
hand and none is fetched), and **releasing an account revokes nothing** — nobody's credentials changed, and
all four flag combinations are pinned so that case is asserted rather than untested. One deviation recorded
on the story: the integration test cannot boot `marketplace-dev-authenticated-resource` to be refused by it,
so it asserts what the two services share — the refresh session and the index key are gone. What the epic
leaves behind is not one of its stories: the public reset-password flow of open question 4.
v1.17 - 2026-08-13: **E15-S06** — writing a login email now ends that account's sessions, with one call
site (`shopOwnerUpdateEmail`, the platform's only email-change mutation) and an enumeration test in both
services that write a credential, so a future mutation cannot skip the revoke silently. It is the mirror
of S05: the operator editing somebody else's address keeps their own session, because the caller rule is
about whose credentials changed. The story's investigation found **the confirm-an-email-change flow has
no caller** — `emailVerify.newEmailTmp` is in the schema and written by nothing — so an operator's write
puts an account on an unconfirmed address while `emailVerify.valid` still reads `true`. E15 reads 8 of 9.
v1.16 - 2026-08-13: **E15-S05** — changing a password now ends every session the account holds, the
caller's own included, on `marketplace-dev-user-authenticated-resource` and
`marketplace-dev-admin-authenticated-resource`. The revoke runs after the write and inside the `try`, so a
Redis that refuses fails the mutation instead of answering `true` over live stolen sessions. Two findings
came out of the build and are recorded on the story rather than smoothed away: **the "three tiers" in the
acceptance criteria is two** — the ShopOwner service has no password-change mutation to hook into — and
**the public reset-password flow is an uncovered credential write**, setting a new password for two tiers
while ending nothing, on a service E15's landing order never listed. That one is now open question 4.
E15 reads 7 of 9.
v1.15 - 2026-08-13: **E15-S04** — one routine, `revokeAllSessionsForAccount`, ends every session an account
holds: `hKeys`, one single-key `del` per session, and the index key last so an interrupted revocation is
safe to run again. Four callers were going to need this and four hand-written versions of it would have
been four chances to fail open. `marketplace-common` is finished for E15; what remains is the three
credential-write call sites. E15 reads 6 of 9.
v1.14 - 2026-08-13: **E15-S03** — the index prunes itself, so it stops being both a memory leak and a lie
about which sessions are live. Rotation and logout unfile the token they delete, and every field carries an
`HEXPIRE` of what remains of its own session's absolute cap, so a session that ends any other way takes its
row with it: the upper bound on stale fields per account is zero by design. That puts a hard Redis 7.4 floor
under the platform, now checked by `up.sh --with-redis` and by a boot probe in each of the four
authorization services rather than assumed. E15 reads 5 of 9; the revoke routine (S04) is the last piece
before a credential write can end a session.
v1.13 - 2026-08-13: **E15-S02** — every login and rotation files its session under its account, so the
platform can finally answer "which sessions does this account have open?" without a keyspace scan. The key
shape is in [`docs/data-model.md`](../../data-model.md) with the four properties of it that are
load-bearing. E15 reads 4 of 9; the prune (S03) and the revoke routine (S04) are what remain before any
credential write can end a session.
v1.12 - 2026-08-12: **E03-S08** — a seller registers themselves. E03's row gains the anonymous tier, three
repos and the caveat that an approved self-registered account still has no onboarding flow to walk. It is
the first story to put an unauthenticated write to `shopOwner` on `marketplace-dev-public-resource`, which
is why the epic now touches the public service and the public app.
v1.11 - 2026-08-11: **E12 is complete — 26 of 26.** The ten stories opened after the two investigations all
landed the same day they were written: E12-S17 … E12-S20 (Redis password out of argv, bounded container logs,
edge log retention, four `console` calls deleted), E12-S21 … E12-S23 as one edit to the same `Sentry.init`
call in nine services, E12-S25 (the platform's first privacy notice), E12-S26 (the customer reset credential
moved into the URL fragment) and finally E12-S24. That last one captured nine real browser envelopes and
turned two code-reads into measurements: `httpBodies: []` holds on the browser transport, `urlQueryParams:
false` does **not** — the SDK copies the whole address bar into five places on both event kinds — and
`browserTracingIntegration` is not a default integration, so the `tracesSampleRate: 0.1` all three frontends
set has been a rate applied to nothing. `sentryBeforeSend` now runs as both hooks in all three apps, from one
implementation in `marketplace-common`.
v1.28 - 2026-08-14: **E13 closes at 11 of 11.** E13-S10 removed the pre-cutover dual-read fallback, the
`dual-read-hits` counter and `DUAL_READ_REMOVE_AFTER` from `marketplace-common` and eight services, and cut
the dual delete to one key. ⚠️ **Its two gates never had anything to measure**: the 90-day window drains
live pre-cutover sessions and the counter counts served fallback reads, and **nothing on this platform has
ever been deployed** — the counter key was absent on the one cluster there is, at `DBSIZE 0`. The six
E13-S02 tests were **inverted rather than deleted**, so a raw-shape key now carries a test proving it fails
to authenticate; `RISK_REGISTER` R51 closed at v1.17.
v1.29 - 2026-08-14: **E03's record leaves `epics/`, the third to do so.** `phase5/epics/E03.md` is deleted
and its content is [`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md), beside this
index next to E01's and E02's, on the condition those two set: all eight stories `built`, and §6's last
open question closed the same day (the `idShopOwner` one, on a premise the Admin tier cannot produce —
`RISK_REGISTER.md` R30). **`E03-S01`..`E03-S08` are unchanged**; sixteen files cite them and every citation
still resolves. §1's "two exceptions" is now three and §2's E03 row links to the new path; `epics/` holds
E04..E18.
v1.30 - 2026-08-14: **E04's record leaves `epics/` the same day, the fourth to do so.**
`phase5/epics/E04.md` is deleted and its content is
[`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md), on the same condition: all eight stories `built`,
§6's one open question closed — the two-writer race the platform owner accepted — and the publish split
under it landed the same day (E04-S08). **`E04-S01`..`E04-S08` are unchanged.** §1's "three exceptions" is
now four and §2's E04 row links to the new path; `epics/` holds E05..E18.
v1.31 - 2026-08-14, last that day: **E05's record leaves `epics/` too, the fifth.**
`phase5/epics/E05.md` is deleted and its content is [`CATALOGUE.md`](./CATALOGUE.md), on the same
condition: all nine stories `built` and §6 empty — its two open questions closed hours apart, the publish
split (E05-S08) and the picture upload (E05-S09). **`E05-S01`..`E05-S09` are unchanged.** §1's "four
exceptions" is now five and §2's E05 row links to the new path; `epics/` holds E06..E18.
v1.32 - 2026-08-25: **E06's record leaves `epics/`, the sixth.** `phase5/epics/E06.md` is deleted and its
content is [`CATEGORY_TAXONOMY.md`](./CATEGORY_TAXONOMY.md), on the same condition: all seven stories
`built` and §6 empty — its last two open questions closed that day, the collection's provenance by
inspection and the read-then-write window by an implementation in two repos. **`E06-S01`..`E06-S07` are
unchanged**, and are the first such set with no citation outside their own file — the only two anywhere are
code comments in `marketplace-admin`. §1's "five exceptions" is now six and §2's E06 row links to the new
path; `epics/` holds E07..E18 — E07..E19 since E19 opened. Four things that record held alone were copied out first: the `/categories`
screen's `position` bound and its orphan bucket to [`docs/frontends.md`](../../frontends.md), the reason
`itemAdd`'s upload stays outside its transaction to `ADR-012`, and `itemCategory`'s global `slug`
uniqueness, its sort ordinal, the absence of a cascade on delete and the seed that creates no category to
[`docs/data-model.md`](../../data-model.md).
v1.33 - 2026-08-25: **a nineteenth epic, and the first one opened by a request rather than by a retrofit or
an audit.** [`E19.md`](epics/E19.md) — Customer Administration — is the operator's missing surface over the
`user` collection: a customers list and the enable/disable lever `user.disabled` has never had a writer for.
It follows directly from E07's §6 closing the same day, which established that no gate stands before a
customer's first login and then found that none stands after it either. Six stories, **none built**, no code
written: one migration adding `user`'s second index, `usersActiveTbl`, `userUpdateStatus`, a `/customers`
screen, an anti-story, and a documentation truth-up. The table reads **clear fields only** — that is the
whole reason the epic is small, and E19-S05 is the boundary that keeps it that way. §1's count is 19, §2 has
an E19 row, §2.1 says why 19 is not numbered by context, and `epics/` holds E07..E19. The header version was
stale at 1.30 while this changelog stood at 1.32; it is corrected here rather than incremented from a number
that was never written down.
v1.34 - 2026-08-25: **E19 built the same day it opened** — five stories built, the sixth an anti-story held — the first epic here to open and close within one day. Its §1 row stops saying `[PLANNED - NOT BUILT]` and names what closed each story: a new migration for `user`'s second index, `usersActiveTbl`, `userUpdateStatus` and the `/customers` screen, with E19-S05 built by *not* being built and E19-S06 truing up the five documents that said the surface did not exist. Nothing about the encryption boundary moved: the table reads clear fields only, which is what made a one-day epic possible.
v1.35 - 2026-08-26: **E07's record leaves `epics/`, the seventh.** `phase5/epics/E07.md` is deleted and its
content is [`CUSTOMER_ACCOUNT_ADDRESSES.md`](./CUSTOMER_ACCOUNT_ADDRESSES.md), on the same condition: all
eleven stories `built` and §6 empty — the absent approval gate closed 2026-08-25 by a decision, and
`position`'s writer 2026-08-26 by an implementation. **`E07-S01`..`E07-S11` are unchanged**, and are still
what `docs/data-model.md`, `phase3/adr/ADR-INDEX.md` §4, `CONFLICT_REPORT.md` and §5 of this file cite.
§1's "six exceptions" is now seven and §2's E07 row links to the new path; `epics/` holds E08..E19. Four
things that record held alone were copied out first: the address form's one `"lon,lat"` field with its three
writers, the viewport exemption that stops the map chasing a dragged pin, and the `[longitude, latitude]`
order with its six-decimal rounding to [`docs/frontends.md`](../../frontends.md); and the corrected meaning
of `position` — a hand-typed address is placed by the pin alone, not left unplaced until re-picked — plus
`addresses`' `maxItems: 6` to [`phase2/UBIQUITOUS_LANGUAGE.md`](../phase2/UBIQUITOUS_LANGUAGE.md) §8. That
pass surfaced a third stale claim and corrected it in two files: `me` does not answer "login/verify state",
and never did — its `select` is a positive list of six fields.
v1.36 - 2026-08-26, later the same day: **E08's record leaves `epics/`, the eighth.**
`phase5/epics/E08.md` is deleted and its content is
[`PUBLIC_DISCOVERY_STOREFRONT.md`](./PUBLIC_DISCOVERY_STOREFRONT.md). All ten stories `built`, and §6 no
longer holds a live question — the last one was not answered, it was **removed as a duplicate**:
[`phase1/NFR.md`](../phase1/NFR.md) §Open questions item 2 asks who deploys the edge and on what host, and
owns PF08 and PF09 along with SE09, SE10, SC01 and SC02. **`E08-S01`..`E08-S10` are unchanged**, and are
still what `CONFLICT_REPORT.md` cites. §1's "seven exceptions" is now eight and §2's E08 row links to the
new path; `epics/` holds E10..E19 (it held E09..E19 until E09 moved later the same day). E08-S10 is itself new that day: NFR-PF09 was in E08's scope and traced
from no story, because `marketplace-nginx/test/run.sh` probed `/tiles/` for security headers only — a
`proxy_pass` there would have answered 200 with the whole archive and passed. The suite now asserts the
range. One thing that record held alone was copied out first, into
[`phase4/API_CONTRACTS.md`](../phase4/API_CONTRACTS.md) §4.2: the public search's bounds and their
asymmetry — `clampLimit`, `COUNT_CAP`, `MAX_OFFSET` against `MAX_CROSS_SHOP_OFFSET`, and why
`totalIsExact` is `false` on every cross-shop item read. That table still listed the `search` field and the
`GraphQLPublicSearchResult` type deleted when the search was split, so the copy-out corrected it. The
header version was stale at 1.34 while this changelog stood at 1.35; it is set to 1.36 here rather than
incremented from a number that was never written down.
**Depends on:** `phase1/PDR.md` ✅ · `phase1/NFR.md` ✅ · `phase2/EVENT_STORMING.md` ✅ · `phase2/BOUNDED_CONTEXT.md` ✅
**Mutability:** living document - refined every sprint
v1.37 - 2026-08-26, later still: **E19's §1 row stops saying erasure exists on no tier.** `userDel` was built that day on the customer tier and `user.deleted_ttl` — a 30-day TTL index on the collection E19-S01 indexed — landed with it, so the stamp is carried out rather than kept. No story of this epic changed and no epic opened: the Admin counterpart to `shopOwnerDel` is still absent, which is what E19 §Open questions 3 now carries alone.
v1.45 - 2026-08-27, later still: **`phase5/epics/E12.md` is deleted and its record moves beside this index to [`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md)** — the eleventh to make that move and the **first that is not a bounded-context epic**, being the head of the E12-E18 remediation block. Moved intact, the E01..E10 way rather than distributed like E11, because all twenty-six of its stories are `built`. §1's paragraph goes from ten exceptions to eleven and gains E12's ids; §1's E12 row and §2's ranges are repointed; `epics/` now holds `E13..E19`, annotated on the v1.39 entry that first stated the range. Ten sibling records narrow their own §0 range the same way. ⚠️ No story id changed and no build state moved.
v1.46 - 2026-08-28: **`phase5/epics/E13.md` is deleted and its record distributed, not moved** — the E11 pattern rather than E12's, and the choice is deliberate. E12 moved intact because its twenty-six stories are a surface someone still has to read as a whole; E13's eleven are all `built`, its §6 read *None open*, and what survived a line-by-line audit of the 592-line file was seven facts held nowhere else. Each went to the document that already owns its subject: the six `INTROSPECTION_CODE` comparison sites and the `NoSchemaIntrospectionCustomRule` confusion to [`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3.6, which also had a **stale** snippet showing the pre-E13 `===`; everything about the seventh site in `@axiumine/koa-utils` — 5.9.0's ungated `timingSafeEqual`, 6.0.0 closing it on 2026-08-11 with all ten repos following that day, and `verifyIntrospectionCode` not being consumer-importable — to [`dependency-tree-advisory-scan.md`](../../report/dependency-tree-advisory-scan.md) §6.1, since none of it is fixable from this workspace; and the landing order with its two `BGREWRITEAOF` passes and the *step four is the clock* rule into §2's E13 row above, which is the only part a future cutover would reuse. E13-S04's three unknowns were already carried by [`data-model.md`](../../data-model.md) §Persistence with the platform owner named, so nothing moved for them. `epics/` now holds `E14..E19`. ⚠️ **The epic id, all eleven story ids and every build state are untouched; only the file is gone.**

v1.41 - 2026-08-27, later still: **every `@axiumine/koa-utils` pin in the workspace moved to `^7.0.0`** - the eight
services still on `^6.0.0` and `marketplace-common`'s devDependency, one commit per repo, each `yarn install` moving
only the `koa-utils` entry in the lockfile and each suite green after it. The one API change between 6 and 7 is
`uploadTemp` -> `uploadTempImage`, which no repo here imports. ⚠️ The v1.25 entry below names
`@axiumine/koa-utils@6.0.0` in the clean-auth-path list and stays as written - it was true of what was installed on
2026-08-13, and re-auditing after the bump gives the same 28 advisories and the same 10 HIGH. No story changed state.
v1.40 - 2026-08-27, later the same day: **the npm 404 that shaped E18 is gone, and this index does not rewrite its own history to hide it.** v1.24 and v1.25 record `yarn install` and `yarn audit` as unrunnable in this workspace because `@axiumine/marketplace-common` answered 404 on both registries; `ADR-037` published it on 2026-08-26, and `yarn audit` now completes (734 packages / 80 advisories in `marketplace-dev-public-resource`). Those entries stay verbatim — they were true when written, and a changelog that edits itself is worth nothing. The correction lives where the claims are load-bearing: `E18.md` v2.7, `docs/report/dependency-tree-advisory-scan.md` §2, `README.md` §Test quality gates. ⚠️ `yarn install` remains unverified and unclaimed. No epic or story changed state.
v1.39 - 2026-08-27: **E10's record leaves `epics/`, the tenth and the first that was not a phase-5 story problem.**
`phase5/epics/E10.md` is deleted and its body becomes [`SHARED_KERNEL.md`](./SHARED_KERNEL.md) beside this index,
named for BC-10 as the nine before it are named for theirs. `epics/` now holds `E11..E19` — ⚠️ narrowed to `E12..E19` on 2026-08-27, when `epics/E11.md` was deleted too and its two stories moved into §6.1 below rather than beside this index, per v1.43, and to `E13..E19` later the same day, when `epics/E12.md` was deleted and its record moved beside this index, per v1.45, and to `E14..E19` on 2026-08-28, when `epics/E13.md` was deleted and its record **distributed rather than moved**, per v1.46. Both of E10's open
questions closed the same day: the 4th-tier fork is **moot** — the owner is adding no further backend, so the
authorization-service consolidation stays decided as it is (ADR-002, NFR-AV01) — and the Qodana Cloud project is
**provisioned**, `MP common`/`b892b`, named by the scan artefact on disk. ⚠️ Two claims in the body were also
corrected rather than relocated: `ADR-037` had already made the *"publishing 404s by design"* scope row and
E10-S03's second acceptance criterion false. No story added, removed or re-scoped; all 7 stay `built`.
v1.38 - 2026-08-26, last that day: **E09's record leaves `epics/` and becomes
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md)** — the ninth to move, and
the first to move on a decision that supersedes an ADR rather than on a question answered inside phase 5.
Its §6 held two questions and now holds none: the first became a pointer to `phase1/NFR.md` earlier the same
day, and the second — who owns publishing `marketplace-common` past `deploy-local.sh` — was answered
directly by the platform owner, who owns that repo and every other one here. `@axiumine/marketplace-common`
is published to npmjs, by him personally, and
[`ADR-037`](../phase3/adr/ADR-037-marketplace-common-is-published-to-npm.md) records it, superseding
[`ADR-015`](../phase3/adr/ADR-015-common-consumed-by-package-name-unpublished.md) **in part** — the
publication half only, because ADR-015 also carries the `deploy-local.sh` bridge and the GPL-3.0-or-later
licence and a registry touches neither. ⚠️ **The question had been citing the wrong gap**: it pointed at
`ADR-INDEX.md` §5's *"where the sixteen repos get published, and under which org"*, which is git hosting,
not the npm registry; that bullet stays open and now says so. **`E09-S01`..`E09-S09` are unchanged.** §1's
"eight exceptions" is now nine and §2's E09 row links to the new path; the eight records that had already
moved carry the corrected range in their own §0.

---

## 1. Purpose

Index only. Stories live in `epics/ENN.md` - one file per epic, written by 4 parallel agents, never inline
here. This file lists the 20 epics, states build state against the working tree, and links out.

**Eleven exceptions, all since 2026-08-13:** E01's record is [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md),
E02's is [`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md), E03's is
[`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md), E04's is
[`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md), E05's is [`CATALOGUE.md`](./CATALOGUE.md) (those
three 2026-08-14), E06's is [`CATEGORY_TAXONOMY.md`](./CATEGORY_TAXONOMY.md) (2026-08-25) and E07's is
[`CUSTOMER_ACCOUNT_ADDRESSES.md`](./CUSTOMER_ACCOUNT_ADDRESSES.md) (2026-08-26), E08's is
[`PUBLIC_DISCOVERY_STOREFRONT.md`](./PUBLIC_DISCOVERY_STOREFRONT.md) (2026-08-26, later the same day) and
E09's is [`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md) (2026-08-26,
later still) and E10's is [`SHARED_KERNEL.md`](./SHARED_KERNEL.md) (2026-08-27) and E12's is
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) (2026-08-27, later still), beside this index rather
than under `epics/`. ⚠️ **E12 is the first exception that is not a bounded-context epic**: it is the head of the
E12-E18 remediation block, so the reason a record leaves `epics/` is that it is finished, not which numbering
block it sits in. All fifteen of E01's stories are `built`,
E02's four built stories sit next to one anti-story - a boundary to defend, not work ahead - all eight of
E03's are `built` with its last open question closed the day it moved, all eight of E04's are too, all
nine of E05's are `built` with both of its open questions closed the day it moved, all seven of E06's
are `built` with its own last two closed the day it moved, and all eleven of E07's are `built` with its two
closed a day apart, all ten of E08's are `built` with its one remaining question moved to the file
that owns it rather than answered here, and all nine of E09's are `built` with one question moved the same
way and the other closed outright by [`ADR-037`](../phase3/adr/ADR-037-marketplace-common-is-published-to-npm.md),
and all seven of E10's are `built` with both of its open questions closed the day it moved — the 4th-tier
fork answered moot by the owner, the Qodana Cloud project answered provisioned by the scan artefact that
names it — so all eleven read as the
record of a shipped surface rather than a backlog entry. All twenty-six of E12's are `built` too, with both of its
investigations closed, every defect they found fixed, and its last outstanding-looking row — E12-S15's Cloudflare
half — reclassified an adopter deployment step on the day it moved. The story IDs `E01-S01`..`E01-S15`,
`E02-S01`..`E02-S05`, `E03-S01`..`E03-S08`, `E04-S01`..`E04-S08`, `E05-S01`..`E05-S09`,
`E06-S01`..`E06-S07`, `E07-S01`..`E07-S11`, `E08-S01`..`E08-S10`, `E09-S01`..`E09-S09` and
`E10-S01`..`E10-S07` and `E12-S01`..`E12-S26` are unchanged and
are still what the citing files cite - see each file's §0. E06 is the one set no document cites at all: its
only two references anywhere are code comments in `marketplace-admin`, both naming `E06-S07`. ⚠️ **E07 and E08 both moved
while part of them was days old** - E07-S10 and E07-S11 landed in the week before their move, E08-S10 the
morning of its own, so neither record is purely retrospective the way the six before them were.

Every epic is bound by `phase5/CONSTRAINTS.md` (read in full before this doc was written), and the conflict
order in that doc's §7 governs if any epic file disagrees with this index. **No epic is bound to a bounded
context**: `phase5/CONSTRAINTS.md` §5 attaches no such rule, an epic never owns a context, and the context
column above is a reading aid. See §2.1 for why E12-E18, and E19 and E20 after them, are numbered as they are.

---

## 2. Epic overview

| ID | Epic | Contexts touched (informational) | Tier(s) served | Build state | Repos | File |
|---|---|---|---|---|---|---|
| E01 | Identity & Access | BC-01 | Admin, ShopOwner, User, anonymous (registration) | Built | `marketplace-dev-public-authorization`, `marketplace-dev-authenticated-authorization`, `marketplace-dev-admin-authenticated-authorization`, `marketplace-dev-user-authenticated-authorization`, `marketplace-dev-public-resource`, `marketplace-common` | [IDENTITY_ACCESS.md](IDENTITY_ACCESS.md) — not under `epics/`, see §1 |
| E02 | Session Termination | BC-02 | Admin, ShopOwner, User - one shared service | Built | `marketplace-dev-authenticated-logout` | [SESSION_TERMINATION.md](SESSION_TERMINATION.md) — not under `epics/`, see §1 |
| E03 | Shop Owner Onboarding & Approval | BC-03 | ShopOwner, Admin, **anonymous (self-registration)** | Built - onboarding progress is operator-written by decision (E03-S04), a shop-owner flow is future work | `marketplace-dev-authenticated-resource`, `marketplace-dev-admin-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-common`, `marketplace-db-setup`, `marketplace-shopowner`, `marketplace-admin`, `marketplace-user` | [SHOPOWNER_ONBOARDING_APPROVAL.md](SHOPOWNER_ONBOARDING_APPROVAL.md) — not under `epics/`, see §1 |
| E04 | Legal Entity / Company | BC-04 | ShopOwner, Admin, anonymous (storefront read) | Built | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-authenticated-resource`, `marketplace-dev-admin-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-shopowner`, `marketplace-admin`, `marketplace-user` | [COMPANY_LEGAL_ENTITY.md](./COMPANY_LEGAL_ENTITY.md) — not under `epics/`, see §1 |
| E05 | Catalogue | BC-05 | ShopOwner (write), anonymous (read) | Built - no `price` field and never one, commerce permanently out of scope (ADR-038); an item takes its picture on `itemAdd` and there is no path to replace one | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-shopowner`, `marketplace-user` | [CATALOGUE.md](./CATALOGUE.md) — not under `epics/`, see §1 |
| E06 | Category Taxonomy | BC-06 | Admin (write only), ShopOwner + anonymous (read) | Built | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-admin-authenticated-resource`, `marketplace-dev-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-admin` | [CATEGORY_TAXONOMY.md](./CATEGORY_TAXONOMY.md) - not under `epics/`, see §1 |
| E07 | Customer Account & Addresses | BC-07 | User | Built - identity/account only, no commerce | `marketplace-common`, `marketplace-db-setup`, `marketplace-dev-user-authenticated-resource`, `marketplace-dev-user-authenticated-authorization`, `marketplace-dev-public-resource`, `marketplace-user` | [CUSTOMER_ACCOUNT_ADDRESSES.md](./CUSTOMER_ACCOUNT_ADDRESSES.md) - not under `epics/`, see §1 |
| E08 | Public Discovery / SSR Storefront | BC-08 | anonymous | Built | `marketplace-dev-public-resource`, `marketplace-user` | [PUBLIC_DISCOVERY_STOREFRONT.md](PUBLIC_DISCOVERY_STOREFRONT.md) |
| E09 | Platform Operations & Quality Gates | BC-09 | cross-cutting - engineering concern, not a business tier | Built | all 16 repos' `.githooks/`, `marketplace-db-setup` (migration pipeline), `marketplace-services-status` | [PLATFORM_OPERATIONS_QUALITY_GATES.md](PLATFORM_OPERATIONS_QUALITY_GATES.md) |
| E10 | Shared Kernel (marketplace-common) | BC-10 | cross-cutting - consumed by all 9 backend services | Built - 7 of 7, both open questions closed 2026-08-27 | `marketplace-common` | [SHARED_KERNEL.md](./SHARED_KERNEL.md) - not under `epics/`, see §1 |
| E11 | Ordering & Fulfilment [WILL NOT BUILD] | BC-11 | User (intended, and now permanently unbuilt) | **The context will never be built and nothing here designs it** - no collection, no resolver, no price, by [ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) of 2026-08-27. Both its stories are *recording* stories. **E11-S01 `built` 2026-08-13**: the two criteria were run against the working tree and both found drift - BC-11 quoted `item.js` with a sentence that file does not contain, and the schemas listing was three entries stale. Neither changed a claim. **E11-S02 `built` 2026-08-27**: the owner's decision that no commerce schema is coming, recorded as ADR-038 and swept through the corpus. All five §6 questions close as moot rather than answered - including question 4, the tier-topology one that survived E11-S01 for hiding a blocker; there is no longer a build for it to block | none | §6.1 below, and [ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note — 2026-08-27 — no file of its own, `epics/E11.md` deleted 2026-08-27 |
| E12 | Telemetry & Egress Hardening | hardens BC-09 | cross-cutting - all 9 backend services + the edge | Built - 26 of 26, closed 2026-08-11. E12-S12 and E12-S13 ran against the running Dev stack and found eight defects the static audit could not, which are the new E12-S16 … E12-S23, checking one of those against the frontends added E12-S24, the owner's log-retention answer added E12-S25, and the owner refusing to accept E12-S16's residual added E12-S26 — the customer reset link moves into the URL fragment, out of every log and cache at once, and its cache half is already built. **Every defect either investigation found is fixed**, the 🔴 among them: no service with a `DSN` set ships a request body any more, and E12-S24's browser capture closed the last one — the address bar, query string and fragment included, was reaching Sentry from all three frontends in five distinct places, and `urlQueryParams: false` never gated it. **One item is not this repo's to close, and reclassified 2026-08-27 so it stops reading as open work:** E12-S15's config is in the repo and fully gated, but Authenticated Origin Pulls must be switched on in Cloudflare **before** it is deployed, or every handshake fails from the reload. That is an **adopter deployment step** — there is no zone or host here — owned by whoever deploys this blueprint, the same "the owner cell was the tell" reading §6.1 applies below. It closes no control: R44 and R46 keep their scores per `ADR-032`. See [`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) §7 | all 9 backend services, `marketplace-common`, `marketplace-nginx`, `marketplace-docker-DBs`, `marketplace-user`, `marketplace-admin`, `marketplace-shopowner` | [`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) |
| E13 | Session-Store Hardening & Recorded Decisions | hardens BC-01, BC-09, BC-10 | cross-cutting | **11 of 11 built** - ten on 2026-08-10, **E13-S10 on 2026-08-14**. It deleted the dual-read fallback, the `dual-read-hits` counter and `DUAL_READ_REMOVE_AFTER` across nine repos, reduced the dual delete to one key, and **inverted rather than deleted** the six E13-S02 tests, so an old-shape key now has a test proving it does *not* authenticate. ⚠️ **Both of its gates — the cutover date plus 90 days, and a zero counter — were moot: the platform has never been deployed**, so no pre-cutover session ever existed and the counter key was never created. `BGREWRITEAOF` run the same day; `RISK_REGISTER` R51 closed. **Landing order, recorded here because it is the reusable half of the epic** (BCON-05, BCON-07): `marketplace-common` first — the `NODE_ENV` allowlist, `hashSessionToken`, `constantTimeEquals`, the dual-read/dual-delete paths — then the five inline comparison sites in the three resource services and the logout service, then the logout dual delete, then hashed writes in the four authorization services, and only then **`BGREWRITEAOF` on every Redis node**, once no old-shape writer remains. Production runs `appendonly yes`, so until that rewrite runs the cutover has changed the store and not the file on disk — and a rewrite is local to the node that serves it, so it is per node. Docs and the parent pointer bump close the pass. E13-S10 was step eight, ninety days later, and carried a **second** `BGREWRITEAOF` pass of its own: the first runs while old-shape keys are still live and therefore writes them straight back out. ⚠️ **Step four is the clock, not step one** — the removal date anchors to the last service that stops writing old-shape keys, and setting it from the `marketplace-common` publish instead would end the window while old writers are still running. Also load-bearing and easy to get wrong: `verifySignedRefreshToken` in `@axiumine/koa-utils` returns a **prefixed** string, `` `refresh:${refreshToken}` ``, so the refresh key shape is not simply the token and any hashing must be applied to the value actually used as a key, never to the raw cookie | `marketplace-common`, `marketplace-dev-authenticated-logout`, the three resource services, the four authorization services, `docs/` | this row, plus [`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3.6 (the six comparison sites, named) and [`dependency-tree-advisory-scan.md`](../../report/dependency-tree-advisory-scan.md) §6.1 (the seventh, upstream) — no file of its own, `epics/E13.md` deleted 2026-08-28 |
| E14 | Refresh Family, Reuse Detection & Absolute Lifetime | hardens BC-01, BC-10 | Admin, ShopOwner, User | Built 2026-08-10 - 9 of 9. **Landing order, recorded here because it is the reusable half of the epic** (BCON-05, BCON-07): (1) `marketplace-common` — `IRefreshData`, the two cap constants, `GRACE_SECONDS`, `package.json` exports entries, unit tests; commit, `./deploy-local.sh`. (2) `marketplace-common` — `revokeSessionFamily` and its `ISessionFamilyStore` in their own module, then `resolveAuthorizationSession` (tombstone, grace, cap, structural rejection) with `ISessionReadStore` re-declared as `extends ISessionFamilyStore` — the routine lands first in the same commit, since the resolver imports it; commit, `./deploy-local.sh`. (3) `marketplace-common` — `refreshSessionTokens` (family `sAdd`, tombstone, old-access delete, reordering); commit, `./deploy-local.sh`. (4) `marketplace-dev-public-authorization` — the four login writers, `rememberMe` → `sessionCapDays`. (5) the three `*-authenticated-authorization` services — old-access-token extraction and both rate limiters, structurally identical, landable in parallel. (6) `marketplace-admin`, `marketplace-shopowner`, `marketplace-user` — the retry path for E14-S04, and E14-S07's five comment corrections; comment-only, so they may land with step 4 instead. (7) parent workspace — one commit bumping every touched submodule pointer (ADR-031). **Steps 4–6 cannot be committed before step 3's `deploy-local.sh` has run** — an undeployed `marketplace-common` edit is invisible and fails at the call site (BCON-07). E14-S09 was run against the Dev stack and `GRACE_SECONDS = 10` is confirmed on measurement; its finding names two defects *under* the epic that stay open — see [multi-tab-refresh-behaviour.md](../../report/multi-tab-refresh-behaviour.md) §4, §5 and §9 | `marketplace-common`, `marketplace-dev-public-authorization`, the three `*-authenticated-authorization` services, `marketplace-admin`, `marketplace-shopowner`, `marketplace-user` | this row, plus [`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 (two rejected alternatives — the tier-keyed privilege gradient for the session cap, and the cached-successor-pair grace design), [`docs/architecture.md`](../../architecture.md) (the abandoned `// if remember me, generate ?` cookie-side comment in koa-utils' `setLoginCookies`, which E14-S07 does not revive), [`RISK_REGISTER.md`](./RISK_REGISTER.md) R52 (two windows, not one), [`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) (the Cloudflare rate-limiting-rules alternative to `limit_req_zone`), §2.1 below (why E17 depends on E14 for `familyId`, and why an operator console can never key a session by a token value — `epics/E17.md` deleted 2026-08-28) and [`token-handling-security-audit.md`](../../report/token-handling-security-audit.md) §3.4 (the cross-service-harness residual) — no file of its own, `epics/E14.md` deleted 2026-08-28 |
| E15 | Session Index, Account Revocation & Credential Teardown | hardens BC-01, BC-02, BC-03 | Admin, ShopOwner, User | 10 of 10 built - E15-S01 closed the live `logout` no-op and E15-S09 the context type that hid it, both 2026-08-12; E15-S08 closed 2026-08-13 against a gate E01-S11 had already built. **E15-S02 built 2026-08-13: the account index exists** and every login and rotation files its session under it, with no keyspace scan anywhere. **E15-S03 the same day: it prunes itself** — rotation and logout unfile, everything else expires with a per-field `HEXPIRE` at the session's cap, which puts a checked Redis 7.4 floor under the platform. **E15-S04 the same day: one routine revokes an account**, so `marketplace-common` is finished for this epic. **E15-S05 the same day: a password change ends every session**, caller included, on the only two services that have a password-change mutation — which surfaced the public reset-password flow as an uncovered credential write (open question 4). **E15-S06 the same day: writing a login email ends that account's sessions**, at its one call site, with a per-repo enumeration test standing guard over the next one. **E15-S07 the same day: parking a ShopOwner ends the sessions they were holding**, so `disabled` and `waitApprov` stop being labels that only bite at the next rotation — while releasing an account deliberately revokes nothing. **E15-S10 built 2026-08-28: the public reset flow ends the sessions it just made resettable** — the fourth credential-write service, the one the landing order never named and the path a compromised account is most likely to take. It closed open question 4 as a story rather than an epic, since it carried no decision this epic had not already made: the routine is E15-S04's, the rule is E15-S05's, the tier constant is ADR-002's. What it added is the read — an unauthenticated caller carries no account id, so the id is read by `login.email` after the koa-utils delegate returns, and the ShopOwner half needed a resolver wrapper that had never existed. The epic is complete and leaves nothing behind. **Landing order, recorded here because it is the reusable half of the epic** (BCON-05, BCON-07): (1) `marketplace-dev-authenticated-logout` alone — E15-S01 and E15-S09, the live defect and the context type that hid it, ahead of everything and touching no key shape. (2) `marketplace-common` — the index writer, the per-field `HEXPIRE` prune and `revokeAllSessionsForAccount`, in that order, each followed by `./deploy-local.sh`; nothing downstream can be committed before that publish, since an undeployed edit is invisible and fails at the call site (BCON-07). (3) the four session writers — `marketplace-dev-public-authorization` plus the three `*-authenticated-authorization` services — which all reach the index through the **one** `setRedisLoginSession` they share, so the write lands once rather than four times. (4) the credential writes — the two `*-resource` services that have a password mutation, then the email-write call site. ⚠️ **Step 4 never touched `marketplace-dev-authenticated-resource`**: ShopOwner has no password-change mutation of its own, and reading the absence as an oversight is the mistake to avoid. (5) `marketplace-dev-authenticated-logout` re-entered, which is why step 1's repo appears twice. (6) `marketplace-docker-DBs` — the Redis 7.4 floor the `HEXPIRE` prune puts under the platform, recorded operationally rather than in code. (7) parent workspace — one commit bumping every touched submodule pointer (ADR-031). E15-S10 arrived after all seven and added a **tenth** repo the order never named, `marketplace-dev-public-resource` | `marketplace-dev-authenticated-logout`, `marketplace-common`, `marketplace-dev-public-authorization`, `marketplace-dev-public-resource`, the three `*-authenticated-authorization` services, the three `*-resource` services, `marketplace-docker-DBs` | this row, plus [`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 (three refused designs — the lazy prune, "revoke all but me", and `familyId`/the cap in the index value), [`docs/data-model.md`](../../data-model.md) §The account index (the key shape and every load-bearing property of it), [`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md) §3.1 (the "log in again" screen no story owns), [`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md) (parking revokes, releasing does not), [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md) (the email-change findings and the one Product question E15's §6 still held), [`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md) (`credentialWriteRevokes.test.mts`), [`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3 (why `checkShopOwnerApproval` runs after the password check) and [`marketplace-docker-DBs/README.md`](../../../marketplace-docker-DBs/README.md) §Redis (the 7.4 floor) — no file of its own, `epics/E15.md` deleted 2026-08-28 |
| E16 | Signing-Key Custody & Rotation | BC-01, BC-10 | Admin (operates), all tiers (affected) | **Built 2026-08-13, by ADR-034's mechanism rather than this epic's** - S01, S02, S03, S05, S06 by E01-S12…E01-S15; S04, S07, S08, S09 in E16's own name. R02 `Mitigated`, residual at R47. **No record file** — `epics/E16.md` deleted 2026-08-28, its record distributed. ⚠️ **This epic is the one whose mechanism was swapped under it, so what it *asked for* survives only here.** Six scope rows were written against a Mongo store and every one shipped as something else. **E16-S01** — a `signingKey` collection with its own migration and DEK → one AES-256-GCM-wrapped Redis record at `<REDIS_KEY>keygrip`; the `current`/`verifiable`/`retired` lifecycle → an **ordered list** where the states are positions and no `state` field exists. **E16-S02** — an in-process snapshot on a refresh interval → `watchKeygrip`, a pub/sub nudge with `KEYGRIP_POLL_MS = 300_000` as the lost-message ceiling rather than the propagation time. **E16-S03** and **E16-S04** — `rotate()`/`forceRetire()` domain functions → the Admin GraphQL mutations `keygripRotate`/`keygripRetire`, rotation **prepending** to the list so no step ever leaves zero signing keys and the `findCurrent() === null` branch it specified having no counterpart at all — a service refuses to boot without a record, so an empty keyring is unreachable from a running platform. **E16-S05** — a Mongo bootstrap → `seedKeygripRecord` in `marketplace-db-setup/lib/keygrip.js`, idempotent, against Redis, with `--force` as the explicit opt-out and no Stryker exclusion argued for. **E16-S06** — env-var removal → `KEYGRIP_KEY_1`/`_2` out of five `env` templates and five `REQUIRED_ENV_VARS` **behind an eslint ban on `process.env.KEYGRIP_KEY_` in `src/**`** (E01-S15), a control no criterion asked for and the one that makes the removal permanent rather than momentary. The two `Out` rows and the permanent one were honoured: no UI here (E17's), no DEK rotated, nothing on the GraphQL surface able to carry key material. Two readings that do not survive anywhere else: **`marketplace-dev-public-authorization` went 16 → 15 `REQUIRED_ENV_VARS`, a net of one and not a one-for-one swap** — two variables left and one arrived, so the "new count" E16-S06 predicted was wrong in the direction nobody checks; and **the platform owner's authorisation to change the middleware contract across all five services was granted and never spent** — E16-S02 took its own stated fallback instead, a real `Keygrip` rebuilt per adoption with `app.keys` **reassigned** rather than mutated, which turned out stronger than the duck-typed provider the criterion asked for because reassignment gives every in-flight request a stable array. That authorisation is recorded as **unspent**: it is not standing permission to reopen the contract. | `marketplace-db-setup`, `marketplace-common`, the five cookie-touching services, `marketplace-dev-admin-authenticated-resource` | this row, plus [`ADR-034`](../phase3/adr/ADR-034-keygrip-keys-live-in-redis-wrapped-under-a-kek.md) (the mechanism, and §Amendment 2026-08-28 for the retirement clock, which now carries §6 q2's answer — why thirty and not ninety, the inverted justification corrected, and the honest window), §2.1 below (the landing order that was planned and not executed), [`keygrip-rotation-propagation.md`](../../report/keygrip-rotation-propagation.md) (both measurements, the straddle analysis and §8's stale-workstation note) and [`RISK_REGISTER.md`](./RISK_REGISTER.md) R02/R47/R50 — no file of its own, `epics/E16.md` deleted 2026-08-28 |
| E17 | Admin Session Console | BC-01, BC-10 | Admin | **Built 2026-08-13 - 9 of 9**, and all five open questions answered: the reuse trail is a **capped Redis list** (50 events) kept **30 days from its last event**, sessions are readable **per account only** — one `hGetAll`, no keyspace scan — and an operator's revoke is **not attributable**, which is a second store's decision rather than a third value in `REUSE_EVENT_ACTIONS` — **for the session-revoke resolvers, which is all question 4 ever covered.** Key custody, shipped by E17-S08 in the same epic, attributes the opposite way: `funKeygripRotate.mts:83` and `funKeygripRetire.mts:77` name the acting Admin in a Sentry line. **Question 5, added and answered 2026-08-28:** the operator is named by `sha256Hex(_id)` in both writers. A `captureMessage` string becomes `event.message`, the one bag `sentryBeforeSend` does not walk, so the raw id was leaving the host verbatim; the digest stays resolvable by whoever holds the `admin` collection and names nobody to the vendor. The handling `assertUnderRateLimit` already gave this same value. E17-S04 landed as a *correction* to E15-S04's already-shipped routine: the index is re-read before it is deleted, bounded at three attempts, and left in place on exhaustion. E17-S07 is a gate rather than a convention — a loop over all seven operations on both sides, with fixtures carrying secrets in fields no document selects, a control test proving the app really authenticates, and a coverage test that fails when an eighth operation is added. E17-S09's decision note argues the ninth service from R02/R03/R04 and cites neither ADR-006 nor NFR-AV01, deliberately. **No record file** — `epics/E17.md` deleted 2026-08-28, its record distributed. **The epic is render-only and that is a position, not a limitation:** it shows what E15 and E16 already enforce and adds no security control of its own, because a control that fires when a human notices something is not a control. Two scope rows are refusals rather than deferrals — **displaying a token, a token prefix, a key or a key prefix is out permanently**, stated by the platform owner as the condition of this epic existing, and **anything network- or device-derived on a session row is out** under the standing GDPR decision: no IP, not truncated, not hashed, not salted. **E17-S01** — the Admin schema slice is hand-edited **before** `yarn codegen` runs, and the commit carries the slice and `src/gql/adminResource/` together because the generated file is a build output of that edit; `GraphQLReuseEventAction` has its own backend file and takes its values from `REUSE_EVENT_ACTIONS` in `marketplace-common`, with a test asserting the two sets equal so the frontend's union and the strings written into Redis cannot drift. Field sets are asserted **by name, not by snapshot** — a snapshot answers a field added later by asking to be updated, and that update looks like every other one: `GraphQLSession` is exactly `['id', 'tier', 'mintedAt', 'familyId']`, `GraphQLReuseEvent` exactly `['familyId', 'tier', 'accountId', 'action', 'at']`, with thirteen banned names refused and nothing nullable. **E17-S03** — `revokeSession` is one single-key `del` plus one `hDel` and **both always run**, so an already-dead session still has its index field pruned and the call answers `false` rather than throwing; the order is load-bearing — session key first, index field second, because the reverse leaves a live session listed nowhere, invisible to the operator *and* to E15-S04's revocation. Metering is `guardSessionWrite`, 60/hour per operator **per operation**, keyed off the Redis session's account id: `app.proxy` is off on every service here, so an address-keyed counter would be one global bucket the whole platform spends, and the per-address half of rate limiting belongs to the edge's `conf.d/20-rate-limit.conf`. **E17-S05** — the trail is five fields and a test asserts the stored line's key count, so a sixth cannot be added quietly; the vocabulary is two values, one per call site — `refreshTokenReplayed` (E14-S02/S03) and `sessionCapReached` (E14-S05) — and the account comes off the tombstone, which gained `_id` and `tier` for this because by replay-detection time the session hash is gone. A marker written before that change still revokes and only loses its event. **E17-S06** — one route rather than several, and the gap line was wrong about this repo: **`marketplace-admin` has no `src/routes/`**; the tree is `createAppRouteTree()` in `src/router.tsx`, where `/security` was added with a `validateSearch` schema, so the account under investigation is a **search parameter rather than local state** and an operator can hand a colleague its URL. All four destructive actions — end one session, end every session, rotate, retire — name their blast radius instead of asking "are you sure", pluralised so "all 1 sessions" never appears, and both revoke texts state E17-S03's residual, because an operator who believes a revoke is instantaneous is one who will not look again in five minutes; the tests assert the text verbatim and assert that **refusing the confirmation fires no mutation at all**, which is the criterion's real content. The key-custody half of that screen is **E16-S07**'s resolvers, whose only consumer it is | `marketplace-dev-admin-authenticated-resource`, `marketplace-admin`, `marketplace-common`, `docs/` | this row, plus §2.1 below (the landing order, and why an operator console can never be built on a token value), [`admin-session-tooling-placement.md`](../../decisions/admin-session-tooling-placement.md) (E17-S09's decision note), [`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md) (the revocation routines the console drives) and [`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) (why the operator's id is a digest in the custody audit line) — no file of its own, `epics/E17.md` deleted 2026-08-28 |
| E18 | Auth Regression Coverage & Documentation Truth-Up | hardens BC-09, BC-10 | cross-cutting | **13 of 13 built** - **E18-S01 verified `built` 2026-08-13 and this epic did not build it**: all three resource services now test the wrong tier, the missing tier and 403-not-401 against their own middleware, having gained those tests with the tier discriminator itself. **E18-S02 built 2026-08-13** — eleven cases in `marketplace-common`, tagged in all seven authenticated services, a per-repo contract test that fails on a missing tag, the contract in `docs/testing.md`; it closed two real gaps in the three authorization services (the introspection allowlist, and the replay refusal asserted only from the writing side). **E18-S03 built 2026-08-13** — nine exact `REQUIRED_ENV_VARS` lists asserted by value and by order, nine services proved to reject out of `start()` before touching a datasource, and the silent **exit 0** on a failed required-env check fixed. **E18-S05 built 2026-08-13** — 30 encrypted field paths under 4 DEKs enumerated, the personal data left in the clear written down with a reason each, and the storage layer measured: MongoDB Community carries no encryption option in the binary and both volumes sit on an unencrypted filesystem, with every other environment **unknown** because none exists. It corrected two of its own premises — Redis session values carry a plaintext email into the AOF, and the keyspace stopped being credentials at E13-S01 — closed the audit §5 item and opened **R48**. **E18-S04 built 2026-08-13** — 54 advisories placed and judged across the 14 repos that have a tree, the whole auth path named and versioned and found clean, the external-and-unmodifiable boundary stated once; `yarn audit` turned out unusable here, seven services ship an `axios` they never load, and Qodana's vulnerable-dependency inspection runs on every commit and reports zero. It opened **E18-S10**, **E18-S11**, **E18-S12** and **R49**, and rewrote **R21**. **E18-S10 built 2026-08-13** — the mail SDK and its `axios@0.21.4` closure removed from the seven services that never loaded it, the credential pair no longer required by two services that cannot send mail, and all six mail variables finally required by the one that can. It established that `yarn install` cannot run anywhere in this workspace, so the seven lockfiles were pruned by a rewriter verified byte-identical on a control repo; and its new startup check caught `APP_DOMAIN_USER` missing from this machine's environment, meaning every customer verification link built here carried the string `undefined`. **E18-S13** opened for six variables two services require and nothing reads. **E18-S06 built 2026-08-13** — the audit report amended **in place** as open question 2 decided, an outcome appended under every finding and a §7 closing record added with nothing above it rewritten; the story's own table is 17 rows, the 15 findings plus §4 and §5, each naming the file and line where the document now reads true **and the story that closes it** — **E15-S08**, **E12-S14**, **E13-S04**, **E13-S06**, **E13-S07** or **E13-S08** where an earlier epic already carried the adjacent code, and this story itself where none did; §3.6c's reachable `INTROSPECTION_CODE` port was routed instead to **ADR-032**, unwritten on that date and written since. `docs/architecture.md` gained *What one session is made of*; ADR-001, ADR-023, `SECURITY_AUTH.md` and `docs/testing.md` lost `KEYGRIP_KEY_1/2` as a live env value and Qodana as an SCA gate. **E18-S07 built 2026-08-13** — `RISK_REGISTER.md` v1.12: R21 and R02 closed, each naming the story that closed it, and R02's closure split its provisioning residual out as **R50** so a closed row carries no open one; **R51** (dual-read fallback, trigger is the cutover date *and* a zero counter) and **R52** (distinct-token flood against `refresh`) added; four of the six residuals the story listed already had rows, because E12, E13, E16 and E18's own investigations took R42–R49 as they found them. §4's totals were recounted and were wrong before the pass: 53 rows, not 49. **E18-S08 built 2026-08-13** — `docs/testing.md` gained *The mechanical checks*: twelve rows, MC-01..12, each naming what is checked, the command that runs it and the file it lives in. Ten are `yarn` in a repo and four are `./scripts/audit-check.sh`, **the workspace's first cross-repo gate**, which exists for one reason — no test on this platform spans two repos, and four of these claims are about sixteen repos agreeing; it reads only, with no writes, installs, containers or running service. Two of its checks were enforced by nothing and now are: `marketplace-common/test/redisKeyspace.test.mts` names all fourteen key shapes, marks each builder digest-or-pass-through with a written reason for every pass-through, and — the load-bearing half — **counts the `${process.env.REDIS_KEY}` interpolations per file**, so a fifteenth cannot land quietly whether it is exported or inlined; and the `no-restricted-syntax` block against unguarded `sendDefaultPii`, which E12-S04/E12-S22 put in the ten backend repos and in none of the three apps — the tier where `src/instrument.ts` is *excluded from coverage* by decision, so a `sendDefaultPii: true` added there would have shipped behind a green run — now carried by all three with eight fixtures proving each selector fires, because in these configs a rule filed under the wrong glob is inert and reads exactly like one that holds. ⚠️ **§2 was red on its first run, and that is the story's own evidence**: six live key shapes were in the code and in no document — `reuse:<tier>:<accountId>` (E17-S05), `grace-hits` (E14-S04), `keygrip`, `keygrip:holders`, `keygrip:rotated` (ADR-034) and `hash-field-ttl-probe` (E15-S03) — with two more rows still reading *planned* for shapes live since E14 landed; the first thing a check written to make the next audit cheaper did was find six things the audit had missed. Two items stay manual and say why: what a caller passes as a rate-limit `identity` — digesting is precisely what makes a wrong one indistinguishable, so the line is held by `app.proxy` staying off — and whether a tagged boundary test still tests its case, which only mutation testing catches. **All twelve read source**, which is what E18-S09 was for. **E18-S09 built 2026-08-13** — the auth path run against the live Dev stack rather than read: 412 / 499 / 498 on the three malformed inputs, 403 in all six wrong-tier combinations, rotation with a tombstone and an index row rewritten rather than appended, 409 for a replay inside `GRACE_SECONDS`, and **E15-S01's logout fix confirmed live** on all three tiers. It found two things reading had not, **neither of which had a story anywhere in phase 5, both fixed the same day on the platform owner's decision**. `registerNewUser` hashed the password and handed it to `User.create` while `LoginSubDocSchema`'s `pre('save')` hashed it again, so a first registration stored `bcrypt(bcrypt(password))` and the account could never log in — measured, not inferred, with `registerNewShopOwner` the same three lines; it survived every gate because the restart-registration paths write with `updateOne`, which runs no document middleware. **Accounts already registered through the broken path are not repaired by the fix and need a password reset.** And E14-S06's retirement of the previous access token ran only `if (presentedAccessToken)`, so a refresh made with no `Authorization` header — the page-reload path, structurally, since the token lives in memory — orphaned an access token that was in no family, in no index row, and reachable by neither revocation routine nor the E17 console; five accumulated during the story's own probing. The refresh hash now carries `accessKey`, and **R54 is closed**. Its one documentation correction: `SETUP.md` §5 and §8 said five services take `KEYGRIP_KEK` and that no `*-resource` service may — six do, `admin-authenticated-resource` hosting E17's rotation mutations, and it was found by that service refusing to boot rather than by reading; the holders table is still five rows, because opening the record and signing with it are different things, and both counts now sit next to each other. **E18-S11 built 2026-08-13** — the cause was a **profile** gap, not the Ultimate Plus licence: `VulnerableLibrariesLocal`, the inspection every `qodana.yaml` arms, is an offline heuristic that queries no advisory feed, while `VulnerableLibrariesGlobalInspection` — the class in the same image that calls `vulnerability-search.jetbrains.com` — is in no profile file and in no scan log this workspace has produced. Rather than reverse-engineer a JetBrains profile, the gate is `trivy fs` in a pinned `aquasec/trivy:0.70.0`, HIGH and CRITICAL only, production tree only, in `.githooks/pre-push`, exercised both ways before landing: exit 1 on `public-resource`'s `axios@0.21.4`, printing all ten CVE ids with their fixed versions, and exit 0 on every other tree. Two things measurement changed: **`--skip-dirs .stryker-tmp` is load-bearing**, because a crashed mutation run leaves a sandboxed *copy* of `yarn.lock` that trivy weighs like the real one — one such sandbox still carried `axios@0.21.4` and `picomatch@2.3.1` after both had left the tree; and the target count is **fifteen rather than fourteen**, since `marketplace-services-status/` is real application code inside the parent repo. The threshold was **not** tuned to green the tree: `marketplace-dev-public-resource` cannot be pushed until R49 is decided. **There is no CI to put the gate in** — no `.github/` directory exists in any of the sixteen repos, and the two git hooks are the whole gate apparatus. ⚠️ **The residue this story named is still live.** The "Qodana does SCA" claim came out of every `pre-push` header and every `REPO.md`, `CLAUDE.md` and `COVERAGE.md` that described the push gates — a documented check that reports nothing is the same defect one layer up — but **the `pre-commit` hooks still describe the same Qodana scan as doing SCA, in three places each**, and `docs/` carries dozens more mentions. E18 counted fourteen such hooks; **as of 2026-08-28 there are sixteen**, so the residue grew rather than shrank, and it has no story. **E18-S12 built 2026-08-13** — `tsc-alias` rewrites path aliases in `dist/` at build time and is imported by nothing at runtime; it moved from `dependencies` to `devDependencies` in the eight services that had it misplaced, `authenticated-logout` having had it right all along, and it was **the only reason `picomatch@2.3.1` — a ReDoS advisory — counted as a production dependency anywhere in this workspace**. **E18-S13 built 2026-08-13** — all six variables left `REQUIRED_ENV_VARS` and the committed `env` templates of `authenticated-resource` and `admin-authenticated-resource`, with the history kept as a comment at the list itself rather than in a record: `EMAIL_FROM`, `PLATFORM_NAME` and `DEV_TEAM_EMAIL` are read only by `SocketLabsLib`, which neither service imports, and `SAMESITE_COOKIE`, `HIT_STATS` and `REDIRECT_DOMAIN` are read by nothing anywhere — no `src/` file in any of the nine services, no `dist/` in either `@axiumine` package. ⚠️ **`SAMESITE_COOKIE` is the one that looks load-bearing and is not**: the cookie policy it appears to name is the literal `sameSite: 'Strict'` in `@axiumine/koa-utils`, which reads no variable, and the edge's `Secure` rewrite (ADR-034) is nginx config. A required variable nothing reads teaches operators that the list is noise, which is the one thing it cannot afford to be. The story predicted it changed no runtime behaviour and **that was wrong** — dropping a name means the service now boots without it, which silently gutted two `startFailure.itest.mts` suites; the trap is recorded in [`docs/testing.md`](../../testing.md) | `marketplace-dev-authenticated-resource`, `marketplace-dev-admin-authenticated-resource`, all 9 services, `docs/` | this row, plus [`docs/testing.md`](../../testing.md) (*The mechanical checks* MC-01..12, and the two traps this epic's findings left), [`RISK_REGISTER.md`](./RISK_REGISTER.md) (R48–R54), [`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md) §6 (the one question this epic leaves open — who reviews a newly-red advisory under a pinned scanner image, and who decides a `.trivyignore` line), [`live-auth-path-observation.md`](../../report/live-auth-path-observation.md), [`encryption-at-rest-coverage.md`](../../report/encryption-at-rest-coverage.md) and [`dependency-tree-advisory-scan.md`](../../report/dependency-tree-advisory-scan.md) (E18-S09's, E18-S05's and E18-S04's investigations) — no file of its own, `epics/E18.md` deleted 2026-08-28 |
| E19 | Customer Administration | BC-07 operated from the Admin tier - no new context | Admin (operates), User (affected) | **Built 2026-08-25 - 5 of 6 built and the sixth an anti-story, opened and closed the same day.** The operator now has a `/customers` list and the switch `user.disabled` never had a writer for: E19-S01 added the collection's second index in a new migration, E19-S02 `usersActiveTbl`, E19-S03 `userUpdateStatus` — which revokes every session that customer holds when the flag goes on, and none when it comes off — and E19-S04 the screen. The list is **clear fields only** - `registeredAt`, the three status flags, and `login.email` returned but never sorted or prefix-matched - so ADR-029 stands untouched, no field changed algorithm and no database was rebuilt. E19-S05 is the anti-story holding that line, and it is the reason the screen has no search box and one sortable column. E19-S06 trued up the five places that said this surface did not exist. §6 keeps five open questions, erasure the one worth reading — and it has since been answered on one side: `userDel` was built 2026-08-26 on the **customer** tier, with the 30-day purge that gives the stamp its effect landing the same day as `user.deleted_ttl`, a TTL index on the collection this epic added its second index to. What the question still carries is the **Admin** counterpart to `shopOwnerDel`, which no story here proposes — ⚠️ **and the rest of that sentence was reversed on 2026-08-29**: `user.deleted_ttl` is dropped by E20-S01, retention became an overwrite in place, and a re-registration inside the thirty days now restores the account rather than destroying it (ADR-041, ADR-046). The Admin counterpart is still absent, and is E20 §6 question 5 as well now | `marketplace-db-setup`, `marketplace-dev-admin-authenticated-resource`, `marketplace-admin`, `docs/` | [E19.md](epics/E19.md) |
| E20 | The Account Lifecycle | BC-01, BC-03 and BC-07 crossed by one lifecycle - no new context and none redrawn | Admin (operates), ShopOwner and User (both live it) | **Built 2026-08-29 - 12 of 13 built and the thirteenth an anti-story, opened and closed the same day, across twelve repositories - the widest single change the platform has taken. Nothing is merged.** Six ADRs ([ADR-041](../phase3/adr/ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md) to [ADR-046](../phase3/adr/ADR-046-the-retention-window-is-an-undo-window.md)) turn suspension and closure into **states with an actor, a scope and a way back**, and one sentence of the platform owner's organises all of them: *"if admin suspend an account, admin must remove the suspension for allow the shopowner to log in again."* E20-S01 makes `disabled` a triple - the flag, `disabledBy`, `disabledReason`, held together by `dependencies: { disabled: ['disabledReason'] }` - on `user` and `shopOwner` alike, and **drops `user.deleted_ttl`, the platform's only hard delete**, in a second migration rather than by editing the immutable first. The 1000-character cap on the reason lives in the Admin tier's input validation and nowhere else: the field is randomly encrypted, and a `binData` has no length a validator can read. E20-S02 writes the triple and cascades it - suspending or closing an owner takes every company and every item under them to `published: false` in the same transaction - and **nothing republishes on release**, by the owner's ruling *"restoring a shopowner, restore only his account"*: E20-S06's `itemsUpdatePublished` (bounded at 500 ids) and E20-S10's select-all bar are how the owner puts a shop back by hand. E20-S03 is the day-30 sweeper that overwrites `login.email`, `login.password` and the personal paths **in place** and leaves the row standing for ever, E20-S04 the two operator reads, E20-S05 `shopOwnerDel` - no arguments, an owner closing their own account. E20-S07 moves an unconfirmed registration out of the collection into one Redis key with a three-day TTL carrying the same deterministic ciphertext the collection indexes, so a confirm copies rather than re-encrypts, and E20-S08 turns the thirty days into an **undo** window: registering again at the same address and confirming restores the same `_id`, unpublished, back in the approval queue, with a suspension surviving it. E20-S09 is the operator's reason form, E20-S11 the privacy notice that states the whole lifetime to the person it is about, E20-S12 the true-up of what the earlier decisions said. E20-S13 is the anti-story: a lint rule in four services refusing the four **write** shapes of `disabled*` on any tier but `Admin` and refusing no read, because the reads were never the gap. §6 opens six questions - the scrub's reach into `company.contactPerson`, and the still-absent Admin `userDel` inherited from E19, the two worth reading | `docs/` (parent), `marketplace-db-setup`, `marketplace-dev-admin-authenticated-resource`, `marketplace-dev-authenticated-resource`, `marketplace-dev-public-resource`, `marketplace-dev-user-authenticated-resource`, `marketplace-dev-authenticated-authorization`, `marketplace-dev-user-authenticated-authorization`, `marketplace-dev-public-authorization`, `marketplace-admin`, `marketplace-shopowner`, `marketplace-user` | [E20.md](epics/E20.md) |

### 2.1 E12-E18 are numbered in landing order

E01-E11 are numbered by bounded context. **E12-E18 are numbered by the order they should land**, because a
remediation backlog with a dependency chain is read as a sequence and numbering it any other way invites the
wrong one:

| # | Epic | Why here |
|---|---|---|
| E12 | Telemetry & Egress Hardening | Depends on nothing, blocks nothing, and E12-S01 (`rejectUnauthorized`) is severe and near-free. No reason to wait |
| E13 | Session-Store Hardening | E13-S01 hashes the session key namespace. E14's `family:`/`used:` keys and E15's `idx:` hash all store session key names - built before this, they are *new* raw-token structures and a Redis dump comes out worse than it went in |
| E14 | Refresh Family & Absolute Lifetime | Widens `IRefreshData`, which E15 also writes to. Landing it second avoids editing that type and the four login writers twice. **Depends on E13-S01** — a hard ordering, not a preference: every key this epic introduces (the `used:` tombstone, the `family:` set, the pre-lookup rate-limit bucket) is derived from a session token, and built before E13 hashes the key namespace they would be new raw-token structures in Redis, the exact thing E13 exists to remove — after E13-S01 each is a SHA-256 digest through `hashSessionToken`. **Land E13-S01 and E13-S02 first** — this deviates from the audit's own §6 suggested order |
| E15 | Session Index & Credential Teardown | Needs E13's hashed keys and E14's session shape. **The E13-S01 dependency is a hard ordering, not a preference**, and for a reason of its own: this epic's `idx:` hash stores *session key names as its fields*, so built before the namespace is hashed it would collect every live credential on an account into one greppable structure and make a Redis dump strictly more dangerous than it already is — the opposite of what an index for revoking sessions is for. After E13-S01 each field is a SHA-256 digest through `hashSessionToken`. **E15-S01, the broken-logout fix, is exempt and should land ahead of everything** - it is a four-character fix to a live defect and touches no key shape |
| E16 | Signing-Key Custody | Independent of E13-E15; placed here so it sits next to the console that operates it. **Its own seven-step landing order was planned and never executed as written** — it is kept here because the two constraints it encodes were honoured anyway and both outlive the plan: (1) `marketplace-db-setup` — migration, shared `$jsonSchema`, DEK entry; (2) `marketplace-common` — the keyring provider, `rotate`, `forceRetire`, the bootstrap under `lib/`, then `./deploy-local.sh`; (3) the five cookie-touching services — `app.keys` assignment, deployable alone because the env var still worked; (4) `marketplace-dev-admin-authenticated-resource` — the GraphQL surface; (5) the five services again — env-var removal and the count corrections, only once step 3 was verified everywhere; (6) `docs/`; (7) the parent, one commit bumping every touched submodule pointer (ADR-031). E01-S12…E01-S15 landed the substance against Redis instead, so **steps 1 and 5 have no counterpart and step 3 folded into step 2**. What held regardless is **BCON-05** — `marketplace-common` lands before its consumers — and **BCON-07** — the env-var removal lands *after* every service can already read the record, so the platform is never in a state where neither source works. A future custody change inherits those two, not the seven steps |
| E17 | Admin Session Console | Renders E15's index, E14's reuse events and E16's resolvers. Cannot precede any of them. **Depends on E15-S02 and E15-S04** — the index and the revoke routine; E17-S04's re-read is a correction *to* E15-S04 and had to land with it rather than after it. **Blocks nothing** — it is the last epic that builds anything, and only E18's coverage and documentation truth-up follows it, by construction. **Depends on E14-S01 and E14-S03** — `familyId` on the session, and the revocation whose events E17-S05 shows. ⚠️ **E17 addresses a session by a non-secret id and can never be built on a token value**: that is the constraint that stops an operator UI from ever keying sessions by the refresh token, and why `familyId` is what it keys them by instead. **Landing order, five steps**, recorded here because `epics/E17.md` is deleted (BCON-05, BCON-07): (1) `marketplace-dev-admin-authenticated-resource` — the four resolvers, the `GraphQLReuseEventAction` file and their tests; (2) `marketplace-common` — E17-S04's re-read before delete; (3) `marketplace-admin` — the schema slice **first**, then `yarn codegen`, then the route and components; (4) `docs/` — E17-S09's decision note and the `docs/architecture.md` table; (5) parent workspace — one commit bumping every touched submodule pointer (ADR-031) |
| E18 | Coverage & Documentation Truth-Up | Records what the other six did, so it closes last. **E18-S01 is the exception** - the `assertTier` reject tests depend on nothing and the audit ranks them second overall |

This ordering deviates from the audit's own §6 suggested sequence, which put §3.3/§3.4 first. The reason is
E13: the audit ranked findings by severity, not by which fix makes the next fix safe to build.

**E19 continues the count and belongs to neither scheme.** It is not a bounded context — BC-07 already has
E07 — and it is not part of the audit backlog, whose numbering closed at E18 when the last of the seven
landed. It takes the next free number for the only reason left: it is the nineteenth epic. Its own stories
are ordered by landing order internally (§5 of that file), which is the E12-E18 idea applied inside one epic
rather than across a block. A twentieth epic opened the same way takes E20 and needs no scheme either — the
context rule that would have demanded one has been gone since 2026-08-11 (§2.2). ⚠️ **That happened on 2026-08-29**, four days
later: E20 — The Account Lifecycle — took E20 for the same reason E19 took 19, and named three contexts
(BC-01, BC-03, BC-07) while owning none of them. The sentence above is left as written because it was a
prediction and it held; annotating it is this document's v1.40 rule.

### 2.2 Why E12-E18 are a separate block

E01-E11 are a **retrofit index** describing a platform that already exists; each happens to line up with one
bounded context because that is how the domain map was walked when they were written, one entry at a time.

E12-E18 are a **remediation backlog** against
[`docs/report/token-handling-security-audit.md`](../../report/token-handling-security-audit.md) v1.1, and a
security finding does not respect context boundaries. Finding §3.5 alone touches all nine services; finding
§3.6a changes a key shape that BC-01, BC-02 and BC-10 all read.

Forcing them into the existing eleven would have meant appending unrelated hardening stories to epics that
currently read as an accurate description of shipped code, which is the more damaging of the two options.

They are a separate block because their **source** differs (a dated audit, cited in every one of the seven
headers) and their **nature** differs (remediation of shipped code rather than description of it) — *not*
because they fail a context rule. There is no context rule: `phase5/CONSTRAINTS.md` §5 stopped requiring one
on 2026-08-11, so an epic spanning nine services or naming no context at all is ordinary. E16 and E17, the
two of the seven that describe genuinely new capability rather than hardening, need no context of their own
to exist under; the BC-12 once proposed for them is **withdrawn**, because it was only ever proposed to give
those two epics a context to own under the rule that has since gone. `phase2/BOUNDED_CONTEXT.md` is untouched
and the eleven contexts stand. If key custody ever earns a context, it earns one as domain modelling, by the
route that document's Mutability line describes — not because an epic needs somewhere to live.

---

## 3. How to read a story here

Brownfield retrofit. Most stories in `epics/*.md` describe work ALREADY SHIPPED, not work still ahead.

- **Built** story = code exists now, cites the real path proving it (resolver file, migration file,
  frontend route) - never phrased "we will build X" for something already running.
- **Open** story = genuinely missing, no model to copy. Among E01-E11, only E11 carried these, and per
  `phase5/CONSTRAINTS.md` §6 even those stopped at recording the gap - no schema, no resolver signature, no
  checkout sequence gets designed in this protocol. ⚠️ **E11 has no open story left**: ADR-038 (2026-08-27)
  closed the context permanently and E11-S02 recorded that — in §6.1 below since 2026-08-27, rather than in
  `epics/E11.md`, deleted the same day — so its questions are moot rather than pending.
  The §6 prohibition stands unchanged and is now backed by an ADR rather than by this document alone. **E12-E18 were open throughout when written**, by
  construction: they described remediation that had not been built. E12, E13 and E14 landed on 2026-08-10
  and are open only where each epic's §7 says so; **E15, E16 and E17 are complete since 2026-08-13** — E16 by
  ADR-034's mechanism rather than its own, retargeted in its v2.0 rather than rebuilt — and E18 is still
  open throughout. Unlike E11 they *do*
  carry design detail, because the §6 prohibition scopes to order/cart/delivery/payment, not to security
  hardening of shipped code. That distinction outlives ADR-038: a permanently-refused context still may not
  be designed, while everything else here still may.
- **Status tag vocabulary is two values only** - `built` and `not built`. E18 uses `not built`
  uniformly; E12-E17 now carry a marker per story, and E12-E14 each end with a §7 naming what stayed
  `not built` and why. **E17 has no §7**: all nine of its stories are `built`, every one carries an
  **Outcome** paragraph, and all four of its open questions are answered in its §6 rather than left for
  later. **E16 has no §7 either**: all nine of its stories are `built` and every one of them
  carries an **Outcome** paragraph instead, saying what satisfied the criteria, what was traded, and where a
  criterion was refused on the merits — E16-S08's R02 closure is the refusal. **E15 has no §7 and needs
  none** — all nine of its stories are `built`, and the one
  thing it leaves open is a credential write on a service its scope never named, recorded as open question
  4 rather than as an unbuilt story. **E19 has no §7 either**: five of its six stories are `built` with an
  **Outcome** paragraph each, and the sixth is E02-S05's shape — an anti-story, `not built` deliberately,
  whose outcome says which tests now hold the line it defends. **E20 has no §7 either**, at four times the size:
  twelve of its thirteen stories are `built` with an **Outcome** paragraph each, and the thirteenth is that
  same shape a third time — `not built` because what satisfies it is a lint rule in four services and the
  three absences it protects. A partially-correct mechanism is `not built` with the defect named in the
  epic's §3 - or `built` with the shortfall named in its §7, never a marker that implies more than landed.
- An **investigation story** produces a written finding and nothing else. Its acceptance criteria describe
  what the finding must contain and where each outcome is routed, never a code change. E12-S12, E12-S13,
  E14-S09, E16-S09, E18-S04, E18-S05 and E18-S09 are the seven, and they exist because the audit's §5 names
  its own blind spots rather than hiding them.
- "Built" ≠ "coverage green". `phase5/CONSTRAINTS.md` BCON-04: a vitest project with zero matching files
  still reports 100% and passes (`BEs/dev/marketplace-dev-user-authenticated-resource/test/integration/`
  was exactly this until 2026-08-07). A Built story's proof path is a resolver/model/route, not a
  checkmark alone.
- Acceptance criteria are mechanically checkable per BCON-01 - a gate name, a test file path, an
  `.explain()` output. "Works well" is never a criterion.
- Story IDs: `ENN-SNN`, sequential per epic, restart per epic - `E01-S01`, `E01-S02`, `E07-S01`. Never a
  global counter.

---

## 4. Which epics touch which context

**Informational only. No epic owns a bounded context and none is required to name one**
(`phase5/CONSTRAINTS.md` §5). This table exists so a reader who knows the domain map can find the epics that
change code in an area — nothing validates it, nothing fails if an epic is missing from it.

That E01-E11 line up one-for-one with BC-01-BC-11 is a coincidence of how the retrofit index was written,
not a property of epics. A future epic may span several rows, or appear in none.

| BC | Described by | Also changed by |
|---|---|---|
| BC-01 | E01 | E13, E14, E15, E16, E17, E20 |
| BC-02 | E02 | E15 |
| BC-03 | E03 | E15 (E15-S07 status change revokes sessions), E20 (`waitApprov` raised again by a restore) |
| BC-04 | E04 | - |
| BC-05 | E05 | - |
| BC-06 | E06 | - |
| BC-07 | E07 | E19, E20 |
| BC-08 | E08 | - |
| BC-09 | E09 | E12, E13, E18 |
| BC-10 | E10 | E13, E14, E15, E16, E17, E18 |
| BC-11 | E11 | - |

---

## 5. Phase 1-4 document coverage

Every mandatory Phase 1-4 document has at least one implementing epic.

| Document | Implementing epic(s) |
|---|---|
| `phase1/PDR.md` | All (E01-E11) - scope + outcomes shape every epic |
| `phase1/SYSTEM_CONTEXT.md` | All (E01-E11) - actor/system boundary crosses every epic |
| `phase1/NFR.md` | All (E01-E11) - critical set NFR-SE01-SE09, SE11, SE12, AV01, AV02, MA01, MA02, MA05, CO01 must land on ≥1 story each (`phase5/CONSTRAINTS.md` §5) |
| `phase2/UBIQUITOUS_LANGUAGE.md` | All (E01-E11) - story language must match its glossary, no banned term |
| `phase2/EVENT_STORMING.md` | E01, E02, E03, E05, E07, E08, E11 - commands/flows map to these |
| `phase2/BOUNDED_CONTEXT.md` | All (E01-E11) - the domain map they describe, §4 above; not a rule over epics |
| `phase3/C4_CONTEXT.md` | E08, E09 - external actors/systems at the boundary |
| `phase3/C4_CONTAINER.md` | E01, E09, E10 - the 9-service + 3-frontend + common split |
| `phase3/SECURITY_AUTH.md` | E01, E02 - opaque token + Redis session + tier-assert model |
| `phase3/INFRA.md` | E09 - deploy, nginx, Redis cluster / MongoDB topology |
| `phase3/CONSTRAINTS.md` | E09 - CON-01..CON-12 enforced by the gate layer (CON-12 via E01-S10's eslint block) |
| `phase3/adr/ADR-INDEX.md` | All (E01-E11) - 29 ADRs, no epic may contradict its area |
| `phase4/ERD.md` | E03, E04, E05, E06, E07 - the 6-collection data model |
| `phase4/DDD_AGGREGATES.md` | E03, E04, E05, E06, E07 - aggregate invariants |
| `phase4/API_CONTRACTS.md` | E01-E08 - one story-group per resource-service surface |
| `phase4/ERROR_HANDLING.md` | All (E01-E11) - error principles cross every resolver |
| `phase4/CONSTRAINTS.md` | E09 - DCON-01..DCON-09 enforced by validators/resolvers |
| `docs/report/token-handling-security-audit.md` v1.1 | E12-E18 - every §3 finding, every §5 blind spot, and the four §4 "do not fix" items recorded so they are not fixed |

Finding-to-epic map, so no audit finding is left unassigned:

| Finding | Epic |
|---|---|
| §3.1 rotation without reuse detection | E14 |
| §3.2 no absolute session lifetime | E14 |
| §3.3 no credential write invalidates a session | E15, closed 2026-08-13 by E15-S05 (password) and E15-S06 (login email) — except the public reset-password flow, which is open question 4 and no story's scope |
| §3.4 old access token survives refresh | E14 |
| §3.5 `sendDefaultPii` + `rejectUnauthorized = false` | E12 |
| §3.6a raw tokens as Redis keys | E13 |
| §3.6b no account→sessions index | E15, surfaced by E17; closed 2026-08-13 by E15-S02 (written), E15-S03 (pruned) and E17-S02 (read by an operator) |
| §3.6c `INTROSPECTION_CODE` comparison and reachability | E13-S03 (comparison), E13-S11 (bypass disabled outside development), E13-S09 (reachability) |
| §3.6d `assertTier` reject path untested in 2 of 3 | E18-S01, verified closed 2026-08-13 — the two missing suites gained the tests with the tier discriminator itself, so E18 verified rather than built |
| §3.6e `waitApprov` claimed but not enforced | E15-S08, closed 2026-08-13 — the gate itself was built by E01-S11 on 2026-08-12 |
| §3.6f Keygrip rotation unused (= R02) | E16 — **closed 2026-08-13**, and operable since the same day: E17-S08's panel rotates and retires from a screen |
| §3.7a `rememberMe` inert | E14 |
| §3.7b Redis persistence / TLS undocumented | E13 |
| §3.7c `SameSite` in no ADR | E13 |
| §3.7d stale docstring | E13 |
| §4 ADR-018 prose wrong, scope load-bearing | E13-S07 - **prose only, the scope is not touched** |
| §5 all six blind spots | E12-S12, E12-S13, E14-S09, E16-S09, E18-S04, E18-S05, E18-S09 — four now run: E14-S09 ([finding](../../report/multi-tab-refresh-behaviour.md)), E12-S12 ([finding](../../report/log-sink-inventory.md)), E12-S13 ([finding](../../report/sentry-event-capture.md)) and E16-S09 ([finding](../../report/keygrip-rotation-propagation.md)) |

This map says which epic owns each finding. **What actually happened to each is in the report itself** —
[`token-handling-security-audit.md`](../../report/token-handling-security-audit.md) §7, written 2026-08-13 by
E18-S06, which carries the outcome and the landing story for all fifteen and names the four things this
backlog leaves open.

---

## 6. Out of scope (binding here too - `phase5/CONSTRAINTS.md` §6)

No story anywhere under `epics/` designs order, cart, delivery, or payment, and none ever will:
[ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) (2026-08-27) puts all four
permanently out of scope. E11 records the BC-11 refusal and the questions that died with it - never a
schema, a resolver signature, a field, or a checkout sequence diagram. A risk-register row naming it
(R31) is in scope for a sibling Phase 5 doc; a story designing the fix is not in scope for E11, and there
is no fix to design. ⚠️ **A recording story is still allowed, and E11 now has two** - E11-S01 (2026-08-13)
recorded the gap, E11-S02 (2026-08-27) recorded that it will never be filled. Both are below, in full,
since `epics/E11.md` — the file that used to carry them — was deleted the same day E11-S02 was built; §6.1
is their record now.

### 6.1 The two recording stories (absorbed from `epics/E11.md`, deleted 2026-08-27)

`phase5/epics/E11.md` never held anything but these two stories and a build-state paragraph the §2 table
above already narrates, so when its turn came to leave `epics/` it followed E01-E10 in substance but not
in form: there is no `ORDERING_FULFILMENT.md` beside this index, because there is no context to describe —
only the record of it staying undescribed. The two stories move here instead, verbatim in substance, in
this file's own voice.

#### E11-S01 — Record the commerce gap and its blocking questions   `built 2026-08-13`
Technical story. Keep the platform's one authoritative record of what Ordering & Fulfilment would need
before design can start, so no future agent infers a shape from the other ten contexts and builds ahead of
a decision nobody made.
**domains:** documentation
**Acceptance criteria:**
- BC-11 and the record agree on the same four named concepts (Cart, Order, Delivery, Payment) — no fifth
  invented, none dropped.
- Every blocking question is traceable to a real open question in an upstream Phase 1/2 document, not
  invented.
**Traces:** BCON entries n/a (no gate applies to undesigned code); `phase5/CONSTRAINTS.md` §6.
**Evidence:** absence itself — the grep across all nine backend services and the schemas-directory listing
that prove it are carried in the §2 table's E11 row above and in
[ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Consequences.

**Built 2026-08-13.** Criterion 1 held: BC-11 and the record named the same four concepts, Cart / Order /
Delivery / Payment, with no fifth and none dropped. One defect was found on that comparison and fixed —
BC-11 had quoted `item.js` with a sentence the file does not contain, "would be a guess at a design
decision nobody has made," and the record now quotes `item.js:11-13` exactly instead. The evidence behind
§3 of the deleted file was re-run rather than trusted: zero commerce mutations across the nine services,
`item` still with no `price`, and the schemas-directory listing stale by three entries, none of them
commerce.

⚠️ **And here is the part that exists nowhere else in the corpus: criterion 2 held for four of the five
questions, and question 4 was the deliberate exception.** It says outright that it is raised nowhere
upstream, and it stays — deleting it to satisfy the criterion would remove a real blocker, and it is a
question about tier topology (ADR-002, `phase2/UBIQUITOUS_LANGUAGE.md` §Service pair) rather than a
commerce design decision, so recording it invents no shape. **The criterion is what caught it, which is
the criterion working.**

**What `built` means here:** the record is current and verified, not that Ordering & Fulfilment exists. No
collection, migration, model, resolver, state machine or price was added, and none may be — ⚠️ and that
sentence used to end "*until §6 is answered by product and the platform owner*," a condition that was
never going to be met. Kept as history rather than quietly dropped: see E11-S02 below.

#### E11-S02 — Record the decision that closed the gap   `built 2026-08-27`
Technical story. Replace the epic's *pending* frame with the decision that ended it, so that no reader,
and no agent, mistakes the four named concepts for a backlog.
**domains:** documentation
**Acceptance criteria:**
- The decision has an ADR of its own, and this file, BC-11 and `phase5/CONSTRAINTS.md` §6 all cite it
  rather than restating it.
- No question anywhere in the corpus is left waiting on a commerce design: §6 there (the epic's own
  open-questions table, now folded into ADR-038 §Note — 2026-08-27), `phase2/BOUNDED_CONTEXT.md` §7 q4,
  `phase2/EVENT_STORMING.md` §6 open question 4 and `phase1/PDR.md` open question 3 all close in the same
  pass, and all close as **moot** — none is answered, because none can be.
- Nothing is designed, nothing is invented, nothing on disk changes. No collection, no migration, no
  resolver, no `price`.
**Traces:** [`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md);
`phase5/CONSTRAINTS.md` §6.
**Evidence:** the four closed-question tables and ADR-038 §Compliance — a grep that fails if any document
pairs a commerce term with deferral language again — both recorded in
[ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note — 2026-08-27.

**Built 2026-08-27.** ADR-038 is the record; this story is what carried it through the corpus. Two
findings came out of doing it, both about framing rather than fact. First, **every factual claim about the
absence was already true and none needed repair** — unusual for this epic, whose two prior passes each
found stale evidence. Second, the questions that closed had been owned by "Product + platform dev" for
their whole life, and **that owner does not exist here**: this platform is a blueprint published for the
community (ADR-037), and the platform owner is the decision-maker of record for all of it. **The owner
cell was the tell, and nobody had read it as one.**

The deeper correction ledger — the citation defects found and fixed on 2026-08-27, and the five §6
questions' own closure detail, question by question — lives in
[ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note — 2026-08-27:
`phase5/epics/E11.md` deleted, its record absorbed here, so the two halves — this file's stories, that
file's questions — point at each other rather than duplicate. They overlap in exactly one place, on
purpose: the owner-cell finding above is also ADR-038's closure detail for question 1, because it is at
once this story's finding and that question's reason for closing, and neither record reads whole without
it.
