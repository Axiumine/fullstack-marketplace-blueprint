# systemd — user units for the Marketplace platform

Wraps the 12 monitored npm processes (9 backend services + 3 frontends) plus this monitor
page itself, each as a `systemd --user` unit. No sudo, no root, no system-wide units.

## What gets installed

- One `<service-id>.service` per entry in `../services.json` (12 total).
- `marketplace.target` — groups all 12 via `Wants=` + `After=`; every unit also carries
  `PartOf=marketplace.target` so stopping/restarting the target propagates down.
- `marketplace-status.service` — this monitor page itself (`yarn start` in the project
  root).

All units are **generated**, never hand-edited: `generate.mjs` reads `../services.json`
and rewrites `units/*.service` / `units/*.target` deterministically. Re-run it (or
`install.sh`, which calls it) after any edit to `services.json`.

`install.sh` also writes `~/.config/systemd/user/.marketplace-status-manifest`, the exact
list of filenames it installed. On the next run it diffs that against the freshly
generated set and removes anything no longer produced from `services.json` (a service
renamed or dropped since the last install) — otherwise that unit's file would sit in
`~/.config/systemd/user` forever, still reachable via `PartOf=marketplace.target` even
though the monitor page no longer knows about it. `uninstall.sh` reads the same manifest
when present (falling back to a fresh services.json-derived list otherwise). Either way,
a file is only ever removed if it carries `generate.mjs`'s own banner comment — a
filename match alone (`marketplace-admin.service`, `marketplace.target`, ...) is not
proof the file is ours, since those names are generic enough that an unrelated
pre-existing user unit could share one.

## Why nothing (except the monitor) is enabled

The 12 monitored units carry **no `[Install]` section**. That's not a convention — it's
the mechanism: `systemctl --user enable <unit>` refuses outright on a unit with no
`[Install]`, and `systemctl --user list-unit-files` shows it as `static`. They can only be
started manually or by `marketplace.target`, and the target itself also has no
`[Install]`, so it can't be boot-enabled either.

`marketplace-status.service` — the control page — is the one exception: it carries
`[Install] WantedBy=default.target`, because something has to be reachable to start
everything else. `install.sh` installs that unit file but does **not** enable it. Enabling
it is a separate, explicit step, and it does not enable anything it monitors.

Every monitored unit also sets `Restart=no`. A crashed dev server should stay in
`failed` state so the status page shows it broken — an automatic restart loop would hide
the failure and spam the journal instead. `marketplace-status.service` is the opposite:
`Restart=on-failure`, because it's the control plane and nothing else can bring it back.

## Why `ExecStart` isn't `yarn dev`

Two settings exist purely so that `failed` on the page means something. Both were arrived
at by measuring, and both look like over-engineering until you see what they fix.

**The unit `exec`s the real binary instead of running `yarn`.** `ExecStart` is
`/bin/sh -c '<repo>/node_modules/.bin/tsc && exec <repo>/node_modules/.bin/tsx watch …'`,
built by `generate.mjs` from that repo's own `package.json` script — the script text stays
the single source of truth and is echoed in a comment above the line. The reason is that
yarn 1.x, sitting between systemd and the real process, exits **1** when its child is
terminated: an ordinary `systemctl stop` then records `Result=exit-code` and the unit lands
in `failed`, identical to a crash. `KillMode=mixed` doesn't rescue it — yarn still exits 1
and orphans its children instead. With `exec`, vite/tsx *is* `MainPID` and receives the
signal directly.

**`SuccessExitStatus=143 15 SIGTERM`.** These dev servers don't shut down uniformly on
SIGTERM: vite exits with code **143**, `tsx watch` exits with code **15**, and a plain node
process with no handler is *killed by* the signal (which systemd reports as `Result=signal`,
a different thing again). All three are declared because all three occur here; miss one and
that family of services goes `failed` on every normal stop. It is deliberately not
`SuccessExitStatus=1` — that would buy the same green stop by making every real failure
(a `tsc` error, `EADDRINUSE`, an uncaught throw) look successful too, which is exactly the
distinction `Restart=no` exists to preserve.

`KillMode=control-group`, not `mixed`: vite spawns rolldown workers and `tsx` spawns a
watcher, and only the control-group kill reaches them.

## Install / uninstall

```bash
./install.sh              # generate, install, daemon-reload, preflight, next steps
./install.sh --dry-run     # same checks, no writes to ~/.config/systemd/user

./uninstall.sh             # stop the target + monitor, remove only the generated units
./uninstall.sh --dry-run
```

Both scripts refuse to run as root and are idempotent — re-running either is safe.
`install.sh` warns (never aborts) on a missing `.env` or `node_modules` per service, warns
(never aborts) on a port already bound by something else, and asserts none of the 12
monitored units is `enabled` before it finishes.

### Port already in use

Several of these services get started by hand outside systemd during normal dev work
(`yarn dev` in a terminal). `install.sh`'s preflight checks every configured port with
`ss -ltn` and prints `IN USE` in the `PORT` column instead of aborting — starting the unit
on top of an already-bound port fails with `EADDRINUSE`, and because every monitored unit
sets `Restart=no` it lands in `failed`, which looks like a broken install rather than a
collision. The script never kills anything; find and stop the offending process yourself:

```bash
ss -ltnp 'sport = :4024'   # substitute the port from the preflight table
```

Then either stop that process or leave the unit alone until you're ready to hand that
service over to systemd.

## Commands

```bash
# start / stop / restart everything
systemctl --user start   marketplace.target
systemctl --user stop    marketplace.target
systemctl --user restart marketplace.target

# one service
systemctl --user start   marketplace-dev-public-authorization.service
systemctl --user status  marketplace-dev-public-authorization.service

# status of the whole group
systemctl --user status marketplace.target
systemctl --user list-units 'marketplace-*'

# logs
journalctl --user -u marketplace-dev-public-authorization.service -f
journalctl --user -u marketplace-dev-public-authorization.service -n 200 --no-pager

# the monitor page itself
systemctl --user start  marketplace-status.service
systemctl --user enable marketplace-status.service   # survive reboot — see below
```

### Making the monitor survive a reboot

`systemctl --user enable marketplace-status.service` alone is not enough — user units
stop the moment you log out unless the user is allowed to "linger":

```bash
sudo loginctl enable-linger $USER
```

This enables the monitor **only**. The 12 services it manages remain `static` and start
only when you click start on the page (or run `systemctl --user start
marketplace.target` / a single unit by hand).

## Switching a service from `yarn dev` to a production script

`script` in that service's `../services.json` entry names a script in that repo's
`package.json` (currently always `"dev"` for all 12); the generator reads the script's text
and turns it into the `ExecStart` shown above. To run a service in production mode instead:

1. Add/point the target script (e.g. `"start"`) in that repo's own `package.json`.
2. Change `"script"` for that entry in `../services.json`.
3. Re-run `./install.sh` (or `node generate.mjs` then copy + `daemon-reload` by hand).

The generator only understands scripts that are a plain `&&` chain of commands. Anything
else — a pipe, `;`, `||`, a subshell, a variable expansion — makes it **abort with the
offending script quoted**, rather than emit a unit that runs something subtly different from
what `yarn <script>` would have run. If you hit that, either simplify the script or teach
`buildExecCommand()` about the construct.

Nothing else needs to change: `Environment=NODE_ENV=development` is currently baked into
every monitored unit by `generate.mjs` — if a service's production script expects
`NODE_ENV=production`, edit the generator's `serviceUnitContent()` for that case rather
than hand-editing the generated file, which gets overwritten on the next run.
