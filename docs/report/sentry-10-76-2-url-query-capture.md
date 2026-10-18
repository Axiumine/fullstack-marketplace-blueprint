# What 10.76.2 Stops Sending: URL Query Strings, Measured Against 10.75.0

# Marketplace

**Measured:** the same request replayed through the platform's `Sentry.init` options under `@sentry/node` 10.75.0 and 10.76.2, with seven
sentinels planted in the query string, the headers, the cookie, the body and the forwarding address, and every envelope read for them.
**Status:** investigation finding — closes the reading behind admitting `@sentry/node` 10.76.2, and (§7) records the runtime check of a running
service made after `marketplace-common` 4.6.2 shipped. Not baselined, not a requirement
**Version:** 1.1
**Date:** 2026-10-18
**Changelog:** v1.1 - 2026-10-18: `marketplace-common` 4.6.2 is published and its twelve consumers lock it. The §6 bullet that said the stale JSDoc
waited for the next release is rewritten, §1 gains one bullet (the scrubber at 4.6.1 passed the five fields) and marks its JSDoc sentence as
corrected, and §7 adds the measurement of a real running service at 10.76.2 and 4.6.2. The measurements and findings of §1 to §5 are unchanged:
they are the 10.75.0 / 10.76.2 probe, which ran `marketplace-common` 4.6.1.
**Scope:** what a service's Sentry envelopes contain, in the two releases, when the request carried a credential in its URL and the service made
one outgoing call whose URL carried another. It backs a static reading of the two releases' published tarballs with a measurement; it does not
replace that reading.
**Method:** measurement. Two throwaway npm projects, identical except for the SDK range (`^10.75.0` and `^10.76.2`), each resolving all five
`@sentry/*` packages the guard names to the same version — `node`, `core`, `node-core`, `opentelemetry`, `server-utils` — plus the published
`@axiumine/marketplace-common` 4.6.1, so `sentryBeforeSend` is the real scrubber **as it was before 4.6.2** (it did not remove `http.query` or
`url.query`). Nothing in any repository was modified and nothing left this host. §7 is a second, separate measurement with its own method.
**Reads against:** *The version is pinned by a test, not by a comment* and *10.76.2 is the second bump this section has admitted* in
[`docs/architecture.md`](../architecture.md) §Observability · risk **R42** in
[`docs/devprotocol/phase5/RISK_REGISTER.md`](../devprotocol/phase5/RISK_REGISTER.md) ·
[`sentry-event-capture.md`](./sentry-event-capture.md) (the 10.69.0 capture, from a running service) · `BEs/marketplace-common/CHANGELOG.md` 4.6.2

**Where the scripts are.** They were written for this measurement and are **not in the repository**. They stayed in the session scratch
directory, in the folder
`/tmp/claude-1000/-media-nvme-websites-fullstack-marketplace-blueprint/f4e169d4-3244-4501-b225-361ee27a20d4/scratchpad/sentry-apply/measure/`
(a path that does not outlive the session). The method below is complete enough to rebuild them: `instrument.mjs`, `probe.mjs` and
`probe-literal.mjs`, `driver.mjs`, `target.mjs`, and `analyze.mjs`, with the recorded envelopes (`old/out-*.json`, `new/out-*.json`)
and the verdicts (`results-*.json`) beside them.

---

## 1. Verdict

**10.76.2 only narrows. Every sentinel found in a 10.76.2 envelope was also found in the same field of the 10.75.0 envelope, and three
found at 10.75.0 are gone.** Across the three runs:

```json
{
  "controlLeaks": ["QSENTINEL", "OSENTINEL", "alice"],
  "newLeaks": [],
  "tested": ["QSENTINEL", "HSENTINEL", "CSENTINEL", "BSENTINEL", "OSENTINEL", "203.0.113.9", "alice"]
}
```

- **At 10.75.0, with `urlQueryParams: false`, the query string still shipped.** The inbound request's `token=QSENTINEL&user=alice` arrived
  in the server transaction's `contexts.trace.data["http.query"]`, and the outgoing call's `?apikey=OSENTINEL` arrived in four places. The
  option name suggests it would not, and the JSDoc in `sentryBeforeSend.mts`, written from a reading of 10.75.0, said it gates only
  `event.request.query_string` (corrected in 4.6.2); the measurement shows it did not reach these fields.
- **The scrubber did not catch them either, at 4.6.1.** The probe ran the published `marketplace-common` 4.6.1 on both hooks, and all five
  fields went through it untouched, because `http.query` and `url.query` were on no list it held. `marketplace-common` 4.6.2 removes both
  keys (§7.1), so the guarantee no longer rests on which SDK release is installed.
- **At 10.76.2 none of the five fields exists.** The query-bearing keys are absent, not blank.
- **The credential-bearing request parts never shipped, in either release.** `HSENTINEL` (the `Authorization` header), `CSENTINEL` (the
  cookie), `BSENTINEL` (the body) and the forwarding address `203.0.113.9` are in no envelope at 10.75.0 or at 10.76.2.
- **Nothing was added.** The structural diff of everything recorded has no field that exists only at 10.76.2.

## 2. What was sent, and what was planted

One inbound `POST /probe?token=QSENTINEL&user=alice`, sent from a separate process so the probe process records only what a service would
record, with these planted values:

| Sentinel | Where it was planted |
|---|---|
| `QSENTINEL`, `alice` | the inbound query string (`token=`, `user=`) |
| `HSENTINEL` | `Authorization: Bearer HSENTINEL` |
| `CSENTINEL` | `Cookie: sid=CSENTINEL` |
| `BSENTINEL` | the JSON body, `{"password":"BSENTINEL"}` |
| `203.0.113.9` | `X-Forwarded-For` |
| `OSENTINEL` | the query string (`?apikey=OSENTINEL`) of one outgoing `fetch` made by the handler to a second local process, run without Sentry |

The handler captures one error, makes the outgoing call, captures a second error (so the outgoing-call breadcrumb can be seen on an error
event) and answers. `instrument.mjs` is `BEs/dev/marketplace-dev-public-resource/src/instrument.mts` with three differences: a dummy `dsn`,
an in-memory recording `transport`, and `tracesSampleRate: 1`. The `DSN` gate and the `dotenv` import are dropped.
`httpIntegration({ maxIncomingRequestBodySize: 'none' })`, every `dataCollection` value and `sentryBeforeSend` on both `beforeSend` hooks
are as the services have them.

`analyze.mjs` walks every key and every string leaf of every envelope header, item header and payload, counts each sentinel there and
against the serialised whole, and records whether the two counts agree (they did, in every run). It then compares the two releases
field by field with run-volatile values masked.

## 3. Where the control leaked

Three runs, identical results. All five fields below are present at 10.75.0 and absent at 10.76.2:

| Sentinel | Field at 10.75.0 |
|---|---|
| `QSENTINEL`, `alice` | server transaction `contexts.trace.data["http.query"]` = `token=QSENTINEL&user=alice` |
| `OSENTINEL` | client span `data["url.query"]` = `?apikey=OSENTINEL` |
| `OSENTINEL` | client span `data["http.query"]` = `apikey=OSENTINEL` |
| `OSENTINEL` | transaction `breadcrumbs[0].data["http.query"]` |
| `OSENTINEL` | second error's `breadcrumbs[0].data["http.query"]` |

`event.request.url`, the server span's `url.full`, `http.url` and `http.target`, and the client span's `url.full` carry **no query in either
release in this probe**; the fields that differ are `http.query` and `url.query`. The static reading said 10.75.2 wires `urlQueryParams` into
every URL the SDK collects; this measurement confirms the two keys above and does not show a difference in the others, which one route shape
cannot distinguish from a filter that was already there.

## 4. The structural diff

Everything recorded, volatile values masked: nothing exists only at 10.76.2; ten entries exist only at 10.75.0 (the five fields of §3, each
as a key and as a value); the remaining differences are run-volatile (`sent_at`, `app_start_time`, `boot_time`, `trace.sample_rand`, which
differ between any two runs of one release), and the order the three items were sent in, which is a timing detail and is labelled by item,
not by position.

## 5. A trap in the probe, kept as a finding

`probe-literal.mjs` is `probe.mjs` with the outgoing sentinel written out in the source. It reports `OSENTINEL` **in 10.76.2 as well** —
twice, in an error's `stacktrace.frames[1].pre_context` and `post_context`. That is not a request leak: `frameContextLines: 7` copies the
source lines around a stack frame into the event, and the line that makes the call contains the sentinel. `probe.mjs` assembles the value at
runtime (`['O', 'SENTINEL'].join('')`) so its text is not in the file, and the runs of §3 are from that version. Anything that plants a
marker literally next to the code that sends it will read a stack-context copy as a leak.

## 6. What this does not cover

- **One route shape.** A `POST` with a query string and one `fetch`. Other route shapes, other outgoing clients (`http.request`, a
  third-party HTTP library) and the GraphQL path are not measured.
- **The reading of the tarballs stays the primary evidence** for the byte-identical files the guard's header lists. This measurement
  shows the *outcome* for the fields that matter and says nothing about a file the probe never ran.
- **The stale comment and the scrubber's gap were closed after this probe, by `marketplace-common` 4.6.2 (2026-10-18).** The probe ran 4.6.1,
  whose JSDoc cited 10.75.0 and said `urlQueryParams: false` gates only `event.request.query_string`, and whose list did not hold `http.query`
  or `url.query`. 4.6.2 corrects the comments (they ship in `dist/`, `removeComments` being off) and adds both keys to `REMOVED_KEYS`. Nothing
  in §1 to §5 was re-run against 4.6.2: they describe the SDK's behaviour at 10.75.0 and 10.76.2, which does not depend on it.
- **The browser apps are not covered.** The three frontends ship their own SDK; `sentry-event-capture.md` §9 is their measurement.

---

## 7. After `marketplace-common` 4.6.2: the scrubber's second layer, and a running service

§1 to §5 measured the SDK and ran the scrubber as it was (4.6.1). This section records what changed in the scrubber the same day, and then
what a real service sends with both releases in place.

### 7.1 What 4.6.2 adds

`marketplace-common` 4.6.2, published 2026-10-18 (tag `v4.6.2`, the tip of `main`), does two things:

- **`sentryBeforeSend` removes `http.query` and `url.query`** wherever it walks a bag (`contexts.trace.data`, `spans[].data`,
  `breadcrumbs[].data`), matched by whole key and case-insensitively like the rest of `REMOVED_KEYS`. They are in `REMOVED_KEYS` rather than in
  `URL_VALUED_KEYS` because each holds a bare query string, and there is no path to keep. The URL-valued keys (`url`, `url.full`, `http.url`,
  `http.target`, `referer`, `referrer`) are unchanged and still keep their path. At 10.76.2 the SDK no longer emits the two keys, so this is
  the second layer, and the guarantee stops depending on the installed SDK release.
- **The JSDoc of `src/others/sentryBeforeSend.mts` is corrected, and it ships** in `dist/`: the `urlQueryParams: false` claim of §1 now says
  what 10.76.2 gates, and the `file.js:line` references are re-pointed at 10.76.2.

Its evidence is the unit tests in `BEs/marketplace-common/test/sentryBeforeSend.test.mts` (both keys and a mixed-case spelling of each, in the
trace context, in a span and in a breadcrumb, with the neighbouring keys left untouched; `http.querystring`, `url.query_params` and
`http.query.extra` asserted as **not** removed). The twelve consumers (the nine services and the three browser frontends, which wire the same
scrubber on both hooks) lock 4.6.2.

### 7.2 Runtime check of a running service

**Measured:** one real service, `marketplace-dev-public-resource`, started from its own checkout with `@sentry/node` 10.76.2 and
`@axiumine/marketplace-common` 4.6.2 installed, sent real requests carrying seven sentinels, and every envelope its real Sentry transport
posted to a local collector was decoded and searched in every key and every string leaf.
**Verdict:** **no sentinel is in any envelope.** `QSENTINEL`, `alice`, `HSENTINEL`, `CSENTINEL`, `BSENTINEL`, `UASENTINEL` and `203.0.113.9`
appear in zero fields of zero envelopes, on an error event and on transactions, and no query-bearing key (`http.query`, `url.query`,
`query_string`) exists anywhere. A positive control through the same pipeline shows the search is not blind.
**Method:** the 2026-08-11 method of [`sentry-event-capture.md`](./sentry-event-capture.md) (a local collector on `127.0.0.1`, the DSN pointed at
it, nothing leaves the host), with the differences in "What was run" below. It closes the gap §6 left open: the probe of §2 replayed the
platform's `Sentry.init` options in a throwaway project, and this one runs the service.
**Where the scripts are.** `collector.mjs` and `analyze.mjs`, the recorded envelopes (`passA/`, `passB/`, `control/`) and the service logs are in
`/tmp/claude-1000/-media-nvme-websites-fullstack-marketplace-blueprint/f4e169d4-3244-4501-b225-361ee27a20d4/scratchpad/common462/runtime/`
(a path that does not outlive the session), and are **not in the repository**.

#### What was installed

Read from `node_modules/*/package.json` of the service, not from the manifest:

| Package | Installed |
|---|---|
| `@sentry/node` | 10.76.2 |
| `@sentry/core`, `@sentry/node-core`, `@sentry/opentelemetry`, `@sentry/server-utils` | 10.76.2 each |
| `@axiumine/marketplace-common` | 4.6.2 (declared `^4.6.0`, locked at 4.6.2 in `yarn.lock`) |
| Node | v24.18.0 |

Every sent envelope also reads `sdk.version` 10.76.2 and `environment` `development`.

#### What was run

| | |
|---|---|
| Service | `marketplace-dev-public-resource`, port 4098, `NODE_ENV=development`, the dev stack's real MongoDB and Redis, field encryption set up as on boot |
| Start command | `node_modules/.bin/tsx --import ./src/instrument.mts src/index.mts`, which is `yarn dev` minus the `tsc` step and minus `watch`. `src/instrument.mts` is the repo's own file, unmodified |
| DSN | `DSN=http://runtimechecklocalkey@127.0.0.1:9911/1`, exported in the launching shell only. `dotenv` does not override an existing variable, so the override held; the collector receiving the envelopes confirms it |
| Collector | a 30-line Node HTTP server, `POST /api/<id>/envelope/`, raw body stored, answers `200 {}` |
| Pass B (main) | the shipped configuration plus `SENTRY_TRACES_SAMPLE_RATE=1` in the launching shell. The SDK reads that variable only when `tracesSampleRate` is undefined (`@sentry/node-core/build/cjs/sdk/index.js:162`), and the shipped `instrument.mts` sets none, so this is the way to get a transaction without touching a tracked file |
| Pass A (control) | the shipped configuration with no sample-rate variable |
| Nothing changed | no tracked file was modified, nothing committed, `git status` of the service is clean, no systemd unit or container was touched |

Requests, all carrying `Authorization: Bearer HSENTINEL`, `Cookie: sid=CSENTINEL`, `X-Forwarded-For: 203.0.113.9`, `User-Agent: UASENTINEL/1.0`:

| # | Request | Result | Envelope |
|---|---|---|---|
| 1 | `POST /public-resource?token=QSENTINEL&user=alice`, JSON body with `password:"BSENTINEL"` in the document and in `variables`, one trailing brace too many | 400, `SyntaxError` from `bodyParser`, a non-`GraphQLError`, so `maybeCaptureSentryError` reports it | error event and transaction |
| 2 | the same URL and headers, well-formed JSON, `variables:{"password":"BSENTINEL"}` | 400, a GraphQL validation error (unused variable), not reported | transaction |
| 3 | `GET /health?token=QSENTINEL&user=alice` | 200 | transaction |
| 4 | positive control: request 3 with `Host: PSENTINEL.test` | 200 | transaction |

Pass B produced nine envelopes: four transactions, one request-time error event, three `info` message events and one `client_report` from the
`SIGTERM` shutdown. Pass A produced one envelope for the same three requests: the error event, and **no transaction**, which is the shipped
configuration's behaviour (no sample rate is set) and is now observed rather than read.

#### Results

Counted three ways that agreed on every sentinel: per field (every key and string leaf of the envelope header, item headers and payload), in the
decoded text, and in the raw bytes (every envelope arrived plain, none gzip).

| Sentinel | Planted in | Pass B (9 envelopes) | Pass A (1 envelope) |
|---|---|---|---|
| `QSENTINEL`, `alice` | query string `token=`, `user=` | 0 fields | 0 fields |
| `HSENTINEL` | `Authorization` header | 0 fields | 0 fields |
| `CSENTINEL` | `Cookie` header | 0 fields | 0 fields |
| `BSENTINEL` | JSON body, document and `variables` | 0 fields | 0 fields |
| `UASENTINEL` | `User-Agent` header | 0 fields | 0 fields |
| `203.0.113.9` | `X-Forwarded-For` | 0 fields | 0 fields |
| `PSENTINEL` / `psentinel` (control) | `Host` header of request 4 | 6 fields, in the envelope of request 4 only | not sent |

The control matters. In the envelope of request 4 the host sentinel is in `request.url`, `contexts.trace.data` `url`, `url.full` (lower-cased),
`http.url`, `http.host` and `net.host.name`, and the same request's `?token=QSENTINEL&user=alice` is in none of them. The URL fields are
populated, they are searched, and the query part is not there. The analyser was also run on a synthetic gzip-compressed envelope that planted
five of the sentinels (`QSENTINEL`, `alice`, `HSENTINEL`, `BSENTINEL`, `203.0.113.9`): it found each of them, in the right field.

#### Whether anything the old setup would have sent is still present

| Field the old setup shipped (10.75.0, §3) | In a sent envelope here |
|---|---|
| `contexts.trace.data["http.query"]` on the server transaction | absent |
| client span `data["url.query"]` and `data["http.query"]`, breadcrumb `data["http.query"]` | absent (no such key anywhere; no key matching `/query/i` at all) |
| `event.request.query_string` | absent |
| `event.request.url`, `url.full`, `http.url`, `http.target`, `url` | present, **path only**: `http://127.0.0.1:4098/public-resource`, `/public-resource`, `/health` |

`event.request` holds exactly `method` and `url` on the error event and on every transaction: no `headers`, no `cookies`, no `data`, no
`query_string`, and there is no `user`. The root-span attribute list is 22 keys (`sentry.*`, `url.full`, `url.path`, `http.url`, `http.method`,
`http.target`, `http.host`, `net.host.name`, `http.scheme`, `http.flavor`, `net.transport`, `http.request_content_length_uncompressed`,
`otel.kind`, `url`, `http.response.status_code`, `http.status_code`, `http.status_text`, `net.host.port`, `net.peer.port`). Against the
transaction of the 2026-08-11 capture at 10.69.0, `http.client_ip`, `http.user_agent`, `net.peer.ip` and `net.host.ip` are not in the sent
envelope. The 117 breadcrumbs across the ten envelopes read are all `category: "console"` with `data` holding only `logger`: none has a `message`
or an `arguments` list, where the 2026-08-11 event carried the arguments verbatim.

#### What this does not establish

- **Where a value was removed is not known.** Without the pre-`beforeSend` tee of 2026-08-11 (it lived in `node_modules/`, and this run was
  read-only) the run shows what reached the wire, not whether the SDK never collected a value or `sentryBeforeSend` took it out. The absences
  above hold either way; their attribution does not. **It follows that this run does not exercise the two keys 4.6.2 added**: at 10.76.2 the SDK
  does not emit them, so their removal is shown by the unit tests of §7.1 and not here.
- **No live A/B.** The old behaviour is taken from the 10.75.0 probe of §2 to §5 and the 10.69.0 capture; this run did not start the service at
  10.75.0.
- **One service, three request shapes.** `marketplace-dev-public-resource` only (a body-parser failure, a GraphQL validation failure, a `GET`).
  The other eight services were not started, and none of the authenticated resolver paths, a `GraphQLError` thrown by a resolver or a login was
  exercised. The browser frontends were not run.
- **No outgoing call with a query string.** The service's only outgoing HTTP is to SocketLabs (registration mail) and to the Turnstile
  verification, both external, and both behind paths that would have sent a real mail or a real request off this host. They were not triggered,
  so a client span's `url.query` was not observed in a running service; the synthetic probe of §2 is the only measurement of it. MongoDB and
  Redis are not HTTP and produced no spans in this run.
- **The sample rate came from the launching shell.** The shipped configuration ships no transactions (pass A); pass B's transactions exist
  because `SENTRY_TRACES_SAMPLE_RATE=1` was exported. A deployment that sets `tracesSampleRate` in code is the same SDK path, and was not run.
- **A 404 produces nothing.** A request to an unknown path with the sentinels (`/path-PSENTINEL?...`) sent no envelope: the SDK ignores incoming
  401 and 404 by default (`httpServerSpansIntegration.js:16`), and the shutdown `client_report` counts one discarded transaction, which is
  consistent with it. That is why the control above rides on the `Host` header.
- **Loopback, no edge.** The peer was `127.0.0.1` over IPv4, with no nginx in front, so no real forwarded chain or `Secure` cookie rewrite was
  involved.
- **`NODE_ENV=development` was required** for the request-time error event, because `maybeCaptureSentryError` reports only in development.
