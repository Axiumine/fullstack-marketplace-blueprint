# Marketplace

Multi-tenant marketplace. Customers order from many independent shops; each shop is run by its owner; the platform vendor (thedoctorweb) operates it.

⚠️ **It is not a pizza platform, and there is no longer a catalogue at all.** The pizza framing came from the old collection names, and on 2026-08-04 those names were deleted outright: 13 food collections plus `costiConsegna` went, with every migration, mongoose model, `Cibo` base shape, resolver and test that served them (see *Data model*). What is left is the multi-tenant skeleton — operators, shop owners, companies, shops, categories — and it is domain-neutral. **Do not reintroduce food vocabulary when adding a product type**; nothing in the surviving code presumes it.

The one exception, deliberately kept: `puntoVendita.opzPizze` and `opzPaninoteca` — per-shop flour options. They are the last dough-specific fields on the platform, they live on a collection that survived, and removing them was not part of the deletion. Treat them as legacy, not as evidence of what the product is.

**Work in progress.** The target product has four surfaces: public pages, customer area, shop-owner area, platform-operator area. Only part of that is built. Every section below marks **built** vs **planned** — do not assume a missing piece is an oversight, and do not describe the platform to the user as if the unbuilt parts exist.

**Language: all domain names, UI text, and comments are Italian. Keep them Italian — do not "translate" identifiers.**

## Target architecture

| Surface | Audience | Status |
|---|---|---|
| Public pages | anonymous | services built, no frontend |
| Customer area | end customer, places orders | **not started** — no collection, no service, no UI |
| Shop-owner area | `Imprenditore` | backend built, no frontend |
| Operator area | `Admin` | backend + `marketplace-admin` frontend built (React + Vite) |

The unbuilt pieces have a known shape, because the built tiers already establish the pattern (see *Terminology* and *Backend services*). Adding the customer tier means: a `utente` collection + migration → an auth tier (public-authorization already hosts `login`) → a `utente`-authenticated service pair → order/cart collections → a customer frontend. Order state, delivery flow, and payment have **no** existing model to copy — they are genuinely new design, so ask before inventing them.

## Terminology — read this first

The code does NOT use the words customer/admin/superadmin. Mapping:

| Business role | Code name | Where |
|---|---|---|
| Shop owner ("the admin") | `Imprenditore` | `imprenditore` collection, `authenticated-*` services |
| Platform operator ("the super admin", the developer) | `Admin` | `admin` collection, `admin-authenticated-*` services |
| End customer (places orders) | `Utente` (planned) | **not implemented** — no collection, no service, no UI |
| Shop / point of sale | `PuntoVendita` | `puntoVendita`, FK `idImprenditore` |
| Menu section | `Categoria` | `categoria`, FK `idPuntoVendita` |
| Product | — | **removed 2026-08-04** — no collection, no model, no resolver |

There is no `role` field and no permission enum anywhere, and this is deliberate — **role = which collection you authenticate against.** Each role gets its own service pair and its own Redis session namespace. Follow this when adding the customer tier: a new collection + a new service pair, *not* a role check bolted onto the existing ones.

Current build state: shop management only — no catalog either, since the product collections were deleted. **No order, cart, or customer collection exists** — a `utente` collection existed in the legacy mongosh scripts and was dropped during the migrate-mongo port (`migration/MongoDB/scripts/utente.js`). ⚠️ That history is **gone locally** — it lived only in `marketplace-db-setup`'s Mercurial history, which was discarded in the hg→git conversion, and this workspace has no git history at all (see *Repo layout*). To recover it, clone the old hg repo from `repo.tdweb.it`. The `img/` folder that held the customer mobile app design (screen layouts, product photos, button icons) has been **deleted** — it was never tracked by any repo, so there is no copy to restore.

## This directory is the parent workspace

**Work from here, not from inside a single repo.** This dir is the father of all Marketplace repos — it exists so the whole platform can be seen and changed at once, with a wide view. A task that looks local almost never is: a model change starts in `marketplace-common`, needs a migration in `marketplace-db-setup`, resolvers in one or more services, and queries in the frontend. Open the parent dir so all of it is reachable in one session.

Consequences to hold in mind:

- Trace a change end to end across repos before editing. Check who consumes the thing you are touching — services share `marketplace-common` by published version, so a breaking edit lands on all seven.
- One logical change = **N separate `git` commits**, one per affected repo. There is no atomic cross-repo commit. Land dependencies first (marketplace-common → publish → bump consumers), and say plainly which repos you touched.
- The repos drift. Shell scripts and service scaffolding are near-duplicates; a fix in one usually belongs in the other six.
- The parent dir is its **own git repo**, tracking only workspace files (`CLAUDE.md`, `.claude/`, `.agents/`). Its `.gitignore` excludes `/BEs/` and `/marketplace-admin/`, so the sub-repos nest without conflict.

## Repo layout

Polyrepo, **not** a monorepo. Ten independent **git** repos under this parent dir (which is itself an eleventh, tracking workspace files only).

⚠️ **All eleven repos are empty and remote-less. Verified 2026-08-04.** `git rev-list --count HEAD` returns nothing in every one of them — **zero commits anywhere** — and `git remote get-url origin` returns nothing either. This workspace is a rebranded *copy* of `/media/nvme/websites/pizzati`, made by renaming directories and sweeping identifiers; the copy carried the working trees but not the histories or the remotes.

Three consequences, all of which bite:

- **There is no rollback.** Nothing is committed, so `git checkout`, `git stash`, `git reset` and `git diff` have no baseline to work from. Every edit here is destructive. The 2026-08-04 catalogue deletion was carried out under exactly this condition, on the user's explicit instruction after the risk was stated.
- **`git status` shows the entire tree as untracked**, which makes it useless for reviewing a change. Diff against `/media/nvme/websites/pizzati` if you need to see what moved.
- **The `never commit on main` rule still applies** — it is about *where* a commit lands, and the first commit in each of these repos will create `main` if nothing else exists. Branch first, exactly as everywhere else.

The original workspace **is** on GitHub — private repos under the **`Pizzati-Org`** org, one per directory. Those remotes belong to the other tree. Nothing here points at them, and nothing here should be pushed to them: the catalogue deletion and the rename would land on the live project. Deciding where these eleven repos get published, and under which org, is the user's call and has not been made.

⚠️ **Note the npm/git split.** `@thedoctorweb_agency/marketplace-common` and `@axiumine/koa-utils` are *npm package* names and are unrelated to where the git repo lives. Renaming a git remote never implies renaming the package, and vice versa. ⚠️ The rename swept `package.json` and `yarn.lock` too, so the library now calls itself `@thedoctorweb_agency/marketplace-common` and the seven services depend on that name — **which is not published**. The installed `node_modules` copies were patched in place to match, so the current tree resolves, but a fresh `yarn install` will 404 until the package is published under the new name.

**Scan history for secrets before the first push of any new repo.** A filename check is not enough — `marketplace-db-setup` hid a live Mongo password in an *unquoted* `mongosh -password` flag, which slips past any quoted-value regex. Scan every blob in `git rev-list --all --objects`, not just the working tree. Purging with `git filter-repo` is free before the first push and expensive after — and with zero commits here, every one of these repos is still in the free window.

```
fullstack-marketplace-blueprint/
├── BEs/
│   ├── marketplace-common/    # shared npm lib — has its own CLAUDE.md, read it before editing
│   ├── marketplace-db-setup/  # MongoDB migrations — has its own CLAUDE.md, read it before editing
│   └── dev/                   # 7 backend services, one git repo each
└── marketplace-admin/         # React + Vite operator SPA (Admin tier)
```

`marketplace-common` is consumed as a **published npm package** (`@thedoctorweb_agency/marketplace-common`, `^1.x`, scoped registry via `.npmrc`) — not `file:`/`link:`. Editing it does not affect the services until published and re-installed.

## Backend services

Seven hand-rolled **Koa 3** servers, each mounting **Apollo Server 5** at one path via `@as-integrations/koa`. Entry always `src/index.mts`. ESM (`.mts` → `.mjs`), Node `^24.18.0`.

GraphQL is the whole API in six of the seven. The exception is `marketplace-dev-public-resource`, which also mounts a real `@koa/router` at `src/middleware/router/index.mts` with prefix `/check`, serving `GET /check/` (health) and `GET /check/verify-email/:email/:hash`. Those two are the only REST endpoints on the platform, and the only reason GitNexus's contract registry is not completely empty.

Split on two axes: **tier** (who) × **concern** (what).

| Service | Port | Tier | Concern |
|---|---|---|---|
| `marketplace-dev-public-authorization` | 4028 | public | login, `loginAdmin` |
| `marketplace-dev-public-resource` | 4027 | public | public catalog |
| `marketplace-dev-authenticated-authorization` | 4029 | Imprenditore | token lifecycle |
| `marketplace-dev-authenticated-resource` | 4026 | Imprenditore | domain data, uploads |
| `marketplace-dev-authenticated-logout` | 4030 | Imprenditore | logout |
| `marketplace-dev-admin-authenticated-authorization` | 4025 | Admin | token lifecycle |
| `marketplace-dev-admin-authenticated-resource` | 4024 | Admin | domain data |

⚠️ **Both columns above are less solid than they look.**

*Ports.* The table is now reproducible: `grep -m1 '^PORT=' <repo>/env` gives the same number for every service, and `marketplace-admin` is `3043`. That was not true before — all seven committed `env` templates carried the same copy-paste `PORT=4064`, a port none of them listens on, so the numbers here appeared nowhere else in the tree and could not be checked. The templates were corrected from each machine's real `.env`; the seven values are distinct and the table below was right all along. No `src/index.mts` supplies a default, so a service with neither `.env` nor `PORT` in the environment still fails to start — the template is the only place to read the intended value from, which is why it has to stay accurate.

*Binding.* They do **not** bind `127.0.0.1`. Each one calls `httpServer.listen({ port })` with no host, so Node binds the unspecified address (`::`, every interface). This was previously written as a `hostname:` key, which is **not** a `net.Server.listen` option — Node silently ignored the unknown key and bound wide anyway, so the `HOSTNAME` variable never had any effect. The dead key was removed rather than converted to `host:`, because the wildcard bind is what the integration suites depend on: all seven fetch `http://127.0.0.1:<port>`, so binding to the LAN address in the env template would have broken every one of them. The bind is now explicitly wildcard, with a comment at each call site saying so.

nginx does terminate TLS in front of the operator SPA on port `3043` — that was read off an nginx error log full of `upstream: "http://127.0.0.1:3043/"`, which sat untracked in the frontend repo and went with it when that repo was deleted, so the evidence is no longer on disk. What has not changed: **no nginx config exists anywhere in this workspace or on this machine** (there is no `/etc/nginx` and no nginx binary in `PATH`). The vhosts live on whatever host actually fronts the stack. Do not go looking for them here.

**authorization** = refresh-token cookie → Redis session → mints tokens. No business queries.
**resource** = `Authorization: Bearer access:<token>` header → Redis lookup → serves domain GraphQL. Only resource services carry `sharp`, `clamscan`, `file-type`, `graphql-upload`.

Put a new domain query/mutation in a **resource** service. Touch **authorization** only for the token lifecycle.

### Auth model

Opaque tokens + Redis sessions. **Not JWT**, despite a stale `JWT` type in `schema.graphql`.

- Refresh token: Koa signed cookie (Keygrip SHA-512, `KEYGRIP_KEY_1/2`), httpOnly.
- Access token: `Authorization: Bearer access:<token>` header, validated against Redis.
- `x-introspectioncode` header (`INTROSPECTION_CODE`) bypasses the token check for service-to-service calls. Treat as a secret; never log it, never expose it to a browser client.
- `checkUserAuthorizationDisDel` in marketplace-common gates on `deleted` / `disabled`. `imprenditore` also has `waitApprov` (manual approval gate) and `onboardingStep`/`onboardingDone`.
- Passwords: bcrypt via `@node-rs/bcrypt`, `SALT_ROUNDS=14`.

### Resolver layout (per resource service)

```
src/graphQLApi/schema/
├── queries.mts  mutations.mts     # roots
├── queries/  mutations/           # one file per operation: <entita>Add|Update|Del|Dis.mts
├── types/  GraphQLInput/  interfaces/  frag/
```

`mutations/cibi/` is gone — it held the per-food-type `*Add.mts`/`*Update.mts` pairs and went with the
catalogue. A new product type gets its own files directly under `mutations/`, following
`puntoVenditaAdd.mts` and `aziendaUpdate.mts`.

## Data model

MongoDB, **5 collections** — `admin`, `imprenditore`, `azienda`, `puntoVendita`, `categoria` — with strict `$jsonSchema` validators and `additionalProperties: false`. Ownership chain:

```
imprenditore ─┬─idImprenditore──> azienda
              └─idImprenditore──> puntoVendita ─┬─idAzienda──> azienda
                                                └─idPuntoVendita──> categoria
```

⚠️ **There is no product collection, and that is deliberate.** The platform used to carry 14 more —
13 food types (`pizza`, `bevanda`, `caffetteria`, `caramella`, `contorno`, `dolce`, `fritto`, `frutta`,
`gelato`, `insalata`, `paninoteca`, `piatto`, `snack`) plus `costiConsegna` — and all 14 were removed on
2026-08-04, together with their migrations, their mongoose models and shared `Cibo` base shapes in
marketplace-common, their `exports` entries, their resolvers in the three resource services and their
tests. What is left is the tenant skeleton: operators, shop owners, companies, shops and categories.
`categoria` survives and now has nothing hanging off it — a deliberate anchor point for whatever
catalogue gets built next. **This is the extension seam**: a new product type is a new collection plus a
migration plus a model plus resolvers, exactly as the 14 were, and nothing in the surviving code
presumes food.

⚠️ **The company is a reference named `puntoVendita.idAzienda`, not the embedded object it used to be.**
Migration `20260803000000-create-azienda` lifted that subdocument into a collection of its own, added
`idImprenditore` (required) plus the new `cf` and the `indirizzo` block, moved the `piva` and `pec`
unique indexes onto it, and **deleted every document in `puntoVendita`** — the `down` cannot bring
them back. `20260803000100` then renames the field itself, and `20260803142526` re-seeds the demo
company and shop.

⚠️ **`idAzienda` was `azienda` until 2026-08-04, and the two migrations were rewritten in place** —
the one time the immutability rule was set aside, on the user's explicit instruction, so the field
reads as if it had never been called anything else. Every database that had run them was rebuilt in
the same piece of work: `dbMarketplaceDev` dropped and replayed with `SEED_DEMO=true`, and each repo's
integration database is dropped by its own `globalSetup` anyway. The demo seed pins fixed `_id`s, so
`categoria` comes back pointing at the shop that was re-created — no dangling `idPuntoVendita` on dev.

**`azienda` carries an optional `deleted` (date), and `aziendaDel` stamps it instead of removing the
row.** `piva_unique` and `pec_unique` stay plain global uniques with no `partialFilterExpression`, so
a retired company keeps its partita IVA occupied — deliberate: one partita IVA is one company,
whoever registered it and whenever they stopped trading. The two tiers answer differently on a
company that is already retired, and both are correct: the Admin tier's `aziendaDel` says 200,
because the guard it uses does not filter `deleted`; the Imprenditore tier says 403, because
`throwIfImprenditoreDontOwnAzienda` does. Liveness filters belong on read paths and on
existence/ownership guards — never on the delete write itself.

One company owns N shops: an imprenditore may hold several `azienda` rows, and each `puntoVendita`
names exactly one of them. A shop therefore cannot be created before a company exists — which is the
order the operator SPA's detail page renders its sections in.

Adding a product type touches, in this order: model in marketplace-common → its `exports` entry (there
is no barrel, so an unlisted file is unreachable) → publish → migration in marketplace-db-setup, with
its `$jsonSchema` builder under `lib/schemi/` → resolvers in the resource services → schema slice and
codegen in `marketplace-admin`. `CibiModels.mts` and the `Cibo*` base shapes it exported are **gone** —
they were deleted with the 14 collections, so a new type starts from `PuntoVenditaModel` /
`CategoriaModel` as its reference, not from a surviving base class.

## Frontend — marketplace-admin (React, current)

Vite 8 + React 19 + TypeScript strict, SPA (no SSR). The **operator app**: `loginAdmin`, then manage
*imprenditori*. It has its own `CLAUDE.md`, `README.md` and `COVERAGE.md` — read them before editing.

TanStack Router (route tree in code, not generated) · urql + `cacheExchange` + `@urql/exchange-auth` ·
graphql-codegen `client-preset`, one project per access level · TanStack Table · react-hook-form + zod ·
Tailwind 4 · Sentry. Dev port `3043`.

Things that bite:

- **`schema/*.graphql` are hand-maintained slices, not the contract.** No service has an SDL file — all seven build their schema programmatically. The resolvers are the source of truth; the slices drift and must be re-checked before any operation is added or changed.
- **`preferGetMethod: false` is load-bearing.** Every service sets `csrfPrevention: true`, which rejects a GET carrying none of Apollo's preflight-forcing headers — and urql sends none. At the default, every query short enough to fit in a URL fails with a CSRF message while mutations work.
- **urql `context.url` objects must be module constants** (`CTX_*` in `src/api/endpoints.ts`). A `{ url }` literal in a component body is a new object per render, and urql re-executes on context change — an infinite refetch loop.
- Create/delete mutations answer a bare `Boolean`, so the document cache invalidates nothing unless the call site passes `additionalTypenames`.
- Gated at **100% coverage and 100% mutation score**, like the backend services, plus `yarn lint:check`, `tsc --noEmit` and Qodana, all five in `.githooks/pre-push` (and all but mutation in `.githooks/pre-commit`). Its `qodana.sh` was written last, after the other nine already had one: the repo carried a `qodana.yaml` that nothing invoked. It has its own qodana.cloud project (`1rylx`) and its own token, like each of the other nine — tokens are per project, so a backend service's token would file this repo's reports under that service and corrupt its baseline.

The shop-owner and customer frontends are separate apps not yet started — **this** is what they should be copied from, not a shell to add their routes into.

## Commands

Node **v24.18.0** via nvm, **yarn** everywhere. `marketplace-db-setup` was the last npm holdout and was converted (`package-lock.json` → `yarn.lock`); every repo now carries the same `packageManager: yarn@1.22.22` pin.

```bash
# any backend service (cd into it)
yarn dev            # tsc && tsx watch src/index.mts
yarn build          # yarn clean && tsc && tsc-alias
yarn start          # node dist/index.mjs
./dev.sh            # nvm + tmpfs-backed node_modules + yarn dev

# marketplace-common
yarn build          # ESM only — build:all / prepare:all are BROKEN (missing tsconfig.cjs.json)
yarn test           # unit          yarn test:cov
yarn test:contract  # verifies package.json exports map
yarn test:int  yarn test:types  yarn test:mutation  yarn test:all

# marketplace-db-setup
yarn migrate:status | migrate:up | migrate:down | migrate:create <name>

# marketplace-admin (React — the operator app)
yarn dev            # vite on http://127.0.0.1:3043, GraphQL paths proxied to 4024/4025/4028/4030
yarn codegen        # regenerate src/gql/ from schema/*.graphql
yarn build          # codegen && tsc --noEmit && vite build
yarn lint           # eslint --fix + prettier --write   (lint:check for CI)
yarn test  test:cov  test:mutation   # gated at 100 / 100
```

`dev.sh` bind-mounts `node_modules` onto a tmpfs ramdisk (`/var/ram/<pkg>/node_modules`) and needs a sudoers entry. It **wipes `node_modules` first** — do not run it if you have local patches there.

## Conventions and traps

- **Indentation: tabs.** Enforced by eslint (`indent: ['error','tab']`) **and now by prettier too**: `"useTabs": true` was present only in `marketplace-admin`, so in the other eight prettier reindented with spaces exactly what eslint demanded back as tabs and whichever ran last won — which is why nobody could safely run both. The nine `.prettierrc` files are byte-identical now (no semicolons, single quotes, `"trailingComma": "none"`, `printWidth: 129`, `proseWrap: "never"`, `useTabs: true`) and so are the nine `.prettierignore` files bar the per-repo lines. Keep it that way: it used to differ per repo, and a snippet moved between two of them failed `yarn lint` on the commas alone. `marketplace-db-setup` still has neither prettier nor eslint, deliberately — its content is applied migrations, and those are immutable.
- **`lint` formats, `lint:check` verifies, both over the whole tree.** `eslint --fix . && prettier --write .` and `eslint . && prettier --check .`, identical in all nine. The scope is the point: `lint` used to be eslint-only in five repos and `prettier --write 'src/**/*.mts'` in the rest, so **test files, configs and yaml were never formatted at all** and drifted for as long as that was true — 111 files came back changed the first time it ran wide. Anything genuinely out of scope belongs in `.prettierignore`, not in a narrower glob. Markdown is ignored on purpose: `proseWrap: "never"` flattens every hand-wrapped paragraph in these docs onto one line. **`lint:check` is now the first gate of both `.githooks/pre-commit` and `.githooks/pre-push` in all nine**, blocking like the others — it was the one tool here whose verdict nothing enforced, and `eslint.config.js`, `.prettierrc` and `.prettierignore` were simultaneously missing from the backend `RELEVANT_PATHS`, so the commits that widened the eslint `ignores` block ran no gate at all. All three are in the filter now: the lint gate reads them, and an edit there changes the verdict for every file in the tree without appearing in any of them.
- **A path that matches no `files` glob is linted by nothing, and eslint reports that as success.** Not as "no config found" — it checks zero rules and exits 0, so the gate is green and the file is unread. `@axiumine/eslint-config-be` scopes everything to `src/**`, which left two holes that stood for as long as nobody printed a config: the root-level `eslint.config.js` and `stryker.config.mjs` in all eight backend repos (the shared JS block is `src/**/*.{js,cjs,mjs}`, and no repo here has JS under `src/`), and **every test file and vitest config in `marketplace-common`**, where `eslint --print-config test/cibimodels.test.mts` printed `undefined` — the seven services had a `test/**/*.mts` block and the library never got one. Both are closed: the eight repos carry a `files: ['*.js','*.mjs','*.cjs']` block and common also carries the test block, and the seven services' `eslint.config.js` are byte-identical again. Fixing it surfaced three real errors in common's tests, invisible until then. `marketplace-admin` never had either hole — every block there is scoped to `SORGENTI`/`CONFIG_ROOT` by construction. **When adding a block, check it resolves**: `npx eslint --print-config <file>` should report ~400 rules, not `undefined`. `*.js` in flat config means the config file's own directory only, never `**/*.js` — that scoping is what keeps a root-JS block off the minified Qodana report, which is how marketplace-admin once produced 1601 `no-undef` errors.
- **`engines.node` is `^24.18.0` in every repo that has a `package.json`** — ten of them; the parent workspace has none. Unified, and worth keeping that way. It used to be spelled four different ways (`^24.14.0`, `^24.14`, `24.14`, `24.14.0`) with two repos omitting the block entirely, and the two spellings without a caret are *not* "24.14 or newer": semver reads `24.14` as `24.14.x` and bare `24.14.0` as that one release. Three services therefore rejected Node 24.18.0 outright while the others installed fine. **`engines` is a hard gate under yarn classic** — a mismatch exits 1 with `The engine "node" is incompatible with this module`, it is not a warning. When bumping Node, bump all ten in one sweep and keep the caret.
- **marketplace-common has no barrel export.** Consumers import per subpath, and every file needs its own entry in the package.json `exports` map (~38 entries) or it is unreachable. `yarn test:contract` catches omissions.
- **All seven services run vitest**, same two-project layout everywhere: `unit` (`test/*.test.mts`, Redis mocked, `REDIS_KEY=test:`) and `integration` (`test/integration/*.itest.mts`, `PORT=0`, `fileParallelism: false`, 30 s timeouts, and the **real** Redis cluster + MongoDB from `.env` under the isolated `REDIS_KEY=marketplaceDev:itest:` namespace). Scripts: `yarn test` · `test:unit` · `test:integration` · `test:cov`. Coverage is gated at **100% on every metric** in all seven, four times over — `thresholds` in `vitest.config.mts`, `testCoverageThresholds` in `qodana.yaml`, and a `yarn test:cov` step in both `.githooks/pre-commit` and `.githooks/pre-push`. The `qodana.yaml` line was inert in the services until the Qodana scan was wired into those two hooks: the file has always declared the threshold, but nothing local ever ran the linter, so the only scans that existed were manual. **Never lower a threshold**; add the missing test. `marketplace-dev-authenticated-logout` carries a `COVERAGE.md` explaining the pattern. Outside `dev/`, coverage lives in marketplace-common (vitest + stryker) and marketplace-db-setup (vitest against a real Mongo — it ran on the built-in `node:test` runner once, and this line said so long after that stopped being true; the assertions never moved off `node:assert/strict`, which is what made the drift easy to miss).
- **Mutation testing is gated too, at 100, in all seven services and in `marketplace-common`.** Stryker (`stryker.config.mjs`, `thresholds.break: 100`) runs as the second step of every `.githooks/pre-push`, after coverage. Coverage asks whether a line *ran*; mutation asks whether a test would have *failed* had that line been wrong — and the two answers diverge badly. Every package here sat at 100% coverage while mutants survived; `marketplace-common` scored 45.95%. See `README.md` for the gate layers and `marketplace-common/CLAUDE.md` for the catalogue of assertions that pass while the code is wrong. **Do not add `ignoreStatic`** to a Stryker config to silence a survivor — it masks real gaps, and the survivor it appears to fix is usually a load-time mutant that needs a dynamic `await import()` inside `beforeEach` instead.
- **Every repo's integration suite owns its own MongoDB database, and three variables have to name it.** `MONGO_TEST_DB`, `MONGO_TEST_AUTH_ADMIN` and the database path of `MONGO_TEST_CONN_STRING` must all carry the same string, and that string must be **unique to the repo** — each `globalSetup` drops its own database, so a shared name means one suite wiping another's data mid-run. `vitest.mongo.mts` enforces the agreement (`assertTestMongoDbNames`) and refuses to build a URL otherwise; it used to rebuild the path from `MONGO_TEST_DB` silently, which turned a mismatch into a working URL pointed at a database the connection string never named. Because the authSource *is* the test database, the two `MONGO_TEST_*` users must exist in every one of them — provision with the loop in `marketplace-db-setup/setup/mongodb.js`. Dropping a database does not delete them; MongoDB keeps all users in `admin.system.users`. Current names: `dbMarketplaceTest` (db-setup), `…Common`, `…PublicAuthz`, `…PublicRes`, `…ImprAuthz`, `…ImprRes`, `…AdminAuthz`, `…AdminRes`; `marketplace-dev-authenticated-logout` has no block because its suite never touches Mongo.
- **Integration tests run against real infrastructure** and must clean up after themselves. The convention: seed through the **raw driver** (`mongoose.connection.db!.collection(…)`), not the Mongoose model — several models disagree with their collection's `$jsonSchema` (`Imprenditore` declares `anagrafica.nascita.date` and no `contatti`, the validator wants `nascita.data` plus `contatti`) — push every `_id` and every Redis key into a module-level array **at creation time**, and drain both in `afterAll`. Registering the key at creation rather than relying on a per-test `finally` matters: a seed that throws before its `try` block leaks the session key. Watch the unique indexes when seeding (`imprenditore.login.email`, `azienda.piva` **and** `azienda.pec`) — a fixed literal collides on the second seed of the same run. Redis is a **cluster**, so delete one key per `del` call; a multi-key `del` throws CROSSSLOT.
- **Migrations are immutable; they are no longer self-contained.** Never edit an applied migration — add a new one. But the `$jsonSchema` shapes themselves live in `marketplace-db-setup/lib/schemi/`, shared by every migration that restates them: 13 identical product validators and 5 restatements of `puntoVendita` were about 3 500 of 5 100 lines, and no edit inside `migrations/` could clear the resulting `DuplicatedCode` findings. The 13 product builders are gone with their collections — `lib/schemi/` is down to `account.js`, `collezione.js`, `geo.js`, `imprenditore.js`, `puntoVendita.js` — but the rule stands for the survivors, and a new product type gets a builder there rather than an inline validator. The old "inline everything" rule assumed a database that cannot be rebuilt, and there is none here — one `Dev` plus a throwaway test DB, both replayable. **The replacement rule: a change under `lib/schemi/` is followed by a full rebuild of every database that has run these migrations, in the same piece of work.** Each builder carries *every* historical shape of its collection, so deleting an unused branch breaks some older migration's `down`. Read `lib/schemi/README.md` before editing it.
- **`.orig` files are merge leftovers**, not sources — three survive: `yarn.lock.orig` in the two `*-resource` services under `dev/`, and `marketplace-dev-public-resource/src/index.ts.orig`. Ignore them; do not sync edits into them.
- Cross-service shell scripts are near-duplicates — `prod-build-local.sh` is byte-identical across all 7. A fix to one usually belongs in all seven.
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
- **Never commit on `main`. Ever.** Before the first edit of any task, create a branch — `git switch -c <type>/<slug>` — and commit there. Merging into `main` is the user's decision alone: do not merge, fast-forward, squash or rebase onto `main` unless the user says so in that message — **`marketplace-common` is the one exception, see the next bullet.** Being on `main` is not permission to commit to it; being asked to "commit and push" means commit the branch and push the branch. This holds in all eleven repos here — the ten sub-repos and this parent — and in `@axiumine/koa-utils` (`/media/nvme/Dev/pacchetti/koa-utils/koa-utils`), which is a twelfth outside this workspace. The reason it needs stating: `main` is the default branch in every one of them and every one tracks `origin/main`, so a bare `git commit` silently lands on `main` when no branch was made first.
- **`marketplace-common` is the only repo that may be committed, merged, pushed and published without asking. Every other repo is push-on-request, always.** Standing permission, granted by the user and not expiring at the end of a session: in `marketplace-common` go through the whole branch → commit → merge → `git push` → `npm publish` loop whenever the work needs it, without stopping to ask at any step. Everywhere else — the other nine repos, this parent workspace, and `@axiumine/koa-utils` — **never run `git push` unless the user asked for it in that message.** "The branch is ready", "the gates are green" and "the hook would run it anyway" are not permission; neither is having pushed that repo an hour ago. Branch-first still holds in `marketplace-common` too: the exception is about who decides to merge and push, not about committing straight onto `main`. Two things to keep in mind while using it. **`npm publish` is a one-way door** — a version number cannot be reused once published, and the 72-hour unpublish window is not a plan — so the bump is the point of no return, not the push. And a publish is only half the change: seven services consume the package by version, so a bump nobody installed changes nothing, and bumping them is a separate commit in each of their repos, which is *not* covered by this permission. The reason the asymmetry exists: `marketplace-common` is consumed as a published package rather than a path link, so an edit there is dead weight until it is on the registry — asking for permission mid-loop strands the consumers on a version that does not exist, while a stray push anywhere else puts code on a remote the user had not decided to change yet.
- **Delete the local branch the moment it is merged.** `git branch -d <slug>`, in the same breath as the merge — not "later", not at the top of the next task. Use `-d` and **never `-D`**: `-d` refuses a branch whose commits are not already reachable from where you stand, so the safe case succeeds quietly and the unsafe one stops you before the work is unreachable. Nothing here does it for you — every repo merges locally and pushes the result, so no forge-side "delete branch on merge" ever fires and a merged branch simply stays forever. **Fourteen** had piled up across the eleven repos before this rule was written — `chore/qodana-severity-gate` alone survived in eight of them, which is what a rule-less polyrepo looks like: the same dead branch, eight times, because deleting it was eight separate commands nobody ran. The cost is not disk: `git branch` is the only place in-flight work is visible in a polyrepo, so every merged leftover reads as unfinished when it is not, and the one branch that *is* still live gets lost among them. If the branch was also pushed, `git push origin --delete <slug>` — and only if the user asked for that push to begin with.
- **Qodana runs in `pre-commit` *and* in `pre-push`, in all ten repos.** `marketplace-db-setup` was the last one unwired — it carried both `qodana.yaml` and `qodana.sh` while no hook called either, and `qodana.sh` could not have run anyway because the repo had no `QODANA_TOKEN`. The token exists now, so both hooks invoke it like everywhere else. Two differences there, both deliberate: neither hook passes `SKIP_TESTS=1`, because that repo's `qodana.yaml` omits `testCoverageThresholds` and so there is no coverage report to reuse; and the scan is the *only* thing its `pre-commit` gates besides the secret guard, since db-setup has no lint config and its migration suite is push-only. Not redundant, for two reasons pre-commit structurally cannot cover. First, **`git merge --no-ff` never fires `pre-commit`** — git runs that hook for `git commit` only — so in the branch → commit → merge → push flow the merge commit, the one revision that actually reaches `origin`, is the single commit no pre-commit scan ever sees; two individually clean branches can merge into a tree that is not. Second, **Qodana Cloud files every report under the branch it was produced on** and the CLI has no `--branch` flag (it reads git HEAD), while pre-commit always runs on the feature branch *before* the commit exists — so a repo gated only there can never produce a `main`-tagged report, `main` is not offered as the cloud project's default branch, and the "new problems" baseline has nothing stable to compare against. pre-push runs after the merge, standing on `main`. In the nine repos that gate coverage, both scans pass `SKIP_TESTS=1` so `qodana.sh` reuses the `coverage/lcov.info` the preceding gate just wrote instead of regenerating it with `yarn test:cov || true`, which swallows the exit code. Bypass with `SKIP_QODANA=1` (coverage and mutation still gate). A missing prerequisite — docker, the `qodana` CLI, the linter image named in `qodana.yaml`, `QODANA_TOKEN` — **blocks and prints the fixing command**; it never warns and continues.
- Use `git`. Each package commits independently; a cross-cutting change means N separate commits — and now N separate pushes, since every repo has its own `origin` (see *Repo layout*). Pushing a service or `marketplace-common` runs a `.githooks/pre-push` hook that enforces lint, the 100% coverage gate, mutation and Qodana in that order. Check the hook is **executable** — git skips a non-executable hook with only a hint, so the gate vanishes silently; `marketplace-dev-public-authorization` shipped that way until it was caught. **Every `pre-push` selects the pinned node first**, reading `engines.node` from that repo's `package.json` and switching via nvm — the gates shell out to yarn, and yarn's `engines` check is a hard exit 1, so without it a push from a shell on the machine default node dies before the first gate *under that gate's banner*, which is how a node mismatch first read as a type error. If nvm is missing or the version is not installed, the hook blocks with the `nvm install` line instead. Not a warning layer: it is the reason `git push` works from any shell here.

# GitNexus — Code Intelligence

**Polyrepo setup: 10 independent indexes, not one.** The parent dir is a git repo but its `.gitignore`
excludes `/BEs/` and `/marketplace-admin/`, so indexing *here* sees only workspace docs. Each sub-repo
is indexed on its own and tied together by the group **`marketplace-platform`**.

⚠️ **The parent's registry name is `fullstack-marketplace-blueprint`, not `marketplace`.** GitNexus names
an index after the directory, and this directory was renamed — so the entry follows the folder, not the
product. It covers **this parent dir only** (4 files, 44 nodes — its own docs, and it grows as they do),
it is **not** the platform index and never will be, because the `.gitignore` above hides every sub-repo
from it. Keep it current so the staleness hook stays quiet, but never query it expecting application code
— none of it is in there.

⚠️ **`pizzati*` entries in the registry are a different workspace.** `list_repos` still returns `pizzati`,
`pizzati-admin`, `pizzati-common`, `pizzati-db-setup` and six `pizzati-dev-*`, all rooted at
`/media/nvme/websites/pizzati` — the pre-rebrand original, which still exists on disk and is still
indexed. They are near-identical in shape to the ten below and will happily answer a query. **Always pass
a `marketplace*` registry name**; a `pizzati*` answer is about the other tree and predates the catalogue
deletion.

| Group path | Registry name (`repo:` param) |
|---|---|
| `lib/common` | `marketplace-common` |
| `lib/db-setup` | `marketplace-db-setup` |
| `be/public/authorization` | `marketplace-dev-public-authorization` |
| `be/public/resource` | `marketplace-dev-public-resource` |
| `be/imprenditore/authorization` | `marketplace-dev-authenticated-authorization` |
| `be/imprenditore/resource` | `marketplace-dev-authenticated-resource` |
| `be/imprenditore/logout` | `marketplace-dev-authenticated-logout` |
| `be/admin/authorization` | `marketplace-dev-admin-authenticated-authorization` |
| `be/admin/resource` | `marketplace-dev-admin-authenticated-resource` |
| `fe/admin` | `marketplace-admin` |

**`repo:` is mandatory on every MCP call** — the single-repo default no longer applies. Use the registry
name, not the group path: `impact({target: 'loginAdmin', repo: 'marketplace-dev-public-authorization'})`.

Cross-repo impact/search is **CLI only** — no MCP tool exists for it:

```bash
gitnexus group impact marketplace-platform --target <sym> --repo be/admin/resource --direction downstream
gitnexus group query  marketplace-platform "onboarding imprenditore"
```

Here `--repo` takes the **group path**, unlike the MCP tools above.

## ⚠️ HTTP contract extraction does not work on this platform

`group sync` yields **0 cross-links**. Verified empirically, not assumed. The 7 services mount Apollo via
`if (ctx.path === ENDPOINT)` inline dispatch, and GitNexus's extractor only recognises `router.get(...)` /
`app.post(...)` / NestJS decorators. Compounding: `.mts`/`.mjs` are absent from its extension registry, and
the tool has no GraphQL model at all.

Re-verified 2026-08-04 on a from-scratch index of all ten repos: `group sync` wrote **3 contracts, 0
cross-links**. Two are providers from `be/public/resource` — `GET /` and
`GET /verify-email/{param}/{param}`, the one place a real Koa router is used. The third is a *consumer*,
`GET /{param}` from `fe/admin`'s `cercaIndirizzi` — that is the SPA's outbound call to the external
geocoding API, not a link to anything in this platform, and it can never match a provider here.

Consequence: **do not reach for `route_map`, contract cross-links, or `group impact` across the HTTP
boundary — they return nothing.** This is a detector gap, not a config problem; manual `links:` entries in
`group.yaml` cannot help, because no contract object exists to link. Symbol-level tools (`query`,
`context`, `impact`, `detect_changes`) work normally within each repo and are where the value is.

## Maintenance

```bash
cd <changed-repo> && gitnexus analyze          # incremental; re-run per repo after commits
gitnexus group sync marketplace-platform           # after marketplace-common publish or resolver/schema changes
gitnexus group status marketplace-platform         # staleness across all 10
```

### `.gitnexusrc` — committed per repo, no flags to remember

`analyze` rewrites `AGENTS.md` / `CLAUDE.md` on every run, and the generated header carries live symbol
and relationship counts. Those counts change whenever anything is edited, so the files came back dirty
after every index and got swept into unrelated commits. Every repo now commits a `.gitnexusrc` at its
root (JSON only, read from the repo root — **not** from `.gitnexus/`, which is gitignored index storage)
so the fix survives without passing flags by hand.

|Where|`.gitnexusrc`|Effect|
|---|---|---|
|the 10 indexed repos|`{"analyze": {"noStats": true}}`|generated block keeps its guidance, drops the volatile counts — byte-identical across runs|
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
| `gitnexus://group/marketplace-platform/status` | Staleness across all 10 repos |
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
