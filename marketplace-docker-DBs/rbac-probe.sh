#!/usr/bin/env bash
#
# Proves the per-service role shape in init/roles.js against the running replica set.
#
#   ./rbac-probe.sh
#
# ⚠️ **This does not provision anything and is not part of `up.sh`.** It creates one throwaway
# database, one role and one user, asserts in both directions that the role grants what a service
# needs and refuses everything else, and drops all three — whatever the result. Nothing it touches
# outlives the run, and it never looks at dbMarketplaceDev.
#
# RISK_REGISTER R24. The nine services share one account holding the built-in, database-scoped
# `readWrite` role, so a bug in any of them reaches every collection at the datastore layer. The
# narrower shape that would fix it is written in init/roles.js; this is what stops that file being
# another unverified claim.
#
# The root password is handed to the container as an environment variable and interpolated inside it,
# the way shell.sh and up.sh already do, so `ps` on this machine never shows it. The probe user's own
# password is minted here, lives for the length of the run, and is dropped with the user.

set -euo pipefail

cd "$(dirname "$0")"

[ -f .env ] || {
	echo 'rbac-probe.sh: no .env here — see README.md.' >&2
	exit 1
}

set -a
# shellcheck disable=SC1091
. ./.env
set +a

if docker compose version > /dev/null 2>&1; then
	dc() { docker compose "$@"; }
else
	dc() { docker-compose "$@"; }
fi

PROBE_DB='dbMarketplaceRbacProbe'
PROBE_USER='marketplaceRbacProbe'
PROBE_PWD="$(openssl rand -hex 24)"

# Values reach mongosh as JS literals because mongosh exposes no `process` and therefore no
# environment. Escape backslash first, then the quote — the other order double-escapes. Identical to
# up.sh's own jsq(), which this script does not source (it runs standalone).
jsq() { printf "'%s'" "$(printf '%s' "$1" | sed "s/\\\\/\\\\\\\\/g; s/'/\\\\'/g")"; }

# One mongosh pass. $1 is the phase, $2/$3 the account it authenticates as. The script arrives on
# stdin — a password in argv is visible to every process on the host.
#
# Every value below goes through jsq() rather than a raw printf %s inside a quoted literal: $user
# and $secret carry the root credentials from .env, and a `'` or a `\` in one — a realistic generator
# output — used to produce a malformed mongosh script instead of an authentication attempt.
probe_pass() {
	local phase="$1" authdb="$2" user="$3"
	local secret="$4"

	{
		printf 'const CFG = {\n'
		printf '\tphase: %s,\n' "$(jsq "$phase")"
		printf '\tprobeDb: %s,\n' "$(jsq "$PROBE_DB")"
		printf '\tprobeUser: %s,\n' "$(jsq "$PROBE_USER")"
		printf '\tprobePwd: %s\n' "$(jsq "$PROBE_PWD")"
		printf '}\n'
		printf 'db = db.getSiblingDB(%s)\n' "$(jsq "$authdb")"
		printf 'if (!db.auth(%s, %s).ok) {\n' "$(jsq "$user")" "$(jsq "$secret")"
		printf '\tprint(%s)\n' "$(jsq "rbac-probe: authentication failed as $user")"
		printf '\tquit(2)\n'
		printf '}\n'
		cat init/roles.js
		cat init/rbac-probe.js
	} | dc exec -T mdb1 mongosh --quiet 'mongodb://mdb1:27017,mdb2:27018,mdb3:27019/?replicaSet=rs0' /dev/stdin
}

# The teardown runs whether the assertions passed or not: a probe that leaves a user behind on a
# failure is a probe nobody runs twice.
cleanup() {
	probe_pass teardown admin "$MONGO_ROOT_USER" "$MONGO_ROOT_PWD" || true
}
trap cleanup EXIT

probe_pass setup admin "$MONGO_ROOT_USER" "$MONGO_ROOT_PWD"
probe_pass assert "$PROBE_DB" "$PROBE_USER" "$PROBE_PWD"
