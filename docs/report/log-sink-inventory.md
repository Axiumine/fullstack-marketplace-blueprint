# Log Sinks — What They Actually Contain

# Marketplace

**Status:** investigation finding — closes E12-S12. Not baselined, not a requirement document
**Version:** 1.10
**Date:** 2026-08-26
**Changelog:** v1.0 — the inventory. v1.1 — §10 records the platform owner's answer of 2026-08-11 to the
first of the two questions it routed. Nothing measured changed. v1.2 — item 2 is decided and fixed
(E12-S16); §10 gains the two corrections that fixing it produced — §5's two link shapes are four, and the
`Referer` field carried the same pair the request line did. v1.3 — the residual v1.2 recorded is now
**E12-S26** rather than a note: §10 says per flow whether the credential can leave the URL path, and adds a
sink nothing here had enumerated — the SSR page dehydrates the address and the hash into an inline `<script>`,
so the cache holds them as body content, not only as a key. That one is source-level and flagged as such.
v1.4 — the cache sink is closed the same day (E12-S26's first landed criterion) and §10 records what
reverting it shows: the second request to a reset link answered `HIT`, so the credential URL was genuinely
stored rather than merely storable. Nothing else measured changed. v1.5 — §10 stops calling the two questions
it routed "open": both were answered on 2026-08-11, `E12.md` §6 no longer houses them, and this document now
points at the story each answer landed on. v1.6 — §7.1 and §7.2 are closed (E12-S17, E12-S18) and both were
re-measured while closing. §7.1 **corrects one of its own rows**: host `ps aux` never showed the Redis
password, because Redis overwrites its `argv` at startup, so the before-state was two surfaces and not three.
§7.2's line count had moved from 380,144 to 458,129, and that rate is what sized the rotation pair.
v1.7 — §6.4 is closed (E12-S19): the edge pins its own retention at 14 daily rotations with `shred`, and
the fix added two measurements the finding had no reason to look for — `shred` degrades to `unlink` on a
busybox host while still exiting 0, and two `logrotate.d` files matching one glob make logrotate skip the
whole later-named file. §6.1's answer is unchanged: the address stays and the lifetime is the control.
v1.8 — the public half of that answer landed too (E12-S25): `/privacy` in `marketplace-user` states the
retention where a data subject can read it, and §6.4 and §10 record the one thing writing it corrected —
`rotate 14` daily lets an entry live into the **fifteenth** day, so "14 days" alone would have been a
statement this configuration overruns. v1.9 — E12-S26 is closed for the customer flow and §10 gains the
before/after measurement its first criterion asked for. The dehydrated body is confirmed as read at source,
and the response carrying it was also labelled `public, s-maxage=60, stale-while-revalidate=600` — the origin
inviting every shared cache in the path, Cloudflare included, to keep a live one-time credential for ten
minutes. That is a sink no section of this document had enumerated. After: the credential is in the URL
fragment, appears zero times in a body served `private, no-store`, and the emailed URL and the bare path
produce byte-identical answers. One method note joins §2: the SSR body greps as **binary**, so a `grep`
without `-a` reports a clean result on a page that contains both values.
**Scope:** every sink this platform writes log lines to — the nine backend services' application logs, the
three nginx access logs, the nginx error logs, and the Docker stack's own container output — and, per sink,
whether a token, a cookie, a signing key or a client IP can appear in it. It also answers the two questions
[`marketplace-nginx/conf.d/05-logging.conf:28-31`](https://github.com/Axiumine/marketplace-nginx/blob/main/conf.d/05-logging.conf)
and that repo's `CLAUDE.md` §95 explicitly delegate here: **which error-log levels emit the hard-coded
`client: <address>` prefix in this configuration, and what the retention on those files is.**
**Method:** measurement against the running Dev stack on this machine, not a reading of the code — that is
the blind spot the audit names. All nine services were stood up with `yarn dev`, each into its own capture
file, against the Docker Mongo replica set and Redis. Every credential-shaped value in every driven request
carried a unique sentinel (`MKTS12…`, and `203.0.113.77` as the forwarded address), so a leak is a `grep`
rather than a judgement. nginx was run from its own configuration inside a throwaway
`nginx:stable-alpine` container, at the shipped level and then one level lower. Static reading was used only
to explain a result already observed, and every such line is cited.
**Reads against:** [`token-handling-security-audit.md`](./token-handling-security-audit.md) §5 ·
[`docs/devprotocol/phase5/epics/E12.md`](../devprotocol/phase5/epics/E12.md) E12-S06, E12-S07, E12-S09,
E12-S11, E12-S14 · [`sentry-event-capture.md`](./sentry-event-capture.md) (E12-S13, the sink this finding
does not cover) v1.10 — 2026-08-26: three dated corrections, nothing re-measured. `phase1/NFR.md` open question 1 (NFR-CO02) was closed that day by a decision taken outside this finding, so the two places saying it is or stays open now say it was, and §10 gains a block quote recording the closure and why this document did not produce it. The §10 paragraph asserting that log retention is not applicability is left standing — it was right, and the fifteen-day gap is the evidence.

---

## 1. Verdict

**The nine application logs are clean.** Not one sentinel, not one forwarded address, not one `Bearer`, not
one cookie name appeared in any of the nine capture files under real traffic — including the failure paths,
where the credentials themselves were poisoned with sentinels to see whether a datasource error would print
them back. It does not. The audit assumed nothing here; the measurement says the assumption would have been
right.

**Four sinks are not clean, and none of the four is the one the epic was watching.**

- 🔴 **The nginx access log records the account email address and the one-time verification / reset hash,
  verbatim, in `"$request"`.** Both mailed links are GETs that carry `:email/:hash` in the URL path, so the
  format's deliberate omission of every address variable does not help: the credential is in the request
  line. Measured on two of the three hosts. §5.
- 🔴 **The Redis password is visible in the container's argv** to any process on the host —
  `docker inspect`, `docker ps --no-trunc` and `ps aux` all show it. Not in `docker logs`. §7.
- 🟠 **The nginx error log carries a full client address at the shipped level.** Five entries were produced
  at `warn` and **five of five** carry `client: <address>`. §6 — and this is the answer to the delegated
  question, which is *not* a list of levels.
- 🟠 **Nothing bounds any of it.** All four database containers run `json-file` with no `max-size` and no
  `max-file`; `marketplace-mdb1` is already at **380,144 lines**. `marketplace-nginx` ships no rotation
  configuration at all and the image has no `logrotate` binary. §6.4, §7.2.

One smaller thing, in the application logs and caller-controlled:
`BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/queries/publicHelloArgs.mts:15` echoes its
argument to stdout verbatim. Nothing sensitive is *routed* there, but what lands in that log is the caller's
choice, which is the same defect shape by a different door. §4.3.

Each of the five becomes a story — §9 — and the two that put a full client address or an email address on
disk route to the standing GDPR decision rather than being fixed here. §10.

## 2. Method, in enough detail to repeat

| Step | What was done |
|---|---|
| Stack | Nine services via `yarn dev`, ports 4024-4032, each `stdout`+`stderr` into its own file; Mongo replica set (`mdb1`/`mdb2`/`mdb3`) and Redis from `docker-DBs/docker-compose.yml` |
| Traffic | Anonymous queries, a failing login on each of the three tiers, authenticated calls with a forged `authorization`, a refresh with a forged cookie, a malformed JSON body, and an unparsable GraphQL document |
| Markers | Every credential-shaped header and field carried a unique `MKTS12…` sentinel; the forwarded address was the reserved-for-documentation `203.0.113.77` |
| Failure paths | The stack was re-run three more times with the Mongo URI, the Redis credentials and the CSFLE master key each poisoned with a sentinel, to see whether a connection error prints the credential it failed with |
| nginx | The repo's own `conf.d/`, `snippets/` and `sites-available/` mounted read-only into `nginx:stable-alpine`, with throwaway self-signed certificates generated inside the container; seven probes at `warn`, the same seven at `info`; a second run driving the two mailed link shapes |
| Docker | `docker logs`, `docker inspect`, `docker ps --no-trunc` and host `ps aux` for each of the five running containers |
| SSR body (added 2026-08-11, §10) | `marketplace-user` built with `yarn build` and served by `node serve.mjs` on a spare port — a **production** build, since the response the cache stores is not the dev server's; `curl -D` for the headers, `grep -a` for the planted values, before the change and after it |

Only the level was changed in the nginx configuration between passes. Every other directive is the repo's.

⚠️ **`grep -a`, not `grep`, on any SSR response.** The HTML `marketplace-user` returns is classified as
binary by `file(1)`, and `grep` on a binary file prints "binary file matches" or, piped, nothing at all. A
credential search run without `-a` therefore reports zero hits on a body that contains the credential — a
false clean result that looks exactly like a real one.

## 3. The inventory

| Sink | Token | Cookie | Signing key | Client IP | Other |
|---|---|---|---|---|---|
| Nine service application logs | **no** | **no** | **no** | **no** | caller-supplied string, §4.3 |
| nginx access logs (three hosts) | **yes** — the one-time verify / reset hash, §5 | no | no | **no** — the format carries no address variable | **yes** — the account email address, §5 |
| nginx error logs (per host, `warn`) | no | no | no | **yes**, §6 | — |
| nginx error log (http-level, `notice`) | no | no | no | **no**, §6.2 | — |
| `docker logs` — Mongo ×3 | no | no | no | **no** — backend socket addresses only, §7.3 | — |
| `docker logs` — Redis | no | no | **no**, §7.1 | no | — |
| Container argv (`inspect` / `ps`) | no | no | **was yes** — the Redis password; ✅ fixed by E12-S17, §7.1 | no | — |

Sentry is a sink too, and it is not in this table: it is E12-S13's subject and has its own finding,
[`sentry-event-capture.md`](./sentry-event-capture.md). That finding is where the request-body result lives,
and it is the more severe of the two.

## 4. The nine application logs

### 4.1 What is in them

Post-boot, under the full driven load, the nine files hold exactly three kinds of line and nothing else:

- Koa's default `onerror` stack for `GraphQLError: Token Required` (24 occurrences) and
  `GraphQLError: Invalid Token` (18) — thrown by `throwRefreshTokenRequired` / `verifySignedRefreshToken`
  in `@axiumine/koa-utils`, printed because `tdwKoaErrorHandler` re-emits on `ctx.app` and Koa's default
  handler writes the stack to `stderr`. The stack names the frame, never the value it rejected.
- `catch GraphQLError: Unauthorized` plus its `extensions`, from
  `BEs/dev/marketplace-dev-public-authorization/src/graphQLPublic/schema/mutations/login.mts:117` and
  `loginAdmin.mts:120`. **The email and the password are not in it** — `e` is the thrown `GraphQLError`, not
  the arguments — but it is an unstructured debug `console.log` on the login path, which is the one place a
  future edit would most easily turn into a leak.
- A body-parser `SyntaxError` for the malformed request.

`BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:46`
prints the constant string `auth undefined` and no value.

### 4.2 The tally

| Service | Lines | `MKTS12*` | `203.0.113.77` | `Bearer` | cookie names |
|---|---|---|---|---|---|
| `marketplace-dev-admin-authenticated-authorization` | 99 | 0 | 0 | 0 | 0 |
| `marketplace-dev-admin-authenticated-resource` | 75 | 0 | 0 | 0 | 0 |
| `marketplace-dev-authenticated-authorization` | 99 | 0 | 0 | 0 | 0 |
| `marketplace-dev-authenticated-logout` | 96 | 0 | 0 | 0 | 0 |
| `marketplace-dev-authenticated-resource` | 75 | 0 | 0 | 0 | 0 |
| `marketplace-dev-public-authorization` | 58 | 0 | 0 | 0 | 0 |
| `marketplace-dev-public-resource` | 31 | **1** | 0 | 0 | 0 |
| `marketplace-dev-user-authenticated-authorization` | 98 | 0 | 0 | 0 | 0 |
| `marketplace-dev-user-authenticated-resource` | 72 | 0 | 0 | 0 | 0 |

The single hit is §4.3. Everything else is a zero measured against a value that was present in the request
that produced the line — which is what makes the zero mean something.

### 4.3 The one hit

```
publicHelloArgs: name:  MKTS12ARGdddd4444
```

`BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/queries/publicHelloArgs.mts:15` is a
`console.debug` of a caller-supplied argument. The query is a public smoke-test resolver and the argument is
a display name, so nothing the platform *routes* there is sensitive. What the line writes to disk is,
however, entirely the caller's choice, on an unauthenticated endpoint, with no bound on length. It is the
only place in nine services where request-supplied content reaches a log verbatim. → **E12-S20**.

### 4.4 The failure paths do not print the credential they failed with

Three separate boots, each with one credential poisoned:

| Poisoned | What was printed | Sentinel in the log |
|---|---|---|
| `MONGODB_URI` | `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27099` | 0 |
| Redis credentials | `Redis Client Error` ×6, then `RootNodesUnavailableError` | 0 |
| CSFLE master key | `The CSFLE master key must be exactly 96 bytes, got 22` | 0 |

The CSFLE message is the interesting one: `BEs/marketplace-common/src/encryption/setupFieldEncryption.mts`
reports the key's *length* and never its bytes, and `requiredEnv` reports the variable's *name*
(`${name} is not set — field encryption cannot start without it`) and never its value. That is the property
that makes the "no" in the table a no rather than an absence of evidence.

## 5. The nginx access logs — the format is right and it is not enough

> ✅ **Fixed 2026-08-11 by E12-S16, after this was written.** Everything below is the measured before-state
> and is kept as such. The format quoted here no longer exists in that shape, and the correction §10 records
> matters when reading the rest of the section: there are **four** link shapes, not the two driven here, and
> the `"$http_referer"` field carried the same values as `"$request"` for any request a browser made from
> the reset page.

`marketplace-nginx/conf.d/05-logging.conf:33` defines the only format the three vhosts use:

```
log_format mkt_access
	'$time_iso8601 $host "$request" $status $body_bytes_sent '
	'"$http_referer" "$http_user_agent" '
	'rt=$request_time urt=$upstream_response_time';
```

No `$remote_addr`, no `$http_x_forwarded_for`, no `$realip_remote_addr`, in any position. Measured: **zero**
occurrences of `127.0.0.1` across every access log produced by the probe. E12-S07 holds, live.

`"$request"` is the problem. Both links this platform mails are GETs that carry the address and the one-time
hash in the path:

- `BEs/dev/marketplace-dev-public-resource/src/middleware/router/index.mts:16`
  — `router.get('/verify-email/:email/:hash', …)`
- `…/index.mts:25` — `router.get('/verify-email-user/:email/:hash', …)`
- `…/src/lib/access/sendUserVerifyEmail.mts:11` — `USER_VERIFY_LINK_PATH = '/check/verify-email-user'`
- `…/src/lib/access/resetPwdFlowUser.mts:38` — `RESET_PATH_USER = '/reset-password'`
- `marketplace-nginx/sites-available/marketplace-domain.com.conf:207` —
  `location ^~ /check/verify-email-user/`

Driving those three shapes plus an ordinary GraphQL POST produced, verbatim:

```
2026-08-11T08:24:24+00:00 marketplace-domain.com "GET /check/verify-email-user/probe%40example.invalid/MKTS12VERIFYHASHjjjj0000 HTTP/2.0" 200 96 "-" "curl/8.21.0" rt=0.001 urt=0.000
2026-08-11T08:24:24+00:00 marketplace-domain.com "GET /reset-password/probe%40example.invalid/MKTS12VERIFYHASHjjjj0000 HTTP/2.0" 200 85 "-" "curl/8.21.0" rt=0.001 urt=0.001
2026-08-11T08:24:24+00:00 marketplace-domain.com "POST /public-resource HTTP/2.0" 200 96 "-" "curl/8.21.0" rt=0.001 urt=0.000
2026-08-11T08:24:24+00:00 marketplace-domain.com "GET / HTTP/2.0" 200 85 "https://evil.invalid/?t=MKTS12REFERERkkkk1111" "MKTS12UAllll2222" rt=0.001 urt=0.000
2026-08-11T08:24:24+00:00 shopowner.marketplace-domain.com "GET /check/verify-email/probe%40example.invalid/MKTS12VERIFYHASHjjjj0000 HTTP/2.0" 200 106 "-" "curl/8.21.0" rt=0.001 urt=0.000
```

| Marker | Occurrences |
|---|---|
| the verification / reset hash | 3 |
| the account email address | 3 |
| `authorization` header value | 0 |
| cookie value | 0 |
| `127.0.0.1` | 0 |
| caller-controlled referer | 1 |
| caller-controlled user-agent | 1 |

Two consequences, both measured rather than argued:

1. **The one-time hash is a bearer credential and it is on disk in plaintext**, on the customer host and the
   panel host, for as long as the file lives — which §6.4 says is undefined. Anyone who can read the access
   log can complete a verification or a password reset that was mailed to someone else, for as long as the
   hash is valid.
2. **The address is PII in a log file.** Not network-derived, so the standing GDPR decision does not cover
   it by its own words, which is exactly why it goes to that decision rather than being answered here. §10.

Referer and user-agent are caller-controlled and written verbatim, as the format intends. Worth stating so
that the next reader does not treat those two columns as trustworthy.

## 6. The nginx error log — the delegated question, answered

### 6.1 Level is not the discriminator

`conf.d/05-logging.conf:28-31` asks which levels emit the `client: <address>` prefix. Measured, the premise
does not hold: **the discriminator is whether the entry has a request or connection context at all, not how
severe it is.** At `warn`, the level all three vhosts ship
(`sites-available/admin.marketplace-domain.com.conf:75`, `marketplace-domain.com.conf:94`,
`shopowner.marketplace-domain.com.conf:74`):

| Level | Entries | With `client: ` |
|---|---|---|
| `error` | 2 | **2** |
| `warn` | 3 | **3** |
| `notice` | 162 | 0 |
| **total** | **167** | **5** |

Every one of the five request-scoped entries carries the address; not one of the 162 process-lifecycle
entries does. The five were:

- `[error] connect() failed … upstream` ×2 — every 502 produces one
- `[warn] using uninitialized "csp_nonce" variable` ×2 — fires only on requests that fail before the rewrite
  phase, so on the 400s, not on ordinary traffic (`marketplace-domain.com.conf:72` sets
  `$csp_nonce $request_id`)
- `[warn] a client request body is buffered to a temporary file` ×1 — any body over the buffer size

### 6.2 Where the 162 go

The `notice` entries are nginx's own start/stop/worker lines. They land in the **http-level** `error.log`,
not in the three per-host files, and they carry no client. The per-host files hold only request-scoped
entries — which is to say that every line in them is a line with an address in it.

### 6.3 Lowering the level adds two more classes

Re-run at `info`, everything else identical: 169 distinct entries, **7** with `client: `. The two new ones
are `client sent plain HTTP request to HTTPS port` and `client sent no required SSL certificate` — the
origin-pull refusal E12-S15 introduces. Both are connection-scoped and both name the address.

`ssl_reject_handshake` rejections are silent at **both** levels: the SNI probe against a host no vhost serves
produced no entry at all.

### 6.4 Retention: there is none, and the repo does not pin one

- `marketplace-nginx` ships **no** rotation configuration — `find /src -name '*logrotate*'` returns nothing.
- The `nginx:stable-alpine` image has **no** `logrotate` binary.
- On this host the distro package's default applies (`/etc/logrotate.d/ngx`: weekly, `rotate 4`, `compress`,
  `delaycompress`, `create 0640 www-data adm`) — a host fact, not a repo fact, and therefore not a guarantee
  the deployment inherits.

So the honest answer to the second delegated question is: **the retention on those files is whatever the host
happens to do, and this workspace neither states nor enforces it.** With §5 and §6.1 both writing
credential-grade content into those files, that is a gap rather than a detail. → **E12-S19**.

> ✅ **Fixed 2026-08-11 by E12-S19.** `marketplace-nginx/logrotate.d/nginx` — `daily`, `rotate 14`, `shred`,
> `compress`/`delaycompress`, `create 0640 www-data adm`, `su root adm`, `USR1` under `sharedscripts` — over
> `/var/log/nginx/*.log`, which covers the seven destinations this repo names and nginx's own `error.log`
> besides. The retention is now a property of the repository: `find /src -name '*logrotate*'` returns it, and
> the container suite fails if it stops parsing, stops covering a destination the configuration names, or
> stops reading back as fourteen daily rotations.
>
> ⚠️ **Two measurements taken while closing this, neither of them in the story.** First, `shred` fails open:
> logrotate does not run `shred <file>`, it hands the open descriptor to `shred … -`, and busybox's applet
> cannot open `-`. On `nginx:stable-alpine` every removal printed `error: Failed to shred <file>, trying
> unlink`, unlinked the file and exited **0**. Debian 13 ships GNU coreutils so the deployment target is
> fine, but on an Alpine-based host this directive is off with nothing but cron mail to say so — the suite
> installs `coreutils` and asserts the forced runs are error-free for exactly that reason. Second, two files
> in `/etc/logrotate.d` matching one glob are not additive: logrotate prints
> `error: <file>:1 duplicate log entry for …`, skips the **whole** later-named file and exits 1, so this one
> installs over the packaged `/etc/logrotate.d/nginx` rather than beside it under its own name.
>
> The 14 days are the floor of the owner's 14–30 (§10): the only consumer of an nginx error log here is a
> developer reading back a recent failure. What this does **not** do is make the content unrecoverable —
> `shred` overwrites the blocks the file occupies now, and a copy-on-write filesystem, ext4 with
> `data=journal` or SSD wear levelling can keep an earlier copy out of its reach. The lifetime is the
> control; `shred` raises the cost of the residue.
>
> ✅ **And stated in public the same day, by E12-S25** — `/privacy` in `marketplace-user`, linked from the
> footer of every page. ⚠️ **Writing it found the period needs a sentence the configuration does not:**
> `daily` + `rotate 14` keeps fourteen closed files beside the one being written, so an entry written just
> after a rotation is destroyed on the **fifteenth** day. "14 days" on its own is a promise this
> configuration overruns by one, which is why the page states the mechanism and the bound rather than the
> number alone. Anyone changing `rotate` here changes that page in the same piece of work; the page's
> assertions are byte-for-byte quotations, so the drift fails a suite rather than sitting in production as a
> false statement.

## 7. Docker

### 7.1 The Redis password is in the container's argv

`docker-DBs/docker-compose.yml:62`:

```yaml
command: [redis-server, --appendonly, 'yes', --requirepass, '${REDIS_PASSWORD:-unset}']
```

| Surface | Password visible |
|---|---|
| `docker logs marketplace-redis` | **no** |
| `docker inspect marketplace-redis` | **yes** |
| `docker ps --no-trunc` | **yes** |
| host `ps aux` | **yes** |

Any unprivileged local process can read it. Not a log sink in the narrow sense — which is precisely why an
inventory that only looked at log files would have missed it. → **E12-S17**.

> ✅ **Fixed 2026-08-11 by E12-S17**, and the fix re-measured the table above. The password now reaches the
> container in `secrets/redis.conf`, generated by `up.sh` from `.env` and mounted read-only, so argv is
> `redis-server /usr/local/etc/redis/redis.conf` and the token `requirepass` appears nowhere in
> `docker inspect` at all. `docker ps --no-trunc` and `docker logs` are clean on the same check.
>
> ⚠️ **One row of the table above was wrong, and the correction is worth more than the row.** Host `ps aux`
> did **not** show the password at steady state, and could not have: Redis overwrites its own `argv` at
> startup (`set-proc-title yes`, on by default), so `/proc/<pid>/cmdline` reads `redis-server *:6379` from
> the first second onward. Re-measured on the old shape against a throwaway container on 2026-08-11 —
> `docker ps --no-trunc` printed `--requirepass <value>` while `pgrep -a -f redis-server` printed the
> rewritten title for the very same process. The before-state was therefore **two** surfaces, not three:
> `docker inspect` and `docker ps`, both of which need access to the daemon socket. That does not soften the
> defect — daemon-socket access is not privilege on most developer machines, it is group membership — but a
> finding that says `ps aux` when `ps aux` says otherwise is the kind of claim that gets a whole report
> disbelieved.

### 7.2 Nothing is bounded

| Container | Driver | `max-size` / `max-file` | Lines today |
|---|---|---|---|
| `marketplace-mdb1` | `json-file` | none | **380,144** |
| `marketplace-mdb3` | `json-file` | none | 5,739 |
| `marketplace-mdb2` | `json-file` | none | 4,553 |
| `backend-backend-1` | `json-file` | none | 2,350 |
| `marketplace-redis` | `json-file` | none | 56 |

`json-file` with an empty options object grows without limit until the filesystem stops it. → **E12-S18**.

> ✅ **Fixed 2026-08-11 by E12-S18.** All four services in `docker-DBs/docker-compose.yml` share one
> `x-logging` anchor — `max-size: 20m`, `max-file: '5'` — and
> `docker inspect -f '{{json .HostConfig.LogConfig}}'` returns that pair for each of them.
> `backend-backend-1` is not in this compose file and is not covered; it belongs to another project on the
> same machine.
>
> **Re-measured while sizing it,** because the number above had moved: `marketplace-mdb1` was at 458,129
> lines / 229 MiB across 52.6 hours — 4.6 MB an hour — against 2.8 MiB, 4.2 MiB and 9 KiB for `mdb2`, `mdb3`
> and `redis` over the same span. 20 MiB × 5 caps one container at 100 MiB and the stack at 400 MiB, which
> at mdb1's rate keeps roughly the last 22 hours. The pair is sized for the loud container; for the other
> three it means "never rotates".
>
> ⚠️ **Rotation is not retention**, and E12-S18 deliberately does not pretend otherwise: this bounds how big
> a container log gets and decides nothing about how long its content may be kept. The 14-day answer of
> 2026-08-11 is the edge's (§6.4, E12-S19). No period has been decided for these files.

### 7.3 Mongo's `remote` field is not a client address

The Mongo logs carry `"remote":"127.0.0.1:<port>"` on every connection — the **backend service's** socket, on
loopback, because the services connect to the replica set directly. No end-user address reaches Mongo and
none can: nothing forwards one. No auth material appears in the connection lines either. That is what makes
this row a "no" rather than an unchecked box.

## 8. What this finding does not cover

- **Sentry.** E12-S13, [`sentry-event-capture.md`](./sentry-event-capture.md). It is a sink, it is measured,
  and it is worse than anything here.
- **Production topology.** Everything above was measured on a single-host Dev stack. ADR-032 records that the
  production topology is owed; a hosted log aggregator, a different nginx level or a different Docker driver
  would each change §6 and §7 and none of them exists yet to be measured.
- **The three frontends.** They log to a browser console, which is not a sink this platform writes to disk.

## 9. Every "yes" becomes a story

| Finding | Story | Severity |
|---|---|---|
| The mailed links put the address and the one-time hash in the access log, §5 | **E12-S16** — ✅ fixed 2026-08-11 | 🔴 |
| …and still travel in the URL, so Cloudflare, the SSR cache and the browser history keep them, §10 | **E12-S26** — opened 2026-08-11 by the owner, not by this finding | 🟠 |
| The Redis password is in the container argv, §7.1 | **E12-S17** — ✅ fixed 2026-08-11, and one row of §7.1 corrected with it | 🔴 |
| No Docker log driver is bounded, §7.2 | **E12-S18** — ✅ fixed 2026-08-11 | 🟠 |
| nginx log retention is unpinned while the error log carries client addresses, §6.1 / §6.4 | **E12-S19** — ✅ fixed 2026-08-11, and §6.4 gained two measurements taken while fixing it · **E12-S25** — ✅ the same period stated in public, `/privacy`, 2026-08-11 | 🟠 |
| `publicHelloArgs` echoes its argument, §4.3 | **E12-S20** — ✅ fixed 2026-08-11 | 🟡 |

All five are written into [`E12.md`](../devprotocol/phase5/epics/E12.md) §4 as part of closing this story, as
its acceptance criteria require. None is fixed here — this story produces a finding and nothing else.

## 10. What routes to the GDPR decision rather than being fixed here

E12-S12's fourth criterion routes full client IPs in nginx access logs to the standing GDPR decision. The
access logs record none. **Two neighbouring facts do belong there, and neither was in the criterion's
sights:**

1. **The nginx error logs record full client addresses at the shipped level** — five of five request-scoped
   entries, §6.1 — with no retention pinned, §6.4. The standing decision is that no network-derived value is
   captured *in any form*; this is one, on disk, today, and it is not reachable by a `log_format` because
   nginx hard-codes the prefix.
2. **The nginx access logs record account email addresses**, §5. PII rather than network-derived, so the
   standing decision does not speak to it by its own wording — which makes it a question for the same owner
   rather than an answer this finding may give.

Both were routed to the platform owner as open questions rather than fixed here, alongside
`RISK_REGISTER` R25 and `phase1/NFR.md` open question 1 (NFR-CO02), which is where GDPR applicability was
logged as undecided at the time of this finding. Both came back answered the same day — see below — and `E12.md` §6 now holds no
open question at all: each answer lives on the story that carries it out, item 1 on **E12-S19** (with its
privacy-notice clause on **E12-S25**) and item 2 on **E12-S16**. NFR open question 1 stayed open — it was
closed on 2026-08-26 by a separate decision, see the note at the end of §10.

### The answer, 2026-08-11

The platform owner decided item 1 the same day, verbatim: *"keep raw IPs in error_log, logrotate at 14–30
days with shred, anonymize access_log, write two lines in your privacy policy. That's proportionate and
defensible."*

| Item | Outcome |
|---|---|
| 1 — full client address in the error log | **Kept.** The control is lifetime, not content: rotation at 14 days (`shred` on removal), which is what E12-S19 now configures. The level stays `warn` |
| 2 — account email in the access log | **Decided and fixed the same day.** *"Anonymize access_log"* — measured, that log holds no address to anonymize (§5), so read against what it does hold the instruction says no personal data in it. Mechanism given next: *"rewrite the logged path — map the two location blocks to a redacted `$request` variable"*. **E12-S16 built it**, at http level rather than per location, because §5's two shapes are four and only two have a `location` block. See below |
| the public half | Two lines in a privacy policy → **E12-S25**, ✅ written 2026-08-11: `/privacy` in `marketplace-user`, the platform's first, footer-linked and indexable. It names which log holds the address and which holds the URL, since neither line is true of both files, and it states the fifteenth-day bound `rotate 14` really produces |

This closes the routing this finding opened. It does **not** close `phase1/NFR.md` open question 1: whether
GDPR is formally in scope is a wider question than log retention, and one concrete decision inside it is not
an answer to it.

> **⚠️ Update — 2026-08-26: open question 1 is closed, and this finding did not close it.** The platform owner
> decided GDPR is in scope, on evidence outside every log file measured here: `company` requires Italian
> registration identifiers (`vatNumber` 11, `certifiedEmail`, `taxCode` in its legal-entity form), which makes
> the platform EU-established and EU-targeting under Art. 3 — `phase1/NFR.md` §2.7. The paragraph above stands
> as written: it was correct that a log-retention decision is not an applicability decision, and the fifteen
> days between the two is the proof. **Nothing measured in this document changes**, and the log decisions it
> records remain the only retention rule this platform has for personal data outside Redis sessions — the
> collections themselves still have none, which is now one of six unimplemented obligations under
> `phase1/NFR.md` open question 6.

### What §5 got right, and the two things it missed

Item 2 is fixed in `marketplace-nginx/conf.d/05-logging.conf` (E12-S16). Re-driving §5's probe against the
new format produces `"GET /check/verify-email-user/[redacted] HTTP/2.0"` — the flow name, no address, no
hash — and the suite in `test/suite.sh` asserts it. Two corrections to §5, both found while fixing it:

- **§5 measured two link shapes because two is what it drove. There are four.** `/reset-password/:email/:hash`
  (`resetPwdFlowUser.mts:38`, an SSR route on the apex) and `/x/reset/:email/:hash` (koa-utils' default
  `linkPath`, taken because `resetPwdFlow.mts:47` passes no mailer) carry the same pair and were never in the
  probe. Neither has an nginx `location` block, so the mechanism as literally worded — the two `location`
  blocks — would have left both writing the credential. The map is keyed on the logged value at http level
  instead, and the suite drives all four.
- **§5 looked at `"$request"` and stopped there. The next field held the same values.** The customer surface
  answers `Referrer-Policy: strict-origin-when-cross-origin`, which sends the **full URL** on a same-origin
  request, so every asset fetch and every GraphQL call made by the page at `/reset-password/:email/:hash`
  wrote the address and the live hash into `"$http_referer"`. A second map covers it. The probe never saw
  this because `curl` sends no referer — a browser does.

**Residual, unchanged by the fix:** the credential still travels in the URL. Cloudflare's own logs, any
middlebox, the browser history and the mail client all still hold it; only moving the token out of the path
would reach those, and that is the option the platform did not choose. And one sink this finding never
enumerated: `sites-available/marketplace-domain.com.conf` caches the SSR reset page under
`proxy_cache_key "$scheme$request_method$host$request_uri"`, writing the whole link into
`/var/cache/nginx/marketplace-user/` — for up to `inactive=24h` (`conf.d/30-cache.conf:8-13`), which is the
number that matters rather than the 60s of freshness.

✅ **That sink is closed, 2026-08-11** (E12-S26's cache criterion). `map $request_uri $mkt_credential_uri`
joins the session-cookie variable on `proxy_cache_bypass` and `proxy_no_cache`, matching the same four
prefixes the logging maps redact. ⚠️ **It was live, not theoretical**: with the change reverted, the second
request to `/reset-password/<address>/<hash>` answers `X-Cache-Status: HIT` — the credential URL was being
stored as a key and served back from it. The session-cookie map could never have caught this: the route has
no `location` block of its own and whoever follows a reset link is anonymous, so that map read 0 for exactly
the request that must not be stored. The credential is still **in the URL**, which is the rest of E12-S26.

### Both of those are now a story — E12-S26, opened 2026-08-11

The platform owner read the residual and asked whether the token can be taken out of the path rather than
accepting that it cannot. It can, for one of the four flows, and the story is scoped to exactly that one:

| Flow | Can the credential leave the path? |
|---|---|
| `/reset-password/:email/:hash` — customer reset, an SSR route | **Yes, cheaply.** It moves into the URL **fragment**, which no browser transmits (RFC 3986 §3.5), so it stops reaching the request line, the `Referer`, the cache key and Cloudflare in one move. `@axiumine/koa-utils` needs no change: the builder normalises only `linkPath`'s leading slash and `encodeURI` never escapes `#` (`SocketLabsLib.mjs:280-283`), so a trailing `#` on `RESET_PATH_USER` is the whole backend edit |
| `/check/verify-email/:email/:hash` and `…-user/…` | **No, not cheaply.** Koa REST `GET`s (`middleware/router/index.mts:16,25`) — a fragment never reaches the server, so moving them means a new frontend page plus a new mutation per surface. And their hash is consumed by the same request that writes the log line, so it is spent before anything stores it. Redaction is proportionate |
| `/x/reset/:email/:hash` — ShopOwner reset | **Nothing to move it into.** ⚠️ Measured while scoping: the link routes nowhere. No nginx `location` matches it, the panel's SPA fallback answers, and `marketplace-shopowner/src/router.tsx:52-101` has no reset route and no not-found component. An unbuilt screen, not a telemetry defect |

✅ **The customer flow is closed, 2026-08-11** (E12-S26, the rest of it). `RESET_PATH_USER` gained a trailing
`#`, so the mail now points at `/reset-password/confirm#/<address>/<hash>`; `marketplace-user` replaced the
param route with a static one, reads the pair from `window.location.hash`, and marks that route `ssr: false`.
Nothing about the credential is transmitted any more, so the sinks this finding enumerated for that flow —
the access log's request line and `Referer`, the cache key, the cached body, and Cloudflare's own logs, which
no configuration in this workspace reaches — all stop receiving it at the same moment. Three residuals stay
open by nature rather than by choice: mails already sent keep the old shape for up to 60 minutes and now land
on a 404, the fragment stays in the browser's history entry, and the whole link stays in the mail client's
copy forever.

⚠️ **Scoping also found a sink neither §5 nor the paragraph above knew about, and it is the same values in a
different place.** `/reset-password/$email/$hash` is server-rendered — the only `ssr: false` in
`marketplace-user` is `src/routeOptions/account.tsx:59` — and TanStack Router dehydrates **every rendered
match** into an inline `<script>`, keyed by a match id built from the *interpolated* path
(`@tanstack/router-core` `router.js:715-721`, `ssr/ssr-match-id.js:2-4`,
`ssr/ssr-server.js:18-32,295-297,346-352`). Read at source that puts the address and the live hash in the
**HTML body**, so the cached file holds them as content and not only as a key. **Source-level, not measured**
— E12-S26's first criterion is to `curl` the page and settle it, for the reason §5 of the Sentry capture
gives: an option's documented behaviour and its real behaviour differed there.

### Measured, 2026-08-11 — and the body was only half of it

A production build (`yarn build`, `node serve.mjs`) answering
`/reset-password/probe%40example.invalid/MKTS26HASHPROBE`:

```
HTTP/1.1 200
cache-control: public, s-maxage=60, stale-while-revalidate=600
vary: cookie

…,$R[10]={i:" reset-password $email $hash reset-password probe%40example.invalid MKTS26HASHPROBE",
          u:1786471081153,s:"success",ssr:!0}]})
```

Both planted values appear once each, in the dehydration script, exactly where the source reading said they
would be — so the paragraph above is confirmed rather than corrected. ⚠️ **The line nobody had read is the
second one.** The origin was labelling that response `public, s-maxage=60, stale-while-revalidate=600`: an
instruction to every shared cache between here and the visitor — Cloudflare included, which the nginx bypass
cannot reach — to store a live one-time credential and serve it for up to ten minutes. The `vary: cookie`
beside it does not help, since whoever follows a reset link is anonymous and their `Cookie` header is
identical to the next anonymous visitor's.

⚠️ **The `grep` for this has to be `grep -a`.** The SSR response is classified as binary by `file(1)`, so a
plain `grep` reports zero matches on a body that contains both values — a measurement that looks like a clean
result and is a silent failure.

**After**, same build, same probe values:

| Request | Status | `cache-control` | Probe values in body |
|---|---|---|---|
| `/reset-password/confirm` | 200, 4505 bytes | `private, no-store` | 0 |
| `/reset-password/confirm#/probe%40example.invalid/MKTS26HASHPROBE` | 200, byte-identical | `private, no-store` | 0 |
| `/reset-password/probe%40example.invalid/MKTS26HASHPROBE` (old shape) | **404** | `private, no-store` | 0 |

The match id now reads `" reset-password confirm reset-password confirm"`. The second row is the whole point
stated as a measurement: the emailed URL and the bare path produce the same bytes, because the server never
received the difference between them. The third confirms the 404 page does not echo the path it refused, and
that the `private, no-store` rule is keyed on the request rather than on the outcome.
