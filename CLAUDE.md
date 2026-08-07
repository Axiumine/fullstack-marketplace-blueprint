# Marketplace

Multi-tenant marketplace. Customers order from many independent shops; each shop is run by its owner; the platform vendor (thedoctorweb) operates it.

⚠️ **It is not a pizza platform, and the catalogue it has now shares nothing with the one it had.** The pizza framing came from the old collection names, and on 2026-08-04 those names were deleted outright: 13 food collections plus `costiConsegna`, then `puntoVendita` and `categoria`, went with every migration, mongoose model, `Cibo` base shape, resolver and test that served them (see *Data model*). `opzPizze` / `opzPaninoteca` — the last dough-specific fields on the platform — went with the collection that carried them. A **domain-neutral** catalogue was built the next day, 2026-08-05, on the seam that cut left behind: `item` and `itemCategory`, hanging off `company`, with **no shop collection** — a shop *is* a company. Nothing in it presumes food, and nothing in it should: **do not reintroduce food vocabulary when adding a product type.**

**Work in progress.** The target product has four surfaces: public pages, customer area, shop-owner area, platform-operator area. **All four now exist**, at very different depths — the customer tier landed on 2026-08-05 with its own collection, its own service pair, a public read surface and a server-rendered app, while orders, cart, delivery and payment are still unbuilt and have no model to copy. Every section below marks **built** vs **planned** — do not assume a missing piece is an oversight, and do not describe the platform to the user as if the unbuilt parts exist.

⚠️ **Language: everything is English — domain names, UI text, routes, comments.** This reverses the rule this file carried until 2026-08-04, when the whole platform was renamed on the user's explicit instruction. The mapping: `imprenditore` → `shopOwner`, `azienda` → `company`, `anagrafica` → `personalData`, `indirizzo` → `address`, `iscrizione` → `registeredAt`, `nome`/`cognome` → `firstName`/`lastName`, `comune` → `city`, `cap` → `postalCode`, `cellulare`/`fisso` → `mobile`/`landline`. Collections were renamed too, which invalidated the `changelog` — see *Data model*.

**Do not "translate back", and do not add a new Italian identifier.** Italian survives in exactly two places, both deliberate: **domain terms with no English equivalent** in prose and comments (*partita IVA* = `vatNumber`, *codice fiscale* = `taxCode`, *PEC* = `certifiedEmail`, *visura* = `registryExtract`, *ragione sociale* = `legalName` — these name Italian legal instruments and the English gloss would be wrong), and the **`it-IT` locale** the operator SPA formats dates with, which is a market choice and not a name.

## Target architecture

| Surface | Audience | Status |
|---|---|---|
| Public pages | anonymous | backend + the SSR half of `marketplace-user` built |
| Customer area | end customer, places orders | identity and account built — `user` collection, service pair, `marketplace-user` private area. **No orders** |
| Shop-owner area | `ShopOwner` | backend + `marketplace-shopowner` frontend built (React + Vite) |
| Operator area | `Admin` | backend + `marketplace-admin` frontend built (React + Vite) |

⚠️ **"Customer area built" means identity, not commerce.** A customer can register, confirm their email, log in, fill in their personal data, keep several addresses and name one of them the default. They cannot buy anything: there is no cart collection, no order collection, no order state machine, no delivery flow and no payment integration, and `item` deliberately carries **no price** for that reason. Those four are genuinely new design with no existing model to copy — **ask before inventing them.** Everything that *is* built was placed so they hang off this tier rather than being retrofitted into it.

The pattern the built tiers establish (see *Terminology* and *Backend services*) is what the customer tier followed, and it is the recipe for a fifth: a collection + migration → a tier value in the session → a service pair of its own → resolvers → a frontend. Name it in English like everything else — the legacy scripts called the customer `utente`, and that spelling did not come back.

## Terminology — read this first

The code does NOT use the words customer/admin/superadmin. Mapping:

| Business role | Code name | Where |
|---|---|---|
| Shop owner ("the admin") | `ShopOwner` | `shopOwner` collection, `authenticated-*` services |
| Platform operator ("the super admin", the developer) | `Admin` | `admin` collection, `admin-authenticated-*` services |
| End customer (registers, will place orders) | `User` | `user` collection, `user-authenticated-*` services |
| Company — **also the shop** (the legal entity a shop owner registers) | `Company` | `company` collection, FK `idShopOwner` |
| Catalogue entry | `Item` | `item` collection, FK `idCompany` |
| Category / subcategory | `ItemCategory` | `itemCategory` collection, self-FK `idParent`, admin-only writes |
| Shop / point of sale as a **separate** thing | — | does not exist, and will not — a shop is a `company` |
| Menu section | — | **removed 2026-08-04** — replaced by `itemCategory` |
| Order, cart, delivery, payment | — | **not implemented** — no collection, no resolver, no design |

There is no `role` field and no permission enum anywhere, and this is deliberate — **role = which collection you authenticate against.** Each role gets its own service pair, and since 2026-08-05 its own `tier` value stamped into the Redis session (see *Auth model*). A fifth role means a fifth collection and a fifth service pair, *not* a role check bolted onto the existing ones.

Current build state: three tenant collections plus a two-level catalogue plus customer identity. **No order or cart collection exists.** A `utente` collection existed in the legacy mongosh scripts and was dropped during the migrate-mongo port (`migration/MongoDB/scripts/utente.js`); the `user` collection built on 2026-08-05 is a fresh design mirroring `shopOwner`, not a restoration of it. ⚠️ That legacy history is **gone locally** — it lived only in `marketplace-db-setup`'s Mercurial history, which was discarded in the hg→git conversion. To recover it, clone the old hg repo from `repo.tdweb.it`. The `img/` folder that held the customer mobile app design (screen layouts, product photos, button icons) has been **deleted** — it was never tracked by any repo, so there is no copy to restore.

## This directory is the parent workspace

**Work from here, not from inside a single repo.** This dir is the father of all Marketplace repos — it exists so the whole platform can be seen and changed at once, with a wide view. A task that looks local almost never is: a model change starts in `marketplace-common`, needs a migration in `marketplace-db-setup`, resolvers in one or more services, and queries in the frontend. Open the parent dir so all of it is reachable in one session.

Consequences to hold in mind:

- Trace a change end to end across repos before editing. Check who consumes the thing you are touching — the services share `marketplace-common`, so a breaking edit lands on all nine.
- One logical change = **N separate `git` commits**, one per affected repo. There is no atomic cross-repo commit. Land dependencies first (marketplace-common → `deploy-local.sh` → bump consumers), and say plainly which repos you touched.
- The repos drift. Shell scripts and service scaffolding are near-duplicates; a fix in one usually belongs in the other eight.
- The parent dir is its **own git repo**, tracking only workspace files (`CLAUDE.md`, `.claude/`, `.agents/`). Its `.gitignore` excludes `/BEs/`, `/marketplace-admin/`, `/marketplace-shopowner/` and `/marketplace-user/`, so the sub-repos nest without conflict.

## Repo layout

Polyrepo, **not** a monorepo. Fourteen independent **git** repos under this parent dir (which is itself a fifteenth, tracking workspace files only). Eleven of them predate 2026-08-05; the customer tier added three — `marketplace-dev-user-authenticated-authorization`, `marketplace-dev-user-authenticated-resource` and `marketplace-user`.

⚠️ **All fifteen repos are remote-less, and their history starts here. Verified 2026-08-05.** `git remote get-url origin` returns nothing anywhere. This workspace is a rebranded *copy* of `/media/nvme/websites/pizzati`, made by renaming directories and sweeping identifiers; the copy carried the working trees but neither the histories nor the remotes.

**Twelve repos have a `main`; the three built on 2026-08-05 do not.** The older twelve were committed for the first time during the 2026-08-04 rename, onto `refactor/italian-to-english`, and `main` was created at each branch tip afterwards on the user's explicit instruction — ten of them carry a `chore: baseline before Italian to English rename` root commit with the rename on top, while `marketplace-dev-authenticated-logout` and `marketplace-shopowner` carry one commit each. The three new repos have **only** their feature branch (`feat/user-tier-services` in the two services, `feat/marketplace-user` in the app): their first commit *is* that branch, and creating `main` there is a decision the user has not been asked for.

Consequences, all of which bite:

- **Rollback exists, but it is shallow.** There is exactly one pre-rename baseline per older repo and nothing before it, so `git diff`, `git stash` and `git reset` work while `git log` answers almost nothing about *why* anything is the way it is. The 2026-08-04 catalogue deletion was carried out before any of these commits existed, with no baseline at all, on the user's explicit instruction after the risk was stated — it is in no repo's history and cannot be reverted.
- **Nine repos have uncommitted work in `.githooks/`**, the hook hardening that has not been committed anywhere but the parent. It is unstaged, so it follows whatever branch is checked out rather than living on `fix/githooks` as the branch name suggests. A clean tree is still not the norm here.
- **The `never commit on main` rule still applies.** In the twelve that have a `main` it is often the checked-out branch, so a bare `git commit` lands on it. In the three that do not, a bare commit lands on the feature branch and looks fine — which is a different trap: the work piles onto one unmerged branch with nothing to diff it against. Branch first either way.

The original workspace **is** on GitHub — private repos under the **`Pizzati-Org`** org, one per directory. Those remotes belong to the other tree. Nothing here points at them, and nothing here should be pushed to them: the catalogue deletion and the rename would land on the live project. Deciding where these fifteen repos get published, and under which org, is the user's call and has not been made.

⚠️ **Note the npm/git split.** `@thedoctorweb_agency/marketplace-common` and `@axiumine/koa-utils` are *npm package* names and are unrelated to where the git repo lives. Renaming a git remote never implies renaming the package, and vice versa.

**Scan history for secrets before the first push of any new repo.** A filename check is not enough — `marketplace-db-setup` hid a live Mongo password in an *unquoted* `mongosh -password` flag, which slips past any quoted-value regex. Scan every blob in `git rev-list --all --objects`, not just the working tree. Purging with `git filter-repo` is free before the first push and expensive after — and with zero commits here, every one of these repos is still in the free window.

```
fullstack-marketplace-blueprint/
├── BEs/
│   ├── marketplace-common/    # shared npm lib — has its own CLAUDE.md, read it before editing
│   ├── marketplace-db-setup/  # MongoDB migrations — has its own CLAUDE.md, read it before editing
│   └── dev/                   # 9 backend services, one git repo each
├── marketplace-admin/         # React + Vite operator SPA (Admin tier)
├── marketplace-shopowner/     # React + Vite shop-owner SPA (ShopOwner tier)
└── marketplace-user/          # TanStack Start SSR app — public site + customer area (User tier)
```

`BEs/dev/upload-local/` is **not** a repo and not a service — it is an empty directory the resource services write uploads into. Do not count it, and do not `git init` it.

⚠️ **`marketplace-common` is consumed as a published package name but is not on any registry, and the gap is bridged by a script.** `package.json` names it `@thedoctorweb_agency/marketplace-common` and the nine services depend on that name — which 404s on registry.npmjs.org. `BEs/marketplace-common/deploy-local.sh` builds it and syncs `dist/` + `package.json` into every consumer's `node_modules/@thedoctorweb_agency/marketplace-common/`, discovered by globbing this workspace. **Re-run it after every edit to common**, or the consumers keep resolving the previous build — an edit that is not deployed is invisible, and it fails at the call site rather than at import. A fresh `yarn install` in a service still 404s until the package is genuinely published.

## Backend services

Nine hand-rolled **Koa 3** servers, each mounting **Apollo Server 5** at one path via `@as-integrations/koa`. Entry always `src/index.mts`. ESM (`.mts` → `.mjs`), Node `^24.18.0`.

GraphQL is the whole API in eight of the nine. The exception is `marketplace-dev-public-resource`, which also mounts a real `@koa/router` at `src/middleware/router/index.mts` with prefix `/check`, serving `GET /check/`, `GET /check/verify-email/:email/:hash` (ShopOwner) and `GET /check/verify-email-user/:email/:hash` (User). Those three are the only REST endpoints on the platform, and the only reason GitNexus's contract registry is not completely empty.

Split on two axes: **tier** (who) × **concern** (what).

| Service | Port | Tier | Concern |
|---|---|---|---|
| `marketplace-dev-public-authorization` | 4028 | public | `login`, `loginAdmin`, `loginUser` |
| `marketplace-dev-public-resource` | 4027 | public | public catalogue reads, customer registration, verify-email |
| `marketplace-dev-authenticated-authorization` | 4029 | ShopOwner | token lifecycle |
| `marketplace-dev-authenticated-resource` | 4026 | ShopOwner | domain data, item CRUD, uploads |
| `marketplace-dev-authenticated-logout` | 4030 | **all three** | logout |
| `marketplace-dev-admin-authenticated-authorization` | 4025 | Admin | token lifecycle |
| `marketplace-dev-admin-authenticated-resource` | 4024 | Admin | domain data, `itemCategory` CRUD, moderation |
| `marketplace-dev-user-authenticated-authorization` | 4031 | User | token lifecycle |
| `marketplace-dev-user-authenticated-resource` | 4032 | User | account, personal data, addresses |

⚠️ **The logout row is not a typo.** One service serves every tier, because its resolver deletes the Redis keys by token *content* and never asks which collection minted them. All three frontends point at 4030. Tier-named logout mutations were evaluated and rejected — see the *Auth model*.

⚠️ **Both other columns are less solid than they look.**

*Ports.* The table is reproducible: `grep -m1 '^PORT=' <repo>/env` gives the same number for every service, and the three frontends are `3043` (admin), `3044` (shopowner), `3045` (user). That was not true before — the seven original committed `env` templates carried the same copy-paste `PORT=4064`, a port none of them listens on, so the numbers here appeared nowhere else in the tree and could not be checked. The templates were corrected from each machine's real `.env`; the nine values are distinct. No `src/index.mts` supplies a default, so a service with neither `.env` nor `PORT` in the environment still fails to start — the template is the only place to read the intended value from, which is why it has to stay accurate.

*Binding.* They do **not** bind `127.0.0.1`. Each one calls `httpServer.listen({ port })` with no host, so Node binds the unspecified address (`::`, every interface). This was previously written as a `hostname:` key, which is **not** a `net.Server.listen` option — Node silently ignored the unknown key and bound wide anyway, so the `HOSTNAME` variable never had any effect. The dead key was removed rather than converted to `host:`, because the wildcard bind is what the integration suites depend on: all nine fetch `http://127.0.0.1:<port>`, so binding to the LAN address in the env template would have broken every one of them. The bind is now explicitly wildcard, with a comment at each call site saying so. ⚠️ **`marketplace-user`'s `serve.mjs` is the one deliberate exception and binds loopback** — it has no authentication of its own, and reaching it directly bypasses every nginx rate limit and cache rule in front of it.

nginx does terminate TLS in front of the operator SPA on port `3043` — that was read off an nginx error log full of `upstream: "http://127.0.0.1:3043/"`, which sat untracked in the frontend repo and went with it when that repo was deleted, so the evidence is no longer on disk. What has not changed: **no nginx config is installed anywhere in this workspace or on this machine** (there is no `/etc/nginx` and no nginx binary in `PATH`). The live vhosts live on whatever host actually fronts the stack. Do not go looking for them here — but do read `marketplace-user/docs/nginx/`, which since 2026-08-05 carries real, deployable configs (`cache.conf`, `marketplace-user.conf`, `rate-limit.conf`, `security-headers.conf`). Those are the source for the customer surface: TLS, HSTS, CSP, the SSR upstream, the `proxy_cache` zone that bypasses on the session cookie, PMTiles range requests and the auth-path rate-limit zones. They are documentation until someone installs them.

**authorization** = refresh-token cookie → Redis session → mints tokens. No business queries.
**resource** = `Authorization: Bearer access:<token>` header → Redis lookup → serves domain GraphQL. Only resource services carry `sharp`, `clamscan`, `file-type`, `graphql-upload`.

Put a new domain query/mutation in a **resource** service. Touch **authorization** only for the token lifecycle.

### Auth model

Opaque tokens + Redis sessions. **Not JWT**, despite a stale `JWT` type in `schema.graphql`.

- Refresh token: Koa signed cookie (Keygrip SHA-512, `KEYGRIP_KEY_1/2`), httpOnly.
- Access token: `Authorization: Bearer access:<token>` header, validated against Redis.
- `x-introspectioncode` header (`INTROSPECTION_CODE`) bypasses the token check for service-to-service calls. Treat as a secret; never log it, never expose it to a browser client.
- `checkUserAuthorizationDisDel` in marketplace-common gates on `deleted` / `disabled`. `shopOwner` also has `waitApprov` (manual approval gate) and `onboardingStep`/`onboardingDone`. `user` has **no** `waitApprov` — customers self-serve — but `loginUser` refuses an account whose `emailVerify.valid` is false, returning the same generic error as every other failure so it cannot be used as an enumeration oracle.
- Passwords: bcrypt via `@node-rs/bcrypt`, `SALT_ROUNDS=14`.

⚠️ **Every session hash carries a `tier`, and every service asserts its own. Added 2026-08-05 to close a real hole.** Until then, `authorizationAuthenticatedResourceHandler.mts` did `hGetAll(${REDIS_KEY}${accessToken})` and set `ctx.state.user` on any non-empty hash — and all nine services share one `REDIS_KEY=marketplaceDev:`, so an **`Admin` access token was accepted by the ShopOwner resource service**, and the reverse. The fix is three pieces, in `marketplace-common`: the `TIER` constant (`admin` | `shopOwner` | `user`, `src/others/Tier.mts`), the tier written into the hash at login and carried through every refresh, and `assertTier(actual, expected)` (`src/others/assertTier.mts`) called in each service's auth middleware.

Three properties of that fix are load-bearing and must not be "simplified":

- **A missing `tier` is invalid, not a wildcard.** Sessions minted before the field existed are rejected by `actual !== expected` with no branch of their own. Fail closed: treating them as trusted would have kept the hole open for the whole `REFRESH_TOKEN_EXPIRY` (90 days) and cost nothing but a re-login to close.
- **403, not 401.** The caller authenticated correctly, it simply authenticated somewhere else. A 401 tells the client to refresh its way out, which it cannot.
- **`REDIS_KEY` stays shared on purpose.** Per-tier prefixes would break the single logout service, which finds a session by token content alone. The tier assertion is the layer that holds even if a prefix is ever reused by mistake — so it is the check to keep, not the prefix.

### Resolver layout (per resource service)

```
src/graphQLApi/schema/
├── queries.mts  mutations.mts     # roots
├── queries/  mutations/           # one file per operation: <entita>Add|Update|Del|Dis.mts
├── types/  GraphQLInput/  interfaces/  frag/
```

⚠️ **`marketplace-dev-public-resource` spells the root `src/graphQLPublic/`, not `src/graphQLApi/`** — the
layout below is otherwise identical, but a `find`/`grep` written for the other eight silently misses it.

`mutations/cibi/` is gone — it held the per-food-type `*Add.mts`/`*Update.mts` pairs and went with the
food catalogue. A new product type gets its own files directly under `mutations/`, following
`itemAdd.mts` and `itemUpdate.mts` in the ShopOwner resource service.

## Data model

MongoDB, **6 collections** — `admin`, `shopOwner`, `company`, `user`, `item`, `itemCategory` — with strict `$jsonSchema` validators and `additionalProperties: false`. Ownership chain:

```
shopOwner ──idShopOwner──> company ──idCompany──> item ──idCategory──> itemCategory
                                                                            ▲
                                                                    idParent ┘  (one level only)
```

`admin` and `user` both stand outside it: an operator owns nothing and is owned by nothing, and a customer owns only the addresses embedded in their own document.

⚠️ **There is still no shop collection, and there will not be — a shop *is* a `company`.** The platform used to carry 16 other collections —
13 food types (`pizza`, `bevanda`, `caffetteria`, `caramella`, `contorno`, `dolce`, `fritto`, `frutta`,
`gelato`, `insalata`, `paninoteca`, `piatto`, `snack`) plus `costiConsegna`, `puntoVendita` and `categoria` — and all 16 were removed on
2026-08-04, together with their migrations, their mongoose models and shared `Cibo` base shapes in
marketplace-common, their `exports` entries, their resolvers in the three resource services and their
tests. `item` and `itemCategory`, built on 2026-08-05, are **not** those collections restored: one generic
catalogue entry replaces the 13 food types, and one two-level category tree replaces `categoria` +
`puntoVendita`'s menu sections. Nothing in either presumes food.

**This is still the extension seam**: a new product *type* is a new collection plus a migration plus a
model plus resolvers, exactly as the 16 were — but check first whether it is genuinely a new type or just
an `item` with a different `idCategory`, because the generic shape exists precisely so most of them are
the latter.

### `user` — mirrors `shopOwner`, four deliberate divergences

Builder `lib/schemas/user.js`, reusing `account.js` (`LOGIN`, `RESET_PWD`, `EMAIL_VERIFY`, `DELETED`,
`DISABLED`, `INDEXES_LOGIN_EMAIL`) and `geo.js`. Required: `login` and `registeredAt` only — **not**
`personalData`, because registration is email + password and nothing else.

The four divergences from `shopOwner`, all intentional and none of them accidents to "fix":

1. **`personalData` is optional** — it is filled in after the email is confirmed.
2. **`addresses` is an array** where `shopOwner` has one `personalData.address`. Each element carries a required `_id`, an optional `label` and the shared address block with an optional `position`.
3. **No `waitApprov`.** Customers self-serve; there is no manual approval gate.
4. **`defaultAddress`** has no counterpart at all — see below.

⚠️ **"At most one default address" is a *shape*, not a rule, and the database enforces the rest.** The
original design was a boolean `default` on each array element; the adopted design is a single top-level
`defaultAddress` ObjectId pointing into `addresses[]._id`. A second default becomes inexpressible rather
than merely forbidden, and setting the default becomes one atomic `$set` instead of a
"clear all, then set one" two-step with a window in which zero or two addresses are default. The one
failure a pointer *can* have is dangling, and that is checkable, so the collection validator is
`$and: [ {$jsonSchema: …}, {$expr: …} ]` where the `$expr` accepts the pointer only if it is missing or
present in `$map` over `addresses`. **Deleting the default address must `$unset` the pointer in the same
update**, or the write is rejected by the database rather than by a code path someone can forget. The
`$ifNull: ['$addresses', []]` inside that `$map` is load-bearing: `$map` over a missing field yields
null, and `$in` against null *errors* instead of returning false, which would turn "no addresses yet"
into a failed insert.

The cost, recorded so nobody re-litigates it: reading "is this address the default?" is a comparison
against a sibling field rather than a local boolean, and any API that wants a boolean derives it.

### `item` and `itemCategory`

```
item          _id, idCompany (req), idCategory (req), name (req, ≤150), description (req, ≤2000),
              slug (req), published (bool), deleted (date, optional)
itemCategory  _id, name (req, ≤100), slug (req, unique), idParent (optional), position (int)
```

The four fields beyond the requested `_id, idCompany, name, description` each earn their place:
`idCategory` because categories cannot filter anything without the link, `slug` because an SEO URL needs a
stable human-readable segment, `published` so an owner can draft without appearing on an indexed page, and
`deleted` because soft-delete is the platform convention (`companyDel` stamps rather than removes).

⚠️ **There is no `price` field, deliberately.** Orders, cart, delivery and payment are out of scope and
have no model to copy; a price with nothing to buy is a guess at a design decision nobody has made.

⚠️ **`itemCategory` depth is capped at two, and the cap is in the resolver, not the validator.** A
`$jsonSchema` cannot express "my parent has no parent" — it cannot read another document. So
`itemCategoryAdd` / `itemCategoryUpdate` reject a parent that is itself a subcategory, and **writes exist
only in `marketplace-dev-admin-authenticated-resource`**. The ShopOwner and public tiers read the
collection and never write it. Adding a write path elsewhere silently removes the depth cap with it.

### Indexes the public surface depends on

The catalogue is read by anonymous traffic at scale, so its indexes are part of the design rather than a
tuning afterthought:

- `company`: **`address.position_2dsphere`** (the map and "shops near me" are exactly this query — the
  migration that created `company` said outright that nothing queried it by distance), `slug_unique`,
  `published_list`, `published_publicName`, `published_city_publicName`, and a `search_text` text index.
- `item`: `idCompany_list`, `idCompany_slug_unique`, `idCompany_published`, `idCategory_published`, the
  `_name` sort variants of both, and `search_text`.
- `itemCategory`: `slug_unique`, `idParent_position`.
- `user`: `login.email_unique`, from the shared `INDEXES_LOGIN_EMAIL`.

Verify a geo query with `.explain()` and expect an `IXSCAN` on the 2dsphere, never a `COLLSCAN`.

⚠️ **The company used to be an embedded object on the shop, and is now a collection.**
Migration `20260803000000-create-company` lifted that subdocument out, added
`idShopOwner` (required) plus the new `taxCode` and the `address` block, and moved the `vatNumber` and `certifiedEmail`
unique indexes onto it. `20260803142526` re-seeds the demo company. The extraction is what makes the real cardinality expressible: one shop owner owns N companies, where the embedded form forced one copy of the company per shop and then refused the second as a duplicate partita IVA.

⚠️ **Every collection, field and identifier was renamed to English on 2026-08-04, and the applied migrations were rewritten in place.** The one time the immutability rule was set aside, on the user's explicit instruction, so a migration reads as if its collection had never been called anything else. `imprenditore` → `shopOwner` and `azienda` → `company` are the two collection renames; the field renames are listed under *Language* at the top. It was paid for the way the `lib/schemas/` rule says to pay for it: **every database that had run these migrations was rebuilt in the same piece of work** — `dbMarketplaceDev` dropped and replayed with `SEED_DEMO=true`, and each repo's integration database is dropped by its own `globalSetup` anyway.

**`company` carries an optional `deleted` (date), and `companyDel` stamps it instead of removing the
row.** `vatNumber_unique` and `certifiedEmail_unique` stay plain global uniques with no `partialFilterExpression`, so
a retired company keeps its partita IVA occupied — deliberate: one partita IVA is one company,
whoever registered it and whenever they stopped trading. The two tiers answer differently on a
company that is already retired, and both are correct: the Admin tier's `companyDel` says 200,
because the guard it uses does not filter `deleted`; the ShopOwner tier says 403, because
`throwIfShopOwnerDontOwnCompany` does. Liveness filters belong on read paths and on
existence/ownership guards — never on the delete write itself.

A shop owner may hold several `company` rows, and each company holds its own `item` rows.

⚠️ **`company` grew a public face on 2026-08-05, and `legalName` is not it.** Migration
`20260804010000-alter-company-public` added `publicName` (the trading name shown to customers — a
*ragione sociale* on a shop card is wrong), `slug` (unique, for `/shop/:slug`), `description` (the page
body and the text-search target) and `published`, which defaults to false so nothing is indexable until
the owner says so. Everything else on `company` remains the legal entity it always was.

Adding a product type touches, in this order: model in marketplace-common → its `exports` entry (there
is no barrel, so an unlisted file is unreachable) → `deploy-local.sh` → migration in marketplace-db-setup, with
its `$jsonSchema` builder under `lib/schemas/` → resolvers in the resource services → schema slice and
codegen in the frontends that read it. `CibiModels.mts`, the `Cibo*` base shapes it exported, `PuntoVenditaModel` and
`CategoriaModel` are all **gone** — a new type starts from `ItemModel` as its reference, not from a surviving base class.

## Frontends — three apps, one per tier

| App | Tier | Port | Rendering |
|---|---|---|---|
| `marketplace-admin` | `Admin` | 3043 | SPA |
| `marketplace-shopowner` | `ShopOwner` | 3044 | SPA |
| `marketplace-user` | `User` + anonymous | 3045 | **SSR** for public routes, `ssr: false` for the account area |

All three are Vite 8 + React 19 + TypeScript strict, and each has its own `CLAUDE.md`, `README.md` and
`COVERAGE.md` — read them before editing that app.

### marketplace-admin and marketplace-shopowner (SPA)

The **operator app**: `loginAdmin`, then manage *shopOwners*.

TanStack Router (route tree in code, not generated) · urql + `cacheExchange` + `@urql/exchange-auth` ·
graphql-codegen `client-preset`, one project per access level · TanStack Table · react-hook-form + zod ·
Tailwind 4 · Sentry.

Things that bite (all three apps unless stated):

- **`schema/*.graphql` are hand-maintained slices, not the contract.** No service has an SDL file — all nine build their schema programmatically. The resolvers are the source of truth; the slices drift and must be re-checked before any operation is added or changed.
- **`preferGetMethod: false` is load-bearing.** Every service sets `csrfPrevention: true`, which rejects a GET carrying none of Apollo's preflight-forcing headers — and urql sends none. At the default, every query short enough to fit in a URL fails with a CSRF message while mutations work.
- **urql `context.url` objects must be module constants** (`CTX_*` in `src/api/endpoints.ts`). A `{ url }` literal in a component body is a new object per render, and urql re-executes on context change — an infinite refetch loop.
- Create/delete mutations answer a bare `Boolean`, so the document cache invalidates nothing unless the call site passes `additionalTypenames`.
- Gated at **100% coverage and 100% mutation score**, like the backend services, plus `yarn lint:check`, `tsc --noEmit` and Qodana, all five in `.githooks/pre-push` (and all but mutation in `.githooks/pre-commit`). Each repo has its own qodana.cloud project (`marketplace-admin` is `1rylx`) and its own token — tokens are per project, so a backend service's token would file this repo's reports under that service and corrupt its baseline.

`marketplace-shopowner` is a **mirror of the operator app**: same stack, same conventions, same
hooks, dev port **3044**, pointed at the four services *without* `admin` in the name (4028 / 4029 / 4026 / 4030).
It is deliberately thinner, because the tier behind it is — though less so since the catalogue landed:
`marketplace-dev-authenticated-resource` now exposes `shopOwnerCompanies`, `companyItems`, `itemCategories`
and six mutations (`company*` plus `itemAdd` / `itemUpdate` / `itemDel`). The operator app's profile,
password-change, personal-data, statistics and paginated-table screens still have no counterpart and were
pruned rather than stubbed.

Three things there are **not** copies of the operator app and must not be "corrected" back: `companyAdd` answers
`OnlyIdType` rather than `Boolean`; `GraphQLInputCompanyPosition` requires `type: String!` on the ShopOwner tier
and forbids it on the Admin one, which stamps `'Point'` server-side; and password recovery *is* available to
`ShopOwner` (`resetPwdFlow` binds that model), it simply has no screens yet.

### marketplace-user (TanStack Start, SSR)

The customer app, and **the only server-rendered thing on the platform**. TanStack Start (Vite 8 + React 19
+ TanStack Router SSR) · urql · graphql-codegen `client-preset` · react-hook-form + zod · Tailwind 4 ·
MapLibre GL 6 + Protomaps PMTiles as a dynamically-imported island · Sentry. Its `CLAUDE.md` carries the
long list of traps; the four that matter from out here:

- **Public routes are SSR, `/account/*` is `ssr: false`, and that pairing is a security boundary.** Rendering authenticated HTML on a server behind a shared `proxy_cache` is how one customer's data reaches another. The cache bypasses on the session cookie and the account routes never render server-side — two halves of one mechanism, and weakening either alone is enough to leak.
- **The SSR server talks to public-resource directly** over `PUBLIC_RESOURCE_URL` (deliberately *not* `VITE_`-prefixed, because that would inline a loopback address into the client bundle), building **a new urql client per request** — a shared one would serve one visitor's cached response to the next.
- **`yarn start` runs `serve.mjs`, not the build output.** `vite build` emits `dist/server/server.js`, a `{ fetch }` handler with no listener; `.output/` belongs to the Nitro preset, which is not installed. nginx serves `dist/client`, the Node process serves SSR only.
- **Route files are one-line `createFileRoute(id)(options)` calls**, with the behaviour in `src/routeOptions/` as router-free constants so loaders, `head` and `validateSearch` are testable without mounting a router. Measured cost, accepted: the framework's splitter reads literal properties and cannot see into an imported identifier, so no route is split out of the entry chunk. The one chunk worth splitting — MapLibre, ~950 KB — is split anyway by the island's dynamic import.

⚠️ **The "skip all tests" instruction was revoked on 2026-08-06, and every frontend now carries a suite.** It had
left `marketplace-shopowner` and `marketplace-user` with a harness and no `test/` directory at all, coverage gates
reporting 0% and every commit needing `--no-verify`. All three are now where the backend has always been —
**100% on all four coverage metrics and a 100 mutation score**, each verified by a full local run:

| App | Test files | Tests | Mutants killed / timed out / survived |
|---|---|---|---|
| `marketplace-admin` | 49 | 729 | 1783 / 6 / 0 |
| `marketplace-shopowner` | 38 | 497 | 1083 / 5 / 0 |
| `marketplace-user` | 66 | 1165 | 2028 / 6 / 0 |
| `services-status` | 7 | 379 | 1102 / 1 / 0 |

`services-status` came with them, and it is the odd one out in three ways worth knowing before editing it: it
is tracked by **this parent repo** rather than being a repo of its own, it has **no `lint` script** (it is not
one of the thirteen eslint/prettier repos — `npx tsc --noEmit` is its type gate), and it had neither a mutation
gate nor a `stryker.config.mjs` until 2026-08-07.

Reaching 100 on it took **changing the code, never a threshold**: eight guards across `server.ts` and
`systemd.ts` turned out to be conditions no input could falsify (`typeof value === 'string'` in front of a
`Set#has`, a `.toLowerCase()` the WHATWG URL parser had already applied, `mainPidRaw !== null` in front of
`> 0`), and each was deleted with the argument recorded at the site. Three genuinely equivalent mutants were
silenced with `// Stryker disable <Mutator>` and a reason — never `ignoreStatic`. ⚠️ **A `disable next-line`
directive must be the *leading* comment of the mutant's own line**: written as the last line of a multi-line
comment it lands on the wrong line, and placed inside a `try` it never reaches the `catch` at all — use the
`disable` … `restore` range form there.

The rule that outlived the instruction: **do not lower a threshold or remove a gate.** It now has teeth
everywhere, so a commit that needs one lowered is a commit that needs a test.

## Commands

Node **v24.18.0** via nvm, **yarn** everywhere. `marketplace-db-setup` was the last npm holdout and was converted (`package-lock.json` → `yarn.lock`).

⚠️ **`packageManager` is *not* pinned everywhere, and this file claimed it was.** Six of the fourteen repos with a `package.json` carry the `yarn@1.22.22+sha512.…` field — `marketplace-db-setup`, the two `*-user-authenticated-*` services, and the three frontends. The other eight — `marketplace-common` and the seven original backend services — have no `packageManager` key at all. Check before quoting it as an invariant: the field is what Corepack reads, so on a machine with Corepack enabled the eight unpinned repos resolve to whatever yarn is on `PATH`. Add the field when touching one of them, in the same spelling as the six that have it.

```bash
# any backend service (cd into it)
yarn dev            # tsc && tsx watch src/index.mts
yarn build          # yarn clean && tsc && tsc-alias
yarn start          # node dist/index.mjs
./dev.sh            # nvm + tmpfs-backed node_modules + yarn dev

# marketplace-common
yarn build          # ESM only — build:all / prepare:all are BROKEN (missing tsconfig.cjs.json)
./deploy-local.sh   # build, then sync dist/ + package.json into every consumer's node_modules
yarn test           # unit          yarn test:cov
yarn test:contract  # verifies package.json exports map
yarn test:int  yarn test:types  yarn test:mutation  yarn test:all

# marketplace-db-setup
yarn migrate:status | migrate:up | migrate:down | migrate:create <name>
yarn test  test:cov  test:mutation   # gated at 100 / 100 — 5 suites, real Mongo
yarn test:seed      # same suites with SEED_DEMO=true (2 tests are skipped without it)

# marketplace-admin (React — the operator app; shopowner is the same on 3044)
yarn dev            # vite on http://127.0.0.1:3043, GraphQL paths proxied to 4024/4025/4028/4030
yarn codegen        # regenerate src/gql/ from schema/*.graphql
yarn build          # codegen && tsc --noEmit && vite build
yarn lint           # eslint --fix + prettier --write   (lint:check for CI)
yarn test  test:cov  test:mutation   # gated at 100 / 100

# marketplace-user (TanStack Start — the customer app)
yarn dev            # vite on http://127.0.0.1:3045, proxied to 4027/4028/4030/4031/4032
yarn build          # codegen && tsc --noEmit && vite build  → dist/client + dist/server
yarn start          # node serve.mjs — SSR only, requires PORT, no default, binds loopback
```

`dev.sh` bind-mounts `node_modules` onto a tmpfs ramdisk (`/var/ram/<pkg>/node_modules`) and needs a sudoers entry. It **wipes `node_modules` first** — do not run it if you have local patches there.

## Conventions and traps

- **Indentation: tabs.** Enforced by eslint (`indent: ['error','tab']`) **and now by prettier too**: `"useTabs": true` was present only in `marketplace-admin`, so in the other eight prettier reindented with spaces exactly what eslint demanded back as tabs and whichever ran last won — which is why nobody could safely run both. The thirteen `.prettierrc` files are byte-identical (no semicolons, single quotes, `"trailingComma": "none"`, `printWidth: 129`, `proseWrap: "never"`, `useTabs: true`) and so are the thirteen `.prettierignore` files bar the per-repo lines — `marketplace-user` adds `src/routeTree.gen.ts`, which its build generates. Keep it that way: it used to differ per repo, and a snippet moved between two of them failed `yarn lint` on the commas alone. `marketplace-db-setup` still has neither prettier nor eslint, deliberately — its content is applied migrations, and those are immutable.
- **`lint` formats, `lint:check` verifies, both over the whole tree.** `eslint --fix . && prettier --write .` and `eslint . && prettier --check .`, identical in all thirteen. The scope is the point: `lint` used to be eslint-only in five repos and `prettier --write 'src/**/*.mts'` in the rest, so **test files, configs and yaml were never formatted at all** and drifted for as long as that was true — 111 files came back changed the first time it ran wide. Anything genuinely out of scope belongs in `.prettierignore`, not in a narrower glob. Markdown is ignored on purpose: `proseWrap: "never"` flattens every hand-wrapped paragraph in these docs onto one line. **`lint:check` is the first gate of both `.githooks/pre-commit` and `.githooks/pre-push` in all thirteen**, blocking like the others — it was the one tool here whose verdict nothing enforced, and `eslint.config.js`, `.prettierrc` and `.prettierignore` were simultaneously missing from the backend `RELEVANT_PATHS`, so the commits that widened the eslint `ignores` block ran no gate at all. All three are in the filter now: the lint gate reads them, and an edit there changes the verdict for every file in the tree without appearing in any of them.
- **A path that matches no `files` glob is linted by nothing, and eslint reports that as success.** Not as "no config found" — it checks zero rules and exits 0, so the gate is green and the file is unread. `@axiumine/eslint-config-be` scopes everything to `src/**`, which left two holes that stood for as long as nobody printed a config: the root-level `eslint.config.js` and `stryker.config.mjs` in the backend repos (the shared JS block is `src/**/*.{js,cjs,mjs}`, and no repo here has JS under `src/`), and **every test file and vitest config in `marketplace-common`**, where `eslint --print-config test/cibimodels.test.mts` printed `undefined` — the services had a `test/**/*.mts` block and the library never got one. Both are closed: each backend repo carries a `files: ['*.js','*.mjs','*.cjs']` block, common also carries the test block, and the nine services' `eslint.config.js` are byte-identical. Fixing it surfaced three real errors in common's tests, invisible until then. The three frontends never had either hole — every block there is scoped by construction. **When adding a block, check it resolves**: `npx eslint --print-config <file>` should report ~400 rules, not `undefined`. `*.js` in flat config means the config file's own directory only, never `**/*.js` — that scoping is what keeps a root-JS block off the minified Qodana report, which is how marketplace-admin once produced 1601 `no-undef` errors.
- **`engines.node` is `^24.18.0` in every repo that has a `package.json`** — fourteen of them; the parent workspace has none. Unified, and worth keeping that way. It used to be spelled four different ways (`^24.14.0`, `^24.14`, `24.14`, `24.14.0`) with two repos omitting the block entirely, and the two spellings without a caret are *not* "24.14 or newer": semver reads `24.14` as `24.14.x` and bare `24.14.0` as that one release. Three services therefore rejected Node 24.18.0 outright while the others installed fine. **`engines` is a hard gate under yarn classic** — a mismatch exits 1 with `The engine "node" is incompatible with this module`, it is not a warning. When bumping Node, bump all fourteen in one sweep and keep the caret.
- **marketplace-common has no barrel export.** Consumers import per subpath, and every file needs its own entry in the package.json `exports` map (~38 entries) or it is unreachable. `yarn test:contract` catches omissions.
- **All nine services run vitest**, same two-project layout everywhere: `unit` (`test/*.test.mts`, Redis mocked, `REDIS_KEY=test:`) and `integration` (`test/integration/*.itest.mts`, `PORT=0`, `fileParallelism: false`, 30 s timeouts, and the **real** Redis cluster + MongoDB from `.env` under the isolated `REDIS_KEY=marketplaceDev:itest:` namespace). Scripts: `yarn test` · `test:unit` · `test:integration` · `test:cov`. Coverage is gated at **100% on every metric** in all nine, four times over — `thresholds` in `vitest.config.mts`, `testCoverageThresholds` in `qodana.yaml`, and a `yarn test:cov` step in both `.githooks/pre-commit` and `.githooks/pre-push`. The `qodana.yaml` line was inert in the services until the Qodana scan was wired into those two hooks: the file has always declared the threshold, but nothing local ever ran the linter, so the only scans that existed were manual. **Never lower a threshold**; add the missing test. `marketplace-dev-authenticated-logout` carries a `COVERAGE.md` explaining the pattern. Outside `dev/`, coverage lives in marketplace-common (vitest + stryker) and marketplace-db-setup (vitest + stryker against a real Mongo — it ran on the built-in `node:test` runner once, and this line said so long after that stopped being true; the assertions never moved off `node:assert/strict`, which is what made the drift easy to miss). db-setup is gated at 100% on every metric too, and that is newer than it looks: the migration replay alone left branches no database state could reach, and the two unit suites that close them (`test/migrateMongoConfig.test.mjs`, `test/migrationGuards.test.mjs`) are what let the threshold go in. ⚠️ v8 coverage only reports files it saw **loaded** — a file no suite requires is absent from the report rather than listed at 0%, so a 100% threshold passes vacuously over it. Check the file list, not just the percentages.
- **Mutation testing is gated too, at 100, in all nine services, in `marketplace-common`, in `marketplace-db-setup`, in the three frontends and in `services-status`.** Stryker (`stryker.config.mjs`, `thresholds.break: 100`) runs as the second step of every `.githooks/pre-push`, after coverage. Coverage asks whether a line *ran*; mutation asks whether a test would have *failed* had that line been wrong — and the two answers diverge badly. Every package here sat at 100% coverage while mutants survived; `marketplace-common` scored 45.95% and `marketplace-db-setup` 52.92%. See `README.md` for the gate layers and `marketplace-common/CLAUDE.md` for the catalogue of assertions that pass while the code is wrong. **Do not add `ignoreStatic`** to a Stryker config to silence a survivor — it masks real gaps, and the survivor it appears to fix is usually a load-time mutant that needs a dynamic `await import()` inside `beforeEach` instead.
- ⚠️ **A top-level `const` is evaluated once per process, and that is the single trap behind most surviving mutants here.** Stryker switches the active mutant **per test**, so any module loaded before the switch hands every test the *unmutated* value however thoroughly it is asserted — 54 of `marketplace-db-setup`'s 62 survivors were exactly this, the const bodies in `lib/schemas/` one for one, while the shapes built inside a *function* body were killed on the first run because those re-execute per call. The fix is to evict the module from the loader cache **inside** the test so the const re-evaluates under the active mutant: `test/migrationCalls.test.mjs` does it with an `evictLib()` over `require.cache`, and the ESM equivalent is a dynamic `await import()` in `beforeEach`. The same insight explains two adjacent rules — a dead literal is a **permanent** survivor no test can ever kill, so a survivor in an exported-but-unimported const means the code is orphaned and the fix is to delete it (that is how `COORDINATE_DECIMAL` was found); and an equivalent mutant is silenced with `// Stryker disable <Mutator>` plus a reason, never with `ignoreStatic` and never by lowering `thresholds.break`.
- **Every repo's integration suite owns its own MongoDB database, and three variables have to name it.** `MONGO_TEST_DB`, `MONGO_TEST_AUTH_ADMIN` and the database path of `MONGO_TEST_CONN_STRING` must all carry the same string, and that string must be **unique to the repo** — each `globalSetup` drops its own database, so a shared name means one suite wiping another's data mid-run. `vitest.mongo.mts` enforces the agreement (`assertTestMongoDbNames`) and refuses to build a URL otherwise; it used to rebuild the path from `MONGO_TEST_DB` silently, which turned a mismatch into a working URL pointed at a database the connection string never named. Because the authSource *is* the test database, the two `MONGO_TEST_*` users must exist in every one of them — provision with the loop in `marketplace-db-setup/setup/mongodb.js`. Dropping a database does not delete them; MongoDB keeps all users in `admin.system.users`. Current names: `dbMarketplaceTest` (db-setup), `…Common`, `…PublicAuthz`, `…PublicRes`, `…ImprAuthz`, `…ImprRes`, `…AdminAuthz`, `…AdminRes`, `…UserAuthz`, `…UserRes`; `marketplace-dev-authenticated-logout` has no block because its suite never touches Mongo. The `Impr*` pair keeps the pre-rename abbreviation of *imprenditore* — it is a database name, not an identifier, and renaming it would mean re-provisioning its two users.
- **Integration tests run against real infrastructure** and must clean up after themselves. The convention: seed through the **raw driver** (`mongoose.connection.db!.collection(…)`), not the Mongoose model — several models disagree with their collection's `$jsonSchema` (`ShopOwner` declares `personalData.birth.date` and no `contacts`, the validator wants `birth.date` plus `contacts`) — push every `_id` and every Redis key into a module-level array **at creation time**, and drain both in `afterAll`. Registering the key at creation rather than relying on a per-test `finally` matters: a seed that throws before its `try` block leaks the session key. Watch the unique indexes when seeding (`shopOwner.login.email`, `user.login.email`, `company.vatNumber`, `company.certifiedEmail`, `company.slug`, `item.{idCompany,slug}` **and** `itemCategory.slug`) — a fixed literal collides on the second seed of the same run. Redis is a **cluster**, so delete one key per `del` call; a multi-key `del` throws CROSSSLOT.
- **Migrations are immutable; they are no longer self-contained.** Never edit an applied migration — add a new one. But the `$jsonSchema` shapes themselves live in `marketplace-db-setup/lib/schemas/` (renamed from `lib/schemi/` in the same sweep), shared by every migration that restates them: 13 identical product validators and 5 restatements of the shop collection were about 3 500 of 5 100 lines, and no edit inside `migrations/` could clear the resulting `DuplicatedCode` findings. The food-product and shop builders are gone with their collections; `lib/schemas/` now holds `account.js`, `collection.js`, `geo.js`, `shopOwner.js`, `company.js`, `user.js`, `item.js`, `itemCategory.js` and its `README.md`. The rule stands, and a new product type gets a builder there rather than an inline validator. The old "inline everything" rule assumed a database that cannot be rebuilt, and there is none here — one `Dev` plus a throwaway test DB, both replayable. **The replacement rule: a change under `lib/schemas/` is followed by a full rebuild of every database that has run these migrations, in the same piece of work.** Each builder carries *every* historical shape of its collection, so deleting an unused branch breaks some older migration's `down`. Read `lib/schemas/README.md` before editing it. ⚠️ The 2026-08-04 English rename went further than this rule allows and rewrote the applied migrations themselves, on the user's explicit instruction — see *Data model*. That was a one-off, and it was paid for with the same full rebuild.
- **`.orig` files are merge leftovers**, not sources — three survive: `yarn.lock.orig` in the two `*-resource` services under `dev/`, and `marketplace-dev-public-resource/src/index.ts.orig`. Ignore them; do not sync edits into them.
- Cross-service shell scripts are near-duplicates — `prod-build-local.sh` is byte-identical across all nine. A fix to one usually belongs in all nine.
- **Never read, echo, copy or commit a secret-bearing file.** That means `.env`, `.env.*`, `.npmrc`,
  `.yarnrc`, `.netrc`, `*.pem`, ssh keys — not just `.env`. `env` and `npmrc` (no leading dot) are the
  committed placeholder templates and are safe to read. Anything printed to a terminal here is sent to
  the model API **and** written in plaintext to `~/.claude/projects/<slug>/*.jsonl`, so `cat .env` leaks
  permanently and cannot be un-sent. To inspect a secret file, print **key names only**:
  `grep -oE '^[A-Za-z_0-9]+' .env`. Metadata (`ls`, `stat`, `wc -l`, `md5sum`, `git check-ignore`) is fine.
  Protected values include `KEYGRIP_KEY_1/2`, `REDIS_PASSWORD`, `INTROSPECTION_CODE`, `DSN`,
  `MONGODB_URI`, `QODANA_TOKEN`, `SOCKETLABS_SERVER_ID`, `SOCKETLABS_SERVER_APIKEY` and any npm token.
- This is **enforced**, not just documented — see `.claude/SECRETS.md` for the three layers
  (`permissions.deny`, the `no-secret-leak` PreToolUse hook, and a `pre-commit` guard in every repo).
- **Never commit on `main`. Ever.** Before the first edit of any task, create a branch — `git switch -c <type>/<slug>` — and commit there. Merging into `main` is the user's decision alone: do not merge, fast-forward, squash or rebase onto `main` unless the user says so in that message — **`marketplace-common` is the one exception, see the next bullet.** Being on `main` is not permission to commit to it; being asked to "commit and push" means commit the branch and push the branch. This holds in all fifteen repos here — the fourteen sub-repos and this parent — and in `@axiumine/koa-utils` (`/media/nvme/Dev/pacchetti/koa-utils/koa-utils`), which is a sixteenth outside this workspace. The reason it needs stating: `main` exists in twelve of the fifteen and is the checked-out branch wherever the tree is clean, so a bare `git commit` silently lands on it when no branch was made first. It does **not** track an `origin/main` here — none of these repos has a remote at all — so nothing downstream will catch the mistake for you.
- **`marketplace-common` is the only repo that may be committed, merged, pushed and published without asking. Every other repo is push-on-request, always.** Standing permission, granted by the user and not expiring at the end of a session: in `marketplace-common` go through the whole branch → commit → merge → `git push` → `npm publish` loop whenever the work needs it, without stopping to ask at any step. Everywhere else — the other thirteen repos, this parent workspace, and `@axiumine/koa-utils` — **never run `git push` unless the user asked for it in that message.** "The branch is ready", "the gates are green" and "the hook would run it anyway" are not permission; neither is having pushed that repo an hour ago. Branch-first still holds in `marketplace-common` too: the exception is about who decides to merge and push, not about committing straight onto `main`. Two things to keep in mind while using it. **`npm publish` is a one-way door** — a version number cannot be reused once published, and the 72-hour unpublish window is not a plan — so the bump is the point of no return, not the push. And a publish is only half the change: nine services consume the package, so a bump nobody installed changes nothing, and bumping them is a separate commit in each of their repos, which is *not* covered by this permission. ⚠️ **Until the package is actually published, `./deploy-local.sh` is what makes an edit visible** — run it after every change to common, or the consumers keep compiling against the previous build. The reason the asymmetry exists: `marketplace-common` is consumed by package name rather than a path link, so an edit there is dead weight until it is deployed — asking for permission mid-loop strands the consumers on a version that does not exist, while a stray push anywhere else puts code on a remote the user had not decided to change yet.
- **Delete the local branch the moment it is merged.** `git branch -d <slug>`, in the same breath as the merge — not "later", not at the top of the next task. Use `-d` and **never `-D`**: `-d` refuses a branch whose commits are not already reachable from where you stand, so the safe case succeeds quietly and the unsafe one stops you before the work is unreachable. Nothing here does it for you — every repo merges locally and pushes the result, so no forge-side "delete branch on merge" ever fires and a merged branch simply stays forever. **Fourteen** had piled up across the older eleven repos before this rule was written — `chore/qodana-severity-gate` alone survived in eight of them, which is what a rule-less polyrepo looks like: the same dead branch, eight times, because deleting it was eight separate commands nobody ran. The cost is not disk: `git branch` is the only place in-flight work is visible in a polyrepo, so every merged leftover reads as unfinished when it is not, and the one branch that *is* still live gets lost among them. If the branch was also pushed, `git push origin --delete <slug>` — and only if the user asked for that push to begin with.
- **Qodana runs in `pre-commit` *and* in `pre-push`, in all fourteen sub-repos.** `marketplace-db-setup` was the last one unwired — it carried both `qodana.yaml` and `qodana.sh` while no hook called either, and `qodana.sh` could not have run anyway because the repo had no `QODANA_TOKEN`. The token exists now, so both hooks invoke it like everywhere else — and since 2026-08-07 they invoke it *last*, behind the same coverage gate as everywhere else: that repo's `qodana.yaml` grew `testCoverageThresholds`, its `pre-commit` gates `yarn test:cov` before scanning and its `pre-push` runs `test:cov` → `test:mutation` → Qodana, so both scans pass `SKIP_TESTS=1` like the other thirteen. The one difference left is lint, which db-setup still has no config for. Not redundant, for two reasons pre-commit structurally cannot cover. First, **`git merge --no-ff` never fires `pre-commit`** — git runs that hook for `git commit` only — so in the branch → commit → merge → push flow the merge commit, the one revision that actually reaches `origin`, is the single commit no pre-commit scan ever sees; two individually clean branches can merge into a tree that is not. Second, **Qodana Cloud files every report under the branch it was produced on** and the CLI has no `--branch` flag (it reads git HEAD), while pre-commit always runs on the feature branch *before* the commit exists — so a repo gated only there can never produce a `main`-tagged report, `main` is not offered as the cloud project's default branch, and the "new problems" baseline has nothing stable to compare against. pre-push runs after the merge, standing on `main`. In all fourteen, both scans pass `SKIP_TESTS=1` so `qodana.sh` reuses the `coverage/lcov.info` the preceding gate just wrote instead of regenerating it with `yarn test:cov || true`, which swallows the exit code. Bypass with `SKIP_QODANA=1` (coverage and mutation still gate). A missing prerequisite — docker, the `qodana` CLI, the linter image named in `qodana.yaml`, `QODANA_TOKEN` — **blocks and prints the fixing command**; it never warns and continues.
- ⚠️ **The hooks are enabled by `core.hooksPath`, which is local config and travels with nothing.** Every repo commits `.githooks/`, executable and at mode `100755`, and every one of them had **never fired a single time**: git reads `.git/hooks/` unless `core.hooksPath` says otherwise, and no repo had it set. The paragraphs above described a gate that was not running. It is set in all fifteen now (`git config core.hooksPath .githooks`), verified with `git hook run pre-commit`. Two things keep it from silently reverting, and one hole neither closes. The fourteen sub-repos each carry `"prepare": "git config core.hooksPath .githooks || true"` in `package.json`, so `yarn install` — which `dev.sh` runs — restores it by itself. **The parent workspace has no `package.json`, so it has no such mechanism**: after a fresh clone of this dir, run the `git config` line by hand or the secret guard is off. And a relative value is safe — git 2.47.3 resolves it against the worktree root, not the cwd, so the hooks fire from a subdirectory too (checked from `src/models`).
- Use `git`. Each package commits independently; a cross-cutting change means N separate commits — and now N separate pushes, since every repo has its own `origin` (see *Repo layout*). Pushing a service or `marketplace-common` runs a `.githooks/pre-push` hook that enforces lint, the 100% coverage gate, mutation and Qodana in that order. Check the hook is **executable** — git skips a non-executable hook with only a hint, so the gate vanishes silently; `marketplace-dev-public-authorization` shipped that way until it was caught. **Every `pre-push` selects the pinned node first**, reading `engines.node` from that repo's `package.json` and switching via nvm — the gates shell out to yarn, and yarn's `engines` check is a hard exit 1, so without it a push from a shell on the machine default node dies before the first gate *under that gate's banner*, which is how a node mismatch first read as a type error. If nvm is missing or the version is not installed, the hook blocks with the `nvm install` line instead. Not a warning layer: it is the reason `git push` works from any shell here.

# GitNexus — Code Intelligence

**Polyrepo setup: 14 independent indexes, not one.** The parent dir is a git repo but its `.gitignore`
excludes `/BEs/`, `/marketplace-admin/`, `/marketplace-shopowner/` and `/marketplace-user/`, so indexing *here* sees only workspace docs. Each sub-repo
is indexed on its own and tied together by the group **`marketplace-platform`**.

⚠️ **The parent's registry name is `fullstack-marketplace-blueprint`, not `marketplace`.** GitNexus names
an index after the directory, and this directory was renamed — so the entry follows the folder, not the
product. It covers **this parent dir only** — its own docs and skill files, and it grows as they do. It
is **not** the platform index and never will be, because the `.gitignore` above hides every sub-repo
from it. Keep it current so the staleness hook stays quiet, but never query it expecting application code
— none of it is in there.

⚠️ **`pizzati*` entries in the registry are a different workspace.** `list_repos` still returns `pizzati`,
`pizzati-admin`, `pizzati-common`, `pizzati-db-setup` and six `pizzati-dev-*`, all rooted at
`/media/nvme/websites/pizzati` — the pre-rebrand original, which still exists on disk and is still
indexed. They are near-identical in shape to the ones below and will happily answer a query. **Always pass
a `marketplace*` registry name**; a `pizzati*` answer is about the other tree and predates both the
catalogue deletion and the customer tier.

| Group path | Registry name (`repo:` param) |
|---|---|
| `lib/common` | `marketplace-common` |
| `lib/db-setup` | `marketplace-db-setup` |
| `be/public/authorization` | `marketplace-dev-public-authorization` |
| `be/public/resource` | `marketplace-dev-public-resource` |
| `be/shopOwner/authorization` | `marketplace-dev-authenticated-authorization` |
| `be/shopOwner/resource` | `marketplace-dev-authenticated-resource` |
| `be/shopOwner/logout` | `marketplace-dev-authenticated-logout` |
| `be/admin/authorization` | `marketplace-dev-admin-authenticated-authorization` |
| `be/admin/resource` | `marketplace-dev-admin-authenticated-resource` |
| `be/user/authorization` | `marketplace-dev-user-authenticated-authorization` |
| `be/user/resource` | `marketplace-dev-user-authenticated-resource` |
| `fe/admin` | `marketplace-admin` |
| `fe/shopOwner` | `marketplace-shopowner` |
| `fe/user` | `marketplace-user` |

**`repo:` is mandatory on every MCP call** — the single-repo default no longer applies. Use the registry
name, not the group path: `impact({target: 'loginAdmin', repo: 'marketplace-dev-public-authorization'})`.

Cross-repo impact/search is **CLI only** — no MCP tool exists for it:

```bash
gitnexus group impact marketplace-platform --target <sym> --repo be/admin/resource --direction downstream
gitnexus group query  marketplace-platform "onboarding shopOwner"
```

Here `--repo` takes the **group path**, unlike the MCP tools above.

## ⚠️ HTTP contract extraction does not work on this platform

`group sync` yields **0 cross-links**. Verified empirically, not assumed. The 9 services mount Apollo via
`if (ctx.path === ENDPOINT)` inline dispatch, and GitNexus's extractor only recognises `router.get(...)` /
`app.post(...)` / NestJS decorators. Compounding: `.mts`/`.mjs` are absent from its extension registry, and
the tool has no GraphQL model at all.

Re-verified 2026-08-05 across all 14 repos: **6 contracts, 0 cross-links**. The registry is three
providers and three consumers and they are disjoint sets. The providers are the three `@koa/router`
routes in `be/public/resource` — `GET /`, `GET /verify-email/{param}/{param}`,
`GET /verify-email-user/{param}/{param}` — and the consumers are each frontend's `searchAddresses` in
`src/lib/nominatim.ts` calling the external geocoding API (`GET /{param}` from `fe/admin` and
`fe/shopOwner`, `GET /{param}/search` from `fe/user`), which can never match a provider in this group.
Adding a whole SSR frontend that talks to `be/public/resource` on every request changed nothing, because
that traffic is GraphQL over `fetch` and the extractor cannot see it.

Consequence: **do not reach for `route_map`, contract cross-links, or `group impact` across the HTTP
boundary — they return nothing.** This is a detector gap, not a config problem; manual `links:` entries in
`group.yaml` cannot help, because no contract object exists to link. Symbol-level tools (`query`,
`context`, `impact`, `detect_changes`) work normally within each repo and are where the value is.

## Maintenance

```bash
cd <changed-repo> && gitnexus analyze          # incremental; re-run per repo after commits
gitnexus group sync marketplace-platform           # after a marketplace-common deploy or resolver/schema changes
gitnexus group status marketplace-platform         # staleness across all 14
```

Adding a repo to the group is `gitnexus group add marketplace-platform <groupPath> <registryName>` — it is
not automatic, and a repo indexed but not added answers single-repo queries while being invisible to every
`group` command.

### `.gitnexusrc` — committed per repo, no flags to remember

`analyze` rewrites `AGENTS.md` / `CLAUDE.md` on every run, and the generated header carries live symbol
and relationship counts. Those counts change whenever anything is edited, so the files came back dirty
after every index and got swept into unrelated commits. Every repo now commits a `.gitnexusrc` at its
root (JSON only, read from the repo root — **not** from `.gitnexus/`, which is gitignored index storage)
so the fix survives without passing flags by hand.

|Where|`.gitnexusrc`|Effect|
|---|---|---|
|the 14 indexed sub-repos|`{"analyze": {"noStats": true}}`|generated block keeps its guidance, drops the volatile counts — byte-identical across runs|
|this parent dir|`{"analyze": {"skipContextFiles": true}}`|no block written at all, so the hand-written GitNexus section above is never appended over|

`skipContextFiles` suppresses only the `AGENTS.md` / `CLAUDE.md` block — the index is still built and the
skill files are still written. CLI flags override the file (`--no-stats`, `--skip-agents-md` are the
equivalents), and the loader fails closed: an unknown key or a wrong value type aborts before analysis
rather than silently no-opping.

Both settings are verified idempotent — a second `analyze` leaves the files byte-identical.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

`{name}` = a registry name from the table above (e.g. `marketplace-dev-authenticated-resource`) — **never
`fullstack-marketplace-blueprint`**, which is the docs-only parent stub, and never a `pizzati*` name.

| Resource | Use for |
|---|---|
| `gitnexus://repo/{name}/context` | Codebase overview, check index freshness |
| `gitnexus://repo/{name}/clusters` | All functional areas |
| `gitnexus://repo/{name}/processes` | All execution flows |
| `gitnexus://repo/{name}/process/{process}` | Step-by-step execution trace |
| `gitnexus://group/marketplace-platform/status` | Staleness across all 14 repos |
| `gitnexus://group/marketplace-platform/contracts` | Contract registry (currently near-empty — see above) |

## CLI

| Task | Read this skill file |
|---|---|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |
