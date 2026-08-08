# Marketplace Services Status

Realtime monitor and control panel for the [Marketplace platform](../CLAUDE.md)'s dev processes: 9
Koa/Apollo backend services plus 3 Vite frontends, each wrapped in its own **systemd user unit**. The
page shows live health, uptime, memory and restart counts for all 12, streams their journal logs, and
can start / stop / restart any one service, a whole tier, or the whole platform — without a shell open.

`services.json` at the project root is the single source of truth for the process list; this server and
the systemd unit generator both read it, and neither hand-encodes the list of services anywhere else.

## What it monitors

| Service | Label | Tier | Kind | Port | Path |
|---|---|---|---|---|---|
| `marketplace-dev-public-authorization` | Public Authorization | Public | backend | 4028 | `/public-authorization` |
| `marketplace-dev-public-resource` | Public Resource | Public | backend | 4027 | `/public-resource` |
| `marketplace-dev-authenticated-authorization` | ShopOwner Authorization | Shop Owner | backend | 4029 | `/authenticated-authorization` |
| `marketplace-dev-authenticated-resource` | ShopOwner Resource | Shop Owner | backend | 4026 | `/authenticated-resource` |
| `marketplace-dev-admin-authenticated-authorization` | Admin Authorization | Admin | backend | 4025 | `/admin-authenticated-authorization` |
| `marketplace-dev-admin-authenticated-resource` | Admin Resource | Admin | backend | 4024 | `/admin-authenticated-resource` |
| `marketplace-dev-user-authenticated-authorization` | Customer Authorization | Customer | backend | 4031 | `/user-authenticated-authorization` |
| `marketplace-dev-user-authenticated-resource` | Customer Resource | Customer | backend | 4032 | `/user-authenticated-resource` |
| `marketplace-dev-authenticated-logout` | Logout (all tiers) | Shared | backend | 4030 | `/logout` |
| `marketplace-admin` | Admin SPA | Frontends | frontend | 3043 | `/` |
| `marketplace-shopowner` | ShopOwner SPA | Frontends | frontend | 3044 | `/` |
| `marketplace-user` | Customer app (SSR) | Frontends | frontend | 3045 | `/` |

`marketplace-dev-public-resource` also exposes `GET /check/` as a health path — it is the one service
with real REST endpoints alongside its GraphQL API (see the workspace `docs/architecture.md`, *Services*).
The three frontends bind `127.0.0.1`; the nine backends bind the wildcard address but are still reached
at `127.0.0.1` from this monitor, which only ever runs on the same host.

To add a 13th service, see *Adding a new service* below — nothing here is hand-maintained per-process.

## Architecture

- **`services.json`** (workspace-relative repo paths, ports, groups) is read by both consumers below and
  must never be edited to disagree with itself between them.
- **`systemd/generate.mjs`** renders one `<id>.service` unit per entry plus `marketplace.target`, and
  writes them to `systemd/units/` (generated, gitignored — never hand-edit an emitted unit).
  `systemd/install.sh` copies them into `~/.config/systemd/user/` and reloads the daemon.
- **The monitor server** (`src/server.ts` + `src/config.ts`/`src/systemd.ts`/`src/probe.ts`/`src/monitor.ts`)
  runs **one shared poller**, not one interval per connected browser tab. Each tick issues a single
  batched `systemctl show` across all 12 units for state/memory/timestamps, plus a TCP connect probe per
  port, and broadcasts the combined snapshot to every open WebSocket connection. `POLL_INTERVAL_MS`
  (default 2000) controls the tick; it does not multiply with the number of viewers.
- **Actions** (start/stop/restart) go through the same `execFile`-based systemd wrapper, dispatched only
  against unit names sourced from `services.json` — never from request input (see *Security posture*).

## Install

```bash
yarn install
yarn build
yarn systemd:install
```

`systemd:install` runs the generator, copies the resulting units into `~/.config/systemd/user/`, runs
`systemctl --user daemon-reload`, and preflights every service: it warns (does not fail) on a missing
`.env` or a missing `node_modules` in that service's repo, and it asserts that no monitored unit is
enabled. It refuses to run as root and checks that
`/home/gio/.nvm/versions/node/v24.18.0/bin/yarn` exists before doing anything, printing the `nvm install
24.18.0` line if it does not.

`yarn systemd:uninstall` stops `marketplace.target`, removes the generated units and reloads the daemon;
it supports `--dry-run`.

## Boot policy

**Hard requirement: none of the 12 monitored processes may start at boot — only from this page.** This
is enforced structurally, not by convention: every generated unit, and `marketplace.target` itself,
carries **no `[Install]` section**. A unit with no `[Install]` section is `static` — `systemctl --user
enable <unit>` fails outright, on that unit and on the target alike, because there is nothing for
`enable` to symlink. There is no code path here or in the units that could accidentally turn boot-start
on; the only way to start a monitored process is a `start` action through this page (or a manual
`systemctl --user start`, which does not persist across a reboot either).

Each unit carries `PartOf=marketplace.target` so that stopping or restarting the target propagates to
every unit — `Wants=` alone only propagates start, not stop.

## Running the monitor itself

`marketplace-status.service` — the monitor's own unit — is the **one exception**: it is generated with
`[Install] WantedBy=default.target`, because the control panel has to be reachable before it can start
anything it controls. `systemd:install` installs it but does **not** enable it. To have it come up with
your user session:

```bash
systemctl --user enable --now marketplace-status.service
```

Enabling `marketplace-status.service` does **not** enable anything it monitors — that unit alone carries
an `[Install]` section, the 12 it manages still refuse `enable` for the reason above.

To have it survive logout (not just a reboot), user units also need linger enabled — `Linger` is `no` by
default on this machine:

```bash
loginctl enable-linger $USER
```

Without linger, `marketplace-status.service` (and anything it started) is killed when your last session
of this user logs out, systemd or not.

## HTTP / WebSocket API

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/` | — | the HTML page |
| GET | `/api/services` | — | `{ groups, services, states, target, scope, pollIntervalMs, timestamp }` |
| POST | `/api/services/:id/:action` | — | `{ ok, message, state }` |
| POST | `/api/groups/:groupId/:action` | — | `{ ok, message, results: [{id, ok, message}] }` |
| POST | `/api/all/:action` | — | `{ ok, message }` (acts on `marketplace.target`) |
| GET | `/api/services/:id/logs` | `?lines=N` (1–2000, default 200) | `{ id, lines: string[] }` |
| WS | `/ws` | `{type:'action'\|'logs'\|'ping', ...}` in, `snapshot`/`states`/`action-result`/`logs` out | — |

`:action` is one of `start` \| `stop` \| `restart`. An unknown `:id`, `:groupId` or `:action` answers 404
or 400 with `{ ok: false, message }` — never a 500 for user input.

## Configuration

All keys live in the committed `env` template (copy to `.env`, which is gitignored); no secrets belong
in either file.

| Key | Default | Purpose |
|---|---|---|
| `PORT` | `2901` | This server's own HTTP/WS port |
| `HOST` | `127.0.0.1` | Interface to bind |
| `BIND_ALL` | `false` | Opt in to binding beyond loopback — requires a non-empty `AUTH_TOKEN` too |
| `BEHIND_PROXY` | `false` | Set true when nginx terminates TLS in front of this |
| `PROXY_PROTOCOL` | `http` | Protocol used to build absolute URLs when behind a proxy |
| `DOMAIN` | `127.0.0.1` | Public hostname used when `BEHIND_PROXY=true`; also joins the trusted-host allowlist below (needed because the `Host` header this process sees can differ from the hostname the browser used once nginx is in front of it) |
| `SYSTEMCTL_SCOPE` | `user` | `systemctl`/`journalctl` scope; this project only manages user units |
| `POLL_INTERVAL_MS` | `2000` | Shared poller tick interval |
| `PROBE_TIMEOUT_MS` | `500` | Timeout for each TCP port-open probe |
| `LOG_LINES` | `200` | Default line count for a Logs request with no `?lines=` |
| `WORKSPACE_ROOT` | *(unset → parent of this dir)* | Override for resolving `services.json`'s repo paths |
| `AUTH_TOKEN` | *(empty)* | Bearer token; required once this is reachable beyond loopback |
| `ALLOWED_HOSTS` | *(empty)* | Extra `Host` values to trust, comma separated, on top of `127.0.0.1` / `localhost` / `::1` / `DOMAIN` / `HOST`. Only needed for a name this process cannot derive — a LAN IP under `BIND_ALL=true`, or a second nginx vhost. Bare hostnames or IPs, no scheme, no port |

`SERVICES_CONFIG` from the old version is gone — the process list moved to `services.json` at the
project root, which is read directly rather than passed through the environment.

## Security posture

This page starts and stops processes, so its threat model is stricter than a read-only dashboard:

- **Loopback by default.** `HOST=127.0.0.1` unless `BIND_ALL=true`, and `BIND_ALL=true` with an empty
  `AUTH_TOKEN` refuses to start rather than serving the panel to the network unauthenticated.
- **`AUTH_TOKEN` when set** is required on every HTTP request and the WS handshake, as `Authorization:
  Bearer <token>` or `?token=<token>`, compared with `crypto.timingSafeEqual` after a length check.
  Unauthorized requests get 401; an unauthorized WS handshake is destroyed.
- **Trusted-host allowlist on every request, before any route runs.** The `Host` header must name
  `127.0.0.1`, `localhost`, `::1`, `DOMAIN`, `HOST`, or an entry in `ALLOWED_HOSTS`; anything else is 403.
  This is the DNS-rebinding defense, and it is the reason `Host` is checked against config rather than
  merely compared with `Origin`: an attacker controls *both* of those headers at once. Point
  `evil.example` at `127.0.0.1`, get the browser to load `http://evil.example:2901/`, and it sends
  `Host: evil.example:2901` with `Origin: http://evil.example:2901` — a perfect match, from a page the
  attacker wrote. It applies to reads too, not only to the `POST` routes: `GET /api/services` returns the
  full topology and `GET /api/services/:id/logs` returns journal output, so a read-only rebind is still a
  breach.
- **Same-origin required on every state-changing route.** All three `POST /api/...` routes check the
  request's `Origin` header (falling back to the origin embedded in `Referer` when `Origin` is absent)
  against that same trusted-host allowlist; a mismatch — or neither header present — is rejected with 403.
  A request that instead carries a valid `AUTH_TOKEN` is exempt, since that covers non-browser callers
  (`curl`, a script) that never send `Origin` at all. This matters even though the default bind is
  loopback: same-origin is about which page issued the request, not about who can reach the port. Any tab
  already open in the developer's browser can `fetch('http://127.0.0.1:2901/api/all/stop', {method:
  'POST'})` — a same-origin-less `POST` needs no CORS preflight to be *sent*, only to have its response
  read — so without this check a page with nothing to do with this project could stop the whole platform
  just by being open in another tab.
- **The WebSocket upgrade carries the same two checks, and needs them independently.** A WS handshake is
  exempt from the same-origin policy and triggers no CORS preflight, so any page can open
  `new WebSocket('ws://127.0.0.1:2901/ws')` cross-origin and the browser will complete it. That socket
  reaches the same `start`/`stop`/`restart` dispatch as the `POST` routes, so guarding only the HTTP side
  left the entire control plane reachable from any tab in the default token-less config. This was a real
  hole in an earlier revision of this project, found by review and confirmed by PoC before it was fixed:
  the handshake was accepted from `Origin: https://evil.example`, the full topology snapshot was
  delivered, and an action executed. Origin-mismatch on a handshake answers `403`, not `401` — the caller
  may have authenticated perfectly well; it is the origin that is refused, and re-authenticating cannot
  fix that. Browsers always attach `Origin` to a WS handshake and never attach `Referer`, so only `Origin`
  is consulted there.

  The full matrix is exercised by `test/security.test.ts` against a live server — evil cross-origin,
  DNS-rebind with matching `Host`+`Origin`, tokenless non-browser, and the two legitimate cases — over
  both WS and HTTP.
- **`Referrer-Policy: no-referrer`** on the page, so a `?token=` passed in the URL is never forwarded in
  a `Referer` header to the Font Awesome CDN (`cdnjs.cloudflare.com`) or any other cross-origin resource
  the page loads.
- **No shell.** Every `systemctl`/`journalctl` invocation goes through `execFile` with an argv array —
  no template-string commands, no `exec`, no `shell: true`.
- **Allowlist before dispatch.** A unit name only ever comes from `services.json`; the request supplies
  an `id` that is looked up in a `Map`, and a miss is a 404 rather than a string concatenated into a
  command. The action is checked against exactly `start` \| `stop` \| `restart`.
- **No sudo, no root.** Everything runs as user-scope systemd (`systemctl --user`); `install.sh` refuses
  to run as root.
- **Escaped output.** Journal log lines are attacker-influenced (they are a process's own stdout, which
  can contain request data) and are rendered with `textContent`/an `esc()` helper, never `innerHTML`.
- **No secrets.** This server never reads or echoes a `.env` file; journal output is passed through
  exactly as the process wrote it.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Card stuck on "starting" indefinitely | The unit is `active` but its port hasn't opened yet — either the dev server is still compiling (`tsc`/`vite` cold start), or the build is genuinely failing. Open **Logs** for that service. |
| Card shows "missing" | The unit isn't installed — run `yarn systemd:install` (also happens if the service was added to `services.json` after the last install). |
| A backend never leaves "down" / exits immediately | No `.env` in that repo — no backend supplies a `PORT` default in code, so it can't bind at all. As of this writing, three repos ship with none: `marketplace-dev-user-authenticated-authorization`, `marketplace-dev-user-authenticated-resource`, `marketplace-user`. `install.sh` warns about this at install time but does not fail the install; create the repo's `.env` from its committed `env` template. |
| `systemctl --user` commands fail entirely | Check `systemctl --user daemon-reload` ran (re-run `yarn systemd:install`) and that `/run/user/<uid>` exists for this session. |
| Unit goes straight to "failed" the moment you press Start | Something else is already bound to that service's port — almost always a `yarn dev` left running by hand in a terminal, outside systemd. Units here carry `Restart=no`, so a bind failure doesn't retry: the unit lands in `failed` within one poll tick, and **Logs** shows `EADDRINUSE`. Find the offender with `ss -ltnp 'sport = :4024'` (swap in the actual port from the table above), stop that process, then press **Start** again from the page. A systemd unit and a manually-run `yarn dev` are two ways of running the same service — never leave both up for the same port at once. |

## Adding a new service

1. Add one entry under the right group in `services.json` (`id`, `label`, `repo`, `kind`, `script`,
   `port`, `path`, optional `healthPath`/`host`, `description`).
2. `yarn systemd:install` — regenerates and reinstalls units, including the new one, and refreshes
   `marketplace.target`'s `Wants=`/`After=` list.

No code change is needed anywhere else: the server, the unit generator and the frontend all derive their
service list from `services.json` at runtime/generation time.
