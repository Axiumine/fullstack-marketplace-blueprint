#!/usr/bin/env bash
#
# Proves `./scripts/service-role-check.mjs` in every direction, against a three-service tree this file
# writes — because a check that has only ever been run on a workspace where the table and the code
# already agree is indistinguishable from one that prints "agree" unconditionally.
#
#   ./scripts/service-role-check-selftest.sh
#
# ⚠️ **Nothing here touches this workspace.** The fixture is a `mktemp -d` tree holding the two paths
# the check reads — an `init/roles.js` and a `BEs/dev/` with a `src/` per service — the check is
# pointed at it with SERVICE_ROLE_CHECK_ROOT, and the tree is removed on exit. That is what lets a
# gate run this half unattended while the check itself reads the real sources.
#
# The fixture keeps the shape of the real file rather than a reduction of it: `roles.js` is a mongosh
# script of declarations that the check *evaluates*, so a fixture built out of JSON would prove
# nothing about the way it actually reads that file.

set -uo pipefail

CHECK="$(cd "$(dirname "$0")" && pwd)/service-role-check.mjs"
FIXTURES=$(mktemp -d) && trap 'rm -rf "$FIXTURES"' EXIT

FAILED=0
PASSED=0

pass() { printf '  ✓ %s\n' "$1"; PASSED=$((PASSED + 1)); }
fail() { printf '  ✗ %s\n' "$1"; FAILED=1; }

ROLES_DIR="marketplace-docker-DBs/init"
DEV="BEs/dev"

# Three services: one that reaches two collections, one that reaches one, one that reaches none.
# `$1` is appended to the first service's source — the lever most cases below pull — and `$2` to the
# collection list its role grants.
build() {
	rm -rf "${FIXTURES:?}" && mkdir -p "$FIXTURES/$ROLES_DIR" \
		"$FIXTURES/$DEV/marketplace-dev-alpha-resource/src/lib" \
		"$FIXTURES/$DEV/marketplace-dev-beta-authorization/src" \
		"$FIXTURES/$DEV/marketplace-dev-gamma-logout/src"

	cat > "$FIXTURES/$ROLES_DIR/roles.js" <<-JS
		const SERVICE_COLLECTIONS = {
			marketplaceAlphaResDev: ['company', 'item'${2:-}],
			marketplaceBetaAuthzDev: ['admin']
		}
		const SERVICE_REPOS = {
			marketplaceAlphaResDev: 'marketplace-dev-alpha-resource',
			marketplaceBetaAuthzDev: 'marketplace-dev-beta-authorization'
		}
		const NO_DATABASE_SERVICES = ['marketplace-dev-gamma-logout']
		function roleNameFor(user) {
			return user + 'Role'
		}
	JS

	{
		printf "import { Company } from '@axiumine/marketplace-common/models/MongoDB/Company.mjs'\n"
		printf "import { Item } from '@axiumine/marketplace-common/models/MongoDB/Item.mjs'\n"
		printf '%b' "${1:-}"
	} > "$FIXTURES/$DEV/marketplace-dev-alpha-resource/src/lib/read.mts"

	# A second file, one directory down, so the walk is proved to descend rather than read a flat dir.
	printf "import { Admin } from '@axiumine/marketplace-common/models/MongoDB/Admin.mjs'\n" \
		> "$FIXTURES/$DEV/marketplace-dev-beta-authorization/src/index.mts"

	printf "import { redisClient } from '@axiumine/koa-utils/dataSources/Redis'\n" \
		> "$FIXTURES/$DEV/marketplace-dev-gamma-logout/src/index.mts"
}

run() {
	SERVICE_ROLE_CHECK_ROOT="$FIXTURES" node "$CHECK" > "$FIXTURES/out.txt" 2>&1
	printf '%d' "$?"
}

printf '\nservice-role-check, every direction\n\n'

# 1. The table and the code agreeing, across a nested source directory and a service with no database.
build
status=$(run)
if [ "$status" = '0' ] && grep -q '2 services match the collections their role grants' "$FIXTURES/out.txt"; then
	pass 'a table that matches the code passes, and the walk descends into subdirectories'
else
	fail "an agreeing table did not pass (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 2. The row that matters — a resolver importing a model the service's role does not grant. On the day
#    those roles are provisioned this is an Unauthorized at first use; today it is silent.
build "import { User } from '@axiumine/marketplace-common/models/MongoDB/User.mjs'\n"
status=$(run)
if [ "$status" = '1' ] && grep -q 'reaches user, which marketplaceAlphaResDev does not grant' "$FIXTURES/out.txt"; then
	pass 'a model imported outside the role fails, and the collection is named'
else
	fail "an ungranted model import did not fail (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 3. The other direction, and the quieter one: a role granting a collection nothing imports. Nothing
#    breaks, which is exactly why it survives — it is standing access to a collection the service has
#    no code for.
build '' ", 'user'"
status=$(run)
if [ "$status" = '1' ] && grep -q 'is granted user and imports no model for it' "$FIXTURES/out.txt"; then
	pass 'a granted collection nothing reaches fails, and is named'
else
	fail "an unused grant did not fail (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 4. The service declared to hold no connection, holding one. `NO_DATABASE_SERVICES` is an assertion
#    rather than an exemption, and this is the case that says so.
build
printf "import { User } from '@axiumine/marketplace-common/models/MongoDB/User.mjs'\n" \
	>> "$FIXTURES/$DEV/marketplace-dev-gamma-logout/src/index.mts"
status=$(run)
if [ "$status" = '1' ] && grep -q 'reaches user and has no account to authenticate as' "$FIXTURES/out.txt"; then
	pass 'a service declared database-free that imports a model fails'
else
	fail "a model in a no-database service did not fail (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 5. A service in neither list. It reads exactly like a pass — nothing measured it — which is the one
#    failure a per-entry loop cannot see by itself.
build
mkdir -p "$FIXTURES/$DEV/marketplace-dev-delta-resource/src"
printf "import { Item } from '@axiumine/marketplace-common/models/MongoDB/Item.mjs'\n" \
	> "$FIXTURES/$DEV/marketplace-dev-delta-resource/src/index.mts"
status=$(run)
if [ "$status" = '1' ] && grep -q 'is in neither SERVICE_REPOS nor NO_DATABASE_SERVICES' "$FIXTURES/out.txt"; then
	pass 'a service in neither table fails rather than going unmeasured'
else
	fail "an unlisted service did not fail (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 6. The premise of the whole derivation: the import list is the collection list only while nothing
#    reaches the raw driver. One `db.collection(…)` and every row above is a guess.
build "const rows = await db.collection('admin').find({}).toArray()\n"
status=$(run)
if [ "$status" = '1' ] && grep -q 'reaches MongoDB through db.collection' "$FIXTURES/out.txt"; then
	pass 'a raw-driver call in a service source fails, and the file is named'
else
	fail "a raw-driver escape did not fail (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 7. The tables renamed. A check that evaluates a file has to fail loudly when the names it reads are
#    gone, or it measures an empty table and calls it agreement.
build
sed -i 's/const SERVICE_REPOS/const SERVICE_DIRECTORIES/' "$FIXTURES/$ROLES_DIR/roles.js"
status=$(run)
if [ "$status" = '2' ] && grep -q 'no longer declares the three tables' "$FIXTURES/out.txt"; then
	pass 'a renamed table exits 2 rather than measuring nothing'
else
	fail "a renamed table did not exit 2 (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 8. The file itself gone. Same reasoning as case 7, one step earlier.
build
rm -f "$FIXTURES/$ROLES_DIR/roles.js"
status=$(run)
if [ "$status" = '2' ] && grep -q 'is missing' "$FIXTURES/out.txt"; then
	pass 'a missing roles.js exits 2 rather than reporting agreement'
else
	fail "a missing roles.js did not exit 2 (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 9. A service named in the table whose source is not there — a renamed directory, a submodule nobody
#    initialised. Zero models read out of a directory that does not exist would otherwise look like a
#    service that reaches nothing.
build
rm -rf "$FIXTURES/$DEV/marketplace-dev-beta-authorization"
status=$(run)
if [ "$status" = '2' ] && grep -q 'has no source to derive a role from' "$FIXTURES/out.txt"; then
	pass 'a listed service with no src/ exits 2 rather than reading as reaching nothing'
else
	fail "a missing service source did not exit 2 (exit $status)"
	cat "$FIXTURES/out.txt"
fi

printf '\n'
if [ "$FAILED" -eq 0 ]; then
	printf '%d cases, all green: the check fires on a widened service, a grant nothing uses, a service in\n' "$PASSED"
	printf 'no list and a raw-driver escape, and refuses to call a source it cannot read agreement.\n\n'
	exit 0
fi

printf 'The check does not behave as documented. Fix it before trusting a green run of it.\n\n'
exit 1
