# ADR-031 — The fifteen sub-repos are tracked as submodules of the parent workspace
# Marketplace

**Status:** accepted
**Date:** 2026-08-09
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** ADR-001, in part — the *no submodules* clause of its Decision only
**Superseded by:** —

---

## Context

ADR-001 chose polyrepo and rejected submodules in the same sentence: *"Polyrepo, 16 independent repos, no
submodules, no monorepo."* Its rejection reasons were that a pointer bump makes any cross-cutting change
N+1 commits rather than N, and that `init`/`update` friction is added to every clone and every `dev.sh`
run without buying atomicity back, since sub-repos still commit independently between parent syncs.

Both reasons are still true. What changed is the requirement they were weighed against. ADR-001 weighed
submodules purely as an *atomicity* mechanism and found them a poor one. The requirement now on the table
is **reconstruction**: one `git clone` of the parent must produce the whole workspace, with all fifteen
sub-repos at their correct paths. Under plain polyrepo that is impossible in principle, not merely
inconvenient — the parent's `.gitignore` excluded `/BEs/`, `/marketplace-admin/`, `/marketplace-nginx/`,
`/marketplace-shopowner/` and `/marketplace-user/`, so a clone of the parent produced `docs/`,
`services-status/`, `docker-DBs/`, `scripts/` and the workspace files, and fifteen absent directories.
Nothing in any tracked file even recorded where the missing repos lived or what they were called.

The second thing ADR-001 did not weigh is that the parent tracks **no** cross-repo state at all. There is
no record anywhere of which `marketplace-common` commit the nine services were working against when a
given migration landed. `git log` at the top level, as ADR-001's own Consequences say, "answers nothing
about a cross-repo change."

State at the time of this decision, which shapes what is and is not yet true of it:

- The parent workspace has **no remote configured at all** — no `origin`, nothing to clone.
- Twelve of the fifteen sub-repos had no `origin` either; only `marketplace-common`,
  `marketplace-db-setup` and `marketplace-nginx` had one, and `marketplace-db-setup`'s was `https` while
  the other two were `ssh`.
- No branch in any of the sixteen repos has an upstream. **Nothing has ever been pushed.**

So the publishing question `ADR-INDEX.md` §5 records as an open gap — *where the sixteen repos get
published, and under which org* — is answered here only as far as naming: the three existing remotes
already follow `github.com/Axiumine/<repo-name>`, and this ADR extends that convention to the other
twelve. Whether and when those repositories are created and pushed to remains the owner's call and is
outside this decision.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — keep plain polyrepo, clone each repo by hand | Status quo; zero mechanism | The paths and names exist in no tracked file, so "clone the project" is not a thing that can be done; the fifteen repos are reconstructible only from someone's memory of this directory |
| B — bootstrap script plus a manifest in the parent (`scripts/clone-all.sh` + `repos.tsv`) | Keeps ADR-001 exactly as written; the manifest gives the repo list one home; the script can also arm `core.hooksPath` in the two repos with no `package.json` and run `deploy-local.sh` | Home-grown, and pins nothing — the manifest records *where* each repo is, never *which commit*, so the cross-repo-state gap stays open and a fresh clone always lands on whatever `main` happens to be |
| C — git submodules, one gitlink per sub-repo (**chosen**) | `git clone --recurse-submodules` reconstructs the workspace in one command; `.gitmodules` is the tracked manifest; each parent commit pins an exact SHA per sub-repo, so a cross-repo state becomes a thing that can be recorded, diffed and returned to | Reverses ADR-001's clause; a cross-cutting change becomes N+1 commits; a fresh `submodule update` leaves every sub-repo on a **detached HEAD**, which collides with the branch-first rule; `git status` in the parent now reports sub-repo dirtiness |
| D — third-party multi-repo tool (`meta`, `vcstool`, `mu-repo`, `google repo`) | Purpose-built for exactly this; some pin revisions too | Adds a runtime dependency and a second config format for what git does natively; nothing here needs the extra features, and the tool becomes one more thing a fresh machine must install before it can check out the code |
| E — collapse to a monorepo | Reconstruction and atomicity both solved outright | Rejected by ADR-001 on grounds this ADR does not reopen: sixteen separate histories, hook sets, gates and Qodana projects would have to merge, and path-scoped CI would have to be invented to recover what repo boundaries give for free |

---

## Decision

Option **C**. The fifteen sub-repos become submodules of the parent. `.gitmodules` is committed and lists
all fifteen, sorted by path, each with `path`, `url` and `branch = main`. The five sub-repo paths are
removed from the parent's `.gitignore` — an ignored path is one `git submodule add` refuses — and
`/BEs/dev/upload-local/` is added in their place, because that directory is not a repo and was covered by
the old blanket `/BEs/` entry.

All fifteen URLs are `git@github.com:Axiumine/<repo-name>.git`, where `<repo-name>` is the directory's own
basename. `marketplace-db-setup`'s `origin` is changed from `https` to `ssh` so that one transport is used
throughout; a `.gitmodules` mixing the two makes a clone's authentication depend on which line it is
reading.

`branch = main` is recorded for every submodule so that `git submodule update --remote` is meaningful —
without it, `--remote` falls back to `HEAD` on the remote, and following each sub-repo's `main` is exactly
what the branch-first workflow already assumes.

**What ADR-001 decided still stands and is not reopened.** These are sixteen independent repos with
sixteen independent histories, hook sets, gates and Qodana projects. A submodule is a pointer, not a merge
of histories: sub-repo commits are still made in the sub-repo, still gated by that repo's own hooks, still
branched and merged there under the same rules. Only the parent's *reference* to them changed.

Two consequences that follow are workflow rules, not side effects:

- **One logical change is now N+1 commits**, not N: one per affected sub-repo, plus one in the parent
  bumping the pointers. The parent commit is what makes the cross-repo state recordable, so it is the
  point of the exercise rather than overhead — but it is a commit that must actually be made, and a
  pointer left un-bumped is a parent that describes a state which no longer exists.
- ⚠️ **`git submodule update` checks out a detached HEAD.** Every sub-repo lands on the pinned SHA with no
  branch, which collides directly with *never commit on `main`, branch first*: committing there produces
  a commit reachable from nothing. After any init or update, run
  `git submodule foreach 'git switch main'` before touching anything.

Because nothing has been pushed, a parent commit today pins SHAs that exist on no remote. Any clone of
the parent will fail its `submodule update` until the sub-repos are published. That is a known, accepted
state of this decision and not a defect in it — the pointers are correct locally and become resolvable
the moment the repositories exist.

---

## Consequences

### Positive
- The workspace is reconstructible from one command. `git clone --recurse-submodules` produces all
  sixteen repos at their correct paths, once the remotes exist.
- `.gitmodules` is the first tracked record of what the fifteen sub-repos are and where they belong.
  Until now that list lived only in prose, and every count of it had to be swept by hand when it changed.
- A parent commit now captures a cross-repo state — which `marketplace-common`, which nine services,
  which migrations — so a working combination can be returned to. This is the gap ADR-001 named in its
  own Consequences and accepted; it is now closable, one parent commit at a time.
- `push.recurseSubmodules=check` becomes available: git can refuse to push a parent that points at
  sub-repo commits which are not themselves pushed, which is the main way a submodule setup goes wrong.

### Negative
- **N+1 commits per cross-cutting change**, exactly as ADR-001 predicted. That cost was not argued away;
  it was accepted in exchange for reconstruction and pinning.
- **Detached HEADs after every init or update**, needing `git submodule foreach 'git switch main'`. This
  is the sharpest edge of the change, because a commit made on a detached HEAD looks completely normal
  until the next checkout orphans it.
- `git status` in the parent is no longer purely workspace files — it now reports every sub-repo that has
  uncommitted work or has moved off its pinned SHA. ADR-001 explicitly wanted "`git status` at the top
  level stays fast"; with fifteen submodules it stays fast but stops being quiet.
- A stale pointer is a new failure mode with no gate behind it. Nothing checks that the parent's SHAs
  match the sub-repos' `main`, so a parent that pins last week's state looks exactly like one that pins
  today's.
- Two local configs still cannot be committed and so still must be set by hand after a clone:
  `core.hooksPath` in the parent and `marketplace-nginx` (ADR-025, ADR-030), and now
  `push.recurseSubmodules` in the parent.

### Risks
- **Risk:** the parent is pushed while sub-repo commits are not, leaving a published pointer to a SHA
  nobody can fetch. Mitigation is `git config push.recurseSubmodules check` in the parent, which is local
  config and therefore not enforced by anything tracked. Revisit if a clone ever fails on a missing
  submodule commit.
- **Risk:** work is committed on a detached submodule HEAD and lost at the next update. Revisit —
  by scripting the `foreach 'git switch main'` into the clone recipe rather than documenting it — the
  first time it happens.
- **Risk:** pointer bumps stop being made because the sub-repo commit felt like the whole job, and the
  parent silently describes a state that has not existed for weeks. Revisit if `git submodule status`
  routinely shows `+` prefixes on a clean working day.
- **Risk:** the `Axiumine` org or the repo names turn out not to be where these are published, making all
  fifteen `.gitmodules` URLs wrong at once. Cheap to fix while nothing is pushed
  (`git submodule sync --recursive` after editing), progressively less so afterwards.

---

## Compliance

From the workspace root:

```bash
git ls-files -s | grep -c '^160000'                    # must be 15 — one gitlink per sub-repo
git config -f .gitmodules --get-regexp 'submodule\..*\.url' | wc -l   # must be 15
git config -f .gitmodules --get-regexp 'submodule\..*\.branch'        # all 15 must read main
git submodule status                                   # no + or - prefix on a clean tree
```

Verify each gitlink actually matches the sub-repo it points at — a pinned SHA that has drifted from the
sub-repo's `main` is the stale-pointer failure above:

```bash
git ls-files -s | awk '$1=="160000"{print $2, $4}' | while read -r sha path; do
  [ "$sha" = "$(git -C "$path" rev-parse HEAD)" ] || echo "STALE: $path"
done
```

Verify the boundary ADR-001 set is still intact — a submodule pins a sub-repo, it does not absorb it:
`git ls-files BEs/marketplace-common | wc -l` must be `0` while `git ls-files services-status | wc -l`
stays nonzero. If the first ever returns a real file list, a sub-repo's contents have been committed into
the parent and the polyrepo boundary is gone.

A violation looks like: a sub-repo path appearing in the parent's `.gitignore` again; a `.gitmodules` URL
on a different transport or org from the other fourteen; a sub-repo committed on a detached HEAD; or a
parent commit that touches only its own files while the sub-repo commits it describes went in without a
pointer bump.
