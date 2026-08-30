# ADR-031 — The fifteen sub-repos are tracked as submodules of the parent workspace
# Marketplace

**Status:** accepted
**Date:** 2026-08-09
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

ADR-001 settles that this is sixteen repositories with sixteen independent histories, hook sets, gates and
Qodana projects. It leaves one question open: **what the parent workspace records about the fifteen
sub-repos it contains.**

Two requirements answer it, and neither is atomicity — that was weighed and given up in ADR-001.

**Reconstruction.** One `git clone` of the parent must produce the whole workspace, with all fifteen
sub-repos at their correct paths. If the parent merely ignores those paths, a clone yields `docs/`,
`marketplace-services-status/`, `marketplace-docker-DBs/`, `scripts/` and the workspace files, plus fifteen absent directories —
and no tracked file anywhere even records where the missing repos live or what they are called. "Clone the
project" is then not a thing that can be done; the list exists only in someone's memory of this directory.

**Cross-repo state.** With sixteen histories and no shared one, there is no record anywhere of which
`marketplace-common` commit the nine services were working against when a given migration landed. `git
log` at the top level, as ADR-001's own Consequences say, answers nothing about a cross-repo change. A
working combination of sixteen repos cannot be named, diffed, or returned to.

State at the time of this decision, which shapes what is and is not yet true of it:

- All sixteen repositories exist under `github.com/Axiumine/<repo-name>`, all public, all empty. The
  parent's `origin` is `https://github.com/Axiumine/fullstack-marketplace-blueprint.git`.
- **No branch in any of the sixteen repos has an upstream. Nothing has ever been pushed.**

So the publishing question [`ADR-INDEX.md`](./ADR-INDEX.md) §5 records as an open gap — *when* the sixteen repos get
published — is answered here only as far as naming and topology. Whether and when anything is pushed
remains the owner's call and is outside this decision. Public repositories also make the pre-first-push
history scan (`docs/workflow.md`) the last gate before sixteen histories are world-readable.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — parent ignores the sub-repo paths, each repo cloned by hand | Zero mechanism; `git status` in the parent stays purely about workspace files | The paths and names exist in no tracked file, so the workspace is reconstructible only from memory; pins nothing, so the cross-repo-state gap stays open permanently |
| B — bootstrap script plus a manifest in the parent (`scripts/clone-all.sh` + `repos.tsv`) | Gives the repo list one tracked home; the script can also arm `core.hooksPath` in the two repos with no `package.json` and run the local sync script of the day (`deploy-local.sh`, deleted 2026-08-30 by ADR-047) | Home-grown, and pins nothing — the manifest records *where* each repo is, never *which commit*, so a fresh clone always lands on whatever `main` happens to be, and the cross-repo-state requirement is unmet |
| C — git submodules, one gitlink per sub-repo (**chosen**) | `git clone --recurse-submodules` reconstructs the workspace in one command; `.gitmodules` is the tracked manifest; each parent commit pins an exact SHA per sub-repo, so a cross-repo state becomes a thing that can be recorded, diffed and returned to | A cross-cutting change becomes N+1 commits; a fresh `submodule update` leaves every sub-repo on a **detached HEAD**, which collides with the branch-first rule; `git status` in the parent now reports sub-repo dirtiness |
| D — third-party multi-repo tool (`meta`, `vcstool`, `mu-repo`, `google repo`) | Purpose-built for exactly this; some pin revisions too | Adds a runtime dependency and a second config format for what git does natively; nothing here needs the extra features, and the tool becomes one more thing a fresh machine must install before it can check out the code |
| E — collapse to a monorepo | Reconstruction and cross-repo state both solved outright | Rejected by ADR-001 on grounds this ADR does not reopen: sixteen separate histories, hook sets, gates and Qodana projects would have to merge, and path-scoped CI would have to be invented to recover what repo boundaries give for free |

---

## Decision

Option **C**. The fifteen sub-repos are submodules of the parent. `.gitmodules` is committed and lists all
fifteen, sorted by path, each with `path`, `url` and `branch = main`. The parent's `.gitignore` therefore
lists none of the five sub-repo paths — an ignored path is one `git submodule add` refuses — and carries
`/BEs/dev/upload-local/` instead, because that directory is not a repo and would otherwise show up as
untracked the first time local dev writes an upload into it.

**URLs are relative: `url = ../<repo-name>.git`**, where `<repo-name>` is the directory's own basename. An
absolute URL pins a transport, and a `.gitmodules` full of `git@github.com:…` under an `https` parent
origin makes a clone switch transport halfway through and authenticate differently per line. A relative
URL resolves against whatever the parent was actually cloned with: under the `https` origin it becomes
`https://github.com/Axiumine/marketplace-nginx.git`, under an `ssh` origin
`git@github.com:Axiumine/marketplace-nginx.git`. One transport throughout, by construction rather than by
keeping fifteen lines in step.

`branch = main` is recorded for every submodule so that `git submodule update --remote` is meaningful —
without it, `--remote` falls back to `HEAD` on the remote, and following each sub-repo's `main` is exactly
what the branch-first workflow already assumes.

**What ADR-001 decided is untouched.** A submodule is a pointer, not a merge of histories: sub-repo commits
are still made in the sub-repo, still gated by that repo's own hooks, still branched and merged there
under the same rules. Only the parent's *reference* to them exists here.

Two consequences that follow are workflow rules, not side effects:

- **One logical change is N+1 commits**: one per affected sub-repo, plus one in the parent bumping the
  pointers. The parent commit is what makes the cross-repo state recordable, so it is the point of the
  exercise rather than overhead — but it is a commit that must actually be made, and a pointer left
  un-bumped is a parent that describes a state which no longer exists.
- ⚠️ **`git submodule update` checks out a detached HEAD.** Every sub-repo lands on the pinned SHA with no
  branch, which collides directly with *never commit on `main`, branch first*: committing there produces
  a commit reachable from nothing. After any init or update, run
  `git submodule foreach 'git switch main'` before touching anything.

One boundary needs restoring by hand, because it was `.gitignore` that held it. GitNexus reads
`.gitignore` to decide what `analyze` sees, and with the five paths gone the parent's index would take in
all fifteen codebases — the whole platform under the one registry name documented as holding none of it.
**`.gitnexusignore` at the workspace root lists the five paths** and keeps the parent index to the parent's
own files; each sub-repo has its own index under its own registry name (`docs/gitnexus.md`).

Because nothing has been pushed, a parent commit today pins SHAs that exist on no remote. Any clone of the
parent will fail its `submodule update` until the sub-repos are published. That is a known, accepted state
of this decision and not a defect in it — the pointers are correct locally and become resolvable the
moment the first push happens.

---

## Consequences

### Positive
- The workspace is reconstructible from one command. `git clone --recurse-submodules` produces all
  sixteen repos at their correct paths, once anything has been pushed.
- `.gitmodules` is the tracked record of what the fifteen sub-repos are and where they belong. Without it
  that list lives only in prose, and every count of it has to be swept by hand when it changes.
- A parent commit captures a cross-repo state — which `marketplace-common`, which nine services, which
  migrations — so a working combination can be returned to. This is the gap ADR-001 names in its own
  Consequences and accepts; it closes one parent commit at a time.
- `push.recurseSubmodules=check` becomes available: git can refuse to push a parent that points at
  sub-repo commits which are not themselves pushed, which is the main way a submodule setup goes wrong.

### Negative
- **N+1 commits per cross-cutting change.** ADR-001 already pays N; the pointer bump is the extra one, and
  it is the price of pinning rather than a defect of it.
- **Detached HEADs after every init or update**, needing `git submodule foreach 'git switch main'`. This
  is the sharpest edge of the arrangement, because a commit made on a detached HEAD looks completely
  normal until the next checkout orphans it.
- `git status` in the parent is no longer purely workspace files — it reports every sub-repo that has
  uncommitted work or has moved off its pinned SHA. It stays fast; it stops being quiet.
- A stale pointer is a failure mode with no gate behind it. Nothing checks that the parent's SHAs match the
  sub-repos' `main`, so a parent that pins last week's state looks exactly like one that pins today's.
- The GitNexus boundary now depends on `.gitnexusignore`, a file only `analyze` reads. A new sub-repo needs
  a line there as well as a submodule entry, and nothing enforces the pairing.
- Two local configs still cannot be committed and so must be set by hand after a clone: `core.hooksPath`
  in the parent and `marketplace-nginx` (ADR-025, ADR-030), and `push.recurseSubmodules` in the parent.

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
git config -f .gitmodules --get-regexp 'submodule\..*\.url' | grep -c ' \.\./'   # must be 15 — all relative
git config -f .gitmodules --get-regexp 'submodule\..*\.branch'        # all 15 must read main
git submodule status                                   # no + or - prefix on a clean tree
```

An absolute URL in `.gitmodules` is a violation even when it works, because it works only for whoever
added it: it pins one transport under a parent origin that may use the other.

The index boundary has its own check, because nothing about it is enforced by git — `.gitnexusignore` is
what holds it, and only `analyze` reads it:

```bash
node -e "console.log(require('./.gitnexus/meta.json').stats.files)"   # low hundreds; thousands = a sub-repo got in
```

Verify each gitlink actually matches the sub-repo it points at — a pinned SHA that has drifted from the
sub-repo's `main` is the stale-pointer failure above:

```bash
git ls-files -s | awk '$1=="160000"{print $2, $4}' | while read -r sha path; do
  [ "$sha" = "$(git -C "$path" rev-parse HEAD)" ] || echo "STALE: $path"
done
```

Verify the boundary ADR-001 sets is intact — a submodule pins a sub-repo, it does not absorb it.
Note that `git ls-files <submodule-path>` returns **one** entry, the gitlink itself, so the check is that
there is nothing *besides* gitlinks under those paths:

```bash
git ls-files -s $(git config -f .gitmodules --get-regexp 'submodule\..*\.path' | awk '{print $2}') \
  | grep -vc '^160000'          # must be 0 — anything else is a sub-repo's files committed into the parent
git ls-files marketplace-services-status | wc -l   # must stay nonzero: the one directory the parent really does track
```

A violation looks like: a sub-repo path appearing in the parent's `.gitignore`; a `.gitmodules` URL on a
different transport or org from the other fourteen; a sub-repo committed on a detached HEAD; or a parent
commit that touches only its own files while the sub-repo commits it describes went in without a pointer
bump.
