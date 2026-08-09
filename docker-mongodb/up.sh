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
wait_for_node mdb1 27017
wait_for_node mdb2 27018
wait_for_node mdb3 27019

# Answering a ping is not the same as having loaded the replica-set config. A node restarted into an
# existing set spends its first seconds in STARTUP: it takes connections, and `hello()` reports neither
# a `setName` nor anything else about the set. Reading that as "no set here" is what made a second
# `./up.sh` call rs.initiate() on a healthy cluster and die on Unauthorized — the localhost exception
# is long gone once the root user exists.
#
# `isreplicaset: true` is the marker that separates the two. mongod sets it only when it was started
# with --replSet and holds no config at all, which is exactly the case initiate() is for. So: a
# setName means initiated, `isreplicaset` means genuinely empty, and neither means still loading —
# wait and ask again rather than guess.
replica_set_state() {
	local i state
	for i in $(seq 1 30); do
		# ⚠️ The match is unanchored on purpose. mongosh prints its `rs0 [direct: secondary] test>`
		# prompt even when stdin is a pipe, so the answer never starts the line it lands on.
		state="$(
			echo 'const h = db.hello(); print(h.setName ? "already" : h.isreplicaset ? "absent" : "loading")' |
				run_local mdb1 27017 2> /dev/null | tr -d '\r' | grep -woE 'already|absent|loading' | tail -1
		)"
		case "$state" in
			already | absent)
				printf '%s' "$state"

				return 0
				;;
		esac
		sleep 2
	done

	echo 'up.sh: mdb1 never reported whether it belongs to a replica set.' >&2

	return 1
}

# ---------------------------------------------------------------- replica set
#
# rs.initiate() and the first createUser() both go through the LOCALHOST EXCEPTION: with a keyfile
# in place and no user yet existing, MongoDB allows exactly these from a loopback connection. That
# is why both run inside mdb1 via `exec` instead of from a separate init container — the exception is
# about the client's address, and a container on the compose network is not localhost.

# Read into a variable first: inside `if [ "$(…)" = … ]` a failing substitution is invisible, and
# "could not tell" would silently become "not initiated" — which is the branch that calls initiate()
# on a live cluster.
RS_STATE="$(replica_set_state)"

if [ "$RS_STATE" = already ]; then
	echo 'up.sh: replica set rs0 already initiated'
else
	run_local mdb1 27017 << 'JS'
rs.initiate({
	_id: 'rs0',
	members: [
		{ _id: 0, host: 'mdb1:27017' },
		{ _id: 1, host: 'mdb2:27018' },
		{ _id: 2, host: 'mdb3:27019' }
	]
})
print('rs:initiated')
JS
fi

# ⚠️ Asked of the SET, not of mdb1. Which member wins an election is not decided here — after a
# restart it is routinely mdb2 or mdb3 — and polling one node for `isWritablePrimary` reported "no
# primary" for a cluster that had one and was perfectly healthy. The driver behind a replicaSet URI
# does the discovery itself and lands on whoever is primary, which is the same thing every service
# does. `hello` needs no credentials, so this works before the root user exists as well as after.
#
# ⚠️ The answer is captured and then matched, never piped into `grep -q`. This script runs under
# `set -o pipefail`, and `grep -q` exits the moment it matches: mongosh is still writing its prompt,
# takes SIGPIPE, and the pipeline reports failure for a check that in fact just succeeded. Whether it
# bites depends on which of the two processes finishes first, so it fails intermittently — the worst
# kind. `|| true` because a node that is not up yet makes `exec` itself exit non-zero.
echo 'up.sh: waiting for a primary...'
for i in $(seq 1 60); do
	answer="$(
		echo 'print(db.hello().isWritablePrimary)' |
			dc exec -T mdb1 mongosh --quiet 'mongodb://mdb1:27017,mdb2:27018,mdb3:27019/?replicaSet=rs0' 2> /dev/null || true
	)"
	case "$answer" in
		*true*) break ;;
	esac
	if [ "$i" -eq 60 ]; then
		echo 'up.sh: no primary was elected in two minutes. `docker compose logs mdb1 mdb2 mdb3` says why;' >&2
		echo '       `./down.sh --purge` starts over, and throws away every database on this cluster.' >&2
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
	// ⚠️ `.ok`, not the return value. The legacy shell's db.auth() answered 1; mongosh answers
	// { ok: 1 }, so `=== 1` is false even on a successful login — and this script then tried to
	// create a root user that already existed, which fails and takes the whole run down with it.
	authed = admin.auth(U, P).ok === 1
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

root_script | run_local mdb1 27017

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
} | dc exec -T mdb1 mongosh --quiet 'mongodb://mdb1:27017,mdb2:27018,mdb3:27019/?replicaSet=rs0'

# ---------------------------------------------------------------- host names

# The set advertises its members as mdb1/mdb2/mdb3, so every driver outside Docker re-dials those three
# names whatever seed list it was handed. This only reports what they currently resolve to — editing
# /etc/hosts is the operator's call, not a script's.
host_name_notice() {
	local name addresses unresolved=() elsewhere=()

	command -v getent > /dev/null 2>&1 || return 0

	for name in mdb1 mdb2 mdb3; do
		addresses="$(getent ahostsv4 "$name" 2> /dev/null | awk '{ print $1 }' | sort -u | tr '\n' ' ' || true)"
		addresses="${addresses% }"
		if [ -z "$addresses" ]; then
			unresolved+=("$name")
		elif [ "$addresses" != '127.0.0.1' ]; then
			elsewhere+=("$name -> $addresses")
		fi
	done

	if [ "${#unresolved[@]}" -ne 0 ]; then
		echo
		echo "up.sh: ${unresolved[*]} do not resolve on this machine, so only processes inside the Docker"
		echo '       network can use this cluster. Add the /etc/hosts line from README.md to fix it:'
		echo '         127.0.0.1   mdb1 mdb2 mdb3'
	fi

	if [ "${#elsewhere[@]}" -ne 0 ]; then
		echo
		echo 'up.sh: these names already point somewhere other than loopback —'
		printf '         %s\n' "${elsewhere[@]}"
		echo '       That is another replica set, most likely the real external rs0. Adding the loopback'
		echo '       line from README.md would redirect every process on this machine to these containers,'
		echo '       not only this project. Leave it out unless that is what you want.'
	fi
}

echo
echo 'up.sh: ready.'
echo "       replica set  rs0  ->  mdb1:27017, mdb2:27018, mdb3:27019"
echo "       CSFLE master key  ->  $(pwd)/secrets/csfle-master-key"
if [ "$WITH_REDIS" -eq 1 ]; then
	echo '       redis             ->  127.0.0.1:6379'
fi

echo '       Connection strings for each repo .env: README.md §Wiring the repos.'

host_name_notice
