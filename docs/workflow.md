# Workspace and git workflow

## This directory is the parent workspace

**Work from here, not from inside a single repo.** A task that looks local almost never is: a model
change starts in `marketplace-common`, needs a migration in `marketplace-db-setup`, resolvers in one or
more services, and queries in the frontends.

- Trace a change end to end across repos **before** editing. The nine services share
  `marketplace-common`, so a breaking edit there lands on all of them.
- One logical change = **N separate commits**, one per affected repo. There is no atomic cross-repo
  commit. Land dependencies first (`marketplace-common` → **publish a release** → bump each consumer's
  range), and say plainly which repos you touched.
- The repos drift. Shell scripts and service scaffolding are near-duplicates — `prod-build-local.sh` is
  byte-identical across all nine. A fix in one usually belongs in the other eight.

## Repo layout

Polyrepo, **not** a monorepo (ADR-001). **Sixteen independent git repos**: this parent dir plus
fifteen sub-repos.

```
fullstack-marketplace-blueprint/     # git repo — workspace files only
├── BEs/
│   ├── marketplace-common/          # shared npm lib — own CLAUDE.md, read before editing
│   ├── marketplace-db-setup/        # MongoDB migrations — own CLAUDE.md, read before editing
│   └── dev/                         # 9 backend services, one git repo each
├── marketplace-admin/               # React + Vite admin SPA (Admin)
├── marketplace-nginx/               # the edge — nginx config + its test container, no package.json
├── marketplace-shopowner/           # React + Vite shop-owner SPA (ShopOwner)
├── marketplace-user/                # TanStack Start SSR app (User + anonymous)
└── marketplace-services-status/                 # tracked by THIS repo, not a repo of its own
```

The parent tracks each of the fifteen as a **submodule** (ADR-031): a gitlink pinning one commit SHA, and
nothing else. **Anything written under those paths is still tracked by that sub-repo and never by the
parent** — a submodule pins a sub-repo, it does not absorb one. `git ls-files -s BEs/marketplace-common`
returns exactly one entry and its mode is `160000`, the gitlink; anything else under that path means a
sub-repo's files have been committed into the parent and the boundary is broken.

`.gitmodules` is the tracked list of all fifteen: path, `url = ../<repo-name>.git`, `branch = main`. The
URL is **relative on purpose** — it resolves against whatever the parent's own `origin` is, so a clone over
`https` fetches the submodules over `https` and a clone over `ssh` fetches them over `ssh`. An absolute URL
would pin one transport and make a clone switch halfway through, which is how a submodule fetch ends up
asking for credentials the cloner does not have.

`BEs/dev/upload-local/` is **not** a repo and not a service — an empty directory the resource services
write uploads into. Do not count it, do not `git init` it. It is the one path under `BEs/` the parent
still ignores, because the old blanket `/BEs/` entry used to cover it.

### Cloning the workspace

```bash
git clone --recurse-submodules https://github.com/Axiumine/fullstack-marketplace-blueprint.git
# or, identically, git@github.com:Axiumine/fullstack-marketplace-blueprint.git —
# the submodule URLs are relative, so they follow whichever you use.
```

⚠️ **This does not work yet.** All sixteen repositories exist on GitHub and every one of them is
**empty** — nothing has ever been pushed, so every SHA `.gitmodules` pins exists on no remote and the
`--recurse-submodules` step fails on the first one it tries. The recipe becomes true on the first push,
not before.

In an existing checkout, or after a clone that forgot `--recurse-submodules`:

```bash
git submodule update --init --recursive
git submodule foreach 'git switch main'    # ⚠️ not optional — see below
git config core.hooksPath .githooks                          # parent: no package.json, no prepare
git -C marketplace-nginx config core.hooksPath .githooks     # same reason (ADR-025, ADR-030)
git config push.recurseSubmodules check                      # refuse to push a pointer to an unpushed commit
```

⚠️ **`git submodule update` leaves every sub-repo on a detached HEAD.** That collides head-on with *never
commit on `main`, branch first*: a commit made there is reachable from nothing and disappears at the next
checkout, looking entirely normal until it does. Run the `foreach` line before touching anything.

Neither `core.hooksPath` line nor `push.recurseSubmodules` can be committed — local config is per-worktree
— so all three survive exactly as long as the checkout does.

To move every sub-repo to the tip of its `main`: `git submodule update --remote --merge`, which is what
the `branch = main` entries are recorded for.

### Current state

- **All sixteen repos have a `main`, and it is normally the checked-out branch.**
- **All sixteen have `core.hooksPath=.githooks` set and a `.githooks/` of their own**, and all sixteen
  carry both a `pre-commit` and a `pre-push` — but they do not all hold the same gates.
  `marketplace-nginx` has no `package.json`, so there is no lint, coverage, mutation or Qodana step for
  it to run: its `pre-push` runs `test/run.sh` and blocks on any failed check, and its `pre-commit` is
  the branch guard, then the secret guard, and nothing after it (ADR-030). Those two run in
  **all sixteen**. No
  CI/CD pipeline is configured; every gate on the platform is a local git hook.
- **The parent's own commits now include pointer bumps.** One logical change is N+1 commits, not N: one
  per affected sub-repo, plus one in the parent moving the gitlinks. Skipping the parent commit leaves it
  describing a cross-repo state that no longer exists (ADR-031).
- History is shallow: `git diff`, `git stash` and `git reset` work, but `git log` answers almost nothing
  about *why* anything is the way it is. **That is what `docs/devprotocol/phase3/adr/` is for.**

The org is settled — `github.com/Axiumine` — and so is the naming: every repo is published under its own
directory basename. Verified 2026-08-09: **all sixteen repositories exist, all sixteen are public, and all
sixteen are empty.** No branch in any of them has an upstream, and **nothing has ever been pushed.**

⚠️ **Public, and empty is the only reason that is currently safe.** Every one of these becomes
world-readable the moment it is pushed to, so [`docs/workflow.md`](./workflow.md) §*Scan history for secrets before the
first push of any new repo* below is not a formality — it is the last gate before sixteen histories are
public. A filename check is not enough; scan every blob.

Moving the whole platform to another org is still cheap while they are empty: change the parent's `origin`
and every submodule URL follows it, because they are relative.

⚠️ **Note the npm/git split.** `@axiumine/marketplace-common` and `@axiumine/koa-utils` are
*npm package* names, unrelated to where the git repo lives. Renaming a git remote never implies renaming
the package, and vice versa.

⚠️ **`./scripts/history-scan.sh` scans history for secrets, and `./scripts/audit-check.sh` §9 runs it.**
A filename check is not enough — a live Mongo password once hid in an *unquoted* `mongosh -password`
flag, which slips past any quoted-value regex, and that is why all sixteen `pre-commit` hooks now carry a
rule for a credential passed as a command-line flag (`docs/testing.md` MC-16). The scanner reads every
object git holds — `git cat-file --batch-all-objects`, reachable **and** dangling, which a `git log`
search misses — with the pattern list taken out of the parent's own `.githooks/pre-commit`, so there is
one list and not two. It blocks on a match reachable from a branch or a tag, prints one in a dangling
object, and takes cleared blobs from `scripts/history-scan-allow.txt` by object name, where a stale entry
fails the run (MC-17). Run it before the first push of any new repo: purging with `git filter-repo` is
free before that push and expensive after.

## Git rules

- **Never commit on `main`. Ever.** Before the first edit of any task, `git switch -c <type>/<slug>` and
  commit there. Being on `main` is not permission to commit to it. This holds in all sixteen repos here
  and in `@axiumine/koa-utils`, a seventeenth repo outside
  this workspace. ⚠️ **Machine-checked since 2026-09-06, in all sixteen repos here** — every
  `.githooks/pre-commit` refuses a commit whose `HEAD` is `main` before it reads anything else
  (MC-25, `./scripts/audit-check.sh` §15). It exempts an in-progress merge, because finishing a
  conflicted merge into `main` by hand is a legitimate commit onto `main` and `MERGE_HEAD` exists at
  exactly that moment; an automatic `--no-ff` merge never reaches the hook at all. The escape hatch is
  `SKIP_MAIN_GUARD=1 git commit`, named rather than `--no-verify` so that taking it does not drop the
  secret guard with it — the first commit of a brand-new repo needs it, `git init` having started on
  `main` with nowhere else to be. The seventeenth repo carries no such guard: it is outside this
  workspace, and there discipline is still the only thing between a task and `main`.
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

- The fourteen sub-repos that are packages carry `"prepare": "git config core.hooksPath .githooks ||
  true"` in `package.json`, so `yarn install` restores it.
- ⚠️ **Two repos have no `package.json` and so no such mechanism: this parent workspace and
  `marketplace-nginx`.** After a fresh clone of either, run **`./scripts/bootstrap.sh`** from the
  workspace root — it arms all sixteen, and is safe to re-run on a workspace already in use — or, in the
  parent, the secret guard and all of `marketplace-services-status`'s coverage, mutation and
  Qodana gates are off, and in `marketplace-nginx` the edge configuration is pushed without ever being
  validated. Neither repo will ever grow a `package.json` to host that one line: ADR-025 accepted the
  residual for the parent, ADR-030 rejected the idea outright for `marketplace-nginx`, and the
  ADR index lists it among the decisions not re-opened.
- ⚠️ **One accidental self-heal exists in the parent and is not a mechanism to rely on.**
  `marketplace-services-status` is a package tracked *by this repo* rather than a submodule of it, so it
  shares the parent's `.git`; a `yarn install` there runs its `"prepare"` and arms the **parent's**
  `core.hooksPath`, because a relative `core.hooksPath` resolves against the worktree root the hooks run
  in. `SETUP.md` §11 marks that install optional and no other setup step reaches it, so a workspace can
  easily be used for weeks without it ever running.
- **`./scripts/audit-check.sh` §7 is the only thing that can report an unarmed repo** (MC-15). It cannot
  be a hook, in any repo, for the reason that makes the risk a risk: the condition it looks for is the
  condition under which no hook runs. It also catches the second silent form — a `.githooks/pre-commit`
  without its executable bit, which git skips with a hint and an exit code of zero.
- `marketplace-nginx` carries both, and both are unlike every other repo's (ADR-030). Its `pre-push`
  gate is `test/run.sh` — `nginx -t` plus the behavioural suite, in a throwaway container — and it
  blocks rather than skips when the container engine, the daemon or the image is missing. Its
  `pre-commit` is the branch guard and the secret guard and stops there: the `main` check, check 0 and
  the two staged-secret scans, then `exit 0`, because with no `package.json` there is no lint, coverage,
  mutation or Qodana step to run.
- **The first thing every `pre-commit` does is read the branch**, and all sixteen copies do it
  identically (MC-25). It is the cheapest check on the platform and the only one about the commit
  rather than its content: `main` is not a branch to commit onto (BCON-06). ⚠️ **It is a guard, not a
  lock** — `--no-verify` lifts it exactly as it lifts the secret guard, and a clone whose
  `core.hooksPath` was never armed runs it no more than it runs anything else (R09).
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
- ⚠️ **Changing `license` in a `package.json` silently disarms that repo's Qodana license audit unless
  `qodana.yaml` changes with it, in the same commit.** Qodana derives the project key for `licenseRules`
  from the manifest, and a rule whose `keys` match no project **does not fail the run** — it stops
  checking and the scan still reports clean, so the gate disappears with no output saying so. Every
  `qodana.yaml` therefore lists **both** `GPL-3.0-or-later` and `PROPRIETARY-LICENSE` (the key Qodana
  derives from `UNLICENSED`), so the rule holds whichever way the metadata is read. `allowed` is a
  separate list — dependency licences — and is not what breaks here.

Gate policy in full: [`README.md`](../README.md), *Test quality gates*.

## Secrets

**Never read, echo, copy or commit a secret-bearing file** — `.env`, `.env.*`, `.npmrc`, `.yarnrc`,
`.netrc`, `*.pem`, ssh keys. `env` and `npmrc` (no leading dot) are the committed placeholder templates
and are safe to read.

Anything printed to a terminal here is sent to the model API **and** written in plaintext to
`~/.claude/projects/<slug>/*.jsonl`, so `cat .env` leaks permanently and cannot be un-sent.

- To inspect a secret file, print **key names only**: `grep -oE '^[A-Za-z_0-9]+' .env`.
- Metadata (`ls`, `stat`, `wc -l`, `md5sum`, `git check-ignore`) is fine.
- Protected values include `KEYGRIP_KEK`, `REDIS_PASSWORD`, `DSN`,
  `MONGODB_URI`, `QODANA_TOKEN`, `SOCKETLABS_SERVER_ID`, `SOCKETLABS_SERVER_APIKEY` and any npm token.

Enforced, not just documented — see [`.claude/SECRETS.md`](../.claude/SECRETS.md) for the three layers (`permissions.deny`, the
`no-secret-leak` PreToolUse hook, and a `pre-commit` guard in every repo).

## Environment files

Per-machine `.env` files are the one place where a *wrong* value fails where nothing is looking.

**There are two layers.** A value identical in every repo that reads it lives once, in `.env.shared` at
the workspace root, exported by one root `.envrc` that direnv loads
([`ADR-053`](./devprotocol/phase3/adr/ADR-053-the-shared-half-of-the-environment-is-one-file.md)); everything
else lives in the repo that reads it. Four rules follow and none of them is obvious:

- ⚠️ **One `.envrc`, at the workspace root, and never one inside a sub-repo.** direnv loads the *nearest*
  one walking up the filesystem and does not stop at a git boundary, so the root file already covers all
  sixteen repos. A second one **replaces** it for that subtree rather than extending it, silently.
- ⚠️ **The layer wins and cannot be overridden.** `dotenv` never overwrites an exported variable, so a key
  in `.env.shared` is answered there and the repo's own copy of it is dead text. A key that legitimately
  differs anywhere must therefore stay out — in the layer it would not be a default, it would be a value
  that repo can no longer change. `DOMAIN` is excluded on exactly one disagreement.
- ⚠️ **An empty key in the layer is inert.** `.envrc` unsets every name `.env.shared` leaves blank, so a
  blank there falls through to each repo's `.env` — and blanking a key in the layer does not blank it
  anywhere.
- ⚠️ **A shell without the direnv hook does not load the layer, and nothing says so.** direnv exports
  `.env.shared` from a *shell hook*, so an interactive shell in the workspace has the layer and a
  non-interactive one does not: a script run as `sh -c`, a CI step, a systemd unit, an editor's task
  runner, an assistant's tool shell. What such a shell gets is the repo's own `.env` alone — which since
  ADR-053 is precisely the half that did **not** move — so every shared key is absent, and the symptom
  names one of them and reads like an unprovisioned machine. `yarn test:cov` in `marketplace-db-setup`
  dies `Missing MONGO_TEST_UDBOWNER in .env` on a box where that value has been in `.env.shared` all
  along, and the same command in a normal terminal passes. ⚠️ **Do not answer it by copying the key back
  into a repo's `.env`**: the layer wins, so the copy is dead text on a hooked shell and a second source
  of truth everywhere else — it manufactures R04 rather than fixing anything. Run the command *through*
  the layer instead — **`direnv exec . yarn test:cov`**, or `direnv exec <workspace-root> <cmd>` from
  anywhere — which evaluates `.envrc` for that directory and needs no hook. `direnv allow`, once per
  machine, is what makes either work; until it is run a hooked shell prints a block message and an
  unhooked one prints nothing at all. The git hooks inherit the shell that ran `git commit`, so a commit
  from a non-hooked shell fails its coverage gate for this reason and not for its own.

The committed `env` templates keep **every** key, the shared ones included: they answer what a service
reads, not where the value comes from. `./scripts/env-diff.sh` reports a key the layer supplies as
`SHARED` and one nothing supplies as `MISSING`; `./scripts/env-shared-migrate.sh` moves keys into the
layer and is the only script here that reads a value out of a real `.env` — it prints names only, refuses
any key the repos disagree on, and **you** run it, never an assistant.

- ⚠️ **A shared value the layer does not hold is unenforced by construction** — no test spans two
  services, so a `REDIS_KEY` mismatch between two services fails at runtime while both repos'
  suites stay green, because each one agrees with itself. **Check with a fingerprint sweep, not by
  reading files.** One shape of that mismatch is now caught at boot rather than at runtime: a service
  whose prefix names a namespace holding no keygrip record exits 1 there (`KEYGRIP_RECORD_MISSING`,
  all nine since 2026-08-31). It catches the service that drifted, never a fleet that drifted together.
  ✅ **The cookie-signing keys are the one pair this no longer applies to** — since *"The Keygrip pair
  leaves five `.env` files for one wrapped record in Redis"* in
  [`devprotocol/phase5/IDENTITY_ACCESS.md`](./devprotocol/phase5/IDENTITY_ACCESS.md) §4, they are not
  in any `.env` at all. They live in one Redis record wrapped under `KEYGRIP_KEK` (ADR-034), and a
  service whose KEK cannot open that record **exits 1 at boot** with `KEYGRIP_KEK_MISMATCH` instead of
  signing cookies its siblings cannot verify. What is left to keep in step is the KEK itself, and getting
  it wrong is now loud.
  ⚠️ **Provisioning them anywhere but a workstation is the adopter's job, and no vendor is named for it.**
  [`ADR-040`](./devprotocol/phase3/adr/ADR-040-the-secrets-manager-vendor-choice-is-the-adopters.md) rules
  that this blueprint never chooses one; [`PRODUCTION_HARDENING.md`](./PRODUCTION_HARDENING.md) lists the
  swap points — ⚠️ **one** decode site in TypeScript (`readKek`) plus a second in `marketplace-db-setup`,
  which shares no code with it — and the invariants a swap must not break. One decode site is one place to
  edit, not one value: seven processes resolving a manager independently can still disagree.
- **Fingerprint, never print.** `sha256(key + ' ' + value)`, first six hex — proves two repos agree
  without putting the secret in a terminal.
- ⚠️ **Quote any value holding whitespace or a `#`.** This page used to say dotenv terminates a bare
  value at the first space; measured against the two readers actually in play here, it does not.
  dotenv 17.4.2 reads `KEY=abc def` as `abc def` — while direnv 2.32.1 calls that line `invalid` and
  exports **none** of the shared layer, so a space costs you every variable in the file rather than the
  tail of one. `KEY=abc#tail` is `abc` to both, silently, each reading the `#` as the start of a comment.
  One file, two readers, two answers, and neither says which it took. A pair of quotes settles all of it —
  **single** quotes, since dotenv expands `\n` and `\r` escapes inside double ones.
- ⚠️ **One value, one line — quoting does not save you from a line break.** A newline inside a quoted
  value does not survive the break, and each reader answers differently. Measured 2026-09-02: dotenv
  17.4.2 keeps a **quoted** wrap as one value with the newline inside it — 89 characters where 88 were
  meant, silently wrong rather than short — and truncates an **unquoted** wrap at the newline, dropping
  the tail unless the tail carries an `=`, which base64 padding supplies and which promotes it to a
  variable of its own. direnv 2.32.1 refuses a wrap of either kind and exports **nothing** from that
  file. This is how all 5 `.env` files holding `KEYGRIP_KEY_1`/`_2` were found broken on 2026-08-09:
  88-char keys wrapped after 76 chars, and one file had the 12-char tail duplicated on a further line.
  ⚠️ **A value that genuinely needs a newline writes `\n` inside double quotes** — the one multi-line
  form both readers agree on, and nothing here needs it today.

  **Both of the two rules above are gates, not conventions.** `.githooks/pre-commit` **check 0** reads
  the working tree — the only check that does, because a `.env` is git-ignored and never staged — and
  refuses the commit when any `.env`, `.env.*`, `env` or `env.shared` in that repo holds a non-blank,
  non-comment line that is not `SCREAMING_SNAKE=VALUE`, a value that opens a quote the line never closes,
  an unquoted value holding whitespace or a `#`, or an unquoted value opening with the `=` that base64
  padding leaves on a tail. The last two rules are what stop a tail like `kJ3xQ==` — a legal `KEY=VALUE`
  line to both readers — from passing as a name. It reports file, line and key name, never a value.
  Trailing spaces are not flagged: both readers drop them, so there is nothing to disagree about. A
  deliberate multi-line value would trip it; none exists here, and the escape hatch is
  `git commit --no-verify`.

  **Detector, to check by hand before you get that far — the key-name listing you are already allowed to
  run:**

  ```bash
  grep -oE '^[A-Za-z_0-9]+' .env
  ```

  A wrapped value announces itself as a **bogus key name** in that listing: the orphan tail begins with
  base64 characters, so dotenv and this grep both read it as a variable. Anything in the output that is
  not an English `SCREAMING_SNAKE_CASE` name is a broken line above it. Nothing wider than this one
  command is available in-agent — the secret guard rejects any pipeline over a `.env`, including
  `grep -vE … | wc -l` and a `diff` of key names against the `env` template. To check the file's whole
  shape, run a script from disk instead of inlining it: the guard reads the command line, not the
  script.

- **Which services need `KEYGRIP_KEK`:** the four `*-authorization` services and
  `marketplace-dev-authenticated-logout` — 5 of 9 — plus `marketplace-db-setup`, which seeds the record
  with `yarn seed:keygrip` and is not a service. The four `*-resource` services sign no cookie and must
  not carry it; per-service table in [`docs/devprotocol/phase3/INFRA.md`](./devprotocol/phase3/INFRA.md) §7.
- ⚠️ **`KEYGRIP_KEK` is a wrapping key, not a signing key**, and it is the whole platform's session
  security in one value: whoever holds it can open the record and forge a cookie for any tier. Treat it
  exactly like the pair it replaced. Losing it, unlike losing the CSFLE master key, is recoverable —
  `yarn seed:keygrip --force` mints a new set and everyone signs in again.
- `checkRequiredEnv` is `if (!env[envVar])`, so an empty value fails exactly like a missing one — that
  is the only class of these it catches on its own. A second pass runs beside it since 2026-08-31:
  `assertEnvShape` (`marketplace-common` 4.2.0) walks the service's own `ENV_SHAPES` map and refuses a
  value of the wrong *kind* — a port that is not a port, `true` where `'1'` is compared, a `mongodb://`
  URI in the Redis slot — aggregating every failure into one `ENV_SHAPE_INVALID` and printing no value.
  ⚠️ **It cannot refuse a wrong value of the right kind**, which is why R04 is mitigated and not closed,
  and five credential-shaped keys plus `DSN` and `NODE_ENV` carry no shape at all. `marketplace-db-setup`
  and the two SPAs run no shape pass whatsoever. Audit by parsing each service's `REQUIRED_ENV_VARS` and
  `ENV_SHAPES` out of `src/index.mts`, then checking that repo's local config for absent-or-empty.

## Commands

Node **v24.18.0** via nvm, **yarn** everywhere.

⚠️ **All of this assumes a reachable MongoDB replica set** — a commit needs one, not only a test run,
because coverage is a pre-commit gate. The platform's own cluster is external and does not travel
with a clone, and neither does `marketplace-db-setup/setup/mongodb.js`, the gitignored runbook that
provisions its users. `marketplace-docker-DBs/` is the stand-in: `cp env .env && ./up.sh` brings up a
three-node `rs0` with every account the backend services expect, an optional Redis, and a CSFLE master
key. Its [`README.md`](../README.md) also carries the boot order for the whole platform and the per-repo
`MONGO_TEST_DB` table.

```bash
# any backend service (cd into it)
yarn dev            # tsc && tsx watch src/index.mts
yarn build          # yarn clean && tsc && tsc-alias
yarn start          # node dist/index.mjs
./dev.sh            # nvm + tmpfs-backed node_modules + yarn dev

# marketplace-common
yarn build          # ESM only — build:all / prepare:all are BROKEN (missing tsconfig.cjs.json)
yarn upload         # npm publish — the ONLY way an edit reaches a consumer (ADR-047). No local deploy exists
yarn test           # unit          yarn test:cov
yarn test:contract  # verifies package.json exports map
yarn test:int  yarn test:types  yarn test:mutation  yarn test:all

# marketplace-db-setup
yarn migrate:status | migrate:up | migrate:down | migrate:create <name>
yarn test  test:cov  test:mutation   # gated at 100 / 100 — 5 suites, real Mongo
yarn test:seed      # same suites with SEED_DEMO=true (2 tests are skipped without it)

# marketplace-admin (admin app; shopowner is identical on 3044)
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
