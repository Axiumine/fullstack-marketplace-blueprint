#!/usr/bin/env bash
# Installs the generated systemd --user units into ~/.config/systemd/user.
# Idempotent: safe to re-run after every services.json edit or repo checkout.
set -euo pipefail

# ---- guard: never run as root ----------------------------------------------
# These are --user units and must run as the owning user: the dev servers
# inherit $HOME (nvm, yarn cache, git config), which a root install would not
# give them, and "systemctl --user" itself expects a real user session.
if [ "${EUID:-$(id -u)}" -eq 0 ]; then
  echo "Refusing to run as root — install as the user who will run the services." >&2
  exit 1
fi

DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *)
      echo "Unknown argument: $arg (only --dry-run is supported)" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_STATUS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
UNITS_DIR="$SCRIPT_DIR/units"
USER_UNIT_DIR="$HOME/.config/systemd/user"
# Records exactly what this script installed, so a service later renamed or
# removed from services.json can still be found and cleaned up (by this script
# next run, and by uninstall.sh) instead of sitting in USER_UNIT_DIR forever —
# still reachable via PartOf=marketplace.target even after the monitor page
# stops knowing about it. Lives alongside the units it tracks rather than under
# a separate state dir: one directory to reason about, and it survives exactly
# as long as the units it describes.
MANIFEST_PATH="$USER_UNIT_DIR/.marketplace-status-manifest"
export SERVICE_STATUS_DIR

# services.json is the single source of truth; pull the handful of values this
# script needs with one node one-liner instead of re-deriving generate.mjs's
# logic in bash. Space-separated on stdout, read back positionally below.
read -r NODE_VERSION NVM_DIR UNIT_TARGET MONITOR_UNIT < <(
  node -e '
    const fs = require("node:fs");
    const path = require("node:path");
    const os = require("node:os");
    const dir = process.env.SERVICE_STATUS_DIR;
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, "services.json"), "utf8"));
    const home = os.homedir();
    const nvmDir =
      cfg.nvmDir === "~" ? home : cfg.nvmDir.startsWith("~/") ? path.join(home, cfg.nvmDir.slice(2)) : cfg.nvmDir;
    // Trailing newline is load-bearing: `read` returns 1 at EOF with no delimiter,
    // which trips `set -e` and kills the script before the first echo even though
    // every variable was assigned correctly. process.stdout.write with no "\n" was
    // exactly that trap.
    process.stdout.write([cfg.nodeVersion, nvmDir, cfg.unitTarget, cfg.monitorUnit].join(" ") + "\n");
  '
)

NODE_BIN_DIR="$NVM_DIR/versions/node/v$NODE_VERSION/bin"
NODE_BIN="$NODE_BIN_DIR/node"

echo "== marketplace-services-status: systemd install =="
echo ""

# ---- step 1: the pinned node must exist ------------------------------------
# node, not yarn: the generated units invoke each repo's node_modules/.bin shims
# directly (see buildExecCommand in generate.mjs), and those shims are
# `#!/usr/bin/env node`. This directory leads the unit PATH, so this binary is the
# one every service ends up running under — if it is missing, all 12 units break
# the same way and the error surfaces at start time instead of here.
if [ ! -x "$NODE_BIN" ]; then
  echo "Pinned node not found at $NODE_BIN" >&2
  echo "Run: nvm install $NODE_VERSION" >&2
  exit 1
fi
echo "[ok] pinned node found: $NODE_BIN ($("$NODE_BIN" --version))"

# ---- step 2: systemd --user must be reachable ------------------------------
RUNTIME_DIR="/run/user/$(id -u)"
if [ ! -d "$RUNTIME_DIR" ] || ! systemctl --user list-units >/dev/null 2>&1; then
  echo "systemctl --user is not reachable (missing $RUNTIME_DIR, or no user session bus)." >&2
  echo "Log in on a real session — not a bare su/sudo shell — and retry." >&2
  exit 1
fi
echo "[ok] systemctl --user is reachable"

# ---- step 2b: the monitor's own build output must exist ---------------------
# dist/ is gitignored, so a fresh clone has none, and marketplace-status.service
# runs `node dist/server.js` — without this the only failure is a MODULE_NOT_FOUND
# in the journal of the one unit you need in order to see any other unit.
# Warn rather than abort: installing the units is still useful on its own, and
# the 12 monitored services do not depend on this build at all.
if [ ! -f "$SERVICE_STATUS_DIR/dist/server.js" ]; then
  echo "[warn] $SERVICE_STATUS_DIR/dist/server.js is missing — the monitor cannot start."
  echo "       Run: (cd $SERVICE_STATUS_DIR && yarn build)"
fi

# ---- step 3: unit directory -------------------------------------------------
if $DRY_RUN; then
  echo "[dry-run] would: mkdir -p $USER_UNIT_DIR"
else
  mkdir -p "$USER_UNIT_DIR"
fi

# ---- step 4: (re)generate the unit files ------------------------------------
# Always regenerate, even under --dry-run: this only writes inside the repo
# (systemd/units/), never touches $HOME, and dry-run is exactly when you want
# to inspect the freshest generated content before anything is installed.
"$NODE_BIN" "$SCRIPT_DIR/generate.mjs" --out "$UNITS_DIR"

# ---- step 5: install + reload ------------------------------------------------
if $DRY_RUN; then
  echo "[dry-run] would copy $(ls "$UNITS_DIR" | wc -l) unit files to $USER_UNIT_DIR"
  echo "[dry-run] would run: systemctl --user daemon-reload"
else
  cp "$UNITS_DIR"/*.service "$UNITS_DIR"/*.target "$USER_UNIT_DIR"/
  systemctl --user daemon-reload
  echo "[ok] units installed to $USER_UNIT_DIR, daemon-reload done"
fi

# ---- step 5b: reconcile against the previous manifest -----------------------
# services.json says what SHOULD exist right now; the manifest says what this
# script installed LAST time. A name in the old manifest but not in the fresh
# generate.mjs output is a service that was renamed or dropped from
# services.json since the previous install — remove its orphaned unit rather
# than leaving it running, un-managed and invisible to the monitor page.
NEW_MANIFEST="$(cd "$UNITS_DIR" && ls -1 | sort)"
OLD_MANIFEST=""
if [ -f "$MANIFEST_PATH" ]; then
  OLD_MANIFEST="$(cat "$MANIFEST_PATH")"
fi

ORPHANS_REMOVED=0
if [ -n "$OLD_MANIFEST" ]; then
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    if grep -qxF "$name" <<<"$NEW_MANIFEST"; then
      continue
    fi
    target="$USER_UNIT_DIR/$name"
    [ -f "$target" ] || continue
    # Same provenance rule as uninstall.sh: only remove a file that still
    # carries generate.mjs's banner, in case something unrelated now owns the
    # name.
    if ! grep -q '^# GENERATED by marketplace-services-status/systemd/generate.mjs' "$target"; then
      echo "!! orphan candidate $target has no generate.mjs banner — leaving it alone" >&2
      continue
    fi
    if $DRY_RUN; then
      echo "[dry-run] would remove orphaned unit $target (no longer generated from services.json)"
    else
      rm -f "$target"
      echo "[ok] removed orphaned unit $target (no longer generated from services.json)"
    fi
    ORPHANS_REMOVED=$((ORPHANS_REMOVED + 1))
  done <<<"$OLD_MANIFEST"
fi

if $DRY_RUN; then
  echo "[dry-run] would write manifest of $(wc -l <<<"$NEW_MANIFEST" | tr -d ' ') unit(s) to $MANIFEST_PATH"
else
  printf '%s\n' "$NEW_MANIFEST" >"$MANIFEST_PATH"
  if [ "$ORPHANS_REMOVED" -gt 0 ]; then
    systemctl --user daemon-reload
    echo "[ok] daemon-reload done (after removing $ORPHANS_REMOVED orphaned unit(s))"
  fi
fi

# ---- step 6: preflight (warn only, never abort) ------------------------------
echo ""
echo "== preflight =="

# Several of these ports are commonly already bound by copies of the same
# services started by hand outside systemd (yarn dev in a terminal). Starting
# the unit on top of one fails with EADDRINUSE and, because Restart=no, lands
# in 'failed' — indistinguishable at a glance from a genuinely broken install.
# Warn, never abort: killing someone's manually-started process is not this
# script's call to make.
HAVE_SS=true
if ! command -v ss >/dev/null 2>&1; then
  HAVE_SS=false
  echo "[warn] 'ss' not found on PATH — skipping the port-collision check." >&2
fi

printf '%-48s %-9s %-9s %-9s\n' "SERVICE" "ENV" "MODULES" "PORT"

SERVICE_ROWS="$(
  node -e '
    const fs = require("node:fs");
    const path = require("node:path");
    const dir = process.env.SERVICE_STATUS_DIR;
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, "services.json"), "utf8"));
    const workspaceRoot = path.resolve(dir, cfg.workspaceRoot);
    const rows = [];
    for (const g of cfg.groups) for (const s of g.services) rows.push([s.id, path.join(workspaceRoot, s.repo), s.port].join("\t"));
    process.stdout.write(rows.join("\n"));
  '
)"

MISSING_ENV=0
MISSING_MODULES=0
PORTS_IN_USE=0
PORTS_IN_USE_LIST=""
while IFS=$'\t' read -r id repo port; do
  [ -z "$id" ] && continue
  env_status="ok"
  modules_status="ok"
  port_status="free"
  # Existence check ONLY — the secret guard forbids reading .env contents even
  # here; test -f never opens the file.
  if [ ! -f "$repo/.env" ]; then
    env_status="MISSING"
    MISSING_ENV=$((MISSING_ENV + 1))
  fi
  if [ ! -d "$repo/node_modules" ]; then
    modules_status="MISSING"
    MISSING_MODULES=$((MISSING_MODULES + 1))
  fi
  if $HAVE_SS && [ -n "$port" ]; then
    if ss -ltn "( sport = :$port )" 2>/dev/null | grep -q ":$port"; then
      port_status="IN USE"
      PORTS_IN_USE=$((PORTS_IN_USE + 1))
      PORTS_IN_USE_LIST="$PORTS_IN_USE_LIST $id:$port"
    fi
  elif ! $HAVE_SS; then
    port_status="?"
  fi
  printf '%-48s %-9s %-9s %-9s\n' "$id" "$env_status" "$modules_status" "$port_status"
done <<<"$SERVICE_ROWS"

echo ""
echo "preflight summary: $MISSING_ENV service(s) missing .env, $MISSING_MODULES missing node_modules, $PORTS_IN_USE port(s) already in use"
if [ "$MISSING_ENV" -gt 0 ]; then
  echo "  -> a missing .env means that backend has no PORT and will not start at all (no default in code)."
fi
if [ "$MISSING_MODULES" -gt 0 ]; then
  echo "  -> run yarn install in the repos listed above with MODULES=MISSING."
fi
if [ "$PORTS_IN_USE" -gt 0 ]; then
  echo "  -> port already in use — stop the process started outside systemd first, or that unit will fail with EADDRINUSE:"
  for entry in $PORTS_IN_USE_LIST; do
    svc_id="${entry%%:*}"
    svc_port="${entry##*:}"
    echo "       $svc_id (port $svc_port): find the offender with ss -ltnp 'sport = :$svc_port'"
  done
fi

# ---- step 7: assert nothing is boot-enabled -----------------------------------
echo ""
echo "== enable-state assertion =="
ENABLED_FOUND=false
while IFS=$'\t' read -r id repo port; do
  [ -z "$id" ] && continue
  unit="$id.service"
  state="$(systemctl --user is-enabled "$unit" 2>/dev/null || true)"
  if [ "$state" = "enabled" ]; then
    ENABLED_FOUND=true
    echo "!! $unit is ENABLED — a monitored unit must never be. Fix:" >&2
    echo "     systemctl --user disable $unit" >&2
  fi
done <<<"$SERVICE_ROWS"
if ! $ENABLED_FOUND; then
  echo "[ok] none of the 12 monitored units is enabled"
fi

# ---- step 8: next steps ---------------------------------------------------------
echo ""
echo "== next steps =="
echo "Start everything:      systemctl --user start $UNIT_TARGET"
echo "Start one service:     systemctl --user start <service-id>.service"
echo "Status of everything:  systemctl --user status $UNIT_TARGET"
echo "Follow logs:            journalctl --user -u <service-id>.service -f"
echo ""
echo "The monitor page ($MONITOR_UNIT) is installed but NOT enabled — start it once by hand:"
echo "  systemctl --user start $MONITOR_UNIT"
echo ""
echo "To have the monitor come back after a reboot (nothing it monitors will):"
echo "  systemctl --user enable $MONITOR_UNIT"
echo "  sudo loginctl enable-linger \$USER   # user units die at logout without this"
echo ""
echo "Enabling $MONITOR_UNIT does NOT enable anything it monitors: the 12 service units"
echo "carry no [Install] section, so \"systemctl --user enable\" refuses them outright."
