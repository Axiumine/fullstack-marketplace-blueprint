# Semgrep — marketplace-services-status

Static analysis (SAST) for the platform monitor. Runs via the pinned Docker
image, with **all rules vendored locally** — no network fetch at scan time,
fully reproducible.

## Run

```bash
yarn semgrep        # human-readable report
yarn semgrep:ci     # nonzero exit on findings + SARIF (semgrep.sarif)
```

Both wrap `docker run … semgrep/semgrep:1.172.0 …` — nothing to install locally.
Output is written as your own UID (`-u`), so no root-owned files. `--network none`
is what makes "vendored" mean something: the container cannot reach the registry
even if a config line asks it to.

## Layout

| Path | What |
|---|---|
| `custom.yml` | Rules specific to this panel — see below |
| `vendor/typescript.yml` | Vendored registry pack `p/typescript` (74 rules) |
| `vendor/secrets.yml` | Vendored registry pack `p/secrets` (52 rules) |
| `vendor/refresh.sh` | Re-download the vendored packs (manual snapshot update) |

The yarn scripts pass `--config semgrep/`, which loads every rule file in this
directory (custom + vendored) in one shot.

## The custom rules

This is the one process on the platform that can **stop a service**, so two of
the three rules guard that power rather than the data it reports.

| Rule | Why it exists |
|---|---|
| `marketplace-services-status-no-shell-command` | `src/systemd.ts` runs `execFile('systemctl', args)` with an argv array, so a unit name arriving from a browser is an argument and never a token the shell re-reads. `exec`, `execSync` and `shell: true` hand the string back to `/bin/sh` — the same input becomes command injection. |
| `marketplace-services-status-no-log-control-token` | The control token is the only thing between a request and `systemctl stop`, and it travels in a `?token=` query parameter as well as a header — so logging a request URL leaks it just as thoroughly as logging the header. |
| `marketplace-services-status-ws-must-not-self-attach` | A `WebSocketServer` built with `server:` or `port:` attaches its own upgrade listener and completes the handshake before `src/server.ts` validates `Origin` and `Host`. `noServer: true` plus an explicit `handleUpgrade` is what keeps the DNS-rebinding check on the path. |

## Provenance / reproducibility

- Vendored from `https://semgrep.dev/c/p/<pack>` on **2026-08-01**, the same
  snapshot the eleven backend repos carry.
- Semgrep engine pinned to **`semgrep/semgrep:1.172.0`**.
- The committed YAML is a frozen snapshot — the registry can change server-side,
  so scans use these files, not the live registry. To update deliberately:
  `./vendor/refresh.sh`, then review `git diff` and commit.
- `p/javascript` and `p/nodejs` are **not** vendored: the former has the same
  rule-id set as `p/typescript`, the latter is a strict subset of it. Vendoring
  them would only add duplicates (semgrep dedupes by id).

## Scope

`src` only — which here includes `src/public/`, the browser half of the panel.
That is deliberate: `app.js` builds the DOM from data that arrives over the
WebSocket, so it is exactly where an XSS rule earns its place. `test/`, the
systemd unit templates and the root config files are out of scope.

No `--scan-unknown-extensions` bypass is needed: this repo is plain `.ts` and
`.js`, both of which semgrep parses natively. The backend services carry that
flag because they are written in `.mts`, which maps to no parser at all.

⚠️ **Semgrep only scans files git already tracks.** A brand-new source file is
invisible to the scan until it is staged or committed — `Scan was limited to
files tracked by git` is printed on every run and is easy to read past. Stage
first, then scan, or the clean result is about the previous state of the tree.
