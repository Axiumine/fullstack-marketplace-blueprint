# ADR-053 — the shared half of the environment is one file, loaded by direnv
# Marketplace

**Status:** accepted
**Date:** 2026-08-31
**Deciders:** platform owner, in the instruction that opened the work — *"1 + 2 with direnv"*, where 2 is
*"a layered shared env file for the ~15 identical keys"* and direnv is the named mechanism.
**Supersedes:** —
**Superseded by:** —

---

## Context

`RISK_REGISTER` R04 is scored 🟠 High and has had no mitigation since it was raised: *"Per-machine `env`
file is wrong-but-populated rather than missing, and `checkRequiredEnv` cannot see the difference"*. Its
enabling condition is stated in the register itself — *"fires on any of the ~15 shared env keys across 9
services, every time one is provisioned by copy from an unrelated project"*.

Sixteen repos, each with its own `.env`. Measuring the committed templates rather than assuming:

| Key | Repos that read it | Distinct non-empty values in the templates |
|---|---|---|
| `REDIS_DB{1,2,3}_{HOST,PORT}`, `REDIS_IS_CLUSTER`, `REDIS_KEY` | 10 | 1 |
| `MONGO_TEST_UDBOWNER`, `MONGO_TEST_UDBRW` (+ their two passwords) | 11 | 1 |
| `MONGODB_URI` | 9 | 1 |
| `CSFLE_MASTER_KEY_PATH`, `CSFLE_KEY_VAULT_NAMESPACE` | 9 | 1 |
| `DSN` | 9 | 1 |
| `UPLOAD_DIR` | 8 | 1 |
| `KEYGRIP_KEK` | 7 | 1 |

Twenty-one keys, each naming one resource, each stored between seven and eleven times. Rotating the Redis
password is eleven edits. Repointing the MongoDB cluster is nine. Nothing checks that the eleven agree, and
a machine where ten agree and one does not is precisely the wrong-but-populated deployment R04 describes —
the odd service boots, connects to a real server, and is wrong.

Three of those values are worse than inconvenient to disagree on:

- **`CSFLE_MASTER_KEY_PATH`.** The data keys in the vault are encrypted under that 96-byte file. A service
  pointed at a different one writes fields no other service can decrypt, and there is no escrow and no
  reset (ADR-029).
- **`KEYGRIP_KEK`.** The key the cookie-signing secrets are decrypted with. One service holding a different
  value rejects every session its neighbours mint.
- **`REDIS_KEY`.** The namespace every key is prefixed with. Two services disagreeing write sessions the
  other cannot read, with no error on either side; `assertRedisNamespace` catches it at boot, which is a
  detector, not a prevention.

### What the other half of the work does, and does not do

Landed alongside this decision, and deliberately not part of it: `assertEnvShape` in
`@axiumine/marketplace-common` (v4.2.0), called at boot by all nine services next to `checkRequiredEnv`. It
refuses a value that is the wrong *kind* of thing — a Mongo URI in a Redis slot, `true` where koa-utils
compares against `'1'`, a host name carrying a scheme. That is a per-repo change needing no ADR, and it
attacks R04's *likelihood*: most of what copying from an unrelated project produces fails a shape check.

It cannot attack the count. A plausible-but-incorrect value of the right shape — the right-looking password
for the wrong server — passes every predicate a single process can run, because no such predicate knows what
the rest of the fleet was pointed at. **Storing the value once is the only thing that makes agreement
structural instead of checked.** The two halves are complementary and neither substitutes for the other.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **One `.env.shared` at the workspace root, exported by one root `.envrc` via direnv (chosen)** | One file per shared value, so agreement is not something to verify; additive and reversible — a repo that sets a key the layer does not still works, and deleting `.envrc` restores the previous state exactly; direnv is already installed and is one `cp` plus one `direnv allow` to adopt; the loader is eleven lines of shell that a reader can hold in their head | A shell-only mechanism: nothing started outside a hooked interactive shell sees it; `direnv allow` is a manual step per clone; the layer cannot be overridden by a repo, so a key that legitimately differs anywhere must not be in it |
| Leave it as is, per-repo `.env` only | Nothing to learn, nothing to install; every value is where the code that reads it is | R04 stays exactly where it is. The count is the risk, and this option is the count |
| A generator: one source file, a script that writes sixteen `.env` files | Works for every launcher, not only shells; each repo keeps a complete file | Sixteen generated copies still exist and can still be hand-edited, so the divergence it prevents on Tuesday returns on Wednesday; a generator that overwrites a secret file is a footgun with no undo; the generated files are gitignored, so nothing shows the drift |
| A secrets manager (Vault, SOPS, `pass`) | Real rotation, real audit, real access control; the answer for a deployment | An operational dependency, a daemon or a decryption key to distribute, and a per-repo integration — for a workstation blueprint whose secrets are already plaintext on one disk. It solves the problem this workspace will have in production, not the one it has. `docs/PRODUCTION_HARDENING.md` is where that belongs |
| Per-repo `.envrc` files chaining to a root one (`source_up`) | Each repo could add to the layer | direnv loads the *nearest* `.envrc` and a second one replaces rather than extends unless every repo remembers `source_up` — sixteen more files to keep honest, to solve a problem the single root file does not have. Rejected on the same reasoning as the generator |
| `dotenv`'s own multi-path support in each service | No new tool; the loader is already a dependency | Only reaches Node processes that call `dotenv.config`, so the frontends' Vite builds, `marketplace-docker-DBs`' compose files and every shell one-liner are left out; and it is nine `src/index.mts` edits to a boot path, versus zero |

---

## Decision

**A value identical in every repo that reads it is stored once, in `.env.shared` at the workspace root, and
exported by a single root `.envrc` that direnv loads. A value that differs anywhere stays in the repo that
reads it.**

1. **One `.envrc`, at the workspace root, and no per-repo `.envrc`.** direnv walks *up the filesystem* for
   the nearest one and does not stop at a git boundary, so the single root file is in force in all sixteen
   repos and every directory below them. A second one inside a sub-repo would replace it for that subtree,
   silently.
2. **The layer answers first and cannot be overridden.** `dotenv` never overwrites an already-exported
   variable, so a key present in both `.env.shared` and a repo's `.env` is answered by the layer and the
   repo's copy is dead text. **This is why membership is decided by measurement, not by convenience:**
   a key put here that legitimately differs somewhere is not a default, it is a value one repo can no
   longer change. `DOMAIN` is the worked example — `xxx.tdweb.lan` in the nine services, `127.0.0.1` in
   `marketplace-services-status` — and it is excluded for that one disagreement.
3. **An empty key in the layer is inert.** `.envrc` unsets every name `.env.shared` leaves blank, so a key
   with no value behaves as though it were absent and the repo answers. Without this, an empty line would
   shadow a working repo value with no error, on a key nobody has a value for — and the committed template
   would be unsafe to copy verbatim. It also means blanking a key here does not blank it anywhere.
4. **`env.shared` is the committed template and carries names, comments and non-secret values only.**
   `envrc`/`.envrc` and `env.shared`/`.env.shared` are the same tracked/gitignored pair the workspace
   already uses for `env`/`.env` and `npmrc`/`.npmrc`.
5. **The sixteen committed `env` templates keep every key, including the shared ones.** They answer *what
   does this service read*, which is a different question from *where does the value come from*, and a
   service's own template is the only place the first question has a complete answer. It is the real `.env`
   files the migration strips.
6. **`scripts/env-shared-migrate.sh` performs the move, and the platform owner runs it.** `seed` builds
   `.env.shared` from what the repos already hold and refuses any key the repos disagree on, by name, with
   a count. `strip` removes the migrated lines and refuses, by name, any key whose repo value differs from
   the shared one. It is dry-run by default, keeps a `.bak`, and prints variable names only — never a
   value, never a whole line, not even in a diff.
7. **What the layer does not reach is documented, not worked around.** direnv exports into an interactive
   shell with its hook installed. A systemd unit, a cron job, an IDE run configuration or a container
   inherits nothing. Those keep a complete `.env` or export the same names by their own mechanism;
   `SETUP.md` §7 says which.

---

## Consequences

### Positive
- **Agreement stops being a property to verify.** Twenty-one values that were stored between seven and
  eleven times are stored once. R04's enabling condition — *"the ~15 shared env keys across 9 services"* —
  loses its subject for those keys; what remains under it is the per-repo half.
- **Rotation is one edit.** The Redis password, the KEK, the CSFLE key path: one line, and every repo has
  it on the next `cd`.
- **The two irreversible values get structural protection.** `CSFLE_MASTER_KEY_PATH` and `KEYGRIP_KEK`
  can no longer be different in one repo, because there is no longer a second place to write them.
- **Onboarding a machine shrinks.** One file to fill in for the shared half, then sixteen shorter ones.
  `SETUP.md` §7 carries the new order.
- **`scripts/env-diff.sh` became correct as a side effect.** Its `keys()` used `tr -d '[:space:]'`, a class
  that contains the newline, so it returned every key concatenated into one word and `comm` compared two
  single lines — it reported either "in sync" or the whole file as both MISSING and EXTRA, and never one
  wrong key. Every report it printed before 2026-08-31 was meaningless. It now also reports a migrated key
  as `SHARED` rather than as `MISSING`.

### Negative
- **A second place to look.** A key a service reads is now in one of two files, and the answer to "why is
  this value what it is" needs both. The committed `env` templates keeping every key is what keeps that
  answerable from inside a repo.
- **`direnv allow` is a manual step per clone**, and a forgotten one looks like sixteen repos with missing
  keys rather than like a missing layer. `scripts/env-diff.sh` says `MISSING` for exactly those keys, which
  is the symptom to recognise.
- **Nothing outside a hooked shell sees it.** Any future launcher — a unit file, CI, a container — needs
  the names supplied its own way. This is the cost of choosing a shell mechanism over a generator, and it
  was chosen knowing it.
- **A shared value cannot be experimented with in one repo.** Pointing a single service at a scratch Redis
  now means removing the key from the layer or exporting it by hand for that shell. That is the same
  property as "cannot drift", seen from the other side.

### Risks
- **A key is added to the layer that is not truly identical.** The failure is silent in the worst
  direction: the repo that needed a different value has no way to say so. `seed` refuses such a key by
  construction, and `strip` refuses to remove a line that disagrees — but a hand-edited `.env.shared`
  bypasses both. The rule is the one in `env.shared`'s header: measure, then add.
- **The layer is assumed on a machine that never ran `direnv allow`.** Every value falls back to the repos,
  which is the previous state and therefore safe — but a repo already stripped of its shared keys will
  refuse to boot on `checkRequiredEnv` instead. That is the intended failure: loud, named, and not a
  connection to the wrong server.
- **Secrets in one file rather than sixteen.** The blast radius of a single leaked file grows; the number
  of files that can leak shrinks by a factor of ten or so. `.env.shared` is gitignored (it matches
  `.env.*`), `seed` writes it mode 600, and `.claude/SECRETS.md` covers it as it covers `.env`. The real
  answer for a deployment is a secrets manager, and that is `docs/PRODUCTION_HARDENING.md`'s subject, not
  this one's.
- **R04 does not close.** Its residual is a plausible-but-incorrect value of the right shape in a key that
  is genuinely per-repo. Both halves of this work reduce it; neither eliminates it, and the row should be
  re-scored rather than retired.

---

## Compliance

```bash
# one .envrc, at the root, and no others
find . -name .envrc -not -path '*/node_modules/*'      # exactly ./.envrc, or nothing before adoption

# the templates are tracked, the real files are not
git check-ignore -v .env.shared .envrc                  # both ignored
git ls-files env.shared envrc                           # both tracked

# names only in git — no value ever reaches a commit
grep -nE '^[A-Za-z_][A-Za-z_0-9]*=.+' env.shared        # only non-secret defaults: REDIS_*, CSFLE namespace, UPLOAD_DIR, MONGO_TEST_U*

# every repo reconciles, and a migrated key reads SHARED rather than MISSING
./scripts/env-diff.sh

# the migration refuses what it cannot prove identical
./scripts/env-shared-migrate.sh strip                   # dry run; ⚠️ KEPT lines are the disagreements
```

A violation looks like:

- an `.envrc` anywhere but the workspace root;
- a key in `.env.shared` whose value is not identical in every repo that reads it — in particular `PORT`,
  `DOMAIN`, `NODE_ENV`, `QODANA_TOKEN`, `MONGO_TEST_DB`, `MONGO_TEST_AUTH_ADMIN` or
  `MONGO_TEST_CONN_STRING`, each excluded for a stated reason in `env.shared` §What stays behind;
- a value — as opposed to a name or a non-secret default — committed in `env.shared`;
- a key removed from a committed `env` template because the layer now supplies it;
- a script, hook or documented step that prints or copies a value out of a real `.env`, other than
  `scripts/env-shared-migrate.sh`, which prints names only;
- a service's `REQUIRED_ENV_VARS` shortened because "the layer supplies it" — the layer is where a value
  comes from, not a reason to stop checking that it arrived.
