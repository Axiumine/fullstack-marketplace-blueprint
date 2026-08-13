#!/usr/bin/env bash
#
# The cross-repo half of the mechanical checks this platform's security backlog introduced.
#
#   ./scripts/audit-check.sh
#
# Everything a single repo can prove about itself is a lint rule or a unit test inside that repo, and
# `docs/testing.md` §The mechanical checks lists which command runs which. What is left over is the set
# of claims that span two repos — and no test on this platform spans two repos, by construction. This
# script is that leftover, and nothing else: five greps that would otherwise be five things somebody has
# to remember to run by hand, which is precisely how the phase-5 audit was conducted and what E18-S08
# exists to stop repeating.
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

# The three files allowed to build a Redis key, all of them in `marketplace-common`. A service that
# builds its own key can neither be found by the logout service nor deleted by a revocation.
KEY_BUILDERS='^BEs/marketplace-common/src/others/(sessionKeys|assertUnderRateLimit|assertHashFieldTTLSupport)\.mts:'

srcDirs() {
	printf '%s\n' BEs/marketplace-common/src BEs/dev/*/src marketplace-*/src services-status/src
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

if [ "$FAILED" -eq 0 ]; then
	echo 'audit-check: every cross-repo check passed.'
else
	echo 'audit-check: BLOCKED — see the failures above.' >&2
fi

exit "$FAILED"
