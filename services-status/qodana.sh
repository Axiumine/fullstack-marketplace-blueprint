#!/usr/bin/env bash
# Run the full Qodana Ultimate scan set for the platform monitor, with QODANA_TOKEN taken
# from the process env or, failing that, from the dotenv file next to this script (the
# Qodana CLI reads process env, never the file). The token is exported into the process
# env and is never printed.
#
# Scans enabled (configured in qodana.yaml):
#   - code inspections + SAST / taint dataflow   (qodana.recommended profile)
#   - vulnerable-dependency check (SCA)           (Ultimate, automatic)
#   - third-party license audit                   (Ultimate Plus, raiseLicenseProblems)
#   - test coverage                               (vitest lcov -> --coverage-dir)
#
# Extra args pass through to `qodana scan`, e.g. ./qodana.sh --baseline qodana.sarif.json
# Env:
#   SKIP_TESTS=1   reuse the existing coverage/lcov.info instead of re-running vitest
set -euo pipefail

cd "$(dirname "$0")"

# An already-exported token wins over the file, which is what makes this script usable from
# CI, where the token arrives as a masked variable and no file exists at all. Failing that
# it is read out of the dotenv file next to this script, the same way the nine backend
# services do it.
if [[ -z "${QODANA_TOKEN:-}" ]]; then
	if [[ ! -f .env ]]; then
		cat >&2 << 'EOF'
qodana.sh: no QODANA_TOKEN in the environment and no dotenv file next to this script.

Qodana 2023.2+ refuses to start without a project token, and the token is what
unlocks the Ultimate tier this scan set depends on (SAST, SCA, license audit).

Create the project on https://qodana.cloud (it is per-repository — the backend
services' tokens belong to their own projects and filing this repo's reports
under one of them would corrupt that project's baseline), then either:

    echo 'QODANA_TOKEN=<token>' >> .env

or export it in the shell that runs the scan.
EOF
		exit 1
	fi

	# Read QODANA_TOKEN only. Take everything after the first '=', strip one optional
	# layer of surrounding single/double quotes. Never echo the value.
	QODANA_TOKEN="$(grep -E '^[[:space:]]*QODANA_TOKEN[[:space:]]*=' .env | tail -n1 | cut -d= -f2- | sed -e 's/^[[:space:]]*//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//")"

	if [[ -z "${QODANA_TOKEN:-}" ]]; then
		echo "qodana.sh: QODANA_TOKEN missing or empty in the dotenv file" >&2
		exit 1
	fi
fi
export QODANA_TOKEN

# Regenerate coverage so the coverage scan reflects the current code.
# vitest writes lcov to coverage/lcov.info (reporter configured in vitest.config.mts).
# `|| true`: a <100% threshold miss must not abort the scan here — Qodana enforces the
# 100% gate itself (qodana.yaml testCoverageThresholds) and reports the shortfall.
# vitest still writes coverage/lcov.info before it fails on the threshold.
#
# Nothing here needs live infrastructure: systemd, the TCP probes and the WebSocket clients
# are all mocked or driven over loopback, so a red run is a real gap and never an unreachable
# host. Run the yarn script rather than `vitest run --coverage` directly — `test:cov` builds
# first, and `test/security.test.ts` drives the compiled `dist/server.js` in a child process.
if [[ "${SKIP_TESTS:-0}" != "1" ]]; then
	yarn test:cov || true
elif [[ ! -f coverage/lcov.info ]]; then
	echo "qodana.sh: SKIP_TESTS=1 but coverage/lcov.info is missing — run once without SKIP_TESTS first" >&2
	exit 1
fi

# A scan killed mid-flight (Ctrl-C, a truncated pipe, a crashed terminal) leaves its
# container behind, and the CLI derives the container name from the project path — so every
# later run dies with "container name ... is already in use" and never scans anything.
# Remove only *stopped* qodana containers: a running one belongs to a concurrent scan.
stale="$(docker ps -aq --filter 'name=^qodana-cli-' --filter 'status=exited' --filter 'status=created' --filter 'status=dead' 2> /dev/null || true)"
if [[ -n "$stale" ]]; then
	echo "qodana.sh: removing $(wc -w <<< "$stale") stale qodana container(s) from an interrupted run"
	docker rm -f $stale > /dev/null || true
fi

# --run-promo true forces the promo (Ultimate) inspections on alongside the profile.
exec qodana scan --run-promo true --coverage-dir coverage "$@"
