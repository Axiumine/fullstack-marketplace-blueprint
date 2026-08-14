# ADR Index
# Marketplace

**Status:** baselined
**Version:** 1.3
**Date:** 2026-08-12
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

## 1. How to use this index

ADRs are immutable once accepted. Never edit one. To change a decision, write a new ADR and set its
`Supersedes` field, then flip the old one's `Superseded by`. Every ADR below is `accepted`, and no
supersession exists — each decision stands as written, and none contradicts another. Where two ADRs touch
the same subject they divide it rather than overlap: ADR-001 decides that the platform is sixteen
independent histories, ADR-031 decides what the parent workspace records about the fifteen it contains.

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
| ADR-011 | Soft delete via `deleted` date, global uniques stay occupied | accepted | 2026-08-04 | — | — | Data model |
| ADR-012 | itemCategory depth capped at two, in the resolver, admin-only writes | accepted | 2026-08-05 | — | — | Catalogue |
| ADR-013 | English-only naming, with no carve-out | accepted | 2026-08-04 | — | — | Data model |
| ADR-014 | Migrations immutable, `$jsonSchema` shapes shared in lib/schemas/ | accepted | 2026-08-04 | — | — | Data model |
| ADR-015 | marketplace-common: package-name consumption, unpublished, deploy-local.sh bridges | accepted | 2026-08-04 | — | — | Build and quality gates |
| ADR-016 | 100% coverage on all four metrics + 100 mutation score, everywhere | accepted | 2026-08-06 | — | — | Build and quality gates |
| ADR-017 | Hooks via core.hooksPath + prepare script, Qodana in pre-commit and pre-push | accepted | 2026-08-07 | — | — | Build and quality gates |
| ADR-018 | SSR public routes, CSR-only /account/*, cache bypasses on session cookie | accepted | 2026-08-05 | — | — | Frontend |
| ADR-019 | New urql client per SSR request, un-prefixed PUBLIC_RESOURCE_URL | accepted | 2026-08-05 | — | — | Frontend |
| ADR-020 | Route files as one-line createFileRoute, behaviour in routeOptions | accepted | 2026-08-05 | — | — | Frontend |
| ADR-021 | preferGetMethod stays false (csrfPrevention everywhere) | accepted | 2026-08-05 | — | — | Frontend |
| ADR-022 | Nine services bind wildcard; SSR server binds loopback | accepted | 2026-08-07 | — | — | Infrastructure and delivery |
| ADR-023 | Per-repo integration database, named identically in three variables | accepted | 2026-08-07 | — | — | Build and quality gates |
| ADR-024 | Tabs everywhere, eslint + prettier together, tree-wide | accepted | 2026-08-07 | — | — | Build and quality gates |
| ADR-025 | services-status has no repo of its own, gated by parent hooks | accepted | 2026-08-07 | — | — | Build and quality gates |
| ADR-026 | engines.node = ^24.18.0 everywhere, caret included | accepted | 2026-08-07 | — | — | Build and quality gates |
| ADR-027 | One frontend app per tier, not one app that switches on role | accepted | 2026-08-05 | — | — | Frontend |
| ADR-028 | GraphQL is the whole API; three REST endpoints serve email verify only | accepted | 2026-08-05 | — | — | Infrastructure and delivery |
| ADR-029 | PII at rest: explicit CSFLE, deterministic on the five lookup keys | accepted | 2026-08-08 | — | — | Data model |
| ADR-030 | marketplace-nginx gates on its own suite at push, on the secret guard at commit | accepted | 2026-08-09 | — | — | Build and quality gates |
| ADR-031 | The fifteen sub-repos are tracked as submodules of the parent workspace | accepted | 2026-08-09 | — | — | Infrastructure and delivery |
| ADR-032 | The production topology is owed, and no control may assume it | accepted | 2026-08-10 | — | — | Infrastructure and delivery |
| ADR-033 | `SameSite=Strict` on the refresh cookie, enforced twice | accepted | 2026-08-10 | — | — | Identity and access |
| ADR-034 | Keygrip keys live in Redis, wrapped under a KEK, boot fails on disagreement | accepted | 2026-08-12 | — | — | Identity and access |

## 3. By area

**Identity and access** — ADR-002, ADR-003, ADR-004, ADR-005, ADR-006, ADR-033, ADR-034

**Data model** — ADR-007, ADR-010, ADR-011, ADR-013, ADR-014, ADR-029

**Catalogue** — ADR-008, ADR-009, ADR-012

**Frontend** — ADR-018, ADR-019, ADR-020, ADR-021, ADR-027

**Build and quality gates** — ADR-015, ADR-016, ADR-017, ADR-023, ADR-024, ADR-025, ADR-026, ADR-030

**Infrastructure and delivery** — ADR-001, ADR-022, ADR-028, ADR-031, ADR-032

## 4. Decisions deliberately NOT re-opened

| Temptation | Settled by | Why not |
|---|---|---|
| Merge the three authorization services into one | ADR-006 | dispatching on a tier read from the session is the pattern ADR-002 rejects; one `process.exit(1)` for three tiers is an availability cost paid by customers |
| Fold `logout` back into the three `*-authenticated-authorization` services, or add a tier-named `adminLogout`/`shopOwnerLogout`/`userLogout` | ADR-005 | the resolver reads no `tier` and opens no collection, so three copies could never diverge — it is one `del` per key either way — while each copy pays the full CON-08 gate cost (lint, 100% coverage, mutation 100, Qodana) for a failure isolation session teardown has no use for; it also reintroduces the tier-dispatch pattern ADR-002 rejects. Stated as a standing boundary in `phase5/SESSION_TERMINATION.md` §E02-S05, which is what a PR proposing it has to answer. Violation looks like a `logout*.mts` appearing under any authorization service's `schema/mutations/`, or `assertTier` appearing inside `marketplace-dev-authenticated-logout/src/` |
| Per-tier `REDIS_KEY` prefixes | ADR-004 | breaks the single logout service (ADR-005), which finds a session by token content alone; the tier assertion is the layer that holds even if a prefix is reused by mistake |
| Add a `role` field / permission enum | ADR-002 | role = which collection you authenticate against, by design; a role field duplicates that |
| Add a shop collection | ADR-007 | a shop is a company; a separate shop collection splits one record in two and puts the storefront fields on the wrong side of the split |
| Add a `price` field to `item` | ADR-009 | order/cart/delivery/payment have no design yet; a price with nothing to buy is a guess at a decision nobody has made |
| Lower a coverage or mutation threshold | ADR-016 | the rule that outlived every other instruction here; a commit that needs a threshold lowered needs a test instead |
| Add `ignoreStatic` to a Stryker config | ADR-016 | masks real gaps; the survivor it appears to fix is usually a load-time mutant needing a dynamic import instead |
| Reintroduce vocabulary that presumes what is sold | ADR-008 | catalogue is domain-neutral on purpose; nothing in item/itemCategory presumes a product type and nothing should |
| Collapse the sixteen repos into a monorepo | ADR-001, ADR-031 | sixteen separate histories, hook sets, gates and Qodana projects would have to merge, and path-scoped CI would have to be invented to recover what repo boundaries give for free; ADR-031 answers reconstruction and cross-repo state without touching this |
| Put the sub-repo paths back in the parent's `.gitignore`, or commit a sub-repo's files into the parent | ADR-031 | the first makes `git submodule add` refuse the path and un-tracks fifteen gitlinks; the second dissolves the boundary ADR-001 set — a submodule pins a sub-repo, it never absorbs one |
| Give `marketplace-nginx` a `package.json` so its hooks self-arm | ADR-030 | it ships no JavaScript, so the file would exist to hold one line of git config and would invite a `lint`/`test` script with nothing behind it — the appearance of a gate, which is exactly what ADR-025 refuses to accept for `services-status` |
| Move `marketplace-nginx`'s test suite into its `pre-commit`, or add a skip variable to its `pre-push` | ADR-030 | the suite needs a container engine and an image, and the ordinary commit there is one directive; a per-commit container run is how a hook gets `--no-verify`d out of habit |
| Encrypt `shopOwner.personalData.firstName` / `lastName` / `address.city` too | ADR-029 | they are the sort keys and `/^term/i` targets of the operator's shop-owner table, and neither CSFLE algorithm survives a sort or a prefix match; encrypting them makes that table silently wrong rather than slow |
| Switch another field to deterministic so it can be queried | ADR-029 | equal plaintext gives equal ciphertext, which is an equality oracle for anyone holding a read; the five deterministic fields are the ones a login or a verification link must *find*, and the list does not grow for convenience |
| Narrow the refresh cookie's `path` to the authorization routes | ADR-018 | the root scope is what makes `conf.d/30-cache.conf:32-35` work: nginx decides whether to cache a public catalogue page by whether the request carries `refresh_token`, and a cookie the browser withholds on that path makes a logged-in customer look anonymous — their personalised HTML is then stored and served to the next visitor (NFR-SE09). ADR-018's prose said "scoped to API paths" and was wrong about it; the sentence was corrected, the scope is not to be |
| Put the Keygrip keys in Redis unwrapped, or drop the `KEYGRIP_KEK` because "Redis is internal" | ADR-034 | the signature is the one layer a Redis read does not already defeat: an attacker holding the session tokens still cannot sign a cookie. Unwrapped keys hand that away, and ADR-032 forbids arguing it back with a network boundary that is not written down anywhere |
| Give the mint to `marketplace-dev-authenticated-logout` because all three tiers already reach it | ADR-034 | that is the reason not to: it is the one service a customer's traffic touches on every tier, and minting a signing key is an operator act that belongs behind the Admin tier's own resource service |
| Reintroduce `KEYGRIP_KEY_1`/`_2` into an `env` template "as a fallback" | ADR-034 | a fallback is a second source of truth for the value the whole decision exists to make single, and it fails in the one shape that is invisible — a service that quietly boots on the env pair while the other four follow the record |
| Add a version or optimistic-lock field to `company` or `item`, or a read-then-compare precondition on either tier's update | platform owner, 2026-08-14 — `phase5/COMPANY_LEGAL_ENTITY.md` §6, `phase5/RISK_REGISTER.md` §5 (R29 Accepted) | two writers on one document is the design, and last writer wins is the accepted outcome: an operator unpublishes, the shop owner publishes again, and that is normal. Both tiers `$set` a whole enumerated object rather than a diff, so what was accepted is whole-card last-write-wins — a story proposing a lock reverses the decision instead of extending it |
| Put `published` back inside `GraphQLInputItem` or `GraphQLInputCompany`, "so a save can set it too" | platform owner, 2026-08-14 — `phase5/COMPANY_LEGAL_ENTITY.md` E04-S08, `phase5/epics/E05.md` E05-S08 | that is the bug the split removed: a whole-object `$set` makes every save a write of the flag, so reopening a stale card republished what somebody had just taken down, without touching anything named publish. `itemUpdatePublished` / `companyUpdatePublished` are the only writers, one pair per tier, and `itemAdd`/`companyAdd` stamp `false`. The DB `$expr` `PUBLISHED_IMPLIES_LINKABLE` then makes save-then-publish two calls by construction |
| Loosen `sameSite: 'Strict'` to `'Lax'` or `'None'` to fix a cross-site redirect | ADR-033 | the cost is known and accepted — a return trip from an external site does not carry the session, and the customer lands logged out. `'Lax'` re-opens top-level-GET CSRF against the authorization services, and the value lives in `@axiumine/koa-utils` anyway, so this is not a change this workspace can make by editing itself |

## 5. Gaps

Decisions this platform still owes an ADR, once taken:

- **Where a shared secret is provisioned.** ADR-034 takes the Keygrip pair out of five `.env` files and
  leaves one `KEYGRIP_KEK` in their place, which is a smaller version of the same unanswered question,
  not an answer to it — `INTROSPECTION_CODE` and `REDIS_PASSWORD` are untouched and still have to be
  identical across nine files that nothing compares (`INFRA.md` §8 q8). Option E of ADR-034 — a secrets
  manager — is the destination and cannot be chosen before ADR-032 says where any of this runs.
- **Ordering.** Cart, order state machine, delivery, payment — no collection, no resolver, no design. ADR-009 records only that item has no price *because* of this gap. Needs its own ADR when the design starts.
- **Where the sixteen repos get published**, and under which org. No ADR yet — it is explicitly the user's undecided call (see [`docs/workflow.md`](../../../workflow.md), *Repo layout*).
- **Production topology — now owned by [`ADR-032`](./ADR-032-production-topology-owed.md), which records it as *owed* rather than answering it.** The edge itself is written down: `marketplace-nginx/` carries a vhost per hostname — apex, `shopowner.`, `admin.` — terminating TLS for all three and proxying eleven loopback upstreams (the nine backend services, the SSR renderer and Nominatim) while serving both SPAs and the SSR app's static output off disk. `marketplace-nginx/test/run.sh` exercises it in a container: `nginx -t` plus 168 behavioural assertions, including that both session cookies come back `Secure` from every endpoint that mints one. What no ADR records is where that instance *runs*: which host, whether anything sits in front of it, how the service ports are closed to everything but it — the nine bind the wildcard address by decision (ADR-022) — and where Redis and MongoDB sit relative to them, `docker-DBs/` being dev-only by its own decision. Three audit findings are bounded by that answer and by nothing else: `INTROSPECTION_CODE` is reachable wherever a service port is (E13-S11), `refresh` is floodable with distinct garbage tokens (E14-S08), and the Redis leg is plaintext `redis://` (R45). ADR-032 names the owner and the date, and rules that until it is superseded **no control may be argued closed by appeal to a network boundary** — so the gap stays open here, deliberately, rather than being closed by an assumption.
