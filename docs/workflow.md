# Workspace and git workflow

## This directory is the parent workspace

**Work from here, not from inside a single repo.** A task that looks local almost never is: a model
change starts in `marketplace-common`, needs a migration in `marketplace-db-setup`, resolvers in one or
more services, and queries in the frontends.

- Trace a change end to end across repos **before** editing. The nine services share
  `marketplace-common`, so a breaking edit there lands on all of them.
- One logical change = **N separate commits**, one per affected repo. There is no atomic cross-repo
  commit. Land dependencies first (`marketplace-common` → `./deploy-local.sh` → bump consumers), and say
  plainly which repos you touched.
- The repos drift. Shell scripts and service scaffolding are near-duplicates — `prod-build-local.sh` is
  byte-identical across all nine. A fix in one usually belongs in the other eight.

## Repo layout

Polyrepo, **not** a monorepo (ADR-001). **Fifteen independent git repos**: this parent dir plus
fourteen sub-repos.

```
fullstack-marketplace-blueprint/     # git repo — workspace files only
├── BEs/
│   ├── marketplace-common/          # shared npm lib — own CLAUDE.md, read before editing
│   ├── marketplace-db-setup/        # MongoDB migrations — own CLAUDE.md, read before editing
│   └── dev/                         # 9 backend services, one git repo each
├── marketplace-admin/               # React + Vite operator SPA (Admin)
├── marketplace-shopowner/           # React + Vite shop-owner SPA (ShopOwner)
├── marketplace-user/                # TanStack Start SSR app (User + anonymous)
└── services-status/                 # tracked by THIS repo, not a repo of its own
```

The parent's `.gitignore` excludes `/BEs/`, `/marketplace-admin/`, `/marketplace-shopowner/` and
`/marketplace-user/`, so the sub-repos nest without conflict — and so **anything written under those
paths is tracked by that sub-repo, never by the parent.**

`BEs/dev/upload-local/` is **not** a repo and not a service — an empty directory the resource services
write uploads into. Do not count it, do not `git init` it.

### Current state

- **All fifteen repos have a `main`, and it is the checked-out branch in fourteen of them.**
- **All fifteen have `core.hooksPath=.githooks` set.** No CI/CD pipeline is configured today — every
  gate is a local git hook.
- History is shallow: `git diff`, `git stash` and `git reset` work, but `git log` answers almost nothing
  about *why* anything is the way it is. **That is what `docs/devprotocol/phase3/adr/` is for.**

Where these fifteen repos get published, and under which org, is the platform owner's open call and has
not been made.

⚠️ **Note the npm/git split.** `@thedoctorweb_agency/marketplace-common` and `@axiumine/koa-utils` are
*npm package* names, unrelated to where the git repo lives. Renaming a git remote never implies renaming
the package, and vice versa.

⚠️ **Scan history for secrets before the first push of any new repo.** A filename check is not enough —
a live Mongo password once hid in an *unquoted* `mongosh -password` flag, which slips past any
quoted-value regex. Scan every blob in `git rev-list --all --objects`, not just the working tree.
Purging with `git filter-repo` is free before the first push and expensive after.

## Git rules

- **Never commit on `main`. Ever.** Before the first edit of any task, `git switch -c <type>/<slug>` and
  commit there. Being on `main` is not permission to commit to it. This holds in all fifteen repos here
  and in `@axiumine/koa-utils`, a sixteenth repo outside
  this workspace. Nothing downstream catches the mistake — the only guard is discipline.
- **Merging into `main` is the user's decision alone** — do not merge, fast-forward, squash or rebase
  onto `main` unless the user says so in that message. One exception, below.
- **`marketplace-common` may be committed, merged, pushed and published without asking.** Standing
  permission, not expiring at session end: go through branch → commit → merge → `git push` →
  `npm publish` whenever the work needs it. Branch-first still applies; the exception is about who
  decides to merge and push, not about committing straight onto `main`.
  - ⚠️ **`npm publish` is a one-way door** — a version cannot be reused, and the 72-hour unpublish
    window is not a plan. The bump is the point of no return, not the push.
  - A publish is half the change: bumping the nine consumers is a separate commit in each of their
    repos, and that is **not** covered by this permission.
- **Every other repo is push-on-request, always.** "The branch is ready", "the gates are green" and "the
  hook would run it anyway" are not permission; neither is having pushed that repo an hour ago.
  "Commit and push" means commit the branch and push the branch.
- **Delete the local branch the moment it is merged** — `git branch -d <slug>`, in the same breath as
  the merge. Use `-d`, **never `-D`**: `-d` refuses a branch whose commits are not already reachable.
  Nothing here does it for you — every repo merges locally, so no forge-side "delete on merge" fires and
  a merged branch stays forever. In a polyrepo `git branch` is the only place in-flight work is visible,
  so every merged leftover reads as unfinished.

## Git hooks

⚠️ **The hooks are enabled by `core.hooksPath`, which is local config and travels with nothing.** Git
reads `.git/hooks/` unless told otherwise; a repo without that setting runs no gate at all and says
nothing about it.

- The fourteen sub-repos carry `"prepare": "git config core.hooksPath .githooks || true"` in
  `package.json`, so `yarn install` restores it.
- ⚠️ **The parent workspace has no `package.json`**, so it has no such mechanism. After a fresh clone of
  this directory, run `git config core.hooksPath .githooks` by hand — or the secret guard and all of
  `services-status`'s coverage, mutation and Qodana gates are off.
- A relative value is safe: git resolves it against the worktree root, so hooks fire from subdirectories
  too.
- **Check the hook is executable.** Git skips a non-executable hook with only a hint, so the gate
  vanishes silently.
- **Every `pre-push` selects the pinned node first**, reading `engines.node` from that repo's
  `package.json` and switching via nvm. Yarn's `engines` check is a hard exit 1, so without it a push
  from a shell on the machine default node dies before the first gate, *under that gate's banner*. If
  nvm is missing or the version is not installed, the hook blocks with the `nvm install` line.
- **Both scans pass `SKIP_TESTS=1`** so `qodana.sh` reuses the `coverage/lcov.info` the preceding gate
  just wrote, instead of regenerating it with `yarn test:cov || true` — which swallows the exit code.
- Bypass Qodana alone with `SKIP_QODANA=1`; coverage and mutation still gate. A missing prerequisite —
  docker, the `qodana` CLI, the linter image, `QODANA_TOKEN` — **blocks and prints the fixing command**;
  it never warns and continues.

Gate policy in full: `README.md`, *Test quality gates*.

## Secrets

**Never read, echo, copy or commit a secret-bearing file** — `.env`, `.env.*`, `.npmrc`, `.yarnrc`,
`.netrc`, `*.pem`, ssh keys. `env` and `npmrc` (no leading dot) are the committed placeholder templates
and are safe to read.

Anything printed to a terminal here is sent to the model API **and** written in plaintext to
`~/.claude/projects/<slug>/*.jsonl`, so `cat .env` leaks permanently and cannot be un-sent.

- To inspect a secret file, print **key names only**: `grep -oE '^[A-Za-z_0-9]+' .env`.
- Metadata (`ls`, `stat`, `wc -l`, `md5sum`, `git check-ignore`) is fine.
- Protected values include `KEYGRIP_KEY_1/2`, `REDIS_PASSWORD`, `INTROSPECTION_CODE`, `DSN`,
  `MONGODB_URI`, `QODANA_TOKEN`, `SOCKETLABS_SERVER_ID`, `SOCKETLABS_SERVER_APIKEY` and any npm token.

Enforced, not just documented — see `.claude/SECRETS.md` for the three layers (`permissions.deny`, the
`no-secret-leak` PreToolUse hook, and a `pre-commit` guard in every repo).

## Environment files

Per-machine `.env` files are the one place where a *wrong* value fails where nothing is looking.

- ⚠️ **Values shared across repos are unenforced by construction** — no test spans two services, so a
  `KEYGRIP_KEY_*` mismatch between `marketplace-dev-public-authorization` (which signs the customer
  refresh cookie at `loginUser`) and the user-tier authorization service (which verifies it) returns 401
  on every customer refresh while both repos' suites stay green, because each signs and verifies with
  itself. The same holds for `INTROSPECTION_CODE`. **Check with a fingerprint sweep, not by reading
  files.**
- **Fingerprint, never print.** `sha256(key + ' ' + value)`, first six hex — proves two repos agree
  without putting the secret in a terminal.
- ⚠️ **Quote any value containing whitespace.** dotenv terminates a bare value at the first space or
  `#`, hands back the truncated prefix and reports nothing. Use **single** quotes: dotenv expands `\n`
  and `\r` escapes inside double quotes.
- `checkRequiredEnv` is `if (!env[envVar])`, so an empty value fails exactly like a missing one — that
  is the only class of these the code catches. Audit by parsing each service's `REQUIRED_ENV_VARS` out
  of `src/index.mts`, then checking that repo's local config for absent-or-empty.

## Commands

Node **v24.18.0** via nvm, **yarn** everywhere.

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

# marketplace-admin (operator app; shopowner is identical on 3044)
yarn dev            # vite on http://127.0.0.1:3043, GraphQL paths proxied to 4024/4025/4028/4030
yarn codegen        # regenerate src/gql/ from schema/*.graphql
yarn build          # codegen && tsc --noEmit && vite build
yarn lint           # eslint --fix + prettier --write   (lint:check for CI)
yarn test  test:cov  test:mutation   # gated at 100 / 100

# marketplace-user (customer app)
yarn dev            # vite on http://127.0.0.1:3045, proxied to 4027/4028/4030/4031/4032
yarn build          # codegen && tsc --noEmit && vite build  → dist/client + dist/server
yarn start          # node serve.mjs — SSR only, requires PORT, no default, binds loopback
```

⚠️ `dev.sh` bind-mounts `node_modules` onto a tmpfs ramdisk (`/var/ram/<pkg>/node_modules`) and needs a
sudoers entry. It **wipes `node_modules` first** — do not run it if you have local patches there.
