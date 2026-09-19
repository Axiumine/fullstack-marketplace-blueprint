# Marketplace

Multi-tenant marketplace: customers order from many independent shops, each shop run by its owner, the
platform vendor operating it. **This directory is the parent workspace of sixteen independent git
repos — work from here, not from inside one repo.** The fifteen sub-repos are tracked here as submodules
(ADR-031): the parent pins a commit per sub-repo and nothing more.

Three human roles — `Admin`, `ShopOwner`, `User` — each with its own collection and service pair.
`Company` (the shop) and `Item`/`ItemCategory` complete the six collections. Full detail, including the
nine-service shape and the role/collection/service table: [`REPO.md`](./REPO.md).

## Where to read next

Load the file that matches the task. Do not guess from this page alone.

| Topic | File |
|---|---|
| rationale, reference tables and worked detail this file used to carry | [`REPO.md`](./REPO.md) |
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

`git log` answers almost nothing here — history is shallow. The ADR index is the rationale of record;
read it before proposing a refactor of anything below.

## Rules that apply to every task

- **Never commit on `main`.** Branch first — `git switch -c <type>/<slug>` — in all sixteen repos;
  merging into `main` is the user's decision alone.
- **`marketplace-common` is the only repo that may be committed, merged, pushed and published without
  asking. Every other repo is push-on-request, always.**
- ⚠️ **An edit to `marketplace-common` reaches a consumer only by being published, and by nothing else**
  (ADR-037, ADR-047). Cut a release — bump, changelog, merge, tag, `git push --follow-tags`,
  `yarn upload` — then move each consumer's range: the nine steps in
  [`BEs/marketplace-common/REPO.md`](./BEs/marketplace-common/REPO.md) §Publishing a release, every time.
  ⚠️ **Never copy a local build into a consumer's `node_modules`** — no `rsync`, `cp`, `yarn link`,
  `file:` path, or reviving the deleted `deploy-local.sh` (ADR-047): a copied build has no version and no
  lockfile entry. `yarn install` is authoritative everywhere and can destroy nothing. Iterate inside
  `marketplace-common` with `yarn test`; if a consumer needs the change, the change is worth a version
  number.
- **One logical change = N+1 commits**: one per affected sub-repo, plus one in the parent bumping the
  submodule pointers (ADR-031). Land dependencies first; say which repos you touched.
- ⚠️ **`git submodule update` leaves sub-repos on a detached HEAD.** Run
  `git submodule foreach 'git switch main'` before editing anything — a commit made there is reachable
  from nothing and looks normal until the next checkout drops it.
- **Never lower a coverage or mutation threshold, and never remove a gate.** Everything is at 100% on all
  four coverage metrics and mutation score 100. A commit that needs a threshold lowered needs a test.
- ⚠️ **Never start the mutation gate by hand**, in any of the fifteen repos that carry a
  `stryker.config.*`. `yarn test:mutation` is hook-only — `pre-push` calls it, nothing else does. To
  reproduce a survivor, apply the mutant by hand in the source and run `yarn test`.
- **Never read, echo or commit a secret-bearing file** (`.env`, `.npmrc`, `*.pem`, …). `env` and `npmrc`
  without the dot are committed templates and safe. Print key names only:
  `grep -oE '^[A-Za-z_0-9]+' .env`. See [`.claude/SECRETS.md`](./.claude/SECRETS.md).
- **Migrations are immutable** — never edit an applied one, add a new one. `$jsonSchema` shapes are
  shared from `marketplace-db-setup/lib/schemas/`; a change there means rebuilding every database that
  has run these migrations, in the same piece of work.
- **Indentation is tabs**, enforced by eslint and prettier together.
- ⚠️ **Everything is English, with no exception** — domain names, identifiers, UI text, routes, comments,
  test fixtures, migrations. One word of a second language is a regression, not a style nit: the same
  name has to spell identically across a migration, a `$jsonSchema`, a model, a resolver, a GraphQL field
  and three frontends.
- ⚠️ **The catalogue is domain-neutral** (ADR-008). `item` and `itemCategory` presume nothing about what
  is sold — do not reintroduce vocabulary that presumes a product type.
- ⚠️ **There is no `role` field and no permission enum anywhere, deliberately (ADR-002): role = which
  collection you authenticate against.** A fifth role means a fifth collection and a fifth service pair,
  never a role check bolted onto the existing ones.
- ⚠️ **Commerce is permanently out of scope, by the platform owner's decision of 2026-08-27
  (ADR-038): no cart, order, order state machine, delivery or payment — ever.** This is a refusal, not a
  gap. Do not invent it, and do not describe it to the user as if it exists.
- ⚠️ **Three human roles, and their names are `admin`, shop owner and customer** — platform owner's ruling
  of 2026-08-29. The word *operator* is not one of them and appears nowhere; a shop owner is never "the
  admin", and there is no "superadmin".
- **Run `impact({target, repo})` before editing a symbol and `detect_changes()` before committing**;
  `repo:` is mandatory and must be a `marketplace*` registry name.
