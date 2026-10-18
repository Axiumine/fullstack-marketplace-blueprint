# What 10.76.2 Stops Sending: URL Query Strings, Measured Against 10.75.0

# Marketplace

**Measured:** the same request replayed through the platform's `Sentry.init` options under `@sentry/node` 10.75.0 and 10.76.2, with seven
sentinels planted in the query string, the headers, the cookie, the body and the forwarding address, and every envelope read for them.
**Status:** investigation finding — closes the reading behind admitting `@sentry/node` 10.76.2. Not baselined, not a requirement
**Version:** 1.0
**Date:** 2026-10-18
**Scope:** what a service's Sentry envelopes contain, in the two releases, when the request carried a credential in its URL and the service made
one outgoing call whose URL carried another. It backs a static reading of the two releases' published tarballs with a measurement; it does not
replace that reading.
**Method:** measurement. Two throwaway npm projects, identical except for the SDK range (`^10.75.0` and `^10.76.2`), each resolving all five
`@sentry/*` packages the guard names to the same version — `node`, `core`, `node-core`, `opentelemetry`, `server-utils` — plus the published
`@axiumine/marketplace-common` 4.6.1, so `sentryBeforeSend` is the real scrubber. Nothing in any repository was modified and nothing left this host.
**Reads against:** *The version is pinned by a test, not by a comment* and *10.76.2 is the second bump this section has admitted* in
[`docs/architecture.md`](../architecture.md) §Observability · risk **R42** in
[`docs/devprotocol/phase5/RISK_REGISTER.md`](../devprotocol/phase5/RISK_REGISTER.md) ·
[`sentry-event-capture.md`](./sentry-event-capture.md) (the 10.69.0 capture, from a running service)

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
  option name suggests it would not, and the JSDoc in `sentryBeforeSend.mts`, written from a reading of 10.75.0, says it gates only
  `event.request.query_string`; the measurement shows it did not reach these fields.
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
- **The stale comment is untouched.** The JSDoc in `BEs/marketplace-common/src/others/sentryBeforeSend.mts` still cites 10.75.0 and says
  `urlQueryParams: false` gates only `event.request.query_string`. Fixing it changes `dist/`, so it waits for the next `marketplace-common`
  release (recorded in that repository's `CHANGELOG.md`, `[Unreleased]`).
- **The browser apps are not covered.** The three frontends ship their own SDK; `sentry-event-capture.md` §9 is their measurement.
