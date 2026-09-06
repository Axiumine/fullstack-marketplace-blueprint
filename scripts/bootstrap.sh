#!/usr/bin/env bash
#
# bootstrap.sh — arm a fresh checkout of this workspace.
#
#   ./scripts/bootstrap.sh
#
# `core.hooksPath` is local git config. It lives in `.git/config`, it is not tracked, and git will
# never set it for you on clone — that is a deliberate security property of git, not an oversight:
# a repository that could arm its own hooks from tracked content would execute a stranger's script
# on `git clone`. The consequence here is that every one of the sixteen repos starts a fresh
# checkout with **every gate off and nothing saying so** — the secret guard, the coverage and
# mutation thresholds, `nginx -t`, the whole apparatus (RISK_REGISTER R09).
#
# Fourteen of the sixteen heal themselves: they are npm packages, and their `"prepare"` script
# re-runs the `git config` line on every `yarn install`. Two cannot, because they have no
# `package.json` and by decision never will — this parent workspace (ADR-025) and
# `marketplace-nginx` (ADR-030 option D, rejected: a JavaScript toolchain invented to host one line
# of git config is the appearance of a gate). For those two the line is typed by hand, which is
# what this script exists to stop being five lines of it.
#
# It is the `SETUP.md` §2 sequence and nothing more. It is safe to re-run on a workspace that is
# already in use — the two steps that could destroy work are both conditional:
#
#   * `git submodule update --init` runs **only** for submodules that are not initialised yet.
#     Running it over an initialised one checks out the commit the parent pins, which detaches HEAD
#     and leaves any commit made on that branch reachable from nothing.
#   * `git switch main` runs **only** for a submodule that is on a detached HEAD. A submodule
#     already on a branch — `main` or a feature branch mid-task — is left exactly where it is.
#
# It writes git config and nothing else: no install, no build, no container, no network beyond the
# submodule fetch a first init needs.
#
# Exit 0 = the workspace is armed. Exit 1 = at least one step failed, named under it.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

FAILED=0

pass() { printf '  ✓ %s\n' "$1"; }

fail() {
	printf '  ✗ %s\n' "$1"
	FAILED=1
}

note() { printf '  · %s\n' "$1"; }

echo
echo "bootstrap: $ROOT"
echo
echo '1. Submodules that have never been initialised'

# `git submodule status` prefixes an uninitialised entry with `-`. Anything else — ` `, `+`, `U` —
# is a working tree somebody may have work in, and is never touched here.
if ! status="$(git submodule status)"; then
	fail 'git submodule status failed — is this the workspace root?'
else
	uninit="$(printf '%s\n' "$status" | awk '/^-/ { print $2 }')"

	if [ -z "$uninit" ]; then
		note 'none — every submodule is already checked out'
	else
		while IFS= read -r path; do
			[ -n "$path" ] || continue
			if git submodule update --init -- "$path" > /dev/null; then
				pass "$path — initialised"
			else
				fail "$path — git submodule update --init failed"
			fi
		done <<< "$uninit"
	fi
fi

echo
echo '2. Submodules left on a detached HEAD'

# A commit made on a detached HEAD is reachable from nothing and disappears at the next checkout,
# looking entirely normal until it does. `git submodule update` leaves every submodule there, which
# is why this step exists at all — and why it refuses to move one that is already on a branch.
DETACHED=0

while IFS= read -r path; do
	[ -n "$path" ] || continue

	branch="$(git -C "$path" branch --show-current 2> /dev/null)"

	if [ -n "$branch" ]; then
		continue
	fi

	DETACHED=1

	if git -C "$path" switch main > /dev/null 2>&1; then
		pass "$path — switched to main"
	else
		fail "$path — detached, and 'git switch main' failed; switch it by hand before editing"
	fi
done < <(git submodule --quiet foreach 'echo "$displaypath"' 2> /dev/null)

[ "$DETACHED" -eq 0 ] && note 'none — every submodule is on a branch'

echo
echo '3. core.hooksPath, in the parent and in all fifteen submodules'

# Relative on purpose: git resolves `core.hooksPath` against the root of the working tree the hooks
# run in, so one value is correct in sixteen repos and keeps working from a subdirectory.
if git config core.hooksPath .githooks; then
	pass 'parent — core.hooksPath=.githooks'
else
	fail 'parent — git config core.hooksPath failed'
fi

if git submodule --quiet foreach 'git config core.hooksPath .githooks'; then
	pass 'all fifteen submodules — core.hooksPath=.githooks'
else
	fail 'at least one submodule — git config core.hooksPath failed'
fi

echo
echo '4. push.recurseSubmodules'

# `check` refuses a parent push whose submodule commits are not on their remotes yet, which is the
# only thing standing between a pointer bump and a superproject that describes commits nobody else
# can fetch.
if git config push.recurseSubmodules check; then
	pass 'parent — push.recurseSubmodules=check'
else
	fail 'parent — git config push.recurseSubmodules failed'
fi

echo
echo '5. What every repo is armed with now'

printf '  %-62s %-22s %s\n' 'repo' 'core.hooksPath' 'branch'
printf '  %-62s %-22s %s\n' '.' "$(git config --get core.hooksPath || echo 'UNSET')" "$(git branch --show-current || echo 'DETACHED')"

while IFS= read -r path; do
	[ -n "$path" ] || continue

	hooks="$(git -C "$path" config --get core.hooksPath)"
	[ -n "$hooks" ] || hooks='UNSET'

	branch="$(git -C "$path" branch --show-current)"
	[ -n "$branch" ] || branch='DETACHED'

	printf '  %-62s %-22s %s\n' "$path" "$hooks" "$branch"

	[ "$hooks" = '.githooks' ] || FAILED=1
done < <(git submodule --quiet foreach 'echo "$displaypath"' 2> /dev/null)

echo

if [ "$FAILED" -eq 0 ]; then
	echo 'bootstrap: the workspace is armed. `./scripts/audit-check.sh` §7 re-checks it at any time.'
else
	echo 'bootstrap: BLOCKED — see the failures above.' >&2
fi

exit "$FAILED"
