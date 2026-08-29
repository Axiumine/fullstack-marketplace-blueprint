# ADR-030 — marketplace-nginx gates on its own test suite at push and on the secret guard at commit
# Marketplace

**Status:** accepted
**Date:** 2026-08-09
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

`marketplace-nginx` is a repo of its own, one of the fifteen sub-repos the parent tracks as submodules
(ADR-001, ADR-031, remote `Axiumine/marketplace-nginx`). It is the only one that arrives at the gate
question with nothing ADR-017 can be applied to.

Every other repo on the platform gates itself the way ADR-017 describes: `.githooks/pre-commit` and
`.githooks/pre-push`, mode `100755`, armed by `core.hooksPath` which a `prepare` script restores on
`yarn install`, running lint → type check → 100% coverage (CON-08, ADR-016) → mutation → Qodana. **None of
that applies here.** `marketplace-nginx` carries no `package.json`, no `eslint.config.js`, no vitest
config, no Stryker config and no Qodana project, because it ships no code: eleven nginx configuration
files — five in `conf.d/`, three vhosts in `sites-available/`, three in `snippets/` — plus a stub-backend
conf and the two shell scripts that drive the test container. There is nothing for ADR-017's tail to run,
and ADR-016's thresholds have no metric to be measured against.

That is not the same as the repo being low-risk. It is:

- the **only** place on the platform that sets `Secure` on the session cookie
  (`snippets/proxy-backend.conf`, `proxy_cookie_flags ~ secure httponly samesite=strict;`, closing the
  🔴 Critical that [`docs/report/token-handling-security-audit.md`](../../../report/token-handling-security-audit.md) carried as §3.1 in v1.0 and dropped
  in v1.1 as closed — koa-utils ships `secure: false` with a comment saying to rewrite it at the edge);
- the only place the three tiers' login rate-limit budgets are separated at all, since all three logins
  reach the same process on 4028 and only the edge still knows which hostname was asked for;
- the only place the Content-Security-Policy for all three surfaces is written.

And **no nginx is installed on this machine** — no `/etc/nginx`, no binary in `PATH` (INFRA.md §11). So
unlike every other repo, nothing here is ever executed by accident: a broken directive stays invisible
until a reload on a host where a failed reload is an outage. The one thing that can execute it is
`test/run.sh` — a throwaway container running `nginx -t` against the real files, then 168 behavioural
assertions against a live nginx with eleven stand-in backends. It takes well under a minute, and it needs
a container engine and an image.

Two further constraints shaped the option that was picked:

- **No `package.json` means no `prepare`**, so `core.hooksPath` is not self-armed here — the same hole
  ADR-025 records for the parent workspace, and the second of exactly two repos with it.
- **The parent's hooks never fire for a change made here.** A submodule is a pointer, not a merge of
  histories (ADR-031): a commit or a push inside `marketplace-nginx` is an event in `marketplace-nginx`,
  so ADR-025's answer for `marketplace-services-status` — gate it from the parent — has nothing to hang on.

Separately, [`.claude/SECRETS.md`](../../../../.claude/SECRETS.md) §3 lists the `pre-commit` secret guard as layer 3 of four: check 0 (a
working-tree env value split across two physical lines, R05b) plus two staged-secret scans. A repo with no
`pre-commit` is a repo where a staged credential is caught by nothing, and the argument above rules out
every mechanism that puts one here by default.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — no hooks; run `test/run.sh` by hand before pushing | Zero setup; the suite is a single command with no arguments | "Documentation of intent, not a running control" is exactly what ADR-017 exists to end; it also leaves the repo outside [`.claude/SECRETS.md`](../../../../.claude/SECRETS.md) layer 3 entirely |
| B — one `pre-commit` and one `pre-push`, both running `test/run.sh` | Symmetric with the other fifteen; the suite runs as early as possible | The suite needs a container engine and an image, and this repo's ordinary commit is one directive in one file — paying a container run per commit is exactly how a hook gets bypassed out of habit, the reasoning ADR-025 already applied to keep mutation push-only |
| C — `pre-push` runs `test/run.sh`; `pre-commit` runs the secret guard and stops | Each gate is paid where its cost is worth it; the secret guard is cheap and belongs at commit, the container suite is not and belongs at push; [`.claude/SECRETS.md`](../../../../.claude/SECRETS.md) layer 3 becomes exceptionless | Two hooks in one repo doing unrelated jobs, neither shaped like any other repo's; a sixth variant of the secret-guard body to keep in sync |
| D — add a `package.json` purely to get `prepare` and a script chain | `core.hooksPath` would self-arm on `yarn install`, matching the fourteen packages | Invents a JavaScript toolchain to host one line of git config, and makes `yarn install` a prerequisite for editing an nginx conf; it also invites a `lint`/`test` script with nothing behind it, which is the appearance of a gate that ADR-025 spent a whole decision removing |
| E — gate it from the parent workspace's hooks, as ADR-025 does for `marketplace-services-status` | Reuses hooks that already exist and are already armed | Structurally impossible: `marketplace-services-status` has no `.git`, so its changes *are* parent commits. `marketplace-nginx` has its own `.git`, and the parent's gitlink records its SHA rather than its commits, so no parent hook ever fires for a change made here |

---

## Decision

Option **C**. `marketplace-nginx` carries two hooks that do unrelated jobs, split by what each one costs.

**`.githooks/pre-push` — the quality gate.** It runs `test/run.sh` and blocks the push on any failure.
It is **unscoped**, and there is nothing here to scope it by: every tracked file is part of the one
configuration the suite exercises. A push also carries merge commits and anything committed with
`--no-verify`, neither of which any `pre-commit` ever sees (ADR-017 §Context), so this is the hook that
stands on the revision that actually reaches the remote.

It **blocks rather than skips** on every prerequisite it cannot satisfy — `test/run.sh` missing or not
executable, the container engine absent or its daemon unreachable, the test image not present locally.
The same rule the parent's hooks already follow: a gate that steps aside when it cannot run is not a
gate, it is the hole reopened one condition lower. It reads the engine and image defaults out of
`test/run.sh` rather than repeating them, so the two cannot drift, and honours the same
`CONTAINER_ENGINE` / `NGINX_TEST_IMAGE` overrides. There is **no bypass variable**: the suite is under a
minute and `git push --no-verify` is the escape hatch precisely because it is conspicuous.

Not pulling the image is deliberate, matching the parent's Qodana gate: the run would pull it silently,
and blocking instead keeps a slow or unreachable registry from becoming a failed push — one explicit
`docker pull` per image bump, versus a network flake on any push.

**`.githooks/pre-commit` — the secret guard, and nothing after it.** The 123-line body from
`set -uo pipefail` through the abort block is **verbatim** the one the other fifteen repos carry: check 0
(working-tree env value split across two lines, R05b), the staged-path scan, the staged-added-lines value
scan, and the declared-placeholder filter that keeps the committed `env` / `npmrc` templates passing.
Then `exit 0`. This is the sixth variant in [`.claude/SECRETS.md`](../../../../.claude/SECRETS.md) §3's table, and the only one
distinguished by having **no tail at all** — the other five differ by which of lint / type check /
coverage / Qodana they go on to run, and this repo can run none of them. With it, layer 3 covers sixteen
repos of sixteen and has no exception.

---

## Consequences

### Positive
- Every revision that reaches `origin` has had `nginx -t` and every behavioural assertion in `test/suite.sh` run against it.
  Without the gate nothing would have: there is no nginx on the machine, so the configuration's first
  execution would be on a host where a failed reload is an outage.
- [`.claude/SECRETS.md`](../../../../.claude/SECRETS.md) layer 3 has no exception. All sixteen repos carry check 0 and both staged scans.
- Splitting the two gates by cost keeps the ordinary commit here — one directive, one file — as fast as a
  commit with no hook at all, which is the difference between a hook that runs and a hook that gets
  `--no-verify`d out of habit.
- The `pre-push` prerequisites block instead of warning, so the failure mode ADR-017 §Context describes —
  a gate reporting success because it never ran — cannot happen here quietly.

### Negative
- **Two repos need `git config core.hooksPath .githooks` by hand after a clone**: the parent (ADR-025)
  and this one. Neither has a `package.json`, so neither self-arms, and a clone that skips the step loses
  *both* hooks silently — no output says the push was ungated.
- The secret-guard body exists in **six** variants. Nothing enforces that they stay identical; it is a
  `diff` run by hand, and a fix to one must be copied to the other five.
- `pre-push` depends on a container engine and a locally present image. An offline push, or a push from a
  machine without Docker or podman, is blocked until the admin installs or pulls — which is the
  intended behaviour and is still a real cost.
- **No static analysis of nginx directives exists, and none is added by this ADR.** `nginx -t` is a
  parser, not a linter: it accepts a backslash-continued `Content-Security-Policy` that drops the header
  silently. Only the behavioural half of the suite catches that class, so coverage of this repo is exactly
  the set of assertions someone wrote.

### Risks
- **Risk:** the suite grows slow — more assertions, a heavier image — and someone moves it out of
  `pre-push` or adds the skip variable this hook deliberately lacks. Revisit condition: `test/run.sh`
  exceeding roughly two minutes on a warm machine, at which point the answer is to split the suite, not
  to weaken the gate.
- **Risk:** someone adds a `package.json` here to get `prepare`, then fills it with a `lint` or `test`
  script that has nothing to lint or test — the appearance of a gate, which is option D restated.
  Revisit condition: a `package.json` appears in this repo.
- **Risk:** the six secret-guard bodies drift, and a fix applied to the backend variant never reaches
  this one. Revisit condition: any diff between the six bodies (command in §Compliance).
- **Risk:** a directive lands that `nginx -t` accepts and no assertion covers, in the same class as a
  silently dropped CSP header. Revisit condition: any edge defect reaching a host that the suite could
  have caught but did not — the fix is a new assertion, never a relaxed gate.

---

## Compliance

Verify both hooks are live and armed, from the workspace root:

```bash
git -C marketplace-nginx config core.hooksPath          # must print .githooks
git -C marketplace-nginx ls-files -s .githooks          # both modes must start 100755
```

Verify the secret-guard body is identical across all six variants — it is the body, not the whole
file, that must match, because each variant's header comment lists its own gates:

```bash
guard() { awk '/^set -uo pipefail$/{f=1} f{print; if ($0=="fi" && s) exit} /aborted\. Secrets belong/{s=1}' "$1"; }
diff <(guard .githooks/pre-commit) <(guard marketplace-nginx/.githooks/pre-commit)   # must be empty, 123 lines each
```

Verify the quality gate actually gates: from `marketplace-nginx`, `./test/run.sh` must end
`ALL CHECKS PASSED` and exit 0 on a clean tree; with any single directive corrupted it must exit non-zero
and the hook must print `PUSH BLOCKED — the edge configuration failed its own suite.` A missing
prerequisite prints `pre-push: BLOCKED — <reason>` and also exits non-zero — never a warning.

A violation looks like: a push landed with `--no-verify`; a skip or bypass variable added to either hook;
a prerequisite check in `pre-push` changed from blocking to warning; a `package.json` in this repo; the
`pre-commit` here carrying anything after `exit 0`, or its guard body differing from the other five.
