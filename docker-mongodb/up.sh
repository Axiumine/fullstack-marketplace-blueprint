#!/usr/bin/env bash
#
# Bring up the local three-node replica set and provision every account the platform expects.
#
#   ./up.sh                 mongod x3
#   ./up.sh --with-redis    mongod x3 + a single Redis
#
# Safe to re-run: the keys are generated once, rs.initiate() runs once, and every user is checked
# before it is created. Nothing here prints a password.
#
# Read README.md first — this needs three /etc/hosts entries to be usable from outside Docker.

set -euo pipefail

cd "$(dirname "$0")"

WITH_REDIS=0
for arg in "$@"; do
	case "$arg" in
		--with-redis) WITH_REDIS=1 ;;
		-h | --help)
			sed -n '2,12p' "$0"
			exit 0
			;;
		*)
			echo "up.sh: unknown argument '$arg' — try --help." >&2
			exit 2
			;;
	esac
done

# docker compose v2 is a subcommand; the v1 script is still what some distributions ship.
if docker compose version > /dev/null 2>&1; then
	dc() { docker compose "$@"; }
elif command -v docker-compose > /dev/null 2>&1; then
	dc() { docker-compose "$@"; }
else
	echo "up.sh: neither 'docker compose' nor 'docker-compose' is available." >&2
	exit 1
fi

if [ ! -f .env ]; then
	echo "up.sh: no .env here. Copy the template and fill in the four passwords:" >&2
	echo "         cp env .env" >&2
	exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

REQUIRED=(
	MONGO_ROOT_USER MONGO_ROOT_PWD
	MONGO_DEV_DB MONGO_DEV_UDBOWNER MONGO_DEV_URW MONGO_DEV_PWD
	MONGO_TEST_DB MONGO_TEST_UDBOWNER MONGO_TEST_PWDDBOWNER MONGO_TEST_UDBRW MONGO_TEST_PWDDBRW
)
if [ "$WITH_REDIS" -eq 1 ]; then
	REQUIRED+=(REDIS_PASSWORD)
fi

missing=()
for name in "${REQUIRED[@]}"; do
	[ -n "${!name:-}" ] || missing+=("$name")
done
if [ "${#missing[@]}" -ne 0 ]; then
	echo "up.sh: these are empty in .env — ${missing[*]}" >&2
	exit 1
fi

# ---------------------------------------------------------------- keys

mkdir -p secrets

if [ ! -f secrets/mongo-keyfile ]; then
	# Internal authentication between replica-set members. Any 6–1024 base64 characters will do; the
	# only rule is that all three nodes hold the same file. Baked into the image by the Dockerfile,
	# because a bind mount arrives with the host's uid and mongod refuses a keyfile it does not own.
	openssl rand -base64 756 > secrets/mongo-keyfile
	chmod 400 secrets/mongo-keyfile
	echo 'up.sh: generated secrets/mongo-keyfile'
fi

if [ ! -f secrets/csfle-master-key ]; then
	# ADR-029. Exactly 96 bytes: the `local` KMS provider splits it into a 32-byte encryption key, a
	# 32-byte MAC key and 32 bytes of reserve.
	openssl rand 96 > secrets/csfle-master-key
	chmod 400 secrets/csfle-master-key
	echo 'up.sh: generated secrets/csfle-master-key (96 bytes)'
fi

# ---------------------------------------------------------------- containers

if [ "$WITH_REDIS" -eq 1 ]; then
	dc --profile redis up -d --build
else
	dc up -d --build
fi

# mongosh scripts arrive on stdin rather than in argv: a password on a command line is visible in
# `ps` to every user on the machine, and this script has four of them.
run_local() { # run_local <service> <port>  < script
	dc exec -T "$1" mongosh --quiet --port "$2"
}

wait_for_node() {
	local svc="$1" port="$2" i
	for i in $(seq 1 60); do
		if echo 'db.adminCommand({ ping: 1 })' | run_local "$svc" "$port" > /dev/null 2>&1; then
			return 0
		fi
		sleep 2
	done
	echo "up.sh: $svc never answered a ping on port $port." >&2
	return 1
}

echo 'up.sh: waiting for the three nodes...'
wait_for_node db1 27017
wait_for_node db2 27018
wait_for_node db3 27019

# ---------------------------------------------------------------- replica set
#
# rs.initiate() and the first createUser() both go through the LOCALHOST EXCEPTION: with a keyfile
# in place and no user yet existing, MongoDB allows exactly these from a loopback connection. That
# is why both run inside db1 via `exec` instead of from a separate init container — the exception is
# about the client's address, and a container on the compose network is not localhost.

if echo 'print(db.hello().setName ? "rs:already" : "rs:absent")' | run_local db1 27017 | grep -q 'rs:already'; then
	echo 'up.sh: replica set rs0 already initiated'
else
	run_local db1 27017 << 'JS'
rs.initiate({
	_id: 'rs0',
	members: [
		{ _id: 0, host: 'db1:27017' },
		{ _id: 1, host: 'db2:27018' },
		{ _id: 2, host: 'db3:27019' }
	]
})
print('rs:initiated')
JS
fi

echo 'up.sh: waiting for a primary...'
for i in $(seq 1 60); do
	if echo 'db.hello().isWritablePrimary' | run_local db1 27017 2> /dev/null | grep -q true; then
		break
	fi
	if [ "$i" -eq 60 ]; then
		echo 'up.sh: no primary was elected. `./down.sh --purge` and try again.' >&2
		exit 1
	fi
	sleep 2
done

# ---------------------------------------------------------------- users
#
# Values reach mongosh as JS literals because mongosh exposes no `process` and therefore no
# environment. Escape backslash first, then the quote — the other order double-escapes.
jsq() { printf "'%s'" "$(printf '%s' "$1" | sed "s/\\\\/\\\\\\\\/g; s/'/\\\\'/g")"; }

root_script() {
	printf 'const U = %s\nconst P = %s\n' "$(jsq "$MONGO_ROOT_USER")" "$(jsq "$MONGO_ROOT_PWD")"
	cat << 'JS'
const admin = db.getSiblingDB('admin')
let authed = false
try {
	authed = admin.auth(U, P) === 1
} catch (e) {
	authed = false
}
if (authed) {
	print('root:exists')
} else {
	// Still inside the localhost exception, or the password in .env is wrong — in which case this
	// throws Unauthorized, which is the honest answer.
	admin.createUser({ user: U, pwd: P, roles: [{ role: 'root', db: 'admin' }] })
	print('root:created')
}
JS
}

root_script | run_local db1 27017

# The provisioning pass dials the replica set as a whole, so it always lands on the primary whatever
# the election decided. Credentials go through auth() inside the script, not into the URI.
{
	printf 'const CFG = {\n'
	printf '\tdevDb: %s,\n' "$(jsq "$MONGO_DEV_DB")"
	printf '\tdevOwner: %s,\n' "$(jsq "$MONGO_DEV_UDBOWNER")"
	printf '\tdevRw: %s,\n' "$(jsq "$MONGO_DEV_URW")"
	printf '\tdevPwd: %s,\n' "$(jsq "$MONGO_DEV_PWD")"
	printf '\ttestDb: %s,\n' "$(jsq "$MONGO_TEST_DB")"
	printf '\ttestOwner: %s,\n' "$(jsq "$MONGO_TEST_UDBOWNER")"
	printf '\ttestOwnerPwd: %s,\n' "$(jsq "$MONGO_TEST_PWDDBOWNER")"
	printf '\ttestRw: %s,\n' "$(jsq "$MONGO_TEST_UDBRW")"
	printf '\ttestRwPwd: %s\n' "$(jsq "$MONGO_TEST_PWDDBRW")"
	printf '}\n'
	printf 'db.getSiblingDB("admin").auth(%s, %s)\n' "$(jsq "$MONGO_ROOT_USER")" "$(jsq "$MONGO_ROOT_PWD")"
	cat init/provision.js
} | dc exec -T db1 mongosh --quiet 'mongodb://db1:27017,db2:27018,db3:27019/?replicaSet=rs0'

echo
echo 'up.sh: ready.'
echo "       replica set  rs0  ->  db1:27017, db2:27018, db3:27019"
echo "       CSFLE master key  ->  $(pwd)/secrets/csfle-master-key"
if [ "$WITH_REDIS" -eq 1 ]; then
	echo '       redis             ->  127.0.0.1:6379'
fi
echo '       Connection strings for each repo .env: README.md §Wiring the repos.'
