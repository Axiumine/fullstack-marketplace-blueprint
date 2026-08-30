# E12 — Telemetry & Egress Hardening
# Marketplace

**Status:** implemented 2026-08-10, investigations closed 2026-08-11 - audit remediation, not baselined; see §7; record moved out of `epics/` 2026-08-27, see §0
**Version:** 2.14
**Date:** 2026-08-28
**Author:** epics-agent
**Bounded context:** hardens BC-09 — Platform Operations & Quality Gates, applied inside every service that BC-01..BC-08 own, and at the edge in `marketplace-nginx`. Introduces no new context.
**Source:** [`docs/report/token-handling-security-audit.md`](../../report/token-handling-security-audit.md) v1.1 §3.5, §5
**Changelog:** v2.14 - 2026-08-28, later the same day: §0's range narrows from "E16..E19" to **E19** —
`phase5/epics/E17.md` and `phase5/epics/E18.md` were **both** deleted and their records **distributed, not
moved**, the E11/E13/E14/E15/E16 way. E17's nine stories and E18's thirteen are `built`; E17's five open
questions and E18's three are all closed. What the audit found held nowhere else went to `EPICS_STORIES.md`
§2's E17 and E18 rows and §2.1's E17 row, `docs/testing.md`, and `PLATFORM_OPERATIONS_QUALITY_GATES.md` §6.
The count in §0 stays eleven — no new record joined it, and every story id survives. This record's own build
state did not change; its content gained one paragraph under **E12-S22**, because the E17 question that pass
answered turned on a limit of `sentryBeforeSend` that only this document owns — `event.message` is not one
of the bags it walks.
v2.13 - 2026-08-28, later the same day: **`phase5/epics/E15.md` is deleted**, so the range
§0 gives for `EPICS_STORIES.md` §1's "stories live in `epics/ENN.md`" narrows once more — from
**E15..E19** to **E16..E19**. E15 followed the E11 / E13 / E14 pattern and not E12's: distributed rather
than moved, all ten of its stories `built`. ⚠️ **Unlike E14's, E15's §6 was not empty** — one Product
question, whether a confirm-first email-change flow should exist at all, moved to
[`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md) §6 as an **open** question 5 rather than being deleted with the
file. The other nine facts went to [`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E15 row and §2.1,
[`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 (three refused designs — the lazy prune, "revoke all but
me", and `familyId`/the cap in the index value), [`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md) §3.1,
[`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md) §3.1,
[`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md) E03-S02,
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md) §3.1,
[`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3 and [`docs/data-model.md`](../../data-model.md).
**This file was not a receiver this time** — E15 wrote nothing into §4 — and no twelfth record joined the
eleven beside the index. E15 kept its epic id and all ten of `E15-S01` … `E15-S10`. No story id,
criterion, evidence line, state or gate in this file changed.
v2.12 - 2026-08-28, later still: **`phase5/epics/E14.md` is deleted**, so the range §0 gives
for `EPICS_STORIES.md` §1's "stories live in `epics/ENN.md`" narrows again — from **E14..E19** to
**E15..E19**. E14 followed **E11's and E13's pattern and not E12's**: distributed rather than moved, all
nine of its stories `built`, its own §6 reading "None open. Every decision this epic made is carried by the
story that implements it, with its reasoning — this section holds only what is still undecided.", and an
exhaustive audit of all 163 facts in the file finding only nine recorded nowhere else. Those nine move to
seven destinations: [`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E14 row (the seven-step landing order,
and "land E13-S01 **and E13-S02** first" at §2.1), [`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 (two
rejected alternatives — the tier-keyed privilege gradient for the session cap, and the cached-successor-pair
grace design), [`docs/architecture.md`](../../architecture.md) (the abandoned `// if remember me, generate
?` cookie-side comment in koa-utils' `setLoginCookies`, which E14-S07 explicitly does not revive),
[`RISK_REGISTER.md`](./RISK_REGISTER.md) R52 ("two windows, not one"), **this file's own §4 E12-S09** (the
Cloudflare rate-limiting-rules alternative to `limit_req_zone`), `epics/E17.md` §5 (why
E17 depends on E14 for `familyId`) and
[`docs/report/token-handling-security-audit.md`](../../report/token-handling-security-audit.md) §3.4 (the
cross-service-harness residual). No twelfth record joined the eleven beside the index, so that count is
unchanged; §0 gains a new dated paragraph saying so, naming all seven destinations, and stating plainly that
E14 kept its epic id and all nine of `E14-S01` … `E14-S09` kept theirs. The documentation-citation list in
§0 also drops `epics/E14.md`, which no longer exists. No story id, criterion, evidence line, state or gate
in this file changed.
v2.11 - 2026-08-28, later: **`phase5/epics/E13.md` is deleted**, so the range §0 gives for
`EPICS_STORIES.md` §1's "stories live in `epics/ENN.md`" narrows again — from **E13..E19** to **E14..E19**. E13
followed **E11's pattern and not E12's**: distributed rather than moved, all eleven of its stories `built`,
its own §6 reading "None open.", and seven facts held nowhere else moved to
[`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E13 row, [`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md)
§3.6 and [`dependency-tree-advisory-scan.md`](../../report/dependency-tree-advisory-scan.md) §6.1. No
twelfth record joined the eleven beside the index, so that count is unchanged; §0 gains a new dated
paragraph saying so, naming all three destinations, and stating plainly that E13 kept its epic id and all
eleven of `E13-S01` … `E13-S11` kept theirs. The documentation-citation list in §0 also drops `epics/E13.md`,
which no longer exists. No story id, criterion, evidence line, state or gate in this file changed.
v1.0 - initial; written against the 2026-08-10 token-handling security audit, after an adversarial review that returned `refuted: true` on the first design — the original `beforeSend` scrubber looked at the wrong half of the event and would not have closed §3.5.
v1.1 - implemented 2026-08-10. Story markers now read per story, and §7 records what is
left: E12-S12, E12-S13 and the Cloudflare half of E12-S15.
v1.2 - 2026-08-11: the non-1:1 bounded-context caveat removed. `phase5/CONSTRAINTS.md` §5 no longer
ties an epic to a bounded context, so this epic breaks no rule. That §5 is the record of the decision.
v1.3 - 2026-08-11: E12-S12 and E12-S13 ran and are `built`, each with a finding under `docs/report/`.
They found eight defects the static audit could not, which become E12-S16 … E12-S23 — one of them 🔴 and
live — and two disclosure questions that route to §6 rather than to a fix. §7 rewritten.
v1.4 - 2026-08-11: E12-S24 added. E12-S22 called itself latent because no service sets a `tracesSampleRate`;
checking that against the frontends showed all three set `0.1` and configure no `beforeSend` at all, and no
frontend depends on the package the scrubber lives in. E12-S22's note now scopes itself to the backend.
v1.5 - 2026-08-11: §6 question 1 answered by the platform owner — raw addresses stay in the error log,
rotation 14–30 days with `shred`, no personal data in the access log, two lines in a privacy policy.
E12-S19 takes the period and stops waiting; E12-S25 is new and writes the notice, which does not exist
yet. Question 2 is settled on *whether* and open on *how*.
v1.6 - 2026-08-11: the owner chose the mechanism for question 2 — rewrite the logged path — and **E12-S16 is
`built`**, the first of the eight defects to be fixed. Implementing it found two things the story did not
know: four link shapes carry `:email/:hash` and only two have a `location` block, and the customer surface's
`Referrer-Policy` put the same pair in `Referer` on every same-origin request the reset page makes. Both are
covered; the credential staying in the URL, and the SSR cache key holding the whole link, are recorded as
residuals in §7 rather than closed.
v1.7 - 2026-08-11: **E12-S26 added**, and the two residuals above stop being notes. The owner asked whether
the token can leave the path; it can, for the customer reset flow, via the URL fragment — and cannot, for the
two verify flows, which are REST `GET`s a fragment never reaches. Scoping it settled at source that the SSR
page dehydrates the address and the hash into an inline `<script>`, so the cache holds them in the body too,
and found that `/x/reset/` — the ShopOwner reset link — routes nowhere, because that panel has no reset
screen. E12 reads 16 of 26.
v1.8 - 2026-08-11: E12-S26's **cache criterion is built**, on the owner's instruction to take that half
first. `$mkt_credential_uri` joins the session-cookie variable on both cache directives, so a mailed
`:email/:hash` URL is never stored — and reverting it proves the point rather than illustrating it: the
second request to a reset link comes back `HIT`. The story is `partly built`; the fragment, the static
route, the hash parser and the origin's `no-store` are still to come. Counts unchanged.
v1.9 - 2026-08-11: **§6 holds no open question any more.** Both of the ones it carried were answered on
2026-08-11, so the section stops being their home: each answer moves onto the story that carries it out and
is quoted verbatim there — the retention answer on E12-S19 with its privacy clause on E12-S25, the access-log
mechanism on E12-S16 — and §6 keeps a two-row map of what was asked, what came back and where it now lives.
E12-S07 gains the live confirmation that used to sit in §6 as a footnote: measured, the access log carries no
client address in any field. The one thing §6 still flags is not this epic's — `phase1/NFR.md` open question 1
is narrowed by these answers and not closed by them.
v2.0 - 2026-08-11: **E12-S21, E12-S22 and E12-S23 are `built`**, together, because they are one edit to the
same `Sentry.init` call in the same nine files. The 🔴 is closed. Implementing E12-S21 found its own first
criterion wrong: `@sentry/node`'s `httpIntegration` spells the option `maxIncomingRequestBodySize`, the inner
`maxRequestBodySize` is a silent no-op on it, and the story text and the eslint selector now carry the name
that is really read. Two widenings are recorded on their stories rather than left implicit — both `user-agent`
spellings, and `breadcrumb.message` on every breadcrumb — and E12-S23's fallback is `'unknown'` rather than
`'development'`. E12 reads 19 of 26.
v2.1 - 2026-08-11: **E12-S20 is `built`**. Four `console` calls gone from three services, each replaced by a
test that asserts the absence — a deleted print leaves no mutant behind it, so nothing else would notice it
coming back. What remains of the eight investigation defects is E12-S17, E12-S18 and E12-S19, none of them in
a service repo. E12 reads 20 of 26.
v2.2 - 2026-08-11: **E12-S17 and E12-S18 are `built`**, together, because both defects live in
`marketplace-docker-DBs/docker-compose.yml`. The Redis password moved out of `command:` into a generated, git-ignored
`secrets/redis.conf` mounted read-only; one `x-logging` anchor caps every container at 20 MiB × 5. Each story
**corrected its own evidence line in the act of closing**: host `ps aux` never showed the password, because
Redis overwrites its `argv` at startup, so the before-state was two surfaces and not three; and `mdb1` had
grown to 458,129 lines / 229 MiB in 52.6 hours, which is the rate the rotation pair answers. The workspace
secret guard gained two rules — any `secrets/` path, and any `requirepass` line — since the new file has
neither a `KEY=` shape nor a telltale extension. E12 reads 22 of 26, and E12-S19 is the last of the eight.
v2.3 - 2026-08-11: **E12-S19 is `built`, and with it all eight investigation defects are fixed.**
`marketplace-nginx` ships `logrotate.d/nginx` — daily, `rotate 14`, `shred`, over a glob that covers all
eight log destinations including nginx's own `error.log`. Building it measured two things the story could not
have known: logrotate shreds by handing the open descriptor to `shred … -`, which **busybox cannot do**, so on
an Alpine host every removal falls back to `unlink`, prints to cron mail and still exits 0; and two files in
`/etc/logrotate.d` matching one glob make logrotate skip the **whole** later-named file, which is why this
installs over the packaged `nginx` rather than beside it. Fourteen new assertions, the last three of them
behavioural — sixteen forced rotations, reading back that both removals went through `shred`. E12 reads 23 of
26; what is left is E12-S24, E12-S25 and the rest of E12-S26, none of them from the investigations.
v2.4 - 2026-08-11: **E12-S25 is `built`** — the platform's first privacy notice, `/privacy` in
`marketplace-user`, linked from the footer the root route renders on every page. It states the other half of
the owner's retention answer in public: which of the two log files holds an address, which holds the URL, that
both are kept 14 days and that removal is `shred`. Writing it found the period needs one more sentence to be
true rather than nearly true — `daily` + `rotate 14` keeps fourteen closed files beside the open one, so an
entry written just after a rotation dies on the fifteenth day — and the page says so. It claims nothing else:
no lawful basis, no other retention, no access flow, because none of those has a decision behind them. Eleven
assertions, quotations rather than descriptions, so drift from the configuration fails the suite. E12 reads 24
of 26.
v2.5 - 2026-08-11: **E12-S26 is `built`** — the customer's reset credential is out of the URL. The mail now
points at `/reset-password/confirm#/<address>/<hash>`, a fragment no browser transmits, so the address and
the live hash reach no request line, no `Referer`, no cache key and no Cloudflare log; `marketplace-user`
reads them from `window.location.hash` on a static, `ssr: false` route, and answers the whole
`/reset-password` prefix `private, no-store`. **Criterion 1 was measured on the production build and came
back worse than the story assumed**: the old page carried both values in the router's dehydration script
*and* `cache-control: public, s-maxage=60, stale-while-revalidate=600`, so the origin was inviting every
shared cache in the path to keep a one-time credential for ten minutes; after, both values appear zero times
in a body served `private, no-store`. Building it also moved that header out of the coverage-excluded
`src/server.ts` into a gated `src/lib/cachePolicy.ts`, on the argument that an exclusion for framework
plumbing must not cover a rule about who may be served another visitor's page. Three residuals stay stated
rather than closed: mails already sent keep the old shape for up to 60 minutes and now 404, the fragment
lives in the browser history and the mail client forever, and the ShopOwner reset link still routes nowhere
because that screen does not exist. E12 reads 25 of 26, and only E12-S24 is left.
v2.6 - 2026-08-11: **E12-S24 is `built`, and E12 is 26 of 26.** A frontend event was finally captured —
nine envelopes from production builds of two of the three apps, the real `@sentry/react` transport, the same
local collector, both event kinds, a reset-password URL with a sentinel in the query string and another in
the fragment. Of the two assumptions the story sent it to test, `httpBodies: []` **holds** and
`urlQueryParams: false` **does not**: it gates `event.request.query_string`, which the browser never fills
in, while `httpContextIntegration` copies `location.href` — query, fragment and all — onto
`event.request.url`, `contexts.trace.data['url.full']`, eight span descriptions, the `Referer` header and
both halves of the navigation breadcrumb, which then carries the reset URL onto **every later event of the
session**. **The story's own premise was also wrong**: `browserTracingIntegration` is not a default
integration, so the three apps ship no transaction at all and their `tracesSampleRate: 0.1` is a rate applied
to nothing — the transaction half is latent-until-integration, which changes when the fix must land and not
whether. `sentryBeforeSend` is published through the subpath export it already had and wired as both hooks in
all three apps — one implementation, not three, for reasons stated on the story — and truncates every
URL-valued key at the first `?` or `#`. Two residuals stay stated: the path is not redacted, and device and
culture entropy is kept deliberately. **One correction to E12-S26's own gate line**: running Stryker on the
frontends — the first run since that story — returned 99.86 for `marketplace-user`, three survivors in
`src/lib/cachePolicy.ts`, none of them from this story's code. Two constants the suite only compared against
themselves and one equivalent mutant; fixed here, and §4 no longer claims a score nobody measured. E12 reads
26 of 26.
v2.7 - 2026-08-26: §6's closing note annotated, not rewritten. Open question 1 (NFR-CO02) was closed on 2026-08-26 by a decision taken outside this epic; the 2026-08-11 paragraph saying it stayed open through E12's answers was true when written and its reasoning still holds, so it stands with a dated block quote underneath. No story, criterion or status changed. ⚠️ **Renumbered 2026-08-27.** This entry was written as `v2.6`, which another entry in this changelog already held — two different edits under one number, and a citation of "E12.md v2.6" could not be resolved to one of them. It takes the next free number instead. It stays where it is: this changelog runs oldest-first, and the number that fits the sequence stays with the entry that sits in it. Nothing in the entry, and nothing in the document, changed with the renumber; no other document cited either number.
v2.8 - 2026-08-27: E12-S15 **reclassified, not closed**. Its state cell read `built` **in the repo, not yet in the zone** since 2026-08-11, which reads as outstanding work on this backlog and is not what it is: every acceptance criterion the story wrote is met and gated, and what remains — enabling Authenticated Origin Pulls in Cloudflare and placing the zone CA under `/etc/nginx/certs/` — needs a zone and a host that do not exist here. This platform is a blueprint published for the community (`ADR-037`), so that admin role does not exist in this checkout; the row now says so and names the adopter as its owner, the same reading `EPICS_STORIES.md` §6.1 applied to six questions whose owner cell was the tell. ⚠️ **No score moved and no control closed.** R44 stays 3×5=15 🟠 High and R46 stays 🟠 High, because `ADR-032` forbids closing a control by appeal to a network boundary and an absent host is an absence of exposure rather than a mitigation. No story, criterion, evidence line or gate changed.
v2.9 - 2026-08-27, later: **`phase5/epics/E12.md` is deleted and this file is its record** — the eleventh epic record to move beside the index rather than sit under it, and the first from the E12-E18 remediation block. Moved intact, which is the E01..E10 pattern and not E11's: nothing here was distributed, because all twenty-six stories are `built` and the file is the record of a shipped hardening pass. New §0 states why, names the ten that moved before it, and separates E11 — deleted with no replacement — from the eleven that moved. Every internal relative link is re-based one level shallower (`../../../report/` → `../../report/`, `../../phase3/` → `../phase3/`, `../EPICS_STORIES.md` → `./EPICS_STORIES.md`, `../../../../SETUP.md` → `../../../SETUP.md`) and all resolve. ⚠️ **No story id changed**: `E12-S01` … `E12-S26` are cited from 87 source files across all fifteen sub-repos and twenty Markdown files, and renumbering was refused for the reason E01 refused it. No story, criterion, evidence line, state or gate changed — this is a move, not a revision.
v2.10 - 2026-08-28: one dated note in the front matter, where this file names the topology gap that bounds E12-S15. `ADR-039` supersedes `ADR-032` and decides that Cloudflare sits in front of the origin, so the configuration E12-S15 shipped is now the decided shape rather than an anticipated one. Nothing about the story moved: its repo half stays `built`, its zone half stays an adopter step (v2.8), and **R44** keeps its score and its missing date. No other section touched.

## 0. Why this record is not under `epics/`

It was `phase5/epics/E12.md` until 2026-08-27. The file was deleted and its record moved here in one pass,
for the reason the ten before it moved: nothing in it is a story still ahead. All twenty-six are `built`,
the two investigations ran and closed, every defect they found is fixed, and the last row that still read
as outstanding — E12-S15's Cloudflare half — was reclassified the same day as an **adopter deployment
step** rather than open work (§7). What is left is the *record* of a shipped hardening pass, not a backlog
entry.

`EPICS_STORIES.md` §1 still says stories live in `epics/ENN.md`, and that stays true for **E14..E19**.
E01..E10 are the ten whose records moved beside the index **before this one** — E01's and E02's from
2026-08-13 ([`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md),
[`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md)), E03's, E04's and E05's on 2026-08-14
([`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md),
[`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md), [`CATALOGUE.md`](./CATALOGUE.md)), E06's on
2026-08-25 ([`CATEGORY_TAXONOMY.md`](./CATEGORY_TAXONOMY.md)), E07's, E08's and E09's on 2026-08-26
([`CUSTOMER_ACCOUNT_ADDRESSES.md`](./CUSTOMER_ACCOUNT_ADDRESSES.md),
[`PUBLIC_DISCOVERY_STOREFRONT.md`](./PUBLIC_DISCOVERY_STOREFRONT.md),
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md)) and E10's on 2026-08-27
([`SHARED_KERNEL.md`](./SHARED_KERNEL.md)). This file is the **eleventh** to make that move and the first
from the E12-E18 remediation block, which is why the pattern needs restating: leaving `epics/` is about a
record being finished, not about which numbering block it belongs to. E11 left `epics/` on 2026-08-27 too
and is **not** one of the eleven — its file was deleted with no replacement record of its own, its
knowledge distributed into [`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)
§Note 2026-08-27 and [`EPICS_STORIES.md`](./EPICS_STORIES.md) §6.1, so it sits under neither `epics/` nor
beside the index.

⚠️ **Narrowed again 2026-08-28.** `phase5/epics/E13.md` is deleted, and the range two paragraphs above
therefore reads **E14..E19**, not E13..E19. E13 followed **E11's pattern and not E12's**: it was
distributed, not moved. All eleven of its stories were `built`, its own §6 read "None open.", and an audit
of the file found seven facts held nowhere else — the landing order, the two `BGREWRITEAOF` passes and the
"step four is the clock, not step one" rule, which moved to [`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's
E13 row; the six `INTROSPECTION_CODE` comparison sites, named with file and line, which moved to
[`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3.6; and the seventh site, upstream in
`@axiumine/koa-utils`, which moved to
[`dependency-tree-advisory-scan.md`](../../report/dependency-tree-advisory-scan.md) §6.1. No twelfth record
joined the eleven that sit beside the index — that count stays eleven, not twelve, and no
`SESSION_STORE_HARDENING.md` or any other new sibling exists. E13 kept its epic id and all eleven of
`E13-S01` … `E13-S11` kept theirs; only the file that held them is gone.

⚠️ **Narrowed again 2026-08-28.** `phase5/epics/E14.md` is deleted, and the range in the paragraph above
narrows once more, to **E15..E19**, not E14..E19. E14 followed **E11's and E13's pattern and not E12's**:
distributed, not moved. All nine of its stories were `built`, its own §6 read "None open. Every decision
this epic made is carried by the story that implements it, with its reasoning — this section holds only
what is still undecided.", and an exhaustive audit of all 163 facts in the file found only nine held
nowhere else. Those nine moved to seven destinations: [`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E14 row
— the seven-step landing order, and "land E13-S01 **and E13-S02** first" (§2.1);
[`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 — two rejected alternatives, the tier-keyed privilege
gradient for the session cap and the cached-successor-pair grace design;
[`docs/architecture.md`](../../architecture.md) — the abandoned `// if remember me, generate ?` cookie-side
comment in koa-utils' `setLoginCookies`, which E14-S07 explicitly does not revive;
[`RISK_REGISTER.md`](./RISK_REGISTER.md) R52 — "two windows, not one"; **this file's own §4, E12-S09** — the
Cloudflare rate-limiting-rules alternative to `limit_req_zone`, so this file is itself one of the seven;
`epics/E17.md` §5 — why E17 depends on E14 for `familyId`; and
[`docs/report/token-handling-security-audit.md`](../../report/token-handling-security-audit.md) §3.4 — the
cross-service-harness residual. No twelfth record joined the eleven that sit beside the index — that count
stays eleven (E01..E10 and E12), not twelve. E14 kept its epic id and all nine of `E14-S01` … `E14-S09`
kept theirs; only the file that held them is gone.

⚠️ **Narrowed again 2026-08-28, later the same day.** `phase5/epics/E15.md` is deleted, and the range
narrows once more, to **E16..E19**, not E15..E19. E15 followed the same pattern — distributed, not moved,
all ten of its stories `built` — but with one difference worth recording, because the last three deletions
established the opposite expectation: **E15's §6 was not empty.** A single **Product** question survived it,
whether a confirm-first email-change flow should exist at all given that the one existing writer moves an
account to a new address immediately while `emailVerify.valid` still reads `true`; it was relocated to
[`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md) §6, where it is now that record's **open** question 5. The
other nine facts went to [`EPICS_STORIES.md`](./EPICS_STORIES.md) §2's E15 row and §2.1,
[`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 (three refused designs),
[`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md) §3.1, [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md)
§3.1, [`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md) E03-S02,
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md) §3.1,
[`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3 and [`docs/data-model.md`](../../data-model.md).
⚠️ **This file received nothing from E15**, unlike the E14 pass, where §4's E12-S09 was one of the seven
destinations — so nothing below this line moved. The count beside the index stays eleven. E15 kept its
epic id and all ten of `E15-S01` … `E15-S10`.

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

**The story IDs did not change, and here that matters more than it did for E01..E10.** All twenty-six of
`E12-S01` … `E12-S26` are in use, and they are cited from **87 source files across all fifteen sub-repos**
as well as from twenty Markdown files — eslint rule messages and `restrictedSyntax` tests in every repo,
the nine `src/instrument.mts` files and the three frontend `src/instrument.ts`, `sentryBeforeSend.mts` and
its four test files in `marketplace-common`, seven `marketplace-nginx` configs plus `test/suite.sh`,
`marketplace-docker-DBs/docker-compose.yml` and `up.sh`, and `marketplace-user/src/lib/cachePolicy.ts`.
On the documentation side: [`SETUP.md`](../../../SETUP.md), [`docs/architecture.md`](../../architecture.md),
`phase1/NFR.md`, `phase3/SECURITY_AUTH.md`, `epics/E19.md`, [`EPICS_STORIES.md`](./EPICS_STORIES.md), [`RISK_REGISTER.md`](./RISK_REGISTER.md), the
four findings under `docs/report/`, and three sub-repo `CLAUDE.md`/`README.md` pairs. Every one of those
resolves to a section of this file. ⚠️ **Renumbering was refused, as it was for E01**: an id cited in
107 files is a name, and moving a file is not a reason to change a name — the more so when most of those
citations are in shipped code behind mutation gates, where a rename is a code change and not an edit.

**What is deliberately not repeated here.** The two investigations keep their own findings —
[`log-sink-inventory.md`](../../report/log-sink-inventory.md) for E12-S12 and
[`sentry-event-capture.md`](../../report/sentry-event-capture.md) for E12-S13 and E12-S24 — and this file
records what each story had to satisfy and where the code is, not the measurements themselves. The
production-topology gap that bounds E12-S15 is
[`ADR-032`](../phase3/adr/ADR-032-production-topology-owed.md), stated once there. ⚠️ **It stopped being a
gap on 2026-08-28**: [`ADR-039`](../phase3/adr/ADR-039-production-topology-cloudflare-app-host-trusted-datastore-segment.md) supersedes ADR-032 and puts **Cloudflare in front of the origin** by
decision, which is what `snippets/origin-pull.conf` had been configured against all along. E12-S15's
remaining half is unchanged — issuing the certificate is still an adopter deployment step, and **R44** still
holds its 🟠 High with no expiry date anyone here can write — but it is now a step toward a decided edge
rather than a presumed one.

## 1. Epic goal

Stop the platform from shipping credentials to a third party, stop it from accepting any TLS certificate while
doing so, and stop a client address from reaching either telemetry or disk. One service asks Sentry to collect
request bodies — on a GraphQL service, mutation variables — all nine put the client's address on every span,
and all nine disable certificate verification on the transport that carries the result. The certificate is
the cheapest of the three to fix and the most severe. One value that is not network-derived rides along
because it is two lines from the one that is: the rate limiter writes a raw email address into a Redis key,
on disk, while Mongo holds the same address encrypted. The edge is the fourth strand and a different shape: it
logs no client address **yet**, because `set_real_ip_from` is unconfigured, and starts logging one the moment
that is corrected — so E12-S07 is a prerequisite rather than a repair.

## 2. Scope

| Item | In/Out | Why |
|---|---|---|
| `rejectUnauthorized = false` in all nine services | In | closes the more severe half of audit §3.5 |
| Removing `sendDefaultPii` from the one service that sets it | In | closes the other half; decided, see E12-S03 |
| A `beforeSend` scrubber that covers where headers **actually** land | In | the refutation's blocking finding — see §3 |
| A repo-local `no-restricted-syntax` block preventing reintroduction of either | In | a fix with no gate is a fix with a half-life |
| Editing or republishing `@axiumine/eslint-config-be` | Out | it needs no change — E12-S04 |
| A revisit trigger for the `@sentry/node` major bump | In | `sendDefaultPii` is deprecated and disappears in v11 |
| Auditing what application and access logs contain | In (investigation only) | audit §5 blind spot, adjacent enough to belong here |
| Removing the `http.client_ip` span attribute the SDK writes unconditionally | In | E12-S06 — no configuration suppresses it, so the scrubber is the only lever |
| An nginx `log_format` that omits the client address, on all three vhosts | In | decided, see E12-S07 — a prerequisite for the `set_real_ip_from` the rate limiter needs |
| Removing `X-Real-IP` / `X-Forwarded-For` from the proxy header block | **Out** | its first entry is the only real client address in the system, and E12-S06 depends on knowing that |
| Dropping the `remoteip` parameter from the Turnstile verification call | In | decided, see E12-S08 — the value sent is nginx's own address |
| `set_real_ip_from` + `real_ip_header CF-Connecting-IP`, and retuning the login zones | In | decided, see E12-S09 — per-address rate limiting does not currently exist; must not land before E12-S07 |
| Deleting the Redis `${bucket}:ip` bucket and pinning `app.proxy` off | In | decided, see E12-S10 — one global bucket today, which is a live defect |
| `app.proxy = true`, or any other route by which a service learns a client address | **Out** | the decision is that only nginx learns it; E12-S10 pins it with a test |
| Hashing the email before it becomes a Redis rate-limit key | In | decided, see E12-S11 — plaintext on disk in Redis, CSFLE-encrypted in Mongo, same value |
| An HMAC, or any keyed digest, for that email | Out | needs key custody, which is E16; E12-S11 says plainly that SHA-256 is pseudonymisation and stops there |
| Refusing direct connections to the origin — Authenticated Origin Pulls | In | decided, see E12-S15 — Full (strict) does not do it and neither does the certificate; mutual TLS on the Cloudflare leg does |
| A host or provider firewall on Cloudflare's ranges | Out | there is none, and E12-S15 replaces the need for one: mTLS needs no address list and no refresh when Cloudflare publishes new ranges |
| **Capturing** any network-derived value, in any form — truncated, hashed, salted | **Explicitly out** | the standing GDPR decision; this epic only takes such values back out |
| Sentry DSN rotation, sampling, quota | Out | operations, not this audit |

## 3. Build state

**Partly built the wrong way.**

- `sendDefaultPii: true` is set in `marketplace-dev-admin-authenticated-resource`'s Sentry init. Sentry maps
  that flag onto a collection-options object at
  `node_modules/@sentry/core/build/cjs/utils/data-collection/defaultPiiToCollectionOptions.js:6-17`, and the
  request-data extractor at `node_modules/@sentry/core/build/cjs/utils/request.js:150-197` then attaches
  headers, cookies and body.
- **Where the headers actually land is not `event.request.headers`.** The Node HTTP integration writes them as
  span attributes — `node_modules/@sentry/node-core/build/cjs/integrations/http/httpServerSpansIntegration.js:76`
  and `:95` — so they arrive in `event.contexts.trace.data` and in each entry of `event.spans[].data`. A
  scrubber that only walks `event.request` runs clean and ships the `authorization` header anyway. This is why
  the first design was refuted, and it is the single most important line in this epic.
  ⚠️ **Refined by measurement, 2026-08-11** (`docs/report/sentry-event-capture.md` §4, §6): the attributes
  land in `event.contexts.trace.data` and **not** in `event.spans[].data`, they exist only on **transaction**
  events, and with `httpHeaders: { request: false }` the `http.request.header.*` attributes are never written
  at all. What survives in that position is `http.client_ip`, `http.user_agent`, `net.peer.ip` and
  `net.host.ip` — and `beforeSend` is not called for transactions, so none of them is scrubbed. E12-S22.
- `rejectUnauthorized = false` appears in **all nine** backend services, at `src/instrument.mts:9-22`, as an
  `insecureHttpsModule` passed to `Sentry.init` under `transportOptions.httpModule`. It is not conditional on
  environment, and it is the only outbound HTTPS these repos configure themselves — SocketLabs mail is
  constructed inside `@axiumine/koa-utils` and verifies normally.
- `sendDefaultPii` is deprecated — `node_modules/@sentry/core/build/types/types/options.d.ts:350-356` — removed
  in v11, superseded by a `dataCollection` options object. A fix written against the deprecated flag alone will
  silently stop applying at the next major bump.
- ⚠️ **The installed SDK is `@sentry/core` 10.69.0, and in it the flag no longer means "ship headers
  wholesale".** `utils/data-collection/filterKeyValueData.js:11` applies `SENSITIVE_KEY_SNIPPETS` on **every**
  branch, including `behavior === true`, and that list —
  `utils/data-collection/filtering-snippets.js:5-27` — already contains `auth`, `token`, `session`, `key`,
  `bearer`, `cookie` and `set-cookie`. An `authorization` header therefore arrives as `[Filtered]` **with the
  flag on**. What `sendDefaultPii: true` still adds, per
  `utils/data-collection/defaultPiiToCollectionOptions.js:6-17` against its `false` branch at `:18-34`, is
  `httpBodies` (all four kinds, against `[]`), `userInfo`, `urlQueryParams`, `databaseQueryData` and
  `stackFrameVariables`. **On a GraphQL service `httpBodies: ["incomingRequest", …]` is the mutation's
  variables**, and the service that sets the flag is the one holding `adminUpdatePwd`. That, not the header, is
  what E12-S03 decides — and it decided to remove the flag.
- ⚠️ **One network-derived value is outside `dataCollection` entirely and no flag suppresses it.**
  `@sentry/node-core/.../httpServerSpansIntegration.js:44` reads `headers['x-forwarded-for']` and `:69` writes
  it to the span as `http.client_ip`, built outside the `httpHeadersToSpanAttributes` call on `:75`. Setting
  `sendDefaultPii: false` denies the `-ip` and `forwarded` *header* attributes and leaves this one standing, in
  all nine services. Only a `beforeSend` scrubber removes it — see E12-S06.
- ⚠️ **`marketplace-nginx` defines no `log_format` at all**, so all three vhosts use nginx's built-in
  `combined`, whose first field is `$remote_addr` — `sites-available/marketplace-domain.com.conf:74`,
  `admin.…conf:65`, `shopowner.…conf:64`. E12-S07 replaces it.
- ⚠️ **Nothing in the repo is configured for the proxy that is actually in front of it.** The zone is
  Cloudflare-proxied (orange cloud) and `set_real_ip_from` appears nowhere. Two consequences the repo's own
  comments predict — `conf.d/20-rate-limit.conf:15-17`, `CLAUDE.md:72-74` — and one it does not:
  - `$remote_addr` is a **Cloudflare edge address**, so every `limit_req_zone $binary_remote_addr`
    (`:39,46,50,53,62`) buckets an entire Cloudflare point of presence together. **Per-address rate limiting
    at the edge does not currently exist**, in either direction: it neither limits an attacker nor spares a
    bystander.
  - `combined` therefore logs a Cloudflare address today, not a client one. The leak E12-S07 prevents appears
    the moment `set_real_ip_from` is configured — which it must be, for the point above — and appears
    silently.
  - The real client address does still reach the services: Cloudflare sends it, `proxy_add_x_forwarded_for`
    keeps it, and the first entry of that header is exactly what `httpServerSpansIntegration.js:69` turns
    into `http.client_ip`. **E12-S06 is unaffected — it is the one place a real client address is captured
    today.**
- ⚠️ **`X-Forwarded-For` is caller-influenced end to end, and the origin lock-down does not change that.**
  Cloudflare *appends* to a client-supplied `X-Forwarded-For` rather than replacing it, and
  `snippets/proxy-backend.conf:57` uses `$proxy_add_x_forwarded_for`, which appends again. A caller who sends
  `X-Forwarded-For: 198.51.100.1` therefore produces `198.51.100.1, <real client>, <cf edge>` at the upstream,
  and **the first entry — the one every consumer reads — is theirs**. Two consequences: `http.client_ip` in
  telemetry is already sometimes a value a caller chose rather than an address (E12-S06 removes it either
  way), and **it is why E12-S09 reads `CF-Connecting-IP` rather than `X-Forwarded-For`** — that is the one
  header Cloudflare overwrites unconditionally, and a zone keyed on a header a caller can prefix hands every
  attacker a private bucket, which is worse than the shared bucket it replaces. An origin unreachable except
  through Cloudflare would not change any of it — nothing stops a caller setting a header on the way
  *through* — which is why the lock-down does not answer this question, in either of its states.
- ⚠️ **The Cloudflare→origin leg is Full (strict), which is a TLS mode and not an access control.** It
  encrypts that leg and has Cloudflare validate the origin certificate. It refuses nobody. **nginx does not
  inspect its own certificate either** — a TLS server presents what it is configured with and the *client*
  decides whether to trust it, so "the certificate is only valid for Cloudflare" describes a browser warning,
  not a refusal, and `curl -k` or any scanner ignores it entirely. The certificates here are Let's Encrypt
  (`sites-available/*.conf:33-34,38-39,46-47`), publicly trusted, so a direct connection with the right SNI
  gets a clean chain and no warning at all.
- **What does refuse is `ssl_reject_handshake on` in the default server** (`conf.d/40-tls.conf:65-75`), and it
  is worth more than it looks: a connection with no SNI, or an SNI for a host not served, is rejected before
  any certificate is presented, so a mass IP scan indexes no hostname and the origin address is not
  discoverable that way. It does **not** stop a caller who sets SNI and `Host` to a name the edge serves —
  and those names are public by construction, every Let's Encrypt issuance being recorded in Certificate
  Transparency. Untargeted scanning is blocked; a targeted bypass of the WAF, the bot rules and everything
  Cloudflare meters is not. Nothing else in the sixteen repos restricts it: `ssl_verify_client`,
  `ssl_client_certificate`, `allow`/`deny` and any `ufw`/`iptables`/`nftables` reference all return zero hits.
  **E12-S09 is unaffected either way** — `set_real_ip_from` scoped to Cloudflare's ranges ignores a direct
  caller's `CF-Connecting-IP`. E12-S15 closes the targeted half.
- ⚠️ **`app.proxy` is off** — `new Koa()` in all nine `src/index.mts`, no assignment anywhere in the tree, and
  `guardPublicWrite.mts:39` states it as the current setting. Koa therefore returns the socket address, which
  behind nginx is **nginx's own**. So `guardPublicLogin.mts:46` and `guardPublicWrite.mts:37,46` do not build
  a per-client bucket at all: `assertUnderRateLimit`
  (`marketplace-common/src/others/assertUnderRateLimit.mts:46`) interpolates that one address into
  `${process.env.REDIS_KEY}rl:${bucket}:${identity}` verbatim, giving **one global bucket** — `perIpPerHour`
  spent by the whole platform, so the 21st login attempt in an hour, from anybody, is refused. Nothing
  personal is stored there, and nothing is limited either. Both layers of per-address rate limiting are
  therefore inoperative, for two different reasons. E12-S09 repairs the edge; E12-S10 deletes the other.
- ⚠️ **The line below it does store something personal, in plaintext, on disk.** `guardPublicLogin.mts:47`
  and `guardPublicWrite.mts:47` meter per email, and `assertUnderRateLimit.mts:46` interpolates that address
  verbatim into the Redis key, giving `rl:userRegister:email:mario@example.com`. Redis runs with
  `--appendonly yes` (`marketplace-docker-DBs/docker-compose.yml:62`), so the addresses reach the volume, while the same
  value is CSFLE-encrypted in Mongo (`account.js:25-26,42`). The module's own comment at `:37` — "Never pass
  a raw password or token as `identity` — the key lands in Redis in plaintext" — shows the author saw the
  mechanism and judged an email acceptable. E12-S11 revisits that, and it is the one **counter** the platform
  keeps: the per-email half is what no nginx zone can express.
- `assertTurnstile` is handed the same value (`guardPublicLogin.mts:49`, `guardPublicWrite.mts:49`), so what
  reaches Cloudflare is nginx's address — wrong data rather than private data. **Decided and closed here:
  E12-S08 removes the parameter.**
- Application and access logging have **never been audited** for credential content (audit §5).

## 4. Stories

### E12-S01 — Certificate verification is on, in all nine services   `built`
**As a** platform admin, **when** any service makes an outbound HTTPS call, **I want** the certificate
verified **so that** anything on the path cannot silently read or rewrite it.
**domains:** backend, testing

> **The flag reaches exactly one egress path.** `insecureHttpsModule` is handed to `Sentry.init` as
> `transportOptions.httpModule` (`src/instrument.mts:9-22`, identical in all nine), so it governs telemetry
> egress and nothing else. It never touched inbound TLS — the browser terminates against nginx and nginx
> reaches Node over plain HTTP — and it never touched SocketLabs mail, which is constructed inside
> `@axiumine/koa-utils` and verifies certificates today. Deleting it cannot break local https browsing and
> cannot break registration mail.
>
> **The three supported shapes are decided and written down** in [`SETUP.md`](../../../SETUP.md) §7:
> **(A)** an empty `DSN`, the default, which skips `Sentry.init` entirely; **(B)** the online Sentry service
> at `sentry.io`, whose certificate chains to a public CA Node already trusts; **(C)** a Bugsink collector
> you run yourself, reached, when it sits behind a certificate the machine does not trust, by
> exporting `NODE_EXTRA_CA_CERTS` on the launcher. **None of the three needs a code path of its own**, which
> is why this story is a deletion rather than a refactor: A needs no transport, B needs no extra trust, and C
> is configured outside the process.

**Acceptance criteria:**
- `grep -rn 'rejectUnauthorized\|insecureHttpsModule' BEs/dev/*/src/ BEs/dev/*/test/` returns zero hits — the
  exported object, its `transportOptions` wiring and the tests that assert it all go, not only the assignment
- Every `src/instrument.mts` initialises only for a non-empty `DSN` and passes no `transportOptions`, matching
  the shape the three frontends already use (`marketplace-user/env:79-81`)
- **No environment variable in any of the sixteen repos can switch verification off.** A collector behind an
  untrusted certificate is reached by trusting its CA — `NODE_EXTRA_CA_CERTS`, or an explicit `caCerts` whose
  value is a *path* read at boot. A boolean toggle — `NODE_TLS_REJECT_UNAUTHORIZED`, `INSECURE`,
  `SENTRY_INSECURE_TLS` — fails review by name, because a copied `.env` carries it into a real deployment with
  nothing failing to signal it
- A test per service asserts `Sentry.init` received no `transportOptions`, and a second asserts it is not
  called at all with an empty `DSN`; nine services, nine pairs, no shared helper a tenth service could forget
- Each service's `yarn test:cov` stays 100/4 and `yarn test:mutation` stays 100
**Traces:** NFR-SE01, NFR-SE06, NFR-SE08, NFR-MA01, NFR-MA02, NFR-CO01; BCON-01, BCON-02
**Evidence (defect):** `BEs/dev/*/src/instrument.mts:9-22` — nine identical copies. The nine
`test/instrument.test.mts:18-27` canonise it (`expect(options.rejectUnauthorized).toBe(false)`), the same way
the wrong 204 canonises the broken logout in E15-S01: the tests have to be replaced, not adjusted.

### E12-S02 — The scrubber walks where the headers actually are   `built`
State plainly: any `beforeSend` scrubber must strip credential-bearing keys from `event.contexts.trace.data`
and from **every** entry of `event.spans[].data`, not only from `event.request`. Stripping `event.request`
alone closes nothing.
**domains:** backend, testing
**Acceptance criteria:**
- The scrubber removes `authorization`, `cookie`, `set-cookie` and every `http.request.header.*` /
  `http.response.header.*` attribute from `event.request`, from `event.contexts?.trace?.data`, and from each
  element of `event.spans ?? []` — case-insensitively, since header attribute names arrive lower-cased but the
  guarantee must not depend on that
- **`http.client_ip` is in the same removal list**, in the same three places. It is not a header attribute and
  no `dataCollection` setting suppresses it (`httpServerSpansIntegration.js:44,69`), so a key list built only
  from the `http.*.header.*` prefix misses it entirely. E12-S06 owns the test; this story owns the key
- The list is expressed as a **prefix-and-name policy the SDK's own filtering cannot be assumed to cover**.
  `@sentry/core` 10.69.0 already filters sensitive header names at collection time
  (`filterKeyValueData.js:11`), which is a second layer, not a substitute — the version is pinned by nothing
  and E12-S05 exists precisely because that behaviour can change under a bump
- The test fixture is built from the **real shape** `httpServerSpansIntegration` produces — a span-attribute
  event, not a hand-written `event.request` object. A test asserting only against `event.request` does not
  satisfy this story
- A test seeds a known token in an `authorization` header, runs the event through the scrubber, and asserts
  `JSON.stringify(event)` does not contain that token as a substring — the whole-event check that would have
  caught the original defect
- The scrubber survives a missing `contexts`, a missing `trace`, a missing `data`, an absent `spans`, and an
  empty `spans` array without throwing; one test per case
- Stryker 100 in every service carrying it, with the optional-chaining branches covered
**Traces:** NFR-SE01, NFR-SE02, NFR-SE08, NFR-MA01, NFR-MA02, NFR-CO01, NFR-CO02; BCON-01, BCON-02
**Evidence (defect):** `@sentry/node-core/.../httpServerSpansIntegration.js:76,95` versus a `event.request`-only scrubber

### E12-S03 — `sendDefaultPii` is off in all nine services   `built`
State plainly: one service sets the flag and eight do not. The question of whether it was wanted is **decided —
it is not** — and this story removes it and makes the removal permanent.

> **Decision, 2026-08-10, platform owner.** `sendDefaultPii: true` goes from
> `marketplace-dev-admin-authenticated-resource`. It is not a preference; the service it sits on is the one
> that must not have it:
>
> - **`src/graphQLApi/schema/mutations/adminUpdatePwd.mts:19-20` takes `passwordOld` and `passwordNew` as
>   `GraphQLString` arguments.** The flag resolves to
>   `httpBodies: ["incomingRequest", "outgoingRequest", "incomingResponse", "outgoingResponse"]`
>   (`defaultPiiToCollectionOptions.js:6-17`), every request here is a GraphQL POST, so the attached body is
>   the envelope carrying both passwords in plaintext. One unhandled error during a password change ships
>   them to the collector.
> - **`shopOwnerAdd.mts` and `shopOwnerUpdate.mts` carry `personalData`**, which is CSFLE-encrypted at rest
>   under ADR-029. Attaching bodies puts those exact values in telemetry in plaintext — encryption at rest
>   defeated by the observability layer.
> - `databaseQueryData` is a second PII path for the same reason: the deterministic CSFLE fields are
>   plaintext lookup values in the query. `stackFrameVariables` is a third — a resolver frame can hold a
>   decrypted document or a resolved token.
> - `urlQueryParams` buys nothing on a POST-only GraphQL surface, and `userInfo` duplicates an `_id` already
>   in the session.
>
> **Nothing needed for debugging is lost.** `graphQL.document` is `true` in *both* branches
> (`defaultPiiToCollectionOptions.js:12` and `:26`, read by
> `@sentry/node/.../tracing/graphql/vendored/utils.js:13`), with literal values redacted at collection time.
> The exception, the stack, the transaction name and the query *shape* still arrive; only the values go.
>
> **This shrinks no other story.** `http.client_ip` is written outside `dataCollection` entirely (§3), and the
> E12-S02 scrubber still has to walk the span attributes — the SDK's own filtering is a 10.69.0
> implementation detail, not a contract.

**domains:** backend, documentation, testing
**Acceptance criteria:**
- `grep -rn 'sendDefaultPii' BEs/dev/*/src/` returns zero hits; the flag is absent rather than set to `false`,
  so it cannot be flipped by editing one character
- A test per service asserts the object handed to `Sentry.init` carries no `sendDefaultPii` key and no
  `dataCollection` key that re-enables `httpBodies`, `databaseQueryData` or `stackFrameVariables`; nine
  services, nine tests, no shared helper a tenth service could forget
- The decision above is written into `docs/architecture.md`'s observability section, naming `adminUpdatePwd`
  and ADR-029 as the two reasons, so the next reader does not re-derive it from the header question this story
  does **not** turn on
- A test asserts E12-S02's scrubber is wired as `beforeSend` and is actually invoked, using an init-options
  assertion rather than trusting the object literal — the scrubber is required whether or not the flag exists
**Traces:** NFR-SE01, NFR-SE08, NFR-MA01, NFR-MA05, NFR-CO01; BCON-01, BCON-03
**Evidence (defect):** `sendDefaultPii: true` in one of nine;
`BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/adminUpdatePwd.mts:19-20`
for what the body would carry;
`@sentry/core/build/cjs/utils/data-collection/defaultPiiToCollectionOptions.js:6-17` versus `:18-34` for what
the flag changes

### E12-S04 — Neither setting can come back by accident   `built`
**As a** platform, **when** someone reintroduces `rejectUnauthorized: false` or `sendDefaultPii`, **I want**
the lint gate to fail **so that** the audit does not have to be repeated in a year.

> **`@axiumine/eslint-config-be` needs no change, and no plugin has to be written.** Every service already
> spreads the shared config and appends its own blocks — `eslint.config.js:21` is `...eslintConfig`, followed
> by two repo-local blocks whose own comment records that they were duplicated deliberately into all seven
> services and `marketplace-common`. A tenth block follows that idiom. Core `no-restricted-syntax` carries the
> rule; the selectors below were run against fixtures with each service's own eslint and
> `@typescript-eslint/parser`, and all six fire while `{ dsn, beforeSend }` stays clean:
>
> ```js
> { selector: "AssignmentExpression[left.property.name='rejectUnauthorized']" }
> { selector: "Property[key.name='rejectUnauthorized']" }
> { selector: "Property[key.value='rejectUnauthorized']" }
> { selector: "Property[key.name='sendDefaultPii']" }
> { selector: "MemberExpression[property.name='NODE_TLS_REJECT_UNAUTHORIZED']" }
> { selector: "Literal[value='NODE_TLS_REJECT_UNAUTHORIZED']" }
> ```
>
> Editing the shared package instead would mean changing a repo outside these sixteen, publishing 2.0.3,
> bumping ten dependents, and shipping a Sentry-specific rule to every unrelated consumer of it. The cost of
> the local block is fourteen lines in ten repos and no publish at all.

**domains:** backend, testing
**Acceptance criteria:**
- **The `rejectUnauthorized` ban covers the assignment form.** The defect in the tree is
  `options.rejectUnauthorized = false` (`instrument.mts:12`) — an `AssignmentExpression`, not a `Property`. A
  rule matching only the object-literal form passes the exact code it exists to catch, so all three selectors
  above are present and a fixture proves each one fires
- **`sendDefaultPii` is banned outright, by key**, not "when unguarded". E12-S03 decided the flag is absent
  everywhere, so no `beforeSend` detection is needed and none is written — scrubber presence is a per-service
  test in E12-S03, which lint cannot check across files in any case
- The two `NODE_TLS_REJECT_UNAUTHORIZED` selectors are both present: the member form
  (`process.env.NODE_TLS_REJECT_UNAUTHORIZED`) parses as an `Identifier`, the computed form
  (`process.env['NODE_TLS_REJECT_UNAUTHORIZED']`) as a `Literal`, and a rule carrying one selector misses the
  other
- Each rule's `message` names the story and the alternative — `NODE_EXTRA_CA_CERTS` and `SETUP.md` §7 for the
  TLS ones, `docs/architecture.md` for the flag — so the failure explains itself to whoever hits it
- A fixture file per rule proves it fires, and a negative fixture proves it does not fire on the compliant
  shape
- The block lands in all nine services **and** `marketplace-common`; `yarn lint` passes everywhere with it
  enabled and no `eslint-disable` is added anywhere under `BEs/dev/*/src/`
**Traces:** NFR-MA01, NFR-MA02, NFR-MA05, NFR-CO01; BCON-01, BCON-02
**Evidence (gap):** nothing prevents either setting today; `eslint.config.js:21` for the spread the block
follows, `instrument.mts:12` for the assignment shape the rule must match

### E12-S05 — The next Sentry major will not silently reopen this   `built`
State plainly: `sendDefaultPii` is deprecated and gone in v11. A guard written against it stops guarding on the
day the dependency bumps, and nothing in this workspace would notice.
**domains:** backend, documentation, testing
**Acceptance criteria:**
- A test asserts the installed `@sentry/node` major version against a pinned expectation and fails on a bump,
  with a message naming this story and the `dataCollection` migration. The expectation is written against
  **10.69.0**, the version every claim in §3 was read from
- The migration path is written down: which `dataCollection` options correspond to today's `sendDefaultPii`
  behaviour, per `@sentry/core/build/types/types/options.d.ts:350-356`
- The guard covers the **filtering** behaviour too, not only the flag's existence: `SENSITIVE_KEY_SNIPPETS`
  (`filtering-snippets.js:5-27`) is what makes `authorization` arrive `[Filtered]` today, it is an
  implementation detail of a minor version, and E12-S02's scrubber must never be reduced on the strength of it
- A `RISK_REGISTER` row records the dependency-bump risk with its trigger and its owner
**Traces:** NFR-MA05, NFR-MA07, NFR-CO01; BCON-01, BCON-03
**Evidence:** `node_modules/@sentry/core/build/types/types/options.d.ts:350-356`

### E12-S06 — No network-derived value reaches telemetry   `built`
State plainly: the standing decision is that no full client IP is captured or stored. Sentry's default request
collection captures one, which makes telemetry the most likely place for that decision to be violated by
accident.

> ⚠️ **This is a live violation, not a hypothetical one, and no configuration closes it.**
> `@sentry/node-core/.../httpServerSpansIntegration.js:44` takes `headers['x-forwarded-for']` and `:69` writes
> `http.client_ip` straight onto the server span. That assignment sits **outside** the
> `httpHeadersToSpanAttributes` call on `:75`, so it is reached by no `dataCollection` option and by neither
> value of `sendDefaultPii`. Every one of the nine services does this on every request today. nginx sets
> `X-Forwarded-For`, so the value is the real client address, and only a `beforeSend` scrubber can take it
> back out.

**domains:** backend, testing
**Acceptance criteria:**
- The E12-S02 scrubber also removes the `http.client_ip` span attribute, `event.user?.ip_address`,
  `client.address` / `client.port` span attributes, and `x-forwarded-for` / `x-real-ip` headers wherever they
  appear in the event
- A test drives the **span-attribute** path specifically — an event carrying `http.client_ip` in
  `event.contexts.trace.data` and in `event.spans[].data` — and asserts the address is gone from both. A test
  that only seeds `event.user.ip_address` passes while the real leak stands
- A test asserts a seeded IP address does not appear anywhere in `JSON.stringify(event)` after scrubbing
- Sentry's own IP inference is disabled at init, so the collector cannot supply what the scrubber removed; a
  test asserts the init option
- `grep -rniE '(remote_addr|x-forwarded-for|x-real-ip|ip_address)' BEs/dev/*/src/` shows hits only inside this
  scrubber's removal list
**Traces:** NFR-SE01, NFR-SE08, NFR-CO01, NFR-CO02; BCON-01, BCON-02
**Evidence (gap):** `@sentry/core/build/cjs/utils/request.js:150-197` collects request data including the address

### E12-S07 — The edge access logs record no client address   `built`
**As a** platform admin, **when** nginx serves any request on any of the three vhosts, **I want** the
access log line to carry no client address in any form **so that** the standing GDPR decision holds at the
edge and not only inside the Node processes.

> **Decision, 2026-08-10, platform owner: no full IP in the access logs.** The decision that produced
> E12-S06 extends to the edge. `marketplace-nginx` defines **no `log_format` at all** — `grep -rn 'log_format'`
> across the repo returns nothing — so all three vhosts fall through to nginx's built-in `combined`, whose
> first field is `$remote_addr`. The fix is a named format that omits it, not a truncation and not a hash:
> capturing a network-derived value in *any* form is explicitly out of scope (§2).
>
> ⚠️ **This story is a prerequisite, not a leak being closed today, and the distinction decides the order it
> lands in.** The zone is proxied by Cloudflare (orange cloud), and `set_real_ip_from` is configured nowhere
> in the repo. `$remote_addr` is therefore a **Cloudflare edge address**, and `combined` logs no client
> address at present. It also means the edge rate-limit zones key on that edge address — see §3 — so
> `set_real_ip_from` plus `real_ip_header CF-Connecting-IP` has to be configured for the rate limiter to work
> at all. **The instant it is, `$remote_addr` becomes the real client and every access log line starts
> carrying one, silently, with no code change to notice.** This format must be in place before or in the same
> commit as that change, never after.
>
> ⚠️ **The forwarded address is load-bearing and must stay on the wire.**
> `snippets/proxy-backend.conf:56-57` sets `X-Real-IP` and `X-Forwarded-For`, and the first entry of the
> latter is what `@sentry/node-core` turns into `http.client_ip` (E12-S06). **This story changes what is
> written to disk, nothing else** — the headers, and the `$binary_remote_addr` rate-limit zones in
> `conf.d/20-rate-limit.conf:39,46,50,53,62`, which live in shared memory and are never persisted, are
> untouched. E12-S09 is what changes the value they carry; E12-S10 is what stops the services reading it.
>
> ✅ **Confirmed live, 2026-08-11.** E12-S12 drove the three vhosts in the test container and grepped every
> access log the probe produced: **zero** occurrences of the client address, in any field, in any form
> (`docs/report/log-sink-inventory.md` §5). Two log defects were measured that day and neither is this one —
> what the access log carried was the mailed credential (E12-S16), and the address the error log carries comes
> from nginx's hard-coded prefix (E12-S19), not from a format this story controls.

**domains:** infra, testing, documentation
**Acceptance criteria:**
- One `log_format` is defined once at `http` level in `conf.d/` and named by the `access_log` directive of
  **all three** vhosts (`sites-available/marketplace-domain.com.conf:74`,
  `admin.marketplace-domain.com.conf:65`, `shopowner.marketplace-domain.com.conf:64`). No `access_log`
  directive anywhere in the repo is left without an explicit format name, since an unnamed one silently means
  `combined`
- The format string contains none of `$remote_addr`, `$binary_remote_addr`, `$realip_remote_addr`,
  `$http_x_forwarded_for`, `$proxy_add_x_forwarded_for`, `$http_x_real_ip` — a grep over the `log_format`
  block proves it, and the same grep is what a reviewer runs
- The format keeps everything that is not network-derived and was there before: time, request line, status,
  bytes, referer, user agent, request time and upstream response time. A log that cannot be read is a log that
  gets reverted
- **The proxy header block is unchanged.** A test asserts `X-Real-IP` and `X-Forwarded-For` still arrive at the
  upstream, so this story cannot be mistaken for a licence to strip them
- The nginx test container drives a real request against each vhost, reads the access log it produced, and
  asserts the client address does not appear as a substring of the line — an assertion against the emitted
  log, not against the config text. The stub must present the request the way Cloudflare does, with
  `CF-Connecting-IP` and an `X-Forwarded-For` whose first entry is a client address, or the assertion passes
  on a request that never carried one
- **The test also covers the post-`set_real_ip_from` shape.** A second case runs with `set_real_ip_from`
  configured, so `$remote_addr` is the real client, and asserts the log line is still clean. Without it this
  story proves nothing about the state it exists to protect
- ⚠️ **`error_log` is not templatable.** nginx builds its error entries with a hard-coded `client: <address>`
  prefix; only the destination and the level are configurable. This story therefore **does not claim to close
  the error log**: it states that limitation in `marketplace-nginx/CLAUDE.md` and routes the residue to
  E12-S12, whose finding must record which levels emit a `client:` prefix in this configuration and what the
  retention on that file is
**Traces:** NFR-SE01, NFR-SE08, NFR-CO01, NFR-CO02; BCON-01, BCON-04
**Evidence (gap):** no `log_format` is defined anywhere in `marketplace-nginx`, so the three `access_log`
directives use the built-in `combined`, which begins with `$remote_addr`;
`conf.d/20-rate-limit.conf:15-17` and `CLAUDE.md:72-74` for the `set_real_ip_from` change that turns that
variable into a client address; `snippets/proxy-backend.conf:56-57` for the headers that must survive

### E12-S08 — Turnstile verification stops transmitting the client address   `built`
**As a** platform, **when** a login or a public write verifies its Turnstile token, **I want** the client
address left out of the request to Cloudflare **so that** the platform is not a transmitter of an address the
verifier already holds.

> **Decision, 2026-08-10, platform owner: stop sending it.** `assertTurnstile.mts:26` declares
> `remoteIp?: string` and `:37` appends it only `if (remoteIp)` — the parameter is already optional and the
> siteverify call succeeds without it. Two call sites pass it today:
> `marketplace-dev-public-authorization/src/lib/access/guardPublicLogin.mts:49` and
> `marketplace-dev-public-resource/src/lib/access/guardPublicWrite.mts:49`.
>
> **It buys no signal.** The browser solves the Turnstile challenge against `challenges.cloudflare.com`
> directly — that is why the private vhosts carry it in their CSP (`conf.d/20-rate-limit.conf:59-61`) — so
> Cloudflare observed the address at issue time and the server-side `remoteip` only repeats it. What it does
> change is the platform's own position: without it, no client address leaves this infrastructure on this
> path at all.
>
> **Remove the parameter, do not merely stop passing it.** An optional argument that must never be supplied
> is a defect waiting for the next caller. Deleting it from the signature makes reintroduction a change to
> `marketplace-common` rather than a one-word edit in a guard.

**domains:** backend, testing
**Acceptance criteria:**
- `assertTurnstile`'s signature is `(token: string | undefined)` — the `remoteIp` parameter and the
  `body.set('remoteip', …)` line at `assertTurnstile.mts:37` are both gone, so no caller can supply it
- `grep -rniE "remoteip" BEs/marketplace-common/src BEs/dev/*/src` returns zero hits
- Both call sites are updated in the same change — `guardPublicLogin.mts:49` and `guardPublicWrite.mts:49` —
  and `ctx.ip` is no longer referenced on either line
- A test asserts the exact body sent to siteverify is `secret=…&response=…` and **contains no third
  parameter**, replacing `marketplace-common/test/others.test.mts:318`, which asserts
  `…&remoteip=203.0.113.7` today and therefore canonises the behaviour this story removes
- A test asserts verification still succeeds and still fails closed on an invalid token with no address
  supplied — removing the parameter must not weaken the gate
- `marketplace-common` is committed **and its release published** before the two consuming services are
  touched, since they consume it by package name from the registry and by no other route (ADR-047)
- `yarn test:cov` stays 100/4 and `yarn test:mutation` stays 100 in `marketplace-common` and in both services
**Traces:** NFR-SE01, NFR-SE08, NFR-CO01, NFR-CO02; BCON-01, BCON-02
**Evidence (defect):** `BEs/marketplace-common/src/others/assertTurnstile.mts:26,37` for the parameter;
`guardPublicLogin.mts:49` and `guardPublicWrite.mts:49` for the two call sites;
`BEs/marketplace-common/test/others.test.mts:318` for the test that has to be replaced

### E12-S09 — nginx learns the real client address, and nothing downstream does   `built`
**As a** platform admin, **when** a request arrives through Cloudflare, **I want** nginx to rate-limit on
the address that actually made it **so that** per-address limiting exists at all — while the address stops at
the edge and reaches nothing behind it.

> **Decision, 2026-08-10, platform owner: only nginx learns it.** The question was whether the Node services
> should know the visitor's address. The answer is no. That makes the edge the single place the address is
> read, and makes it the only place that has to be got right.
>
> ⚠️ **Per-address rate limiting does not currently exist on this platform.** Five zones key on
> `$binary_remote_addr` (`conf.d/20-rate-limit.conf:39,46,50,53,62,66,76,78`) and `set_real_ip_from` is
> configured nowhere, so `$remote_addr` is a Cloudflare edge address and each zone buckets an entire
> Cloudflare point of presence. The repo predicted exactly this at `:15-17` and at `CLAUDE.md:72-74`.
>
> **The TLS mode is Full (strict), which settles what `set_real_ip_from` is set to.** Cloudflare reaches the
> origin over the public internet and validates its certificate, so this is not a Tunnel and the trusted set
> is Cloudflare's published address ranges rather than a local tunnel address. It also means the value is not
> static: Cloudflare adds ranges, and a stale list silently stops trusting a whole point of presence, which
> presents as `$remote_addr` reverting to an edge address for some visitors and nothing else.
>
> **This story is safe whether or not the origin is locked down.** `set_real_ip_from` scoped to those ranges
> means a connection arriving from outside them — a caller who found the origin address and went straight at
> it — has its `CF-Connecting-IP` ignored, so `$remote_addr` stays that caller's own address and the zones
> meter them correctly. What the lock-down protects is the WAF and the volumetric layer, not the correctness
> of the address read here; that is E12-S15's job and it does not block this.
>
> **`CF-Connecting-IP`, not `X-Forwarded-For`.** Cloudflare *appends* to a caller-supplied `X-Forwarded-For`
> instead of replacing it, so its first entry is whatever the caller chose. `CF-Connecting-IP` is
> single-valued and overwritten unconditionally. Reading the wrong one hands every attacker a private bucket
> of their own, which is worse than the shared bucket it replaces.
>
> ⚠️ **The GDPR position, once E12-S07, E12-S09 and E12-S10 are all in place, written down rather than
> inferred, 2026-08-28.** The edge holds a binary client address in `limit_req_zone` shared memory for the
> zone's lifetime — RAM only: E12-S07 keeps it out of `log_format` (§4, above), E12-S10 removes the
> per-address Redis bucket, and no Node service ever receives it (§2, §3). That is the accepted shape. The
> alternative that keeps the address out of vendor-operated infrastructure entirely is Cloudflare's own
> rate-limiting rules, which costs plan tier rather than code — it is not chosen here, and it stays
> available without invalidating anything above. This is the one fact `phase5/epics/E14.md` (E14-S08) held
> that lived nowhere else in the corpus; the file is deleted today and its record distributed — see §0.

**domains:** infra, testing, documentation
**Acceptance criteria:**
- `set_real_ip_from` covers Cloudflare's published IPv4 **and** IPv6 ranges, with `real_ip_header
  CF-Connecting-IP` and `real_ip_recursive off`, in one `conf.d/` file — not repeated per vhost
- **The range list has a refresh path, and it is written down next to the list.** Either a generated file with
  the command that regenerates it from `cloudflare.com/ips-v4` and `ips-v6` in a comment at the top, or a
  vendored list carrying the date it was fetched plus a `RISK_REGISTER` row with a review trigger. A list with
  neither is a control that expires without failing — the symptom is `$remote_addr` quietly reverting to an
  edge address for the visitors behind a newly added range, which reads as nothing at all
- **E12-S07 is already in place when this lands**, in the same commit or an earlier one. This story is what
  turns `$remote_addr` into a client address; landing it first starts writing client addresses into
  `combined` access logs with nothing to notice it
- The three login zones are retuned, because they were never enforcing what their comments claim: with the
  Redis 20/hour bucket gone (E12-S10), `mkt_auth`, `mkt_owner_auth` and `mkt_admin_auth` become the whole
  per-address rule. `rate=1r/m burst=20 nodelay` is the starting point — 20 immediately, ~60/hour sustained —
  against `20r/m`, `20r/m` and `10r/m` today
- ⚠️ **The chosen rates are justified in the config comment against carrier and office NAT.** Nothing has
  ever enforced a real per-address limit here, so no traffic evidence exists; a number too low locks out a
  shared address and the failure looks like a broken login, not like a rate limit. E12-S12 reviews it against
  real traffic
- ⚠️ **The three token-rotation endpoints move off the login zones first, into `mkt_refresh`,
  `mkt_owner_refresh` and `mkt_admin_refresh` at `rate=10r/m burst=20 nodelay`.** Today
  `/user-authenticated-authorization`, `/authenticated-authorization` and
  `/admin-authenticated-authorization` share `mkt_auth`, `mkt_owner_auth` and `mkt_admin_auth` with the login
  endpoint on the same vhost, which contradicts the principle `conf.d/20-rate-limit.conf:9-13` states in its
  own header — zone name is the counter, and separate budgets exist so one surface's abuse cannot spend
  another's allowance. The retune above makes the split mandatory rather than tidy, for two reasons stated in
  the config comment: a token flood against rotation would otherwise exhaust the 20-request burst and hold
  the whole address, login included, to 1r/m; and rotation is a timer-driven path every authenticated session
  hits, so an office NAT of fifty sessions rotating twice an hour is roughly 1.7/min sustained and breaks a
  1r/m ceiling with no attacker present at all
- The nginx test container asserts the separation behaviourally: exhausting a rotation zone from one address
  leaves that address able to reach the login endpoint on the same vhost, and the reverse
- `proxy_set_header X-Forwarded-For $remote_addr` replaces `$proxy_add_x_forwarded_for` in
  `snippets/proxy-backend.conf:57`, so no caller-supplied entry survives to any upstream. Nothing in the app
  reads it, but `@sentry/node-core` does (E12-S06), and it should not be reading a value a caller wrote
- The nginx test container asserts all three: a request presenting `CF-Connecting-IP` from an address inside
  `set_real_ip_from` is limited on that address; the same request from outside the range is **not** trusted;
  and a caller-supplied `X-Forwarded-For` does not reach the upstream
- `marketplace-nginx/CLAUDE.md:72-74` and `conf.d/20-rate-limit.conf:15-17` are rewritten — they describe this
  as a future hazard, and after this story it is the configuration
**Traces:** NFR-SE01, NFR-SE08, NFR-AV01, NFR-AV02, NFR-CO01; BCON-01, BCON-04
**Evidence (defect):** `conf.d/20-rate-limit.conf:39,46,50,53,62,66,76,78` key on `$binary_remote_addr` with
no `set_real_ip_from` anywhere in the repo; `snippets/proxy-backend.conf:57` for the appending form

### E12-S10 — The services stop counting per address   `built`
**As a** platform, **when** a login or public write is rate-limited, **I want** the per-address half done at
the edge only **so that** no client address is written to Redis and the counter stops being a fiction.

> **Consequence of E12-S09's decision.** `app.proxy` is off, so `ctx.ip` is nginx's own address and
> `${bucket}:ip` is **one global bucket** — `perIpPerHour` spent by the entire platform, and a live defect:
> the 21st login attempt in an hour, from anybody at all, is refused. Deleting it removes a broken control,
> not a working one. E12-S09 supplies the replacement.
>
> **`app.proxy` stays off, and that is now load-bearing.** The whole design rests on the services never
> seeing a client address. A future `app.proxy = true` would silently start writing real addresses into
> whatever reads `ctx.ip`, so it is pinned by a test rather than by a comment.
>
> **The per-email bucket stays.** It is the half no nginx zone can express — a zone keyed on the address
> never sees the email a distributed source is grinding against — and `guardPublicWrite.mts:31-36` records
> why it is worth its own denial-of-service trade. Whether the *email* belongs in that key in plaintext is
> E12-S11, which lands with this one.

**domains:** backend, testing, documentation
**Acceptance criteria:**
- The `${bucket}:ip` call is gone from `guardPublicLogin.mts:46` and `guardPublicWrite.mts:46`, and
  `perIpPerHour` is gone from `IGuardPublicLoginArgs` and `IGuardPublicWriteArgs` — the argument cannot be
  passed, so no caller can reinstate the counter by supplying it
- Every mutation passing `perIpPerHour` today is updated in the same change; `grep -rn 'perIpPerHour'
  BEs/dev/*/src BEs/marketplace-common/src` returns zero hits
- `grep -rn 'ctx\.ip' BEs/dev/*/src` returns zero hits — with E12-S08 removing the Turnstile argument, this
  story removes the last reader
- **A test per service asserts `app.proxy` is falsy on the constructed Koa app.** Nine services, nine tests;
  a comment saying it is off is what this replaces
- The doc comments that describe the removed behaviour are rewritten, not left: `guardPublicWrite.mts:37-41`
  reasons about `app.proxy` and `X-Forwarded-For`, and `marketplace-nginx/CLAUDE.md:76-78` states the real
  limit is "per-IP *and* per-email, which no nginx zone can express" — after this story the per-IP half is
  precisely what the nginx zone expresses
- `marketplace-common` is committed **and its release published** before either consuming service is touched
- `yarn test:cov` stays 100/4 and `yarn test:mutation` stays 100 in `marketplace-common`,
  `marketplace-dev-public-authorization` and `marketplace-dev-public-resource`
**Traces:** NFR-SE01, NFR-SE08, NFR-AV01, NFR-CO01, NFR-CO02; BCON-01, BCON-02
**Evidence (defect):** `guardPublicLogin.mts:46` and `guardPublicWrite.mts:37,46` build the bucket from
`ctx.ip`; `assertUnderRateLimit.mts:46` interpolates it verbatim into the Redis key; `new Koa()` in all nine
`src/index.mts` with no `app.proxy` assignment anywhere

### E12-S11 — The rate-limit key carries no plaintext email   `built`
**As a** platform, **when** the per-email counter is incremented, **I want** the address hashed before it
becomes a Redis key **so that** a Redis dump, a `KEYS` scan or the append-only file is not a list of the
addresses that tried to register.

> **Decision, 2026-08-10, platform owner: hash it, SHA-256.** `assertUnderRateLimit.mts:46` interpolates
> `identity` verbatim into `` `${process.env.REDIS_KEY}rl:${bucket}:${identity}` ``, and the per-email call
> sites (`guardPublicLogin.mts:47`, `guardPublicWrite.mts:47`) pass the address itself — so the key is
> `rl:userRegister:email:mario@example.com`. Redis runs with `--appendonly yes`
> (`marketplace-docker-DBs/docker-compose.yml:62`), so that address reaches disk. The *same* value, `login.email`, is
> CSFLE **deterministically encrypted** in Mongo (`marketplace-db-setup/lib/schemas/account.js:25-26,42`):
> encrypted at rest in one store, plaintext on disk in the other.
>
> **The limiter only ever tests equality.** It increments a counter and compares it to a ceiling; it never
> reads the identity back. Hashing therefore costs one `sha256` per call and changes no behaviour, which is
> why this is a two-line change rather than a redesign.
>
> ⚠️ **This is pseudonymisation, not anonymisation, and the epic must not claim otherwise.** An email is
> drawn from a guessable space, so a bare SHA-256 digest is recoverable by dictionary attack against a
> dump. What it removes is casual disclosure — the admin running `KEYS`, the AOF read by whoever can read
> the volume, the support engineer looking at a slow log. The form that survives an attacker holding the
> dump is an HMAC under a managed key, and key custody is E16; this story does not pretend to reach that.
>
> **No cutover, unlike E13-S01.** These keys are hour-scoped counters, not session lookups, so switching the
> shape does not need a dual read — it resets every live counter once, and nothing else observes them.

**domains:** backend, testing, documentation
**Acceptance criteria:**
- `marketplace-common` exports `sha256Hex(value)` returning a lower-case hex digest, and
  `assertUnderRateLimit` builds its key as `` `${process.env.REDIS_KEY}rl:${bucket}:${sha256Hex(identity)}` ``
  — the raw `identity` is not interpolated anywhere in the module
- A test asserts the **exact** key string sent to Redis for a known identity, against a digest written into
  the test as a literal. An assertion that merely checks the key differs from the input is satisfied by a
  mutant that reverses the string
- **Only the identity is hashed.** `bucket` stays readable, so `rl:loginUser:email:` remains a greppable
  prefix and an admin can still count buckets without being able to name anybody in one
- **`sha256Hex` does not normalise its input**, and a test pins that: `A@x.it` and `a@x.it` hash differently.
  Normalisation stays where it already is — the callers pass `email.toLowerCase().trim()`
  (`loginUser.mts:86`, `login.mts:69`, `loginAdmin.mts:70`, `userRegister.mts:61`,
  `userResetPwd.mts:46`, `userUpdatePwd.mts:48`, `userVerifyEmailResend.mts:55`) and
  `IGuardPublicWriteArgs.email:12` documents the contract. Moving it into the hash would let the limiter
  silently disagree with what the account lookup matches on
- ⚠️ **The contract line in `IGuardPublicWriteArgs` and `IGuardPublicLoginArgs` stays and gains a reason.**
  A non-normalised address used to be visible in the key; after this story it is not, so a caller that
  forgets `toLowerCase()` produces a second bucket that nobody can spot by looking
- `assertUnderRateLimit.mts:32-37`'s doc comment is rewritten. The current warning — "Never pass a raw
  password or token as `identity` — the key lands in Redis in plaintext" — stops being literally true while
  the **ban stays**: a bare digest of a low-entropy secret is exactly what an offline attack wants, so the
  comment states the new reason rather than being deleted
- `sha256Hex` is the single hashing primitive in `marketplace-common`, written so E13-S01's
  `hashSessionToken` is a named wrapper over it rather than a second implementation;
  `grep -rn "createHash" BEs/marketplace-common/src` returns exactly one hit
- The operational residue is written down, not left implied: raw-email keys already in the append-only file
  survive this change until the file is rewritten, so the finding records `BGREWRITEAOF` — **per node, Redis
  being a cluster** — run after the one-hour window has drained, as the step that removes the history
- `marketplace-common` is committed **and its release published** before either consuming service is touched
- `yarn test:cov` stays 100/4 and `yarn test:mutation` stays 100 in `marketplace-common`,
  `marketplace-dev-public-authorization` and `marketplace-dev-public-resource`
**Traces:** NFR-SE01, NFR-SE08, NFR-CO01, NFR-CO02, NFR-MA01; BCON-01, BCON-02
**Evidence (defect):** `BEs/marketplace-common/src/others/assertUnderRateLimit.mts:46` interpolates `identity`
verbatim; `guardPublicLogin.mts:47` and `guardPublicWrite.mts:47` pass the address;
`marketplace-docker-DBs/docker-compose.yml:62` runs Redis with `--appendonly yes`;
`BEs/marketplace-db-setup/lib/schemas/account.js:25-26,42` encrypts the same value in Mongo

### E12-S12 — Investigation: what do the application and access logs actually contain   `built`
State plainly: the audit was static-only and never looked at a log line. This story looks, and produces a
finding — nothing else.
**Finding:** [`docs/report/log-sink-inventory.md`](../../report/log-sink-inventory.md) v1.0 — measured
against the running Dev stack on 2026-08-11. The nine application logs are clean on every marker; the nginx
access log records the account email and the one-time verify/reset hash; the Redis password is in the
container argv; nothing bounds any Docker log; the nginx error log carries `client: <address>` on five of
five request-scoped entries at the shipped `warn`. Yeses become **E12-S16 … E12-S20**; the two that put a
full client address or an email address on disk routed to the platform owner rather than to a fix, and both
came back decided on 2026-08-11 — the retention answer is quoted in full on **E12-S19**, the access-log
mechanism on **E12-S16**.
**domains:** backend, documentation
**Acceptance criteria:**
- A written finding enumerates every log sink the platform writes to — application logs in the nine services,
  nginx access logs, the Docker stack's own output — and states, per sink, whether a token, a cookie, a signing
  key or a client IP can appear in it, with a file and line for each yes
- The finding is produced against the **running** Dev stack with real requests, not by reading code, since that
  is precisely the blind spot the audit names
- Every "yes" becomes a story in this epic before it is called done; every "no" cites what makes it a no
- If nginx access logs record full client IPs, the finding says so plainly and routes it to the GDPR decision
  rather than fixing it silently
**Traces:** NFR-SE08, NFR-MA07, NFR-CO01, NFR-CO02; BCON-01, BCON-04
**Evidence (gap):** audit §5 — "Application and access logging was never audited."

### E12-S13 — Investigation: capture one real Sentry event and read it   `built`
State plainly: every claim in E12-S02 rests on reading `node_modules`. One captured event settles it.
**Finding:** [`docs/report/sentry-event-capture.md`](../../report/sentry-event-capture.md) v1.0 — a real
event, built and transmitted by the real transport into a local collector on 2026-08-11. No header sentinel
reached the wire, but not because the scrubber removed it; `event.request.data` carried the raw GraphQL body
with a plaintext password; transactions bypass `beforeSend` entirely. E12-S02's key list and fixture are
corrected in §8 there. Yeses become **E12-S21 … E12-S23**.
**domains:** backend, testing
**Acceptance criteria:**
- One real event is captured from a running service with an `authorization` header present — via a transport
  stub or a local capture — and the raw JSON is recorded in the finding with credential values redacted
- The finding confirms or corrects where the headers land, and E12-S02's key list is updated to match what was
  actually observed
- If the observed shape differs from `httpServerSpansIntegration`'s documented behaviour, the difference is
  named and E12-S02's fixture is rebuilt from the observation
**Traces:** NFR-SE08, NFR-MA07; BCON-01, BCON-04
**Evidence (gap):** audit §5 — the audit was static-only

### E12-S14 — The observability documentation matches the code   `built`
**domains:** documentation
**Acceptance criteria:**
- `docs/architecture.md` gains an observability section stating what is sent to Sentry, what is scrubbed, and
  where the scrubber lives
- `grep -rn 'sendDefaultPii\|rejectUnauthorized' docs/` returns no statement contradicting the code after this
  epic
- The E12-S12 finding is linked from that section, so the next audit starts from an answer rather than a blind
  spot
**Traces:** NFR-MA05, NFR-CO01; BCON-01, BCON-03
**Evidence (gap):** no observability section exists in `docs/architecture.md`

### E12-S15 — Only Cloudflare can open a connection to the origin   `built`
**As a** platform admin, **when** anything other than Cloudflare connects to the edge on 443, **I want**
the TLS handshake refused **so that** the WAF, the bot rules and every Cloudflare-side limit cannot be
skipped by learning one IP address.

> **Decision, 2026-08-10, platform owner: Authenticated Origin Pulls, configured on the zone (or per
> hostname) with a certificate of this zone's own.** The Cloudflare→origin leg becomes mutual TLS: Cloudflare
> presents a client certificate and nginx verifies it, so the origin stops depending on nobody knowing its
> address.
>
> **Why not the global certificate.** Cloudflare's default origin-pull certificate is shared by every
> Cloudflare customer, so `ssl_verify_client on` against that CA admits anyone who points their own zone at
> this origin — it stops the internet and not an attacker willing to open a free account. A certificate
> issued for this zone is trusted by nobody else. If the global one is ever used instead, the identity has to
> be pinned as well — `$ssl_client_s_dn` or `$ssl_client_fingerprint` in a `map` — because the issuer alone
> proves only "some Cloudflare customer".
>
> **What is already covered, and must not be double-counted.** `ssl_reject_handshake on` in the default
> server (`conf.d/40-tls.conf:65-75`) refuses a connection with no SNI or an unknown SNI before any
> certificate is presented, which is why this origin is not discoverable by mass scanning. What it does not
> refuse is a caller who sets SNI and `Host` to a hostname the edge serves — and every such hostname is
> public, each Let's Encrypt issuance being recorded in Certificate Transparency. This story closes that
> half and only that half.
>
> ⚠️ **Two ways this takes the platform down, and both are avoidable.** Cloudflare presents a client
> certificate only where the feature is switched on, so enabling `ssl_verify_client on` first fails every
> handshake on the vhost from the moment nginx reloads. And a zone certificate has an admin-set validity
> that nothing renews automatically — the day it expires, all three vhosts stop answering Cloudflare, and the
> symptom reads as a TLS fault rather than an expiry.

**domains:** infra, testing, documentation
**Acceptance criteria:**
- `ssl_client_certificate` and `ssl_verify_client on` are declared **once, in a snippet included at server
  level by all four 443 blocks**, following the `snippets/proxy-backend.conf` idiom rather than being written
  out per file; `grep -c` proves four includes and one definition. **Four, not three** — the `www` redirect
  in `sites-available/marketplace-domain.com.conf:27-38` is a server block of its own, and a vhost count
  leaves it out, leaving one hostname that still answers an unauthenticated caller
- **The default server block is left alone.** `ssl_reject_handshake on` (`conf.d/40-tls.conf:72`) refuses
  earlier in the handshake than client verification runs, so adding the directives there is dead
  configuration that reads as a second control; a test asserts the block is unchanged
- **The CA file is referenced by path and never committed.** It lives beside the Let's Encrypt material
  (`/etc/nginx/certs/…`), the way `ssl_certificate` already does. This is not only convention: this repo's
  `.githooks/pre-commit` adds `key` to `SECRET_PATH` and `*.pem` is already matched, so a committed
  certificate file trips the secret guard — the hook and the idiom agree
- **Port 80 is untouched**, and the suite proves it: a request to `/.well-known/acme-challenge/…` on `:80`
  completes with no client certificate, so an ACME HTTP-01 renewal cannot be broken by this story
- The test container asserts both directions against a **test** CA, since Cloudflare's private key is not
  available to a test: a request presenting no client certificate is refused, and one presenting a
  certificate signed by that CA is served. A suite that only runs `nginx -t` proves the syntax and nothing
  about the behaviour
- **The rollout sequence is written into `marketplace-nginx/README.md`, with its failure symptom named**:
  enable on the Cloudflare side first, then `ssl_verify_client optional` with `$ssl_client_verify` in the
  access log to confirm a certificate is actually arriving, then `on`. Any other order is an outage on that
  hostname at the next reload
- ⚠️ **The expiry has an owner and a trigger, not a comment.** A `RISK_REGISTER` row records the zone
  certificate's expiry date, who renews it and what fails if nobody does — all three vhosts refusing
  Cloudflare — and the regeneration procedure is written down next to the rollout sequence. A control whose
  failure mode is total unavailability cannot rely on somebody remembering
- `marketplace-nginx/CLAUDE.md` states that the origin accepts Cloudflare only, so the next reader does not
  add a monitoring probe or a health check pointed straight at the origin and conclude the edge is down
- `nginx -t` passes and `./test/run.sh` is green — the `pre-push` hook runs it and blocks on failure
**Traces:** NFR-SE01, NFR-SE08, NFR-AV01, NFR-AV02, NFR-CO01; BCON-01, BCON-04
**Evidence (gap):** `ssl_verify_client`, `ssl_client_certificate`, `allow`/`deny` and any
`ufw`/`iptables`/`nftables` reference return zero hits across all sixteen repos;
`conf.d/40-tls.conf:65-75` covers the SNI-less and unknown-SNI cases only;
`sites-available/*.conf:33-34,38-39,46-47` for the publicly trusted certificates a direct caller is served

### E12-S16 — The mailed links stop writing a live credential to the access log   `built 2026-08-11`
**As a** customer or shop owner, **when** I click the link the platform mailed me, **I want** the one-time
hash and my address to stay out of the edge's log files **so that** anyone who can read an access log cannot
complete my verification or my password reset.

> The access `log_format` was written to carry no address variable and it does not (E12-S07, confirmed live).
> That is not enough here: both mailed links are **GETs with `:email/:hash` in the URL path**, and the path is
> in `"$request"`. The credential is in the request line, not in a header the format could omit.

**domains:** backend, frontend, infra, testing
**Acceptance criteria:**
- No access log line produced by either mailed link shape contains the one-time hash or the address. The
  probe in `docs/report/log-sink-inventory.md` §5 is the test: drive both links, grep the log for both values,
  expect zero
- **Which of the two fixes is used is a decision, not a detail, and the story records it**: either the token
  leaves the URL path (a POST or a fragment the SSR page reads and forwards), or those `location` blocks set
  `access_log off` — the first removes the credential from every intermediary, the second only from this one
- If `access_log off` is chosen, the story states what is lost: those requests disappear from the only record
  the edge keeps of them
- `marketplace-nginx`'s container suite asserts whichever shape is chosen, so a later edit to
  `sites-available/marketplace-domain.com.conf` cannot quietly reinstate the logging
- The `Referer` leak is named in the same change if the token stays in the URL: an SSR page that loads any
  third-party resource sends the whole path with it
**Traces:** NFR-SE01, NFR-SE08, NFR-CO01, NFR-CO02; BCON-01, BCON-04
**Evidence (defect):** measured — `docs/report/log-sink-inventory.md` §5, three logged lines carrying both
values across two hosts; `BEs/dev/marketplace-dev-public-resource/src/middleware/router/index.mts:16,25`;
`src/lib/access/sendUserVerifyEmail.mts:11`; `src/lib/access/resetPwdFlowUser.mts:38`;
`marketplace-nginx/sites-available/marketplace-domain.com.conf:207`

**Mechanism chosen — the third one, decided by the platform owner 2026-08-11.** Neither option the story
listed: *"rewrite the logged path — map the two location blocks to a redacted `$request` variable"*. The
credential stays in the URL and the log stops recording it. `access_log off` was rejected implicitly by the
same instruction — the owner asked for an anonymised access log, not for a missing one.

**Built as** `marketplace-nginx/conf.d/05-logging.conf`, at http level rather than per location, plus the
suite in `test/suite.sh`. What changed, and the three things the implementation found:

- **There are four link shapes, not two.** `/check/verify-email-user/:email/:hash` (apex) and
  `/check/verify-email/:email/:hash` (shopowner) have a `location` block each; `/reset-password/:email/:hash`
  is a `marketplace-user` SSR route reached through `location /` (`resetPwdFlowUser.mts:38`) and
  `/x/reset/:email/:hash` is koa-utils' default `linkPath`, taken because `resetPwdFlow.mts:47` passes no
  mailer — neither has a block of its own. **A per-location fix would have covered half of them and looked
  complete**, which is why the map is at http level and keyed on the logged value.
- **`$request` cannot be rewritten**, so the format stops naming it and builds the request line from
  `$request_method`, `$request_uri` through `map $request_uri $mkt_uri`, and `$server_protocol`. Everything
  after the matched prefix collapses to one `[redacted]`, so the query string and any future segment go with
  it. The flow name survives, which is what the log was debugged from.
- **The `Referer` was the same leak by a second route, and it is fixed in the same change.** The customer
  surface answers `Referrer-Policy: strict-origin-when-cross-origin`, which sends the **full URL** on a
  same-origin request — so every asset fetch and every GraphQL call the reset page makes carried the address
  and the live hash into the field right after the request line. A second map, `$mkt_referer`, redacts it.
  The panel surface answers `no-referrer` and never had it.

**Residual, and it is the cost of the mechanism the owner picked:** the credential still travels in the URL,
so Cloudflare's own logs, any corporate middlebox, the browser history and the mail client still hold it.
Only the option this platform rejected — taking the token out of the path — removes it from those. Bounded on
one side: `strict-origin-when-cross-origin` sends only the origin cross-origin, so a third-party resource
loaded by the reset page receives no path, and every asset the customer surface loads is first-party anyway.
✅ **Reopened as a story, not left as a note** — the owner asked on the same day whether the residual can be
closed, and **E12-S26** closes the half that is closable: the customer reset link moves into the URL
fragment. The verify links stay as they are, for the reason that story records.

**Adjacent, not fixed here, and reported:** `sites-available/marketplace-domain.com.conf` caches the SSR
response with `proxy_cache_key "$scheme$request_method$host$request_uri"`, so `/reset-password/:email/:hash`
is stored under a cache key that is the whole link, on disk, for 60s — and `conf.d/30-cache.conf:8-13` keeps
the file up to `inactive=24h`, which is the number that matters, not the 60. Same credential, a different
sink, outside this story's "access log" scope, and **now owned by E12-S26** together with the residual above.

**Verified:** `./test/run.sh`, all checks passed. Seven new assertions — three static (the format names no
raw `$request`, `$request_uri` or `$http_referer`; both maps exist) and four behavioural, driving all four
link shapes for real in encoded (`%40`) and decoded (`@`) form plus one `Referer` probe, each asserting the
line keeps the flow name, drops both values and stays address-free. Mutation-checked: with the format
reverted to `"$request"` / `"$http_referer"`, all seven fail.

### E12-S17 — The Redis password stops riding in the container's argv   `built 2026-08-11`
**As a** platform admin, **when** Redis runs, **I want** its password out of the process command line
**so that** an unprivileged local process cannot read it with `ps`.

**domains:** infra, documentation
**Acceptance criteria:**
- `docker inspect marketplace-redis`, `docker ps --no-trunc` and host `ps aux` show no password. The measured
  before-state is three yeses and one no (`docker logs`), so the test is the same four commands
- The credential arrives by a path that is not argv — a `redis.conf` mounted read-only, or Redis 7's
  `--requirepass` read from a file — and `marketplace-docker-DBs/docker-compose.yml` no longer interpolates
  `${REDIS_PASSWORD}` into `command:`
- `marketplace-docker-DBs/CLAUDE.md` records the new shape, since the boot order documented there is what the next reader
  copies
- **No secret file is committed**, and the parent workspace's secret guard is what proves it
- The generated file is **mode 444 and lives in a 700 directory**, and both numbers are commented where they
  are set. `redis-server` reads the config as uid 999 through a bind mount the daemon owns, so a 400 file
  owned by the host user is `Fatal error, can't open config file` — measured, not assumed. The host-side
  control is therefore the directory, which the container's path never traverses
- `up.sh` **rewrites the file on every run**, so `.env` stays the single source of truth and a password
  change cannot be half-applied. It removes the old one first: mode 444 denies the owner write too, and a
  plain redirect onto it fails on the second run
**Traces:** NFR-SE01, NFR-SE08, NFR-CO01; BCON-01
**Evidence (defect):** measured — `docs/report/log-sink-inventory.md` §7.1;
`marketplace-docker-DBs/docker-compose.yml:62` — `command: [redis-server, --appendonly, 'yes', --requirepass, '${REDIS_PASSWORD:-unset}']`

> ✅ **Built 2026-08-11.** `up.sh` writes `secrets/redis.conf` — git-ignored, mode 444 — from `REDIS_PASSWORD`
> and compose mounts it read-only at `/usr/local/etc/redis/redis.conf`; the command is now
> `redis-server /usr/local/etc/redis/redis.conf` and `appendonly yes` moved into the file with the password,
> so the server has one source of configuration instead of two. Re-measured after the change: the token
> `requirepass` appears **nowhere** in `docker inspect marketplace-redis`, `docker ps --no-trunc` prints the
> two-token command, `docker logs` is clean, and an unauthenticated `redis-cli ping` still answers
> `NOAUTH Authentication required` — the credential moved, it was not dropped. `up.sh` was run twice to prove
> the rewrite path.
>
> The workspace secret guard gained two rules rather than being trusted as it stood: `SECRET_PATH` now refuses
> **any** staged path containing a `secrets/` segment, and `SECRET_VALUE` refuses a `requirepass` or
> `masterauth` line — the new file has no `KEY=` shape and no telltale extension, so neither existing rule
> would have caught it. Nothing in the sixteen repos tracks such a path, so the first rule costs nothing.
>
> ⚠️ **One acceptance criterion is met by correcting it.** Host `ps aux` shows no password now and showed none
> before: Redis rewrites its own `argv` at startup (`set-proc-title yes`), so `/proc/<pid>/cmdline` reads
> `redis-server *:6379` within a second of boot. Re-measured against a throwaway container running the old
> `--requirepass` shape — `docker ps --no-trunc` printed the value while `pgrep -a -f` printed the rewritten
> title for the same process. The before-state was **two** surfaces, both needing the daemon socket, not
> three. The finding's §7.1 table is corrected in place. The defect stands — daemon-socket access is group
> membership, not privilege — but the story's own evidence line was wrong and is now right.

### E12-S18 — Every container log is bounded   `built 2026-08-11`
**As a** platform admin, **when** the stack runs for a long time, **I want** container logs to stop growing
without limit **so that** the filesystem is not the only thing that stops them.

**domains:** infra
**Acceptance criteria:**
- Every service in `marketplace-docker-DBs/docker-compose.yml` declares `logging.options.max-size` and `max-file`;
  `docker inspect -f '{{json .HostConfig.LogConfig}}'` returns a non-empty `Config` for all of them
- The chosen size is written down with its reasoning rather than picked — `marketplace-mdb1` was measured at
  380,144 lines on a development machine, which is the number the choice has to answer
- ⚠️ **Rotation is not retention.** The story states plainly that bounding the file does not decide how long
  the content may be kept. That second question was the platform owner's and is now answered — 14–30 days
  with `shred`, E12-S19 — but it is answered for the **edge's** logs; nothing has decided a period for the
  Docker container logs this story bounds, so it bounds size and says so
- The pair is set **once, on a YAML anchor** every service merges, so adding a service to this file cannot
  quietly reintroduce the unbounded default
**Traces:** NFR-AV01, NFR-MA07, NFR-CO02; BCON-04
**Evidence (defect):** measured — `docs/report/log-sink-inventory.md` §7.2; all five running containers use
`json-file` with an empty options object

> ✅ **Built 2026-08-11.** One `x-logging` anchor — `max-size: 20m`, `max-file: '5'` — merged by the three
> `mongod` services and by `redis`. `docker inspect -f '{{json .HostConfig.LogConfig}}'` returns
> `{"max-file":"5","max-size":"20m"}` for all four after a recreate.
>
> **The size answers a re-measurement, not the number in the evidence line.** `marketplace-mdb1` had moved
> from 380,144 lines to **458,129 — 229 MiB across 52.6 hours**, or 4.6 MB an hour, while `mdb2`, `mdb3` and
> `redis` wrote 2.8 MiB, 4.2 MiB and 9 KiB over the same span. 20 MiB × 5 caps one container at 100 MiB and
> the stack at 400 MiB, which at mdb1's rate keeps roughly the last 22 hours — one working day, the window a
> developer actually reads back. For the other three the same pair means "never rotates" and costs nothing:
> it is sized for the loud container, and the reasoning is in the file above the anchor so raising it is a
> decision with its own arithmetic in front of it.
>
> `backend-backend-1` appears in the finding's §7.2 table and is **not** covered: it belongs to a different
> compose project on the same machine, and this story owns `marketplace-docker-DBs/docker-compose.yml`.

### E12-S19 — The edge's log retention is pinned by the repo   `built 2026-08-11`
**As a** platform admin, **when** nginx writes a log line carrying a client address, **I want** the
lifetime of that file to be a property of this repository **so that** it is not whatever the host distribution
happens to default to.

> Measured: `marketplace-nginx` ships **no** rotation configuration, and `nginx:stable-alpine` has no
> `logrotate` binary. On this machine a distro default applies; a deployment inherits nothing.

> ✅ **The period is decided — platform owner, 2026-08-11**, verbatim: *"keep raw IPs in error_log, logrotate
> at 14–30 days with shred, anonymize access_log, write two lines in your privacy policy. That's proportionate
> and defensible."* This story owns the first two clauses: the error log **keeps** full addresses, so the
> control is lifetime rather than content. The third clause is E12-S16's (measured, the access log holds no
> address at all — what it held was the mailed credential, now redacted), the fourth is E12-S25's. This story
> no longer waits on anything.

**domains:** infra, documentation
**Acceptance criteria:**
- `marketplace-nginx` ships a rotation configuration of its own — period, count, compression, mode and owner
  — and the container suite asserts it is present and syntactically valid
- The error logs are covered, not only the access logs: five of five request-scoped entries at the shipped
  `warn` carry `client: <address>`, so those are the files retention actually matters for
- **Retention is 14 days**, daily rotation, `rotate 14`. The owner gave 14–30; the floor is taken because the
  file's only consumer is a developer reading a recent failure, and nothing on this platform reads an nginx
  error log older than a day. The config carries that sentence as a comment, so raising it to 30 is a
  one-line decision with the reason already in front of whoever makes it
- **Removal is `shred`, not `unlink`** — `logrotate`'s `shred` with the default 3 passes, on both the access
  and error logs, and the container suite asserts the directive is present. A rotated-out file that is only
  unlinked is still on the device, which makes the 14 days a statement about the directory listing rather
  than about the data
- The error log's **level stays `warn` and its content is not filtered**: the decision is explicit that the
  address stays and the lifetime is the control. A story that strips the prefix would be re-opening a decided
  question — and it cannot, since nginx hard-codes it (§6.1 of the finding)
- `marketplace-nginx/CLAUDE.md` §95 and `conf.d/05-logging.conf:28-31` stop delegating the question to E12-S12
  and cite the finding instead
**Traces:** NFR-SE08, NFR-MA07, NFR-CO02; BCON-04
**Evidence (gap):** measured — `docs/report/log-sink-inventory.md` §6.1, §6.4;
`marketplace-nginx/sites-available/{admin.marketplace-domain.com.conf:75,marketplace-domain.com.conf:94,shopowner.marketplace-domain.com.conf:74}`

> ✅ **Built 2026-08-11.** `marketplace-nginx/logrotate.d/nginx` — `daily`, `rotate 14`, `compress` with
> `delaycompress`, `shred`, `create 0640 www-data adm`, `su root adm`, and `sharedscripts` around a `USR1`
> so nginx reopens after the rename. One glob, `/var/log/nginx/*.log`, rather than a list of the eight
> destinations: a list covers the vhosts that existed the day it was written, and the ninth would silently
> inherit the host default again. Fourteen assertions in the container suite, `./test/run.sh` green.
>
> **Three of those assertions are behavioural, not a second grep of the file.** The period is read back out
> of `logrotate -d` (`after 1 days … (14 rotations)`), coverage is read back the same way — every path the
> repo names, plus nginx's own `error.log`, must appear as `considering log <path>` — and the suite then
> rotates sixteen times for real, because `rotate 14` has to build fourteen generations before the
> fifteenth can fall off. Both removals are then checked in logrotate's own output: the plaintext copy
> when `delaycompress` catches up with it, and the generation that crosses the retention boundary. Mutating
> `rotate 14` → `rotate 7` and deleting `shred` fails four of them, which is how they were shown not to be
> vacuous.
>
> ⚠️ **`shred` fails open, and finding that out is the story's own correction.** logrotate does not run
> `shred <file>`; it opens the file and hands the descriptor to `shred … -`. Busybox's applet cannot open
> `-`, so on `nginx:stable-alpine` every removal printed `error: Failed to shred <file>, trying unlink`,
> unlinked the file anyway and exited **0** — the whole clause silently off, with the only trace in cron
> mail. Debian 13 ships GNU coreutils and is fine; the suite installs `coreutils` beside `logrotate` for
> exactly this reason and asserts the runs are error-free, so the difference is visible rather than assumed.
>
> ⚠️ **Two stanzas matching one glob cost more than a duplicate.** Measured: logrotate prints
> `error: <file>:1 duplicate log entry for …`, skips the **whole** later-named file and exits 1. Installed
> as `marketplace-nginx` this file would lose on name order to the distribution's weekly `rotate 4`, so it
> installs **over** `/etc/logrotate.d/nginx`. `README.md` §Install carries that as a step and as a dpkg
> conffile warning.
>
> ⚠️ **`shred` is not an erasure guarantee and the story does not claim one.** It overwrites the blocks the
> file occupies now; a copy-on-write filesystem, ext4 with `data=journal`, or SSD wear levelling can leave
> an earlier copy where the overwrite never reaches. It raises the cost of recovery. **The 14 days are the
> control**, which is also why E12-S25 states them in public.

### E12-S20 — No resolver echoes its argument to a log   `built 2026-08-11`
**As a** platform admin, **when** an anonymous caller sends a GraphQL argument, **I want** it not to be
written to disk verbatim **so that** what lands in the log is the platform's choice rather than the caller's.

**domains:** backend, testing
**Acceptance criteria:**
- `BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/queries/publicHelloArgs.mts:15` no longer
  prints the argument. The one measured marker hit in nine service logs is this line
- The debug `console.log`s on the login path go with it —
  `BEs/dev/marketplace-dev-public-authorization/src/graphQLPublic/schema/mutations/login.mts:117` and
  `loginAdmin.mts:120` print the caught error and nothing sensitive **today**, which is the reason to remove
  them before an edit makes that untrue
- `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:46`
  prints a constant; it goes for tidiness, not for safety, and the story says which is which
- ⚠️ **This is not cosmetic while E12-S22 is open**: console output becomes `event.breadcrumbs` on any error
  event from the same request, so a caller-controlled echo is caller-controlled telemetry. E12-S22 landed
  first, so the scrubber now clears `message` and `data.arguments` from every breadcrumb — this story removes
  the supply line rather than relying on that
- **Each removal is asserted as an absence.** A deleted `console` call leaves no mutant and no failing test
  behind it, so nothing would notice it coming back; `loginUser.mts` already had a test shaped this way and
  the other three now match it. The `publicHelloArgs` one asserts on five console methods rather than on
  `debug` alone, since an edit that reaches for `log` instead has changed nothing about why the test exists
- Coverage and mutation stay at 100 in every repo touched
**Traces:** NFR-SE08, NFR-MA01, NFR-CO02; BCON-01
**Evidence (defect):** measured — `docs/report/log-sink-inventory.md` §4.3, the single marker hit across nine
capture files

### E12-S21 — The request body never reaches Sentry   `built 2026-08-11`
**As a** customer, shop owner or admin, **when** a service reports an error, **I want** my request body to
stay out of the report **so that** a password or an encrypted-at-rest personal field is not shipped to a third
party in plaintext.

> ⚠️ **This is live today, on the shipped configuration, and `dataCollection.httpBodies: []` does not stop
> it.** `@sentry/core` 10.69.0 hard-wires `include.data = true` for events
> (`integrations/requestdata.js:27-28`, comment: *"dataCollection.httpBodies gates write-time, not
> read-time"*); the write-time gate is `httpIntegration`'s `maxIncomingRequestBodySize`, default `"medium"`
> (`integrations/http/server-subscription.js:55-57`). `httpBodies` reaches only the
> `http.request.body.data` **span** attribute. A captured event carried a plaintext password in both the
> GraphQL document and `variables`.
>
> ⚠️ **The option is spelled `maxIncomingRequestBodySize` on `@sentry/node`'s `httpIntegration`**, and this
> story's first criterion named it `maxRequestBodySize` until implementation read the wrapper. That is the
> name `httpServerIntegration` — the `@sentry/node-core` integration underneath — reads it as
> (`node-core/build/cjs/integrations/http/index.js:20` forwards one to the other), and passing the inner
> spelling to the outer integration is a **silent no-op**: the options object is not validated, so the
> default `"medium"` stays and nothing fails. Criterion 1 below is corrected; the eslint selector matches the
> outer name for the same reason.

**domains:** backend, testing
**Acceptance criteria:**
- All nine `src/instrument.mts` files pass `httpIntegration({ maxIncomingRequestBodySize: 'none' })`, so the
  body is never captured — a scrubber that deletes it afterwards leaves the bytes in process memory and
  depends on `beforeSend` running, which E12-S22 shows is not guaranteed
- `sentryBeforeSend` deletes `event.request.data` as well, as the second layer, on the same reasoning
  E12-S02 gives for not trusting the SDK's own filtering
- The `no-restricted-syntax` block in `eslint.config.js` refuses any `maxIncomingRequestBodySize` value other
  than `'none'`, the way it already refuses the blanket PII flag — the setting is one word from being reversed
  and nothing else would notice
- A test seeds a body containing a known password, runs a real event through the scrubber, and asserts
  `JSON.stringify(event)` does not contain it — the whole-event check E12-S02 established
- E12-S05's version guard gains this pairing, since it is a defaults question and defaults move on a bump
- Coverage 100/4 and mutation 100 in `marketplace-common` and every service touched
**Traces:** NFR-SE01, NFR-SE02, NFR-SE08, NFR-MA01, NFR-CO01, NFR-CO02; BCON-01, BCON-02
**Evidence (defect):** measured — `docs/report/sentry-event-capture.md` §3, §5, the transmitted envelope;
`BEs/dev/*/src/instrument.mts:63-64`

### E12-S22 — The scrubber runs on every event type and covers every bag that carries data   `built 2026-08-11`
**As a** platform admin, **when** tracing is switched on, **I want** the scrubber to run **so that** turning
on a sample rate is not the same as turning off the redaction.

> Measured: with `tracesSampleRate` set, `event.contexts.trace.data` carried `http.client_ip`,
> `http.user_agent`, `net.peer.ip` and `net.host.ip`, and **all four left the process unchanged** —
> `beforeSend` is not called for transaction events and `beforeSendTransaction` is configured nowhere. The
> keys the scrubber was written around are on the one event type it never sees.
>
> ⚠️ **This is latent on the backend only.** No service sets a sample rate; **all three frontends set
> `tracesSampleRate: 0.1`** (`src/instrument.ts:46`) and none configures `beforeSend` or
> `beforeSendTransaction` — see E12-S24, which owns the frontend half.
>
> ⚠️ **Corrected by E12-S24, 2026-08-11:** the frontend half is latent too, for a different reason.
> `browserTracingIntegration` is not one of `@sentry/browser`'s default integrations, so with none registered
> the three apps ship **no** transaction and the `0.1` is a rate applied to nothing. Both hooks are wired in
> all three apps regardless — the scrubber has to be right before the integration is added, not after.

**domains:** backend, testing
**Acceptance criteria:**
- All nine `src/instrument.mts` files pass `beforeSendTransaction: sentryBeforeSend` alongside `beforeSend`,
  and the `no-restricted-syntax` block refuses a `Sentry.init` that sets one without the other
- `REMOVED_KEYS` gains `http.user_agent`, `net.peer.ip` and `net.host.ip`. All three are set outside the
  `dataCollection` machinery, exactly as `http.client_ip` is, and all three were observed on the wire.
  **Built with five, not three**: `user-agent` and `user_agent` join them, because the list already carries
  both spellings of every other key it holds and removing `http.user_agent` while
  `event.request.headers['user-agent']` keeps the same string removes nothing
- `sentryBeforeSend` walks `event.breadcrumbs[].data` and `event.breadcrumbs[].message`; console output
  becomes a breadcrumb with its arguments verbatim, and E12-S20's caller-controlled echo is one.
  **`message` is deleted on every breadcrumb, not only the `console` ones**: the scrubber cannot tell which
  text was built from a request, and `category`, `level` and `timestamp` survive, so the trail still records
  that the call happened. `data.arguments` is deleted by position rather than by name, since `arguments` is
  removed for where it sits and not for what it is called
- **The fixture is rebuilt from the capture**, not extended by hand: the attribute list in
  `docs/report/sentry-event-capture.md` §6 is a real transaction's `contexts.trace.data`, and it replaces the
  hand-written span-attribute object E12-S02 shipped. The existing error-event tests stay — the capture
  confirms they model the shape that ships today
- E12-S02's story text is amended where §8 of the finding corrects it: the keys live in
  `contexts.trace.data`, not in `event.spans[].data`, and on an error event all three bags are empty
- A test asserts a transaction event with a seeded address comes out of `beforeSendTransaction` without it
- Coverage 100/4 and mutation 100 in `marketplace-common` and every service touched
**Traces:** NFR-SE01, NFR-SE02, NFR-SE08, NFR-MA01, NFR-CO01, NFR-CO02; BCON-01, BCON-02
**Evidence (defect):** measured — `docs/report/sentry-event-capture.md` §6, §7, §8;
`@sentry/node-core/.../httpServerSpansIntegration.js:44,69,70`

⚠️ **One bag it does not walk, established 2026-08-28 outside this story and recorded here because this is the
document that owns the claim: `event.message`.** A `Sentry.captureMessage(text)` call puts its whole string there,
and `sentryBeforeSend` scrubs `event.request`, the span and trace bags and every breadcrumb — not the top-level
message. So a value interpolated into a `captureMessage` string leaves the host verbatim no matter what
`REMOVED_KEYS` holds. It surfaced on E17's key-custody audit line, where `funKeygripRotate` and `funKeygripRetire`
named the acting Admin's `_id`; both now pass `sha256Hex(_id)`, the same value `assertUnderRateLimit` already
used, which stays resolvable by whoever holds the `admin` collection and names nobody to the vendor. **The general
rule is the one worth carrying: a scrubber that walks bags cannot help a string a caller built by hand — the call
site is the only place that can decide.** The digest's own limit is stated rather than glossed: this is
pseudonymisation, not anonymisation, and an id space the size of the `admin` collection is enumerable by
anyone already holding it — the intended reader, not the threat.

### E12-S23 — Sentry's environment matches the deployment   `built 2026-08-11`
**As a** platform admin, **when** I look at a Sentry project, **I want** development events separated from
production ones **so that** a Dev stack does not pollute the record the production alerts are built on.

**domains:** backend, documentation
**Acceptance criteria:**
- `Sentry.init` receives an explicit `environment`, derived from the same value the rest of the process uses;
  a captured event from a development stack reads `"environment": "development"`. **The fallback is
  `'unknown'`, not `'development'`**: an unset `NODE_ENV` on a real deployment would otherwise be labelled the
  one thing it is least likely to be, which is this same defect pointing the other way
- `SETUP.md` §7 records it alongside the three DSN shapes it already documents, since the value belongs to the
  environment file rather than to the code
- One test per service, or one shared test, asserting the option is present — the defect is an **absent**
  option resolving to a plausible default, which is the class of thing a test only catches by naming it
**Traces:** NFR-MA07, NFR-CO01; BCON-04
**Evidence (defect):** measured — `docs/report/sentry-event-capture.md` §3, §8: the captured event reads
`"environment": "production"` from a service that logged *"for development"*

### E12-S24 — What a frontend actually sends is measured, and scrubbed   `built 2026-08-11`
**As a** platform admin, **when** a customer's browser reports to Sentry, **I want** the same evidence and
the same redaction the backend has **so that** the tier handling passwords is not the one tier nobody looked
at.

> The backend half of E12-S22 is latent because no service sets a sample rate. **The frontends are not
> latent**: `marketplace-user`, `marketplace-admin` and `marketplace-shopowner` each set
> `tracesSampleRate: 0.1` at `src/instrument.ts:46` and none configures `beforeSend` or
> `beforeSendTransaction`. `sentryBeforeSend` is a `marketplace-common` export and **no frontend depends on
> that package**, so no scrubber runs on any frontend event of either kind, and one page load in ten already
> ships a transaction wherever a DSN is set.

**domains:** frontend, testing
**Acceptance criteria:**
- One **real captured event** per frontend kind — an error and a transaction — taken the way E12-S13 took the
  backend one: the real SDK, the real transport, a local collector, raw JSON in a finding with credentials
  redacted. **Reading the SDK is not evidence here**: §5 of that finding is the case where the documented
  behaviour of a `dataCollection` category and its actual behaviour differed
- The finding states, from the capture and not from the option list, whether `urlQueryParams: false` and
  `httpBodies: []` hold on the browser transport, and what `event.request`, `event.breadcrumbs` and
  `event.contexts.trace.data` carry. A reset-password route is in the sample, since that URL is the one
  frontend path that can carry a one-time credential
- A scrubber runs on both event types in all three apps. `sentryBeforeSend` is browser-safe by inspection —
  it walks plain event bags — so either it is published for frontend use or the three apps get one
  implementation, **not three**; whichever is chosen is stated with its reason
- Whatever the capture shows in a browser bag that the backend key list does not name is added to the key
  list, and the fixture is built from the capture
- Coverage 100/4 and mutation 100 in every frontend touched
**Traces:** NFR-SE01, NFR-SE02, NFR-SE08, NFR-CO01, NFR-CO02; BCON-01, BCON-02
**Evidence (defect):** `marketplace-user/src/instrument.ts:46`, `marketplace-admin/src/instrument.ts:46`,
`marketplace-shopowner/src/instrument.ts:46` — sample rate set, no `beforeSend`, no dependency on
`marketplace-common`; `docs/report/sentry-event-capture.md` §6.1

> ✅ **Built 2026-08-11.** The capture is `docs/report/sentry-event-capture.md` **§9**, v1.2 of that finding:
> nine envelopes from production builds of `marketplace-user` (3146) and `marketplace-admin` (3147), the real
> `@sentry/react` transport, the same local collector §2 used, both event kinds, and the reset-password route
> in the sample with a sentinel in the query string and a second one in the fragment. Both patched
> `instrument.ts` were restored from backup and both repos verified clean before anything was committed.
>
> **The two acceptance questions, answered from the envelope.** `httpBodies: []` **holds** — the `fetch`
> breadcrumb of a POST whose body carried a password sentinel recorded method, URL and status code and no
> body. `urlQueryParams: false` **does not hold**, and not because it is ignored: it gates
> `event.request.query_string`, a field the browser never fills in, while `httpContextIntegration` copies
> `location.href` unconditionally. The whole address bar — query string **and** fragment — shipped on
> `event.request.url`, on `contexts.trace.data['url.full']`, on the `description` of eight `browser.*` spans,
> on the `Referer` header and on both `from` and `to` of the navigation breadcrumb.
>
> ⚠️ **The navigation breadcrumb outlives the page.** Probe 3 navigated away from the reset URL and then
> errored: the reset URL, token and one-time hash included, was still in `data.from` on that later error and
> on the later transaction. A credential in a URL is not scoped to the event raised on that URL.
>
> ⚠️ **This story's own premise was wrong, and the correction is in the finding.**
> `getDefaultIntegrations()` in `@sentry/browser` 10.69.0 does not include `browserTracingIntegration`, so
> with none registered the three apps ship **no** transaction at all and `tracesSampleRate: 0.1` is a rate
> applied to nothing. "One page load in ten already ships a transaction" was a code-read, and it was wrong.
> The transaction §9 reads was produced by registering the integration in the harness. The transaction half
> is therefore latent-until-integration — which changes when the fix must land, not whether: the scrubber has
> to be right before the integration is added, not after.
>
> **One implementation, in `marketplace-common`.** `sentryBeforeSend` is published for frontend use through
> the `./others/sentryBeforeSend` subpath export it already had, and the three apps declare
> `@axiumine/marketplace-common` and wire it as **both** `beforeSend` and `beforeSendTransaction`. The
> reason, since the criteria ask for one: the three frontends share no package of their own, so "one
> implementation" anywhere else would mean a new package built for one function; the module imports nothing
> and walks plain object bags, so a browser bundle pulls exactly one file and not the Mongoose models beside
> it; and a consumer opts in *by declaration*, so three `package.json` entries plus one published version are
> the whole of the plumbing. Three copies would need correcting three times, and the first correction reaching
> two of them is the leak.
>
> **What the browser adds to the key list.** `url`, `url.full`, `http.url`, `http.target`, `referer` and
> `referrer` are sanitised to their path — truncated at the first `?` **or** `#`, both because a fragment is
> what a reset link carries since E12-S26 and a query string is what one built before it carries.
> `breadcrumbs[].data.from` / `.to` are sanitised at that one site only, since those two words mean a URL on
> a `navigation` breadcrumb and mean anything at all elsewhere. A span `description` is sanitised **only when
> the value starts like a URL**, because it is free text — `first-contentful-paint` on one span and
> `div.flex… > p#password-hint…` in the same event's `lcp.element` are what a value-sniffing scrubber would
> have destroyed. None of the node key list's `http.client_ip`, `net.peer.ip`, `net.host.ip` or
> `http.request.header.*` appeared in any browser envelope; they have no browser equivalent, as §6.1 warned.
>
> **The fixture is the capture.** `test/sentryBeforeSend.test.mts` gains two transcribed events — a browser
> error one navigation past the reset link, and the pageload transaction of the reset page — plus the
> whole-event sentinel assertions on both. 544 tests, coverage 100/4 and mutation 100 in `marketplace-common`
> and in all three frontends.
>
> **Two residuals, stated rather than fixed** (§9.6). The **path** is not redacted: a reset link built before
> E12-S26 carries its credential there, and adding route knowledge to a shared scrubber to cover a shape that
> dies with its own 60-minute window was rejected as the worse trade — no verify-email route exists in any
> frontend, so that is the only path-carried credential there has ever been. And `deviceMemory`,
> `hardwareConcurrency`, `effectiveConnectionType` and `contexts.culture` are **kept**: fingerprinting
> entropy, but not credentials and not the client address, and the entire payload of the performance product
> the transaction exists to feed. `marketplace-shopowner` was not captured — two of three apps were, and
> agreed to the byte.

### E12-S25 — The log retention is stated where a data subject can read it   `built 2026-08-11`
**As a** customer, **when** I want to know what this platform keeps about me, **I want** the log retention
written down **so that** a decision taken in an epic is also a promise made in public.

> Owner decision, 2026-08-11 — the fourth clause of the retention answer quoted in full on E12-S19:
> *"write two lines in your privacy policy."* ⚠️ **No privacy policy exists
> in any of the sixteen repos** — `grep -ri "privacy policy"` returns nothing across `docs/` and the three
> frontends. This story therefore writes the first one, at the smallest size that carries the two lines
> honestly. It does not attempt a complete GDPR notice: `phase1/NFR.md` open question 1 — whether the
> framework is formally in scope — is still open, and inventing a compliance document the owner has not asked
> for is the scope-fabrication this protocol forbids.

**domains:** frontend, documentation
**Acceptance criteria:**
- Two lines, in English, saying what the two log kinds hold and for how long: the web server records the
  address a request came from and keeps it **14 days**; the access log records the URL requested and keeps it
  the same period. Both state that the files are **shredded**, not merely deleted
- The text matches what E12-S19 actually configures. If the two ever disagree the configuration is right and
  the page is a false statement, so the story lands **after** E12-S19 or in the same piece of work, never
  before it
- The page lives in `marketplace-user` — the only public, indexed, anonymous-reachable surface — as an SSR
  route, reachable from the footer of every page, `noindex` **not** set. The two panels are behind a login
  and are the wrong place for a notice a data subject must be able to read without one
- It states nothing the platform has not decided. No lawful basis, no retention period for anything other
  than logs, no data-subject-access flow — none of those has a decision behind it (`RISK_REGISTER` R25),
  and a privacy page that describes a process nobody operates is worse than no page
- The route carries the repo's own gates: snapshot, 100/4 coverage, mutation 100
**Traces:** NFR-CO02, NFR-MA07; BCON-04
**Evidence (owner decision):** the platform owner's retention answer of 2026-08-11, quoted in full on E12-S19;
retention configured by E12-S19

> ✅ **Built 2026-08-11.** `/privacy` in `marketplace-user` — `src/routeOptions/privacy.tsx` with the repo's
> one-line route file, SSR like every other public page, `noIndex` **not** set and not disallowed in
> `robots.txt`. One `<Link to="/privacy">` in `src/components/layout/Footer.tsx`, which is the only element
> the root route renders on every page, so "reachable from every page" is a property of the layout rather
> than a list to keep up to date. Eleven assertions plus a snapshot; 100/4 coverage and mutation 100 held.
>
> **The two lines say which file holds what**, because "we log your address for 14 days" would have been true
> of neither file on its own: the **error** log holds the network address a request came from, the **access**
> log holds the URL and no address at all (E12-S07 took it out and E12-S12 measured that it stayed out), and
> both are kept 14 days and shredded on removal. The assertions are byte-for-byte quotations rather than
> `toMatch(/14 days/)` — the only defect this page can have is drifting from `logrotate.d/nginx`, and a
> loose assertion is exactly the one that would not notice.
>
> ⚠️ **"14 days" alone would have been a promise the configuration slightly overruns.** `daily` + `rotate 14`
> keeps fourteen closed files beside the one being written, so an entry written moments after a rotation is
> destroyed on the **fifteenth** day, not the fourteenth. The page states the mechanism in one sentence and
> the bound with it. This is the story's own correction: the criteria say 14 days, the configuration says 14
> rotations, and those are not the same number of days.
>
> ⚠️ **What it does not say is as deliberate as what it does.** No lawful basis, no controller identity, no
> retention for anything but these two files, no access or erasure flow — `RISK_REGISTER` R25 and
> `phase1/NFR.md` open question 1 are still open, and a notice describing a procedure nobody operates is a
> worse artefact than a short one describing a real one. The page says the rest will be added when it is
> decided, which is a statement about this platform and not a template's placeholder.

### E12-S26 — The customer's reset credential leaves the URL   `built 2026-08-11`
**As a** customer, **when** the platform mails me a password-reset link, **I want** the one-time hash and my
address to stay inside my own browser **so that** no log, cache or intermediary on the way — including ones
this platform does not operate — ever receives them.

> **This is E12-S16's residual, taken seriously.** That story stopped the edge from *recording* the
> credential; it does not stop it from *arriving*. The link is still a `GET` with `:email/:hash` in the path,
> so Cloudflare's own logs, any corporate middlebox and the SSR disk cache still see the live value. The only
> mechanism that reaches those is the one the platform did not pick then: take the token out of the path.
> Scoped 2026-08-11 on the owner's question *"can we, as residual stated not closed, take the token out of the
> path?"* — the answer is **yes for the customer reset flow and only for that one**, and the rest of this
> story is why.

> ⚠️ **Scoping found the leak is wider than the URL.** `/reset-password/$email/$hash` is server-rendered — no
> route outside `/account/*` sets `ssr: false` — and TanStack Router dehydrates **every rendered match** into
> an inline `<script>`, keyed by a match id built from the *interpolated* path. Read at source, that puts the
> address and the live hash in the **HTML body**, not only in the URL: `@tanstack/router-core`
> `router.js:715-721`, `ssr/ssr-match-id.js:2-4`, `ssr/ssr-server.js:18-32,295-297,346-352`, injected by
> `<Scripts/>` (`marketplace-user/src/routeOptions/root.tsx:34`). That body is what `location /` stores on
> disk. **Source-level, not measured** — criterion 1 measures it before anything is changed.

**domains:** backend, frontend, infra, testing, documentation
**Acceptance criteria:**
- **Measure before changing.** `curl` the running apex at `/reset-password/<encoded-address>/<hash>` and grep
  the returned HTML for both values. The story records the measured answer either way: if the dehydration
  script carries them, this is a second sink and the cache criterion below covers a body as well as a key; if
  it does not, the criterion shrinks to the key and the story says so. E12-S13's lesson is the reason this is
  criterion 1 — an option's documented behaviour and its real behaviour differed there
- **The mailed link becomes a fragment URL**, and `@axiumine/koa-utils` does not change to allow it.
  `RESET_PATH_USER` (`marketplace-dev-public-resource/src/lib/access/resetPwdFlowUser.mts:38`) gains a
  trailing `#`: the builder normalises only `linkPath`'s **leading** slash and `encodeURI` never escapes `#`
  (`koa-utils/dist/email/SocketLabsLib.mjs:280-283`), so `` `${base}${path}/${encodeURI(email)}/${hash}` ``
  yields `https://host/<path>#/<address>/<hash>`. A fragment is never transmitted (RFC 3986 §3.5), so the
  credential stops existing in any request line, any `Referer` and any cache key
- ⚠️ **The static path is not `/reset-password`** — that URL is already the *other* half of this flow, the
  ask-for-your-address screen (`marketplace-user/src/routes/reset-password.index.tsx`). Since the server never
  sees the fragment, every reset click would land on it and render the wrong page. The confirm screen takes a
  path of its own
- `marketplace-user` reads the credential from `location.hash`: `src/routes/reset-password.$email.$hash.tsx`
  is replaced by a static route, `src/routeTree.gen.ts` is regenerated **and committed**, and
  `src/routeOptions/resetPasswordConfirm.tsx` stops calling `route.useParams()`. ⚠️ **No precedent exists** —
  nothing under `src/` reads `window.location` today — so the parser is new code with its own tests, and both
  its failure branches (no fragment, malformed fragment) render the same invalid-link state an expired hash
  renders. 100/4 coverage and mutation 100 are the gates (`vitest.config.ts:121-125`, `stryker.config.mjs:30`)
- **The confirm route is `ssr: false`.** With the credential in the fragment the server cannot see it, so
  there is nothing to dehydrate — the flag makes that a property of the route instead of a consequence of the
  URL shape, and it is what stops the next param added to this route from reopening the finding above
- **The edge stops storing credential-bearing paths regardless**, because the fragment does not cover
  everything: links already in mailboxes keep the old shape until the last one expires,
  `/check/verify-email*` and `/x/reset/` keep it permanently, and a future param route would silently
  reinstate it. A second variable joins the existing pair at
  `marketplace-nginx/sites-available/marketplace-domain.com.conf:301-302` — both directives take **multiple**
  variables and any non-empty non-`0` one wins, so no `location` block is duplicated and the session-cookie
  bypass is untouched. The suite asserts `X-Cache-Status: BYPASS`; the header already ships (`:318`) and the
  pattern is `test/suite.sh:395-405`
- **The SSR origin stops inviting shared caches to do the same.** `marketplace-user/src/server.ts:78` marks
  every anonymous 200 `public, s-maxage=60, stale-while-revalidate=600`; the reset paths are excluded and sent
  the `private, no-store` the file already defines at `:45`. nginx protects this platform's disk, the header
  protects Cloudflare's
- **E12-S16's two maps stay, and the story says why rather than leaving it to be re-derived**: three of the
  four shapes still carry `:email/:hash` in the path after this change, and the fourth carries it in every
  mail already sent
- `marketplace-user/CLAUDE.md`'s routing table is corrected in the same change. It lists `/login`, `/register`
  and `/reset-password*` as `ssr: false`; measured, the only `ssr: false` in the repo is
  `src/routeOptions/account.tsx:59`, and `src/routeOptions/login.tsx:9-16` documents `/login` as
  server-rendered. This story adds the first genuine `ssr: false` outside the account area, so it is the one
  that must not leave a stale table behind it
- **Residual, stated not closed:** the fragment is still in the browser's history entry and the whole link is
  still in the mail client's copy, forever. Nothing on the platform's side reaches either. What this story
  removes is every *server-side* holder — the edge, the disk cache, Cloudflare, any middlebox

**Out of scope, each for a measured reason:**
- **The two `/check/verify-email*` flows.** They are Koa REST `GET`s
  (`marketplace-dev-public-resource/src/middleware/router/index.mts:16,25`), so a fragment never reaches the
  server at all — moving them means a new frontend page plus a new mutation, on two surfaces. And the hash is
  consumed by the very request that writes the log line, so it is spent by the time anything stores it. E12-S16's
  redaction is the proportionate control there; only the reset hash has a live window (60 minutes,
  `koa-utils/dist/graphQL/schema/mutations/updatePassword.mjs:46-48`, burned at submit, not at page open)
- **`/x/reset/:email/:hash`, the ShopOwner reset link.** ⚠️ It routes nowhere today: no nginx `location`
  matches it, so it falls to the panel's SPA fallback
  (`sites-available/shopowner.marketplace-domain.com.conf:224-231`), and `marketplace-shopowner/src/router.tsx:52-101`
  declares `/`, `/loading`, `/home` and `/companies` with no not-found component. The panel has **no reset
  screen at all**, so there is no page to move a credential into. That is an unbuilt frontend, not a telemetry
  defect, and it belongs to whoever builds the screen — recorded here so it is not lost, fixed here by nothing
**Traces:** NFR-SE01, NFR-SE08, NFR-CO01, NFR-CO02; BCON-01, BCON-04
**Evidence (residual):** E12-S16 above, and `docs/report/log-sink-inventory.md` §10 — the credential in the
URL, and the SSR cache key that is the whole link
(`marketplace-nginx/sites-available/marketplace-domain.com.conf:296`, `conf.d/30-cache.conf:8-13`, `inactive=24h`)

**Built first — the cache criterion, 2026-08-11**, on the owner's instruction to fix that half first. It is
the one part of this story that needs no frontend, no mail change and no koa-utils change, and it is the part
that still matters after the fragment lands, since links already sent keep the old shape and three of the
four flows keep it permanently.

- `marketplace-nginx/conf.d/30-cache.conf` gains `map $request_uri $mkt_credential_uri`, matching the same
  four prefixes the logging maps redact. Duplicated rather than shared: the redaction map needs a named
  capture to rebuild the flow name, this one needs a yes
- `sites-available/marketplace-domain.com.conf` passes it as the **second** variable on the existing
  `proxy_cache_bypass` / `proxy_no_cache` pair. Both directives take a list and any non-empty non-`0` value
  wins, so no `location` block is duplicated and the session-cookie bypass is untouched
- ⚠️ **Measured, and it settles that this was live rather than theoretical:** with the change reverted, the
  *second* request to `/reset-password/<address>/<hash>` answers `X-Cache-Status: HIT`. The credential URL
  was genuinely being stored as a cache key, and served back from it
- Five assertions in `test/suite.sh`: BYPASS on the first visit and on the second, the decoded `@` form,
  and — the other direction — an ordinary page still going MISS → HIT, because a bypass keyed on the URL is
  one greedy regex away from turning the cache off in production with every other assertion still green. A
  sixth is static: both `05-logging.conf` and `30-cache.conf` must still carry the same four prefixes, so a
  fifth mailed link added to one cannot be redacted in the log while sitting on disk in full
- `./test/run.sh` green. Mutation-checked twice — drop the variable and three assertions fail; shorten the
  prefix list and the drift assertion fails

**Built — the rest, 2026-08-11.** Two repos, one behaviour: the credential is no longer part of any URL a
server can read.

- ⚠️ **Criterion 1, measured on the production build, and it was worse than the story assumed.** Before:
  `curl` of `/reset-password/<encoded-address>/<hash>` answered `200`, 5878 bytes, carrying **both** values
  in the router's dehydration script — `$R[10]={i:" reset-password $email $hash reset-password
  probe%40example.invalid MKTS26HASHPROBE",…}` — under
  `cache-control: public, s-maxage=60, stale-while-revalidate=600` and `vary: cookie`. The source reading
  was right, and the header beside it was the part nobody had looked at: the origin was inviting every
  shared cache in the path to keep a live one-time credential for ten minutes. After: `/reset-password/confirm`
  answers `200`, 4505 bytes, `cache-control: private, no-store`, its match id reads
  `" reset-password confirm reset-password confirm"`, and both probe values appear **zero** times in the body
  — in encoded and decoded form. The whole emailed URL, fragment included, produces the byte-identical
  answer, which is what "never transmitted" looks like from the server's side. The old shape now answers
  `404`, also `private, no-store`, and its body does not echo the path it refused
- **The mail.** `resetPwdFlowUser.mts`'s `RESET_PATH_USER` is `'/reset-password/confirm#'`. The trailing `#`
  is load-bearing punctuation and the comment above it says so, quoting the four lines of
  `SocketLabsLib.mjs` that make it work and what removing it does — both restore the leak *and* 404, since
  the route it would then point at no longer exists
- **The route.** `src/routes/reset-password.$email.$hash.tsx` is deleted and
  `src/routes/reset-password.confirm.tsx` replaces it; `src/routeTree.gen.ts` is regenerated and committed.
  `src/routeOptions/resetPasswordConfirm.tsx` no longer calls `useParams` — there are no params — and its
  `head` names the static path, so the canonical it emits is a URL and not a credential
- **The parser**, `src/features/auth/resetLink.ts` — 24 lines of code under more comment than code, and the
  only place in `src/` that reads `window`.
  ⚠️ It reads `window.location.hash` and **not** the router's `location.hash`: `router-core`'s
  `router.js:195,211` percent-decodes and sanitises its copy through `decodePath` before anything here
  could split it, so an address containing an escaped `/` would arrive as a different pair. The address is
  decoded, the hash is taken verbatim, and both failure branches — no fragment, malformed fragment — return
  `undefined`, which the route renders as the same invalid-link state a refused hash renders
- **`ssr: false` on the confirm route**, the first outside `/account/*`. The server cannot see a fragment, so
  there is nothing to render and nothing to dehydrate; the flag makes that a property of the route rather
  than a consequence of today's URL shape, which is what stops a param added here later from silently
  reopening the finding
- **The origin's `no-store`**, and ⚠️ **not in `src/server.ts`.** That file is excluded from coverage and
  from mutation as a framework entry point, which is a fair argument about `createStartHandler` and a bad
  one about a rule deciding whether one visitor's page may be handed to the next. The decision moved into
  `src/lib/cachePolicy.ts` as a pure function of a request and a response — `private, no-store` for the
  whole `/reset-password` prefix and for anyone carrying a session cookie, the existing
  `public, s-maxage=60, stale-while-revalidate=600` for anonymous 200 HTML, nothing at all for a 404, a 500
  or a non-HTML answer — and is gated like every other line in the repo. `server.ts` is now the wrapper the
  exclusion always claimed it was
- **The invalid-link state is one component**, `src/features/auth/ResetLinkInvalid.tsx`, shared by the
  parser's failure branches and by a hash the server refuses. ⚠️ It deliberately contains **no**
  `FormStatus`: a live region has to be mounted before the message it announces appears, so each caller
  keeps its own and this component is only the sentence and the way out
- `marketplace-user/CLAUDE.md`'s routing table is corrected in the same commit, and the ⚠️ under it now
  names the three mechanisms this scheme rests on — the parser reading `window.location.hash`, `ssr: false`,
  and `cachePolicy.ts` covering the prefix — because any one of them removed leaves the other two looking
  fine
- ⚠️ **Links already in mailboxes keep the old shape for up to 60 minutes** — koa-utils' hash lifetime — and
  land on the 404 page. Keeping `/reset-password/$email/$hash` alive as a redirect was considered and
  rejected: it would have kept the credential in the request line, in the access log's `Referer` field and
  in the dehydrated body for exactly as long as it stayed
- ⚠️ **E12-S16's redaction now also covers the confirm page itself**, since `^/+reset-password/.` matches
  `/reset-password/confirm`: the access log reads `/reset-password/[redacted]` and cannot distinguish a
  confirm-page visit from an old-shape one. Accepted rather than fixed — narrowing the map to exclude one
  static path is how the next mailed URL added under this prefix ends up logged in full
- **Gates.** `marketplace-dev-public-resource`: lint clean, 398 tests, 100/4, mutation 100.
  `marketplace-user`: `tsc --noEmit` clean, 71 files / 1275 tests, 100/4 (1112 statements, 486 branches,
  289 functions, 981 lines). Three new test files and two extended ones, including the
  end-to-end assertion that the pair read out of `location.hash` reaches the mutation variables intact.
  ⚠️ **Corrected 2026-08-11 — mutation was not run here, and was not 100.** The first frontend Stryker run
  after this story, under E12-S24, came back **99.86** with three survivors in `src/lib/cachePolicy.ts`:
  `ANONYMOUS_CACHE` and `PRIVATE_CACHE` both mutate to `""` with every assertion still passing, because the
  suite only ever compared them against themselves, and `isCacheableHtml`'s `?? ''` default was an
  equivalent mutant — no replacement Stryker can write there starts with `text/html` either. Both are fixed
  in the E12-S24 branch: the two headers are asserted once as literal bytes, and the default is now
  `?.startsWith(…) ?? false`, which a headerless response tells apart. `marketplace-user` is back at 100
  (2162 mutants, 0 survived, 7 timed out)

## 5. Dependencies

- **Depends on nothing — which is why it is numbered first.** Every story here is independent of E13–E17, and
  E12-S01 in particular is severe, near-free and landable today. Nothing in the rest of the backlog has to wait
  for it, and it has to wait for nothing.
- **Only E18 depends on it**, and loosely: E18's regression suite wants the scrubber in place before it asserts
  telemetry behaviour.
- **One thread runs the other way, and it is deliberate:** E12-S11 introduces `sha256Hex` in
  `marketplace-common`, and E13-S01's `hashSessionToken` is a named wrapper over it rather than a second
  digest helper. E12 lands first, so E13 inherits the primitive; if the order is ever reversed, E13-S01 writes
  it and E12-S11 imports it. What must not happen is two implementations, since a hashing helper is exactly
  the kind of thing that gets copied and then diverges on encoding.
- **Landing order** (BCON-05, BCON-07):
  1. All nine services — E12-S01, one commit per service, no shared code needed.
  2. `marketplace-common` — the scrubber and its tests (it is used by more than one service). Commit,
     **publish the release**, move each consumer's range.
  3. `marketplace-dev-admin-authenticated-resource` and any other service keeping the flag — wire `beforeSend`.
  4. The lint rule (E12-S04), then all nine services re-linted.
  5. `marketplace-nginx` — E12-S07, one commit: the `log_format`, the three `access_log` lines, the test
     container assertion. It depends on nothing above and could equally land first.
  6. `marketplace-nginx` again — E12-S09, `set_real_ip_from` and the retuned zones. **Never before step 5**;
     it is what makes `$remote_addr` a client address. **No longer blocked** — Full (strict) settles the
     trusted set as Cloudflare's published ranges, and E12-S15 is a different control entirely.
  7. E12-S08, E12-S10 and E12-S11 together, in this order and no other: `marketplace-common` (drop the
     Turnstile parameter, drop `perIpPerHour`, add `sha256Hex` and hash the identity, replace the tests all
     three canonise), **published as a release**, then `marketplace-dev-public-authorization` and
     `marketplace-dev-public-resource`. Landing a consumer first breaks its build against the published
     signature. The three are one pass because they touch the same two `marketplace-common` modules and the
     same two guards; splitting them means three release cycles for one file. E12-S10 should not
     precede step 6 either — deleting the Redis bucket before the edge zones work leaves a window with no
     per-address limit anywhere.
  8. `marketplace-nginx` a third time — E12-S15, Authenticated Origin Pulls. **The Cloudflare side is
     enabled before this commit is deployed, not after**, and the intermediate `ssl_verify_client optional`
     step is a deploy of its own; landing the final state in one move is what turns a misconfiguration into
     an outage. Independent of steps 5-7 in content, last in order because it is the only one that can take
     all three vhosts down.
  9. `docs/` — E12-S14, E12-S05's risk row, E12-S15's `RISK_REGISTER` row for the certificate expiry.
  10. Parent workspace — one commit bumping every touched submodule pointer (ADR-031).
  E12-S12 and E12-S13 are investigations and run alongside, gating nothing but their own follow-ups.

## 6. Open questions

**None open.** Every decision this epic made is carried by the story that implements it, with its reasoning —
this section holds only what is still undecided.

Two questions lived here until 2026-08-11. E12-S12's fourth acceptance criterion put them here rather than in
a fix, because neither was this epic's to decide: they were a disclosure question and a retention question,
both the platform owner's. Both came back decided the same day, and each answer now sits on the story that
carries it out, quoted verbatim there rather than summarised here:

| Was | Decided | Carried by |
|---|---|---|
| The nginx **error** logs record a full client address at the shipped `warn`, with no retention pinned by any repo — may they, and for how long? | Kept as they are; lifetime is the control — rotate at 14–30 days, `shred` on removal; two lines of a privacy policy say so | **E12-S19**, `built 2026-08-11` (the quote in full, why it takes 14, and the `logrotate.d/nginx` that carries it) · **E12-S25**, `built 2026-08-11` (the notice at `/privacy`, quoting the same period back) |
| The nginx **access** logs record an account email address and a live one-time hash in `"$request"` — by what mechanism does that stop? | Rewrite the logged path to a redacted `$request` rather than switch the log off | **E12-S16**, `built 2026-08-11` — at http level, because four link shapes carry the credential and only two have a `location` block |

The residual E12-S16 left — the credential still travelling in the URL, where Cloudflare and the browser
history keep it — is not an open question either. The owner asked the same day whether it could be closed
instead of accepted, and it is **E12-S26**, `built 2026-08-11`: for the customer reset flow the credential
now travels in the URL **fragment**, which no browser transmits, so it reaches no request line at all. The
other three mailed links still carry it in the path and are redacted rather than moved, each for a reason
the story measures.

⚠️ **One thing narrowed here was still open on 2026-08-11, and it was not this epic's to close.** `phase1/NFR.md` open
question 1 — whether GDPR or another framework is formally in scope (NFR-CO02, `RISK_REGISTER` R25) — stayed
open through both answers above. A retention decision about two log files is not an applicability decision
about the platform, and reading it as one is the mistake this line exists to prevent.

> **Closed 2026-08-26, elsewhere.** The platform owner decided GDPR is in scope, on evidence this epic never
> touched: `company` requires Italian registration identifiers, so the platform is EU-established and
> EU-targeting under Art. 3 (`phase1/NFR.md` §2.7). The paragraph above is left standing because it was true
> when written and the reasoning in it still is — the log decisions did not close the question, a separate
> decision fifteen days later did. What this epic built is unaffected, and none of it becomes a compliance
> claim: the six unimplemented obligations are `phase1/NFR.md` open question 6.

## 7. Implementation status — 2026-08-11

**All twenty-six stories are `built`, and nothing here is waiting on this workspace.** E12-S15 was the last row that read as outstanding; its repo half is complete and gated, and its zone half is an adopter deployment step, reclassified 2026-08-27 (see its row below). The two investigations ran on 2026-08-11 and closed; **they
found eight defects, E12-S16 … E12-S23, and all eight are now fixed** — E12-S16 first, once the
owner chose the mechanism, then E12-S21, E12-S22 and E12-S23 together, because they are one edit to the same
`Sentry.init` call in the same nine files, then E12-S20, then E12-S17 and E12-S18 together, because both
live in `marketplace-docker-DBs/docker-compose.yml`, and E12-S19 last, at the edge. **The 🔴 is closed**: no service with
a `DSN` set ships a request body any more. **Nothing from either investigation is open.** The last three
were not opened by an investigation either, and all three landed the day they were written: E12-S25 hours
after the configuration it describes, E12-S26 once the fragment link, the static route and the parser were
built on top of the cache half, and E12-S24 once a browser event had actually been captured — which is what
turned its own premise, and a claim in the E12-S13 finding, from a code-read into a measurement.
⚠️ **Fixing E12-S17, E12-S18 and E12-S19 corrected or extended the evidence line of each**, which is the
pattern this epic keeps producing: a measurement taken to close a story is also a re-measurement of the
story — E12-S19's version being that its central directive, `shred`, fails open on a busybox host and says
so only in cron mail. A ninth,
**E12-S24**, came out of checking E12-S22's "latent because no sample
rate is set" claim against the frontends, where a sample rate has been set all along. A tenth,
**E12-S25**, is not a defect at all: it is the second half of the owner's retention answer — the half that has to
be said in public rather than configured. An eleventh, **E12-S26**, comes from the owner reading E12-S16's
residual and asking whether it can be closed rather than accepting it.

| Story | State | What is actually true |
|---|---|---|
| E12-S01 … E12-S11, E12-S14 | `built` | Landed across the nine services, `marketplace-common` and `marketplace-nginx`, each behind that repo's own lint, 100/4 coverage, mutation and Qodana gates |
| E12-S12 | `built` | Measured against the running Dev stack; finding at [`docs/report/log-sink-inventory.md`](../../report/log-sink-inventory.md) v1.0. The nine application logs are clean on every planted marker, including the poisoned-credential failure paths. Four sinks are not: the access log carries the mailed one-time hash and the address, the Redis password is in the container argv, no Docker log driver is bounded, and the error log carries a full client address at `warn`. Yeses → E12-S16 … E12-S20; the two disclosure questions → the platform owner, both answered the same day (E12-S19, E12-S16) |
| E12-S13 | `built` | One real event, built and transmitted by the real transport into a local collector; finding at [`docs/report/sentry-event-capture.md`](../../report/sentry-event-capture.md) v1.0. No header sentinel reached the wire — but the scrubber is not why, and E12-S02's three bags were empty on the event that shipped. 🔴 `event.request.data` carried the raw GraphQL body with a plaintext password; transactions bypass `beforeSend` and ship `http.client_ip` unredacted. E12-S02's key list and fixture are corrected in §8 there → E12-S21 … E12-S23 |
| E12-S15 | `built` — **the remaining half is an adopter deployment step, not open work** | `snippets/origin-pull.conf` declares `ssl_client_certificate` and `ssl_verify_client on` once and is included by all four 443 server blocks, with the container suite asserting the count and that the default block is untouched. **Every acceptance criterion this story wrote is met and gated**, R44 included. What is left is not a task on this backlog: Authenticated Origin Pulls must be switched on in Cloudflare and the zone CA placed at the path the snippet names under `/etc/nginx/certs/`, **by whoever deploys this blueprint** — there is no zone here to switch it on in and no host to place a file on. This platform is a blueprint published for the community ([`ADR-037`](../phase3/adr/ADR-037-marketplace-common-is-published-to-npm.md)), so the admin role this half needs **does not exist in this checkout** — the same reading that closed six questions in [`EPICS_STORIES.md`](./EPICS_STORIES.md) §6.1, where the tell was the owner cell. ⚠️ **Order matters and is not editorial:** nginx verifying first means every handshake fails from the reload, so the Cloudflare side goes on before this config is deployed — step 1 of `marketplace-nginx/README.md` §Authenticated Origin Pulls, and the trigger `RISK_REGISTER` R44 fires on. ⚠️ **Reclassifying it closes nothing and lowers no score.** R44 keeps 3×5=15 🟠 High and R46 keeps 🟠 High: [`ADR-032`](../phase3/adr/ADR-032-production-topology-owed.md) rules that no control may be argued closed by appeal to a network boundary, and "no host exists" is an absence of exposure, not a mitigation — the same trap, reached from the other side |
| E12-S16 | `built` | Landed in `marketplace-nginx` the day it was opened, once the owner picked the mechanism. Two `map` blocks in `conf.d/05-logging.conf` at http level, the request line rebuilt from parsed values, seven new assertions in the container suite, `./test/run.sh` green and mutation-checked. **Residual, stated rather than closed here and now owned by E12-S26:** the credential still travels in the URL, so Cloudflare's logs, the browser history and the mail client keep it. **Adjacent, same owner:** the apex caches the SSR reset page under `proxy_cache_key "$scheme$request_method$host$request_uri"`, writing the whole link to `/var/cache/nginx/marketplace-user/` for up to `inactive=24h` |
| E12-S26 | `built` | Opened 2026-08-11, by the owner asking whether E12-S16's residual can be closed rather than by a finding, and closed the same day across three repos. **The edge half first**: `$mkt_credential_uri` joins the session-cookie variable on `proxy_cache_bypass` / `proxy_no_cache`, so a mailed `:email/:hash` URL never becomes a cache key. Reverting it makes the second request to a reset link answer `HIT` — it was being stored, not theoretically storable. **Then the link itself**: `RESET_PATH_USER` gains a trailing `#`, so the mail points at `/reset-password/confirm#/<address>/<hash>` and the credential exists only in the browser (RFC 3986 §3.5) — no koa-utils change needed, since it normalises only `linkPath`'s leading slash and `encodeURI` never escapes `#`. `marketplace-user` reads it from `window.location.hash` through a small parser, on a static route that is `ssr: false` — the first outside `/account/*` — and the origin now answers the whole `/reset-password` prefix `private, no-store` from `src/lib/cachePolicy.ts`, moved out of the coverage-excluded `server.ts` on purpose. **Measured before and after on a production build:** the address and live hash were in the dehydration script under `public, s-maxage=60`, and are now absent from a body served `private, no-store`. **No for the two `/check/verify-email*` flows** — Koa REST `GET`s a fragment never reaches, whose hash is spent by the request that logs it. ⚠️ **Residuals, stated not closed:** links already sent keep the old shape for up to 60 minutes and now 404; the fragment stays in the browser history and the mail client forever; and `/x/reset/`, the ShopOwner reset link, **routes nowhere at all** — the panel has no reset screen, so there is no page to move a credential into |
| E12-S17, E12-S18 | `built` | Landed together on 2026-08-11 in `marketplace-docker-DBs`, the one place both defects lived. The Redis password moved out of `command:` into a generated `secrets/redis.conf` mounted read-only, and one `x-logging` anchor caps all four containers at 20 MiB × 5. Both were **re-measured after the change and again before it**, which corrected each story's own evidence: host `ps aux` never showed the password (Redis rewrites its `argv` at startup), so the before-state was two surfaces and not three; and `mdb1` had grown from 380,144 lines to 458,129 — 229 MiB in 52.6 hours — which is the rate that sized the pair. The workspace secret guard gained a `secrets/` path rule and a `requirepass` value rule, because neither existing rule would have caught a file with no `KEY=` shape and no extension |
| E12-S19 | `built` | Landed 2026-08-11 in `marketplace-nginx`, the last of the eight. `logrotate.d/nginx` — daily, `rotate 14`, `shred`, `su root adm`, `USR1` under `sharedscripts` — over a glob covering all eight destinations, nginx's own `error.log` included. Fourteen assertions, three of them behavioural: sixteen forced rotations that read back both `shred` removals out of logrotate's output, mutation-checked by dropping `shred` and halving the count. **Two things the story could not have known, both measured:** logrotate shreds through `shred … -` on the open descriptor, which busybox cannot open, so on an Alpine host the clause silently degrades to `unlink` and still exits 0 — the suite installs `coreutils` and asserts the runs are clean; and two files in `/etc/logrotate.d` matching one glob make logrotate skip the whole later-named file, so this installs **over** the packaged `nginx` rather than beside it. The error log keeps `warn` and keeps the address: lifetime is the control, and E12-S25 is what states it in public |
| E12-S20 | `built` | Four `console` calls gone from three services on 2026-08-11: the caller-supplied argument in `publicHelloArgs`, the two login catch prints, the constant in the admin resource handler. **The absence is asserted in each place** — a deleted print leaves no mutant behind it, so nothing else would notice it returning. `loginUser.mts` was already shaped this way and is now the pattern rather than the exception |
| E12-S21, E12-S22, E12-S23 | `built` | Landed together on 2026-08-11, in `marketplace-common` and all nine services, behind each repo's lint, 100/4 coverage, mutation and Qodana gates. The 🔴 is closed: `maxIncomingRequestBodySize: 'none'` stops the body being captured and the scrubber deletes `request.data` as a second layer. **Implementing E12-S21 found its own first criterion wrong** — the option is `maxIncomingRequestBodySize` on `httpIntegration`, not `maxRequestBodySize`, and the inner spelling is a silent no-op on the outer integration; the story text is corrected in place and the eslint selector matches the name that is really read. Two widenings beyond what was written, both recorded on the stories: `user-agent` and `user_agent` join the removal list, and `breadcrumb.message` is deleted on every breadcrumb rather than on `console` ones alone. **`beforeSendTransaction` is wired but unexercised in production terms** — no backend service sets a `tracesSampleRate`, so the transaction path is proved by tests and by the capture, not by a live event; the frontends were assumed to be the live case and, measured under E12-S24, are not — they register no browser-tracing integration, so they ship no transaction either |
| E12-S24 | `built` | Opened 2026-08-11 after §6.1 of the capture, closed the same day across four repos. **Nine envelopes captured** from production builds of `marketplace-user` and `marketplace-admin` through the real `@sentry/react` transport into the §2 collector, both event kinds, a reset-password URL carrying a sentinel in the query string and another in the fragment; finding at [`docs/report/sentry-event-capture.md`](../../report/sentry-event-capture.md) §9, v1.2. `httpBodies: []` **holds**; `urlQueryParams: false` **does not** — it gates `event.request.query_string`, which the browser never fills in, while `httpContextIntegration` copies `location.href` whole onto `event.request.url`, `contexts.trace.data['url.full']`, eight span descriptions, `Referer` and both halves of the navigation breadcrumb, **which carries the reset URL onto every later event of the session**. **The story's premise was wrong and the finding says so**: `browserTracingIntegration` is not a default integration, so the apps ship no transaction at all and `0.1` is a rate applied to nothing — the transaction half is latent-until-integration, not live. `sentryBeforeSend` is published through the subpath export it already had and wired as **both** hooks in all three apps: one implementation, not three, because the frontends share no package of their own, the module imports nothing, and a consumer opts in by declaring the dependency on a published version. Every URL-valued key is truncated at the first `?` or `#`; a span `description` only when the value starts like a URL, since `lcp.element` in the same event is `p#password-hint`. Fixture built from the capture; 100/4 and mutation 100 in `marketplace-common` and all three frontends. **The frontend mutation gate had not been run since E12-S26 and was not green**: `marketplace-user` came back 99.86 with three survivors in `src/lib/cachePolicy.ts` — two constants the suite only ever compared against themselves, and an `?? ''` default no mutant can be distinguished from — all three fixed in this branch, and E12-S26's gate line corrected in §4. ⚠️ **Residuals, stated not closed:** the path is not redacted, so a link built before E12-S26 keeps its credential for its 60-minute window; `deviceMemory`, `hardwareConcurrency`, `effectiveConnectionType` and `contexts.culture` are kept on purpose — entropy, but not credentials and the whole payload of the product the transaction feeds; `marketplace-shopowner` was not captured, though the two that were agreed to the byte |
| E12-S25 | `built` | Landed 2026-08-11 in `marketplace-user`, hours after the configuration it describes. `/privacy` — SSR, indexable, one `<Link>` in the footer the root route renders on every page. The platform's **first** privacy notice: which log holds the address, which holds the URL and no address, 14 days for both, `shred` on removal, and nothing else — no lawful basis, no other retention, no access flow, because none of those has a decision behind it. Eleven assertions plus a snapshot, all of them quotations rather than `toMatch(/14 days/)`, since drifting from `logrotate.d/nginx` is the only defect this page can have. **The story's own correction:** `daily` + `rotate 14` keeps fourteen closed files beside the open one, so an entry can live fifteen days, and "14 days" alone would have been a promise the configuration overruns — the page states the mechanism and the bound |
