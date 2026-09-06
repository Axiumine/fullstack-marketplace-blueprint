#!/usr/bin/env bash
#
# The cross-repo half of the mechanical checks this platform's security backlog introduced.
#
#   ./scripts/audit-check.sh
#
# Everything a single repo can prove about itself is a lint rule or a unit test inside that repo, and
# `docs/testing.md` §The mechanical checks lists which command runs which. What is left over is the set
# of claims that span two repos — and no test on this platform spans two repos, by construction. This
# script is that leftover, and nothing else: sixteen checks that would otherwise be sixteen things somebody
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

# The nine services, and only the nine: each runs an integration suite against a throwaway database that
# carries no `$jsonSchema` validator, so a fixture seeded through a Mongoose model writes whatever the
# model believes and nothing on the way in disagrees. `marketplace-common` is absent deliberately — its
# own suite tests the models themselves and has to import them — and so are the three apps and
# `marketplace-db-setup`, which own no integration harness of this shape.
DEV_SERVICES=(
	BEs/dev/marketplace-dev-admin-authenticated-authorization
	BEs/dev/marketplace-dev-admin-authenticated-resource
	BEs/dev/marketplace-dev-authenticated-authorization
	BEs/dev/marketplace-dev-authenticated-logout
	BEs/dev/marketplace-dev-authenticated-resource
	BEs/dev/marketplace-dev-public-authorization
	BEs/dev/marketplace-dev-public-resource
	BEs/dev/marketplace-dev-user-authenticated-authorization
	BEs/dev/marketplace-dev-user-authenticated-resource
)

# Every repo that holds a Redis client — the nine services, plus `marketplace-common`, whose session
# helpers call `store.del(...)` through an injected store. Each must carry the one-key-per-del block and
# the fixture that proves it fires. `marketplace-db-setup` and the three apps touch no Redis and are
# absent on purpose: a ban nothing can violate is a line nobody maintains.
REDIS_DEL_REPOS=(
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
)

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

# Every backend service that must never write `itemCategory`: the nine, minus the one that owns the
# collection. `marketplace-dev-admin-authenticated-resource` is absent on purpose and section 10 checks
# that it stays absent — a list that grew to nine would be a list that had banned the only legal writer,
# which fails loudly in that repo and would otherwise read here as an improvement.
ITEMCATEGORY_BANNED_SERVICES=(
	BEs/dev/marketplace-dev-admin-authenticated-authorization
	BEs/dev/marketplace-dev-authenticated-authorization
	BEs/dev/marketplace-dev-authenticated-logout
	BEs/dev/marketplace-dev-authenticated-resource
	BEs/dev/marketplace-dev-public-authorization
	BEs/dev/marketplace-dev-public-resource
	BEs/dev/marketplace-dev-user-authenticated-authorization
	BEs/dev/marketplace-dev-user-authenticated-resource
)

ITEMCATEGORY_WRITER=BEs/dev/marketplace-dev-admin-authenticated-resource

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

# Three facts, and none of them can be established from inside one repo. A repo that ships no
# scripts/coverage-audit.mjs, or ships one that `test:cov` never calls, has a 100% threshold over
# whatever files the report happens to contain — RISK_REGISTER R07, reopened one repo at a time and
# green in that repo's own suite the whole while. Whether the gate then passes is the script's own
# business: it runs on every `yarn test:cov` and fails loudly, so there is nothing to duplicate here.
#
# ⚠️ The third fact is that the copy is the CURRENT gate rather than an older one. The script exists
# in fifteen hand-kept copies, so a repo can sit a revision behind and be indistinguishable from a
# repo that is current — it is present, it is called, and it passes. `globRoot` is the function that
# reads a source root out of a glob, which is what R56 added: a copy without it still checks that
# every gated file reached the report, and is blind to a file no glob ever gated at all.
MISSING_GATE=0

for repo in "${GATED_REPOS[@]}"; do
	if [ ! -f "$repo/scripts/coverage-audit.mjs" ]; then
		fail "$repo — no scripts/coverage-audit.mjs"
		MISSING_GATE=1
	elif ! grep -q 'coverage-audit\.mjs' "$repo/package.json" 2> /dev/null; then
		fail "$repo — the gate is present and test:cov never calls it"
		MISSING_GATE=1
	elif ! grep -q 'globRoot' "$repo/scripts/coverage-audit.mjs"; then
		fail "$repo — the gate predates R56: no extension-drift scan, so a file no glob matches is invisible"
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
# Every rule a repo carries must appear in the parent's list, which catches a repo inventing a rule of
# its own that nothing else gets; and every repo must carry the credential-flag rule RISK_REGISTER R14
# landed, which is the one a `mongosh -password …` line slips past when a repo is missing it.
#
# ⚠️ **SECRET_PATH is checked too, and it had already drifted (R57).** The value rules were compared
# here from the day this section existed and the path rule was not, so fifteen hooks carried one
# spelling and `marketplace-nginx` carried another — narrower in five names and wider in one, which is
# the shape nobody notices: each repo refuses something, no repo refuses everything, and the hook that
# is missing a name is the hook of the repo that most needs it. Equality rather than subset, because
# unlike the value rules there is no repo-specific path worth having: a path rule that is right for one
# of the sixteen is right for all sixteen, and one line is cheaper than sixteen judgements.
CANON="$(sed "s/^SECRET_VALUE='/SECRET_VALUE+='|/" .githooks/pre-commit | grep '^SECRET_VALUE')"
CANON_PATH="$(grep '^SECRET_PATH' .githooks/pre-commit)"
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

	if [ "$(grep '^SECRET_PATH' "$dir/.githooks/pre-commit")" != "$CANON_PATH" ]; then
		fail "$label — its SECRET_PATH is not the one the parent carries, so the two hooks refuse different files"
		DRIFTED=1
	fi
}

check_rules 'parent' .

while IFS= read -r path; do
	[ -n "$path" ] || continue
	check_rules "$path" "$path"
done < <(git submodule --quiet foreach 'echo "$displaypath"' 2> /dev/null)

# ⚠️ Sixteen identical copies of a rule that matches nothing would pass every check above. So the rule
# is run, here, against paths this file names — the ones it must refuse and the ones it must not — and
# a regex that stops matching is caught by the same section that catches a regex that stops being
# copied. No file is created and none is read: `grep -E` is given the path as text, which is all the
# hook itself does with it.
#
# The second list is the one worth keeping honest. `setup/mongodb.js` is refused and
# `setup/mongodb.test.js` is not, because a rule that swallowed the test file would be edited out by
# the first person it inconvenienced; `docs/environment.md` is not refused, because a name that merely
# contains a refused word is prose.
path_rule=''
while IFS= read -r assignment; do
	value="${assignment#SECRET_PATH}"
	value="${value#+}"
	value="${value#=}"
	value="${value#\'}"
	path_rule+="${value%\'}"
done <<< "$CANON_PATH"

MUST_REFUSE=(.env .env.local BEs/dev/svc/.env setup/mongodb.js marketplace-nginx/tls/origin.pem
	secrets/redis.conf a/b/id_ed25519 certs/server.key store/keys.jks)
MUST_PASS=(env npmrc BEs/dev/svc/env docs/environment.md setup/mongodb.test.js
	src/setup/mongodbClient.mts scripts/env-fingerprint-sweep.sh package.json)
BEHAVIOUR=0

for p in "${MUST_REFUSE[@]}"; do
	printf '%s\n' "$p" | grep -Eq "$path_rule" ||
		{ fail "SECRET_PATH no longer refuses $p"; BEHAVIOUR=1; }
done

for p in "${MUST_PASS[@]}"; do
	printf '%s\n' "$p" | grep -Eq "$path_rule" &&
		{ fail "SECRET_PATH refuses $p, which is a committed file or a name that only reads like one"; BEHAVIOUR=1; }
done

[ "$BEHAVIOUR" -ne 0 ] && DRIFTED=1

[ "$DRIFTED" -eq 0 ] &&
	pass "all 16 hooks scan for the same rules, all 16 have the credential-flag rule, and the shared path rule refuses ${#MUST_REFUSE[@]} paths and passes ${#MUST_PASS[@]}"

echo
echo '9. No secret is sitting in a history that a push would publish'

# Delegated whole, because it is the same kind of claim and a different kind of read: `pre-commit` sees
# the staged diff and never the history behind it, so a value committed before a rule existed — or past
# it with `--no-verify` — is invisible to every gate this platform has. RISK_REGISTER R14 is that gap.
if ! ./scripts/history-scan.sh; then
	fail 'history-scan found a secret reachable from a branch or a tag — see above'
fi

echo
echo '10. The itemCategory write ban is carried by every service that owes it, and by no other'

# ADR-012 caps the category tree at two levels in a resolver, because a $jsonSchema validator cannot
# read the parent document to learn how deep this one sits. The cap holds for exactly as long as every
# write goes through the Admin tier, and no single repo can see whether that is still true — a second
# writer added in a neighbouring service is green in its own suite and invisible from here without this
# check. RISK_REGISTER R19.
#
# Both directions, the way section 4 checks the Sentry block: the eight must carry the selector and the
# fixture that proves it fires, and the ninth — the service that owns the collection — must not, because
# a ban there would refuse `funItemCategoryAdd` and the ban would be lifted in the one place it must
# never be lifted from.
MISSING_ITEMCATEGORY=0

for repo in "${ITEMCATEGORY_BANNED_SERVICES[@]}"; do
	config="$repo/eslint.config.js"
	fixture="$repo/test/fixtures/restrictedSyntax/item-category-write-call.mts.fixture"

	if ! grep -q 'ITEMCATEGORY_NO_WRITE' "$config" 2> /dev/null; then
		fail "$repo — no itemCategory write ban in eslint.config.js (ADR-012)"
		MISSING_ITEMCATEGORY=1
	elif [ ! -f "$fixture" ]; then
		fail "$repo — the ban is there and nothing exercises it: no item-category-write-call fixture"
		MISSING_ITEMCATEGORY=1
	elif ! grep -q 'item-category-write-call' "$repo/test/restrictedSyntax.test.mts" 2> /dev/null; then
		fail "$repo — the fixture is there and no test lints it"
		MISSING_ITEMCATEGORY=1
	fi
done

if grep -q 'ITEMCATEGORY_NO_WRITE' "$ITEMCATEGORY_WRITER/eslint.config.js" 2> /dev/null; then
	fail "$ITEMCATEGORY_WRITER — carries the ban, and it owns the collection: ADR-012 puts the depth check here"
	MISSING_ITEMCATEGORY=1
fi

[ "$MISSING_ITEMCATEGORY" -eq 0 ] && pass "all ${#ITEMCATEGORY_BANNED_SERVICES[@]} services, and the writer exempt"

echo
echo '11. Every third-party host reached from source is named in PROCESSOR_INVENTORY.md'

# A host literal in a source file is an outbound call to somebody, and personal data crossing to a
# processor is the one kind of change no gate in this workspace can see: it is a new string in one repo,
# green in that repo's own suite, and legally the most expensive line in the diff. RISK_REGISTER R25,
# whose three obligations are the platform owner's — this check is only what keeps the list they have to
# rule on from going stale between reviews.
#
# The rule is deliberately blunt: every absolute host that appears in any repo's `src/` must be named
# somewhere in `docs/devprotocol/phase5/PROCESSOR_INVENTORY.md`, §2 if personal data crosses and §3 with a
# written reason if it provably does not. A host in neither takes this red, which puts the argument at the
# moment the call is added rather than at the next audit.
#
# ⚠️ **It cannot see a processor that is configured rather than coded**, and three of the six are: Sentry
# is a DSN, SocketLabs is a server id, Cloudflare's edge is a DNS record. Nor can it see
# `VITE_NOMINATIM_URL` pointed at a third party, which turns a self-hosted dependency into a processor with
# no diff at all. §4 of that document says so; this is a drift guard, not a compliance check.
INVENTORY='docs/devprotocol/phase5/PROCESSOR_INVENTORY.md'
UNLISTED=0

if [ ! -f "$INVENTORY" ]; then
	fail "$INVENTORY is missing — every host below would pass unchecked"
	UNLISTED=1
else
	# One pass over the tracked source of every sub-repo. `git ls-files` rather than `find`, so a build
	# artefact or a gitignored scratch file can never add a host nobody committed.
	while IFS= read -r host; do
		[ -n "$host" ] || continue

		if ! grep -Fq "$host" "$INVENTORY"; then
			fail "$host — reached from source and named nowhere in PROCESSOR_INVENTORY.md"
			UNLISTED=1
		fi
	done < <(
		git submodule --quiet foreach 'git ls-files -z -- "src/*.ts" "src/*.tsx" "src/*.mts" "src/*.js" "src/*.mjs" | xargs -0 -r grep -hoE "https?://[A-Za-z0-9._-]+" || true' 2> /dev/null \
			| grep -oE 'https?://[A-Za-z0-9._-]+' \
			| sed -E 's#^https?://##' \
			| sort -u
	)
fi

[ "$UNLISTED" -eq 0 ] && pass 'every host literal in every sub-repo is a row in PROCESSOR_INVENTORY.md'

echo
echo '12. The one-key-per-del rule is carried by every repo that holds a Redis client'

# BCON-08 / NFR-SC03, RISK_REGISTER R32. Redis is a cluster, so a multi-key `DEL` throws CROSSSLOT unless
# every key hashes to the same slot — which digested session keys never do. The rule that refuses the
# batched form is ten copies of one block, and ten copies drift: a repo that loses its copy is green in
# its own suite and invisible from every other repo, which is the shape this script exists for.
#
# Three things per repo, because any one of them alone is decoration: the block, the fixture that plants
# the violation, and a test that lints it. A block with no fixture is a rule nobody has ever seen fire.
MISSING_REDIS_DEL=0

for repo in "${REDIS_DEL_REPOS[@]}"; do
	config="$repo/eslint.config.js"
	fixture="$repo/test/fixtures/restrictedSyntax/redis-del-array-argument.mts.fixture"

	if ! grep -q 'REDIS_ONE_KEY_PER_DEL' "$config" 2> /dev/null; then
		fail "$repo — no one-key-per-del block in eslint.config.js (BCON-08)"
		MISSING_REDIS_DEL=1
	elif [ ! -f "$fixture" ]; then
		fail "$repo — the block is there and nothing exercises it: no redis-del-array-argument fixture"
		MISSING_REDIS_DEL=1
	elif ! grep -q 'redis-del-array-argument' "$repo/test/restrictedSyntax.test.mts" 2> /dev/null; then
		fail "$repo — the fixture is there and no test lints it"
		MISSING_REDIS_DEL=1
	fi
done

# The spread is what carries the block into a later config object naming the same rule, and a later
# object without it discards every selector the earlier one set for the files it matches. Each repo must
# spread it as many times as it declares the rule.
for repo in "${REDIS_DEL_REPOS[@]}"; do
	config="$repo/eslint.config.js"
	[ -f "$config" ] || continue

	declared=$(grep -c "'no-restricted-syntax':" "$config")
	spread=$(grep -c '\.\.\.REDIS_ONE_KEY_PER_DEL' "$config")

	if [ "$declared" -ne "$spread" ]; then
		fail "$repo — declares no-restricted-syntax $declared times and spreads the redis block $spread: the odd one out un-bans it"
		MISSING_REDIS_DEL=1
	fi
done

[ "$MISSING_REDIS_DEL" -eq 0 ] && pass "all ${#REDIS_DEL_REPOS[@]} repos carry the block, its fixture and its test"

echo
echo '13. Every service refuses a model-seeded integration test'

# RISK_REGISTER R33, docs/testing.md "Integration test conventions" (MC-23). The convention is that an
# integration fixture reaches the collection through the raw driver, because the model is a second
# description of a shape whose first description is a `$jsonSchema` validator in another repo — and the
# per-repo test databases carry no validator, so the two can disagree with nothing to say so.
#
# Nine copies of one block drift the way ten did in §12. Three things per repo, since any one alone is
# decoration: the block, the fixture that plants the violation, and the test that lints it.
MISSING_SEED_BAN=0

for repo in "${DEV_SERVICES[@]}"; do
	config="$repo/eslint.config.js"
	fixture="$repo/test/fixtures/restrictedSyntax/integration-seed-via-model.mts.fixture"

	if ! grep -q 'INTEGRATION_SEED_NO_MODEL' "$config" 2> /dev/null; then
		fail "$repo — no integration-seed block in eslint.config.js (R33)"
		MISSING_SEED_BAN=1
	elif ! grep -q "files: \['test/integration/\*\*/\*.mts'\]" "$config" 2> /dev/null; then
		fail "$repo — the block is there and scoped to something other than test/integration/**"
		MISSING_SEED_BAN=1
	elif [ ! -f "$fixture" ]; then
		fail "$repo — the block is there and nothing exercises it: no integration-seed-via-model fixture"
		MISSING_SEED_BAN=1
	elif ! grep -q 'integration-seed-via-model' "$repo/test/restrictedSyntax.test.mts" 2> /dev/null; then
		fail "$repo — the fixture is there and no test lints it"
		MISSING_SEED_BAN=1
	fi
done

# Same replacement hazard as §12, on a different rule: a later config object naming
# `no-restricted-imports` discards this one's patterns for every file it matches, silently. Each repo
# must wire the constant into as many declarations as it makes.
for repo in "${DEV_SERVICES[@]}"; do
	config="$repo/eslint.config.js"
	[ -f "$config" ] || continue

	declared=$(grep -c "'no-restricted-imports':" "$config")
	wired=$(grep -c 'INTEGRATION_SEED_NO_MODEL\]' "$config")

	if [ "$declared" -ne "$wired" ]; then
		fail "$repo — declares no-restricted-imports $declared times and wires the seed block $wired: the odd one out un-bans it"
		MISSING_SEED_BAN=1
	fi
done

[ "$MISSING_SEED_BAN" -eq 0 ] && pass "all ${#DEV_SERVICES[@]} services carry the block, its fixture and its test"

echo
echo '14. Every consumer resolves the marketplace-common paths it names'

# RISK_REGISTER R34 (MC-24). `marketplace-common` reaches a consumer by being published and by nothing
# else, and each consumer moves its own range deliberately - so a repo lagging the shipped version is
# the design and not a finding. The bump that was *owed* and forgotten is the finding, and it looks
# identical from inside the repo that owes it: `yarn.lock` names a version, `node_modules` holds
# whatever is there, and every gate that repo runs agrees with both.
#
# Delegated whole, like §9, because it reads four files per consumer and answers in versions rather
# than in grep hits.
if ! node ./scripts/common-consumer-check.mjs; then
	fail 'a consumer names a marketplace-common path its own lockfile cannot resolve — see above'
fi

echo
echo '15. All sixteen pre-commit hooks refuse a commit that would land on main'

# RISK_REGISTER R35 (MC-25). Sixteen separate copies of one guard, and the same drift the secret rules
# have in §8: a repo that loses it loses it alone, and the loss looks like nothing at all — commits
# keep working, which is the whole problem.
#
# Three greps rather than one, because two of the three lines are what makes the guard survivable. The
# `MERGE_HEAD` exemption is why finishing a conflicted merge into `main` by hand still works, and
# `SKIP_MAIN_GUARD` is why the one legitimate commit onto `main` — the first commit of a new repo,
# `git init` having started there — does not need `--no-verify`, which would drop the secret guard too.
GUARD_DRIFTED=0

check_main_guard() {
	local label="$1" hook="$2/.githooks/pre-commit"

	if ! grep -q 'symbolic-ref --short HEAD' "$hook" 2> /dev/null; then
		fail "$label — no branch guard in .githooks/pre-commit: a commit onto main passes every gate (R35)"
		GUARD_DRIFTED=1
	elif ! grep -q 'MERGE_HEAD' "$hook"; then
		fail "$label — branch guard with no MERGE_HEAD exemption: finishing a conflicted merge into main is blocked"
		GUARD_DRIFTED=1
	elif ! grep -q 'SKIP_MAIN_GUARD' "$hook"; then
		fail "$label — branch guard with no named escape hatch, so the way past it is --no-verify, which drops the secret guard too"
		GUARD_DRIFTED=1
	fi
}

check_main_guard 'parent' .

while IFS= read -r path; do
	[ -n "$path" ] || continue
	check_main_guard "$path" "$path"
done < <(git submodule --quiet foreach 'echo "$displaypath"' 2> /dev/null)

[ "$GUARD_DRIFTED" -eq 0 ] && pass 'all 16 hooks block a commit onto main, exempt an in-progress merge, and name their own escape hatch'

echo
echo '16. Every shared environment value is held identically everywhere it is read'

# RISK_REGISTER R39, docs/PRODUCTION_HARDENING.md §4, ADR-040 §Decision-3 (MC-26). "Nothing on this
# platform proves that nine environment files hold the same REDIS_KEY, or that six hold the same
# KEYGRIP_KEK, before a deploy" - the one sentence on that page that names a gap ADR-040 explicitly
# does NOT decline, because a fingerprint sweep needs no vendor to exist.
#
# Two halves, and only the second one is about this machine. The self-test builds a tree under
# `mktemp -d` and plants drift, a shadow, a gap and three things that only look like drift - it is
# what keeps the sweep from becoming a check that cannot fail. The sweep proper then reads the real
# files and prints six hex per key, never a value, and exits 0 on a clone nobody has provisioned yet.
if ! ./scripts/env-fingerprint-sweep-selftest.sh > /dev/null 2>&1; then
	fail 'the fingerprint sweep does not behave as documented - run ./scripts/env-fingerprint-sweep-selftest.sh'
elif ! ./scripts/env-fingerprint-sweep.sh > /dev/null 2>&1; then
	fail 'a shared value disagrees with itself - run ./scripts/env-fingerprint-sweep.sh for which key and which files'
else
	pass 'the sweep fires on planted drift, and finds none in this workspace'
fi

echo
echo '17. A personal field is encrypted in both halves of ADR-029 or in neither'

# RISK_REGISTER R48, docs/report/encryption-at-rest-coverage.md, ADR-029 (MC-27). A field is encrypted
# by appearing in two places that cannot see each other - the field map in `marketplace-common` and the
# `$jsonSchema` in `marketplace-db-setup` - and `encryptedFields.mts` says of that pairing, in its own
# header, "Nothing gates that". This is the gate. The direction that matters is the quiet one: a
# `binData` the client never encrypts fails every write, or sits in the clear if the validator is
# rebuilt after the model, and nothing else on this platform would say so.
#
# Same two halves as §16: the self-test writes a two-repo tree under `mktemp -d` and plants each
# direction of the mistake plus two unreadable sources, then the check reads the real files. Exit 2 -
# a source it cannot read - is a failure here rather than a pass, which is the whole point of it being
# a separate status.
if ! ./scripts/encryption-coverage-check-selftest.sh > /dev/null 2>&1; then
	fail 'the encryption coverage check does not behave as documented - run ./scripts/encryption-coverage-check-selftest.sh'
elif ! node ./scripts/encryption-coverage-check.mjs > /dev/null 2>&1; then
	fail 'a field is encrypted in one half of ADR-029 and not the other - run node ./scripts/encryption-coverage-check.mjs'
else
	pass 'the field map and the validators name the same encrypted paths, and the check fires when they do not'
fi

echo

if [ "$FAILED" -eq 0 ]; then
	echo 'audit-check: every cross-repo check passed.'
else
	echo 'audit-check: BLOCKED — see the failures above.' >&2
fi

exit "$FAILED"
