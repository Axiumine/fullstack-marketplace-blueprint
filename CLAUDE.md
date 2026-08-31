# Marketplace

Multi-tenant marketplace. Customers order from many independent shops; each shop is run by its owner;
the platform vendor operates it. **This directory is the parent workspace of sixteen
independent git repos — work from here, not from inside one repo.** The fifteen sub-repos are tracked
here as submodules (ADR-031): the parent pins a commit per sub-repo and nothing more, so their files stay
theirs, and `git clone --recurse-submodules` rebuilds the whole workspace.

## Where to read next

Load the file that matches the task. Do not guess from this page alone.

| Topic | File |
|---|---|
| bringing the whole platform up from nothing, in order | [`SETUP.md`](./SETUP.md) |
| services, ports, auth model, resolver layout | [`docs/architecture.md`](./docs/architecture.md) |
| the edge — three vhosts, TLS, the `Secure` cookie rewrite, its test container | [`marketplace-nginx/CLAUDE.md`](https://github.com/Axiumine/marketplace-nginx/blob/main/CLAUDE.md) |
| collections, validators, indexes, migrations, PII encryption | [`docs/data-model.md`](./docs/data-model.md) |
| the three apps + `marketplace-services-status` | [`docs/frontends.md`](./docs/frontends.md) |
| vitest layout, integration + mutation traps | [`docs/testing.md`](./docs/testing.md) |
| repos, git rules, cloning the workspace, secrets, `.env`, commands | [`docs/workflow.md`](./docs/workflow.md) |
| lint, formatting, engines, package plumbing | [`docs/conventions.md`](./docs/conventions.md) |
| GitNexus MCP + CLI | [`docs/gitnexus.md`](./docs/gitnexus.md) |
| no MongoDB replica set on this machine — Docker one, and the boot order of the whole platform | [`marketplace-docker-DBs/CLAUDE.md`](./marketplace-docker-DBs/CLAUDE.md) |
| taking this blueprint past a workstation — the three shared secrets, their swap points, what a swap must not break | [`docs/PRODUCTION_HARDENING.md`](./docs/PRODUCTION_HARDENING.md) |
| gate policy — which layer blocks what | [`README.md`](./README.md) |
| **why** any of this is the way it is | [`docs/devprotocol/phase3/adr/ADR-INDEX.md`](./docs/devprotocol/phase3/adr/ADR-INDEX.md) |
| traps of one specific repo | that repo's own `CLAUDE.md` |

`git log` answers almost nothing here — history is shallow. The ADR index is the
rationale of record, including a *"decisions deliberately NOT re-opened"* table. Read it before
proposing a refactor of anything below.

## Build state

Four surfaces, all present, at very different depths.

| Surface | Audience | Built |
|---|---|---|
| Public pages | anonymous | backend + the SSR half of `marketplace-user` |
| Customer area | end customer | **identity only** — `user` collection, service pair, private area |
| Shop-owner area | `ShopOwner` | backend + `marketplace-shopowner` |
| Admin area | `Admin` | backend + `marketplace-admin` |

⚠️ **"Customer area built" means identity, not commerce, permanently.** A customer can register, confirm
their email, log in, fill in personal data, keep several addresses and name one the default. They cannot
buy anything and never will: **no cart, no order, no order state machine, no delivery, no payment** — no
collection, no resolver, no design, and `item` carries no price for that reason. Those four are
**permanently out of scope** by the platform owner's decision of 2026-08-27
([`ADR-038`](./docs/devprotocol/phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)).
**Do not invent them** — this is a refusal, not a gap, and building one contradicts an accepted ADR.
Re-opening it takes a superseding ADR, which is the platform owner's call alone.

Do not describe the unbuilt parts to the user as if they exist, and do not assume a missing piece is an
oversight. The commerce four are not merely missing: they are declined.

Adding a fifth tier follows the recipe the four establish: a collection + migration → a `tier` value in
the session → a service pair of its own → resolvers → a frontend.

## Two naming rules

⚠️ **Everything is English, with no exception** — domain names, identifiers, function names, collection
and field names, UI text, routes, comments, test fixtures, migrations. There is no second language
anywhere in these sixteen repos, and adding one word of one is a regression rather than a style nit: the
same name has to spell identically in a migration, a `$jsonSchema`, a model, a resolver, a GraphQL field
and three frontends, and nothing maps between those layers.

A field whose meaning is not obvious from its English name gets a comment saying exactly what it holds —
see [`docs/devprotocol/phase2/UBIQUITOUS_LANGUAGE.md`](./docs/devprotocol/phase2/UBIQUITOUS_LANGUAGE.md) §12 for the five registration fields on `company`,
where `legalName` (registered name) and `publicName` (trading name) are the pair worth knowing. The
`en-GB` locale the frontends format dates with, and the `english` stemming on the two text indexes, are
market choices rather than names.

⚠️ **The catalogue is domain-neutral** (ADR-008). `item` and `itemCategory` presume nothing about what
is sold. **Do not reintroduce vocabulary that presumes a product type** when adding one.

## Terminology — read this first

⚠️ **Three human roles, and their names are `admin`, shop owner and customer** — platform owner's ruling
of 2026-08-29. **The word *operator* is not one of them and appears nowhere**: it used to mean the `Admin`
tier, and a fourth word for a role that already has a name is how a reader ends up asking which of the
three it was. The two other words this page once used are gone with it — a shop owner is never "the admin",
and there is no "superadmin".

| Business role | Code name | Where |
|---|---|---|
| Shop owner | `ShopOwner` | `shopOwner` collection, `authenticated-*` services |
| Admin — runs the platform | `Admin` | `admin` collection, `admin-authenticated-*` services |
| End customer | `User` | `user` collection, `user-authenticated-*` services |
| Company — **also the shop** | `Company` | `company` collection, FK `idShopOwner` |
| Catalogue entry | `Item` | `item` collection, FK `idCompany` |
| Category / subcategory | `ItemCategory` | `itemCategory` collection, self-FK `idParent`, admin-only writes |
| Shop as a **separate** thing | — | does not exist and will not — a shop *is* a `company` |
| Order, cart, delivery, payment | — | not implemented |

⚠️ **There is no `role` field and no permission enum anywhere, deliberately (ADR-002): role = which
collection you authenticate against.** Each role has its own service pair and its own `tier` value in
the Redis session. A fifth role means a fifth collection and a fifth service pair, *not* a role check
bolted onto the existing ones.

## The shape, in one screen

Nine Koa 3 + Apollo Server 5 backend services, split on **tier** (who) × **concern** (what); three
frontends, one per tier; one shared npm lib; one migrations repo.

| Service | Port | Tier |
|---|---|---|
| `marketplace-dev-admin-authenticated-resource` | 4024 | Admin |
| `marketplace-dev-admin-authenticated-authorization` | 4025 | Admin |
| `marketplace-dev-authenticated-resource` | 4026 | ShopOwner |
| `marketplace-dev-public-resource` | 4027 | public |
| `marketplace-dev-public-authorization` | 4028 | public |
| `marketplace-dev-authenticated-authorization` | 4029 | ShopOwner |
| `marketplace-dev-authenticated-logout` | 4030 | **all three** |
| `marketplace-dev-user-authenticated-authorization` | 4031 | User |
| `marketplace-dev-user-authenticated-resource` | 4032 | User |

Frontends: `marketplace-admin` 3043 (SPA) · `marketplace-shopowner` 3044 (SPA) · `marketplace-user`
3045 (SSR public + CSR account area).

**authorization** = token lifecycle only. **resource** = domain GraphQL. Put a new domain query or
mutation in a **resource** service.

MongoDB, 6 collections, strict `$jsonSchema` with `additionalProperties: false`:

```
shopOwner ──idShopOwner──> company ──idCompany──> item ──idCategory──> itemCategory
                                                                            ▲
                                                                    idParent ┘  (one level only)
admin, user — outside the chain
```

## Rules that apply to every task

- **Never commit on `main`.** Branch first — `git switch -c <type>/<slug>` — in all sixteen repos.
  Merging into `main` is the user's decision alone.
- **`marketplace-common` is the only repo that may be committed, merged, pushed and published without
  asking. Every other repo is push-on-request, always.**
- ⚠️ **An edit to `marketplace-common` reaches a consumer by being published, and by nothing else.**
  It is consumed by name from `registry.npmjs.org`, each consumer resolving the range its own
  `package.json` declares (ADR-037, ADR-047), so
  an unpublished edit is invisible at every call site. Cut a release: bump, changelog, merge, tag,
  `git push --follow-tags`, `yarn upload`, then move each consumer's range — the nine steps in
  [`BEs/marketplace-common/CLAUDE.md`](./BEs/marketplace-common/CLAUDE.md) §The release flow, all of them,
  every time. **`yarn install` is authoritative everywhere and can destroy nothing.**
  ⚠️ **Never copy a local build into a consumer's `node_modules`** — no `rsync`, no `cp`, no `yarn link`,
  no `file:` path, and no revival of `deploy-local.sh`, which is **deleted** (platform owner, 2026-08-30 —
  [`ADR-047`](./docs/devprotocol/phase3/adr/ADR-047-a-common-change-ships-as-a-published-release.md)). A
  copied build has no version, no lockfile entry and no second machine that can reproduce it. Iterate
  inside `marketplace-common` with `yarn test`; if a consumer needs the change, the change is worth a
  version number.
- **One logical change = N+1 commits**: one per affected sub-repo, plus one in the parent bumping the
  submodule pointers (ADR-031). Land dependencies first; say which repos you touched. A sub-repo commit
  with no pointer bump leaves the parent describing a state that no longer exists.
- ⚠️ **`git submodule update` leaves sub-repos on a detached HEAD.** After any init or update, run
  `git submodule foreach 'git switch main'` before editing anything — a commit on a detached HEAD is
  reachable from nothing and looks entirely normal until the next checkout drops it.
- **Never lower a coverage or mutation threshold, and never remove a gate.** Everything is at 100% on
  all four coverage metrics and mutation score 100. A commit that needs a threshold lowered needs a
  test.
- ⚠️ **Never start the mutation gate by hand, in any of the fifteen repos that carry a `stryker.config.*`.**
  `yarn test:mutation` is **hook-only** — `pre-push` calls it, nothing else does, and neither a commit nor
  a "quick check on one file" is a reason to run it. Each repo's own `CLAUDE.md` says the same at the top.
  To reproduce a survivor, apply the mutant by hand in the source and run `yarn test`, which takes seconds.
- **Never read, echo or commit a secret-bearing file** (`.env`, `.npmrc`, `*.pem`, …). `env` and
  `npmrc` without the dot are committed templates and safe. Print key names only:
  `grep -oE '^[A-Za-z_0-9]+' .env`. See [`.claude/SECRETS.md`](./.claude/SECRETS.md).
- **Migrations are immutable** — never edit an applied one, add a new one. But `$jsonSchema` shapes are
  shared from `marketplace-db-setup/lib/schemas/`, and a change there means rebuilding every database
  that has run these migrations, in the same piece of work.
- **Indentation is tabs**, enforced by eslint and prettier together.
- **Run `impact({target, repo})` before editing a symbol and `detect_changes()` before committing**;
  `repo:` is mandatory and must be a `marketplace*` registry name.
