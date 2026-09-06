#!/usr/bin/env bash
#
# Proves `./scripts/encryption-coverage-check.mjs` in both directions, against a two-repo tree this
# file writes — because a cross-repo check that has only ever been run on a workspace where the two
# halves already agree is indistinguishable from one that prints "agree" unconditionally.
#
#   ./scripts/encryption-coverage-check-selftest.sh
#
# ⚠️ **Nothing here touches this workspace.** The fixture is a `mktemp -d` tree with the two paths the
# check reads — a `marketplace-common` field map and a `marketplace-db-setup` schema directory — the
# check is pointed at it with ENCRYPTION_CHECK_ROOT, and the tree is removed on exit. That is what
# lets a gate run this half unattended while the check itself reads the real sources.
#
# The fixture reproduces the two shapes that made the real walk non-trivial: a validator wrapped in
# `$and` beside its `$jsonSchema`, which `user` and `company` both are, and an array of subdocuments
# whose fields the field map addresses as `addresses.[].street`.

set -uo pipefail

CHECK="$(cd "$(dirname "$0")" && pwd)/encryption-coverage-check.mjs"
FIXTURES=$(mktemp -d) && trap 'rm -rf "$FIXTURES"' EXIT

FAILED=0
PASSED=0

pass() { printf '  ✓ %s\n' "$1"; PASSED=$((PASSED + 1)); }
fail() { printf '  ✗ %s\n' "$1"; FAILED=1; }

MAP_DIR="BEs/marketplace-common/src/encryption"
SCHEMA_DIR="BEs/marketplace-db-setup/lib/schemas"

# The four lists the check insists on, with one path each except `user`, which carries the array.
# `$1` is appended to the shopOwner list, `$2` to the shopOwner validator's properties — the two
# levers every case below pulls.
build() {
	rm -rf "${FIXTURES:?}" && mkdir -p "$FIXTURES/$MAP_DIR" "$FIXTURES/$SCHEMA_DIR"

	{
		printf 'export const ENCRYPTED_FIELDS_ADMIN: IEncryptedFieldSpec[] = [\n'
		printf "\t{ path: 'login.email', algorithm: ALGORITHM_DETERMINISTIC, plaintext: 'string' }\n]\n"
		printf 'export const ENCRYPTED_FIELDS_SHOP_OWNER: IEncryptedFieldSpec[] = [\n'
		printf "\t{ path: 'login.email', algorithm: ALGORITHM_DETERMINISTIC, plaintext: 'string' }%s\n]\n" "${1:-}"
		printf 'export const ENCRYPTED_FIELDS_USER: IEncryptedFieldSpec[] = [\n'
		printf "\t{ path: 'addresses.[].street', algorithm: ALGORITHM_RANDOM, plaintext: 'string' }\n]\n"
		printf 'export const ENCRYPTED_FIELDS_COMPANY: IEncryptedFieldSpec[] = [\n'
		printf "\t{ path: 'contactPerson', algorithm: ALGORITHM_RANDOM, plaintext: 'string' }\n]\n"
	} > "$FIXTURES/$MAP_DIR/encryptedFields.mts"

	cat > "$FIXTURES/$SCHEMA_DIR/admin.js" <<-'JS'
		const BIN = { bsonType: 'binData', description: 'fixture' };
		function validatorAdmin() {
			return { $jsonSchema: { bsonType: 'object', properties: { login: { bsonType: 'object', properties: { email: BIN } } } } };
		}
		module.exports = { validatorAdmin };
	JS

	# `$and` beside the schema, which is the shape that made a naive root read return nothing.
	cat > "$FIXTURES/$SCHEMA_DIR/user.js" <<-'JS'
		const BIN = { bsonType: 'binData', description: 'fixture' };
		function validatorUser() {
			return {
				$and: [
					{ $jsonSchema: { bsonType: 'object', properties: { addresses: { bsonType: 'array', items: { bsonType: 'object', properties: { street: BIN } } } } } },
					{ $expr: { $lte: [1, 1] } }
				]
			};
		}
		module.exports = { validatorUser };
	JS

	cat > "$FIXTURES/$SCHEMA_DIR/company.js" <<-'JS'
		const BIN = { bsonType: 'binData', description: 'fixture' };
		function validatorCompany() {
			return { $jsonSchema: { bsonType: 'object', properties: { contactPerson: BIN } } };
		}
		module.exports = { validatorCompany };
	JS

	{
		printf "const BIN = { bsonType: 'binData', description: 'fixture' };\n"
		printf 'function validatorShopOwner() {\n'
		printf "\treturn { \$jsonSchema: { bsonType: 'object', properties: { login: { bsonType: 'object', properties: { email: BIN } }%s } } };\n" "${2:-}"
		printf '}\n'
		printf 'module.exports = { validatorShopOwner };\n'
	} > "$FIXTURES/$SCHEMA_DIR/shopOwner.js"
}

run() {
	ENCRYPTION_CHECK_ROOT="$FIXTURES" node "$CHECK" > "$FIXTURES/out.txt" 2>&1
	printf '%s' "$?"
}

printf '\nencryption-coverage-check, both directions\n\n'

# 1. Two halves naming the same fields, including the array and the `$and` wrapper. Green.
build
status=$(run)
if [ "$status" = '0' ] && grep -q '4 encrypted paths across 4 collections' "$FIXTURES/out.txt"; then
	pass 'agreeing halves pass, and the array path behind an $and wrapper is counted'
else
	fail "agreeing halves did not pass, or were miscounted (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 2. In the field map, not in the validator: the client encrypts a field the server still expects to
#    be a string, and every write to it fails on a live database.
build ",\n\t{ path: 'personalData.notes', algorithm: ALGORITHM_RANDOM, plaintext: 'string' }"
status=$(run)
if [ "$status" = '1' ] &&
	grep -q 'personalData.notes is encrypted by the client and not binData' "$FIXTURES/out.txt"; then
	pass 'a path encrypted by the client and unknown to the validator fails, and is named'
else
	fail "a client-only encrypted path did not fail (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 3. The quiet direction: `binData` in the validator, absent from the field map. If the validator is
#    rebuilt after the model, that field sits in the clear and nothing else on the platform says so.
build '' ", notes: BIN"
status=$(run)
if [ "$status" = '1' ] &&
	grep -q 'notes is binData in the validator and not encrypted by the client' "$FIXTURES/out.txt"; then
	pass 'a binData path the client never encrypts fails, and is named'
else
	fail "a validator-only binData path did not fail (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 4. A half that is not there at all. Exit 2, distinct from a disagreement — a source this check
#    cannot read is not two halves agreeing, and a gate that treated it as one would go green on a
#    renamed file.
build
rm -f "$FIXTURES/$MAP_DIR/encryptedFields.mts"
status=$(run)
if [ "$status" = '2' ] && grep -q 'no field map at' "$FIXTURES/out.txt"; then
	pass 'a missing half exits 2 rather than reporting agreement'
else
	fail "a missing field map did not exit 2 (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 5. A list the check needs, emptied. Same reasoning as case 4: an empty list agrees with an empty
#    validator on paper, and would hide a collection whose encryption was deleted wholesale.
build
sed -i '/ENCRYPTED_FIELDS_COMPANY/,$d' "$FIXTURES/$MAP_DIR/encryptedFields.mts"
status=$(run)
if [ "$status" = '2' ] && grep -q 'ENCRYPTED_FIELDS_COMPANY is not exported' "$FIXTURES/out.txt"; then
	pass 'a list that stopped being exported exits 2 rather than counting zero paths'
else
	fail "a removed list did not exit 2 (exit $status)"
	cat "$FIXTURES/out.txt"
fi

printf '\n'
if [ "$FAILED" -eq 0 ]; then
	printf '%d cases, all green: the check fires in both directions of the mistake and refuses to call\n' "$PASSED"
	printf 'a source it cannot read agreement.\n\n'
	exit 0
fi

printf 'The check does not behave as documented. Fix it before trusting a green run of it.\n\n'
exit 1
