#!/usr/bin/env bash
#
# The cross-repo half of the mechanical checks this platform's security backlog introduced.
#
#   ./scripts/audit-check.sh
#
# Everything a single repo can prove about itself is a lint rule or a unit test inside that repo, and
# `docs/testing.md` §The mechanical checks lists which command runs which. What is left over is the set
# of claims that span two repos — and no test on this platform spans two repos, by construction. This
# script is that leftover, and nothing else: nine checks that would otherwise be nine things somebody
# has to remember to run by hand, which is precisely how the phase-5 audit was conducted and what this
# script exists to stop repeating.
#
# It reads. It never writes, never installs, never starts a container, and needs no service running.
#
# Exit 0 = every check passed. Exit 1 = at least one failed, with the offending lines printed under it.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

FAILED=0

pass() { printf '  ✓ %s\n' "$1"; }

fail() {
	printf '  ✗ %s\n' "$1"
	FAILED=1
}

# Every repo that calls `Sentry.init`, plus `marketplace-common`, which owns the scrubber both hooks are
# wired to. Each must carry the `no-restricted-syntax` block and the suite that proves it fires.
SENTRY_REPOS=(
	BEs/marketplace-common
	BEs/dev/marketplace-dev-admin-authenticated-authorization
	BEs/dev/marketplace-dev-admin-authenticated-resource
	BEs/dev/marketplace-dev-authenticated-authorization
	BEs/dev/marketplace-dev-authenticated-logout
	BEs/dev/marketplace-dev-authenticated-resource
	BEs/dev/marketplace-dev-public-authorization
	BEs/dev/marketplace-dev-public-resource
	BEs/dev/marketplace-dev-user-authenticated-authorization
	BEs/dev/marketplace-dev-user-authenticated-resource
	marketplace-admin
	marketplace-shopowner
	marketplace-user
)

# The seven services with a credential to refuse. The two public ones authenticate nobody and are
# exempt in `AUTH_BOUNDARY_SERVICES` with a written sentence, not an empty cell.
AUTH_SERVICES=(
	BEs/dev/marketplace-dev-admin-authenticated-authorization
	BEs/dev/marketplace-dev-admin-authenticated-resource
	BEs/dev/marketplace-dev-authenticated-authorization
	BEs/dev/marketplace-dev-authenticated-logout
	BEs/dev/marketplace-dev-authenticated-resource
	BEs/dev/marketplace-dev-user-authenticated-authorization
	BEs/dev/marketplace-dev-user-authenticated-resource
)

# Every package with a coverage threshold, and therefore every package that owes the file-count gate.
# The nine services and marketplace-common gate `src/**`, marketplace-db-setup gates four directories of
# `.js`, the three apps gate `src/**` with an exclude list, and marketplace-services-status gates `src/**/*.ts`.
GATED_REPOS=(
	BEs/marketplace-common
	BEs/marketplace-db-setup
	BEs/dev/marketplace-dev-admin-authenticated-authorization
	BEs/dev/marketplace-dev-admin-authenticated-resource
	BEs/dev/marketplace-dev-authenticated-authorization
	BEs/dev/marketplace-dev-authenticated-logout
	BEs/dev/marketplace-dev-authenticated-resource
	BEs/dev/marketplace-dev-public-authorization
	BEs/dev/marketplace-dev-public-resource
	BEs/dev/marketplace-dev-user-authenticated-authorization
	BEs/dev/marketplace-dev-user-authenticated-resource
	marketplace-admin
	marketplace-shopowner
	marketplace-user
	marketplace-services-status
)

# The three files allowed to build a Redis key, all of them in `marketplace-common`. A service that
# builds its own key can neither be found by the logout service nor deleted by a revocation.
KEY_BUILDERS='^BEs/marketplace-common/src/others/(sessionKeys|assertUnderRateLimit|assertHashFieldTTLSupport)\.mts:'

srcDirs() {
	printf '%s\n' BEs/marketplace-common/src BEs/dev/*/src marketplace-*/src marketplace-services-status/src
}

echo
echo '1. Redis keys are built in marketplace-common and nowhere else'

STRAY_KEYS="$(grep -rn --include='*.mts' --include='*.ts' -F '${process.env.REDIS_KEY}' $(srcDirs) 2>/dev/null |
	grep -Ev "$KEY_BUILDERS" || true)"

if [ -z "$STRAY_KEYS" ]; then
	pass 'no key built outside the three builder files'
else
	fail 'a Redis key is built outside marketplace-common/src/others:'
	printf '      %s\n' "$STRAY_KEYS"
fi

echo
echo '2. Every key shape is a row in docs/data-model.md §Key shapes'

# The literal segment each builder puts in front of whatever varies — `used:`, `idx:`, `keygrip`, and so
# on. A builder whose key is nothing but the prefix and a digest contributes an empty segment and is
# skipped: there is no word to look for, and the two rows that describe those keys are the table's first.
UNDOCUMENTED=''

while IFS= read -r segment; do
	[ -z "$segment" ] && continue
	grep -qF -- "$segment" docs/data-model.md || UNDOCUMENTED="$UNDOCUMENTED $segment"
done < <(grep -rhoE '\$\{process\.env\.REDIS_KEY\}[a-z:-]+' \
	BEs/marketplace-common/src/others/sessionKeys.mts \
	BEs/marketplace-common/src/others/assertUnderRateLimit.mts \
	BEs/marketplace-common/src/others/assertHashFieldTTLSupport.mts 2>/dev/null |
	sed 's/${process.env.REDIS_KEY}//' | sort -u)

if [ -z "$UNDOCUMENTED" ]; then
	pass 'every key-shape word the builders write appears in the data model'
else
	fail "a key shape is built and documented nowhere:$UNDOCUMENTED"
	printf '      add the row to docs/data-model.md §Key shapes, and the entry to\n'
	printf '      BEs/marketplace-common/test/redisKeyspace.test.mts\n'
fi

echo
echo '3. No service trusts a forwarded client address'

# `app.proxy` is Koa's switch for believing `X-Forwarded-For`. It is off by default and is never set here,
# which is what makes "no caller can pass an address as a rate-limit identity" structural rather than a
# convention — a resolver has no client address to pass.
PROXY_HITS="$(grep -rn --include='*.mts' -E '\.proxy[[:space:]]*=|proxy:[[:space:]]*true' BEs/dev/*/src 2>/dev/null || true)"

if [ -z "$PROXY_HITS" ]; then
	pass 'app.proxy is set in none of the nine services'
else
	fail 'a service enables app.proxy — the client address becomes readable, and bucket keys with it:'
	printf '      %s\n' "$PROXY_HITS"
fi

echo
echo '4. Every repo with a Sentry init carries the lint block and its suite'

MISSING_BLOCK=0

for repo in "${SENTRY_REPOS[@]}"; do
	config="$repo/eslint.config.js"
	suite="$(ls "$repo"/test/restrictedSyntax.test.* 2> /dev/null | head -n 1)"

	if ! grep -q "sendDefaultPii" "$config" 2> /dev/null; then
		fail "$repo — no sendDefaultPii selector in eslint.config.js"
		MISSING_BLOCK=1
	elif [ -z "$suite" ]; then
		fail "$repo — the block is there and nothing exercises it: no test/restrictedSyntax.test.*"
		MISSING_BLOCK=1
	fi
done

[ "$MISSING_BLOCK" -eq 0 ] && pass "all ${#SENTRY_REPOS[@]} repos"

echo
echo '5. Every authenticated service carries the boundary contract suite'

MISSING_BOUNDARY=0

for repo in "${AUTH_SERVICES[@]}"; do
	if [ ! -f "$repo/test/authBoundaryContract.test.mts" ]; then
		fail "$repo — no test/authBoundaryContract.test.mts"
		MISSING_BOUNDARY=1
	fi
done

[ "$MISSING_BOUNDARY" -eq 0 ] && pass "all ${#AUTH_SERVICES[@]} services"

echo
echo '6. Every coverage-gated repo carries the file-count gate and actually runs it'

# Two facts, and neither can be established from inside one repo. A repo that ships no
# scripts/coverage-audit.mjs, or ships one that `test:cov` never calls, has a 100% threshold over
# whatever files the report happens to contain — RISK_REGISTER R07, reopened one repo at a time and
# green in that repo's own suite the whole while. Whether the gate then passes is the script's own
# business: it runs on every `yarn test:cov` and fails loudly, so there is nothing to duplicate here.
MISSING_GATE=0

for repo in "${GATED_REPOS[@]}"; do
	if [ ! -f "$repo/scripts/coverage-audit.mjs" ]; then
		fail "$repo — no scripts/coverage-audit.mjs"
		MISSING_GATE=1
	elif ! grep -q 'coverage-audit\.mjs' "$repo/package.json" 2> /dev/null; then
		fail "$repo — the gate is present and test:cov never calls it"
		MISSING_GATE=1
	fi
done

[ "$MISSING_GATE" -eq 0 ] && pass "all ${#GATED_REPOS[@]} gated packages"

echo
echo '7. Every repo has its hooks armed, and the hook they point at can actually run'

# The one check here that cannot be a gate, and has to be a check for that reason.
#
# `core.hooksPath` is local git config. It is not tracked, it does not travel with a clone, and git
# will never set it from tracked content — a repository that could arm its own hooks would execute a
# stranger's script on `git clone`. So a fresh checkout of any of the sixteen starts with every gate
# off and nothing saying so (RISK_REGISTER R09), and the hook that would notice is the one that is
# off. Fourteen repos heal on `yarn install` through `"prepare"`; this workspace and
# `marketplace-nginx` have no `package.json` and never will (ADR-025, ADR-030 option D), so for those
# two the value is typed by hand — `./scripts/bootstrap.sh` types it.
#
# The executable bit is the second half of the same silent failure: git skips a hook it cannot
# execute with a hint on stderr and an exit code of zero, which is indistinguishable from a hook that
# ran and was happy.
UNARMED=0

check_armed() {
	local label="$1" dir="$2"
	local hooks

	hooks="$(git -C "$dir" config --get core.hooksPath)"

	if [ "$hooks" != '.githooks' ]; then
		fail "$label — core.hooksPath is '${hooks:-unset}', so every gate in this repo is off. Fix: ./scripts/bootstrap.sh"
		UNARMED=1

		return
	fi

	if [ ! -x "$dir/.githooks/pre-commit" ]; then
		fail "$label — .githooks/pre-commit is not executable, and git skips it with a hint and exit 0. Fix: chmod +x $dir/.githooks/*"
		UNARMED=1
	fi
}

check_armed 'parent' .

while IFS= read -r path; do
	[ -n "$path" ] || continue
	check_armed "$path" "$path"
done < <(git submodule --quiet foreach 'echo "$displaypath"' 2> /dev/null)

[ "$UNARMED" -eq 0 ] && pass 'all 16 repos armed, every .githooks/pre-commit executable'

echo
echo '8. The secret rules have not drifted apart across the sixteen pre-commit hooks'

# Each repo carries its own copy of the hook — not a symlink, not a template — so a rule added to one
# is added to one. The parent's list is the superset by construction: every rule any repo has, it has.
# Two things are checked, and neither can be seen from inside a repo. Every rule a repo carries must
# appear in the parent's list, which catches a repo inventing a rule of its own that nothing else gets;
# and every repo must carry the credential-flag rule RISK_REGISTER R14 landed, which is the one a
# `mongosh -password …` line slips past when a repo is missing it.
CANON="$(sed "s/^SECRET_VALUE='/SECRET_VALUE+='|/" .githooks/pre-commit | grep '^SECRET_VALUE')"
DRIFTED=0

check_rules() {
	local label="$1" dir="$2"
	local own extra

	own="$(sed "s/^SECRET_VALUE='/SECRET_VALUE+='|/" "$dir/.githooks/pre-commit" 2> /dev/null | grep '^SECRET_VALUE')"

	if [ -z "$own" ]; then
		fail "$label — no SECRET_VALUE rules in .githooks/pre-commit at all"
		DRIFTED=1

		return
	fi

	extra="$(printf '%s\n' "$own" | grep -Fxv -f <(printf '%s\n' "$CANON") || true)"

	if [ -n "$extra" ]; then
		fail "$label — carries a secret rule the parent's list does not have:"
		printf '      %s\n' "$extra"
		DRIFTED=1
	fi

	if ! grep -qF -- '(password|passwd|pwd|pass)' "$dir/.githooks/pre-commit"; then
		fail "$label — no credential-flag rule, so a \`-password <the value>\` line commits clean (R14)"
		DRIFTED=1
	fi
}

check_rules 'parent' .

while IFS= read -r path; do
	[ -n "$path" ] || continue
	check_rules "$path" "$path"
done < <(git submodule --quiet foreach 'echo "$displaypath"' 2> /dev/null)

[ "$DRIFTED" -eq 0 ] && pass 'all 16 hooks scan for the same rules, and all 16 have the credential-flag rule'

echo
echo '9. No secret is sitting in a history that a push would publish'

# Delegated whole, because it is the same kind of claim and a different kind of read: `pre-commit` sees
# the staged diff and never the history behind it, so a value committed before a rule existed — or past
# it with `--no-verify` — is invisible to every gate this platform has. RISK_REGISTER R14 is that gap.
if ! ./scripts/history-scan.sh; then
	fail 'history-scan found a secret reachable from a branch or a tag — see above'
fi

echo

if [ "$FAILED" -eq 0 ]; then
	echo 'audit-check: every cross-repo check passed.'
else
	echo 'audit-check: BLOCKED — see the failures above.' >&2
fi

exit "$FAILED"
