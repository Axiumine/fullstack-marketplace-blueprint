# One Real Sentry Event, Captured and Read

# Marketplace

**Status:** investigation finding — closes E12-S13. Not baselined, not a requirement document
**Version:** 1.1
**Date:** 2026-08-11
**Changelog:** v1.0 — the capture. v1.1 — §6.1 added after reading the three frontends: they set
`tracesSampleRate: 0.1` and configure no scrubber, so §6's finding is latent on the backend only. Nothing
measured changed; a scope claim that was too narrow is now stated, and the browser payload is named as
unmeasured (E12-S24).
**Scope:** what a Sentry event built by one of these nine services actually contains when the request that
produced it carried an `authorization` header, a cookie, forwarding headers and a body. It settles the one
thing E12-S02 could not: every claim in that story rests on reading `node_modules`, and this one reads an
event.
**Method:** measurement, not reading. `marketplace-dev-public-resource` was restarted on port 4098 with its
own `src/instrument.mts` and a `DSN` pointing at a **local collector on 127.0.0.1:9911** that writes every
envelope to a file — so a real event was built, serialised and transmitted by the real transport, and nothing
left this host. A throwaway `addEventProcessor` teed each event **before** `beforeSend` ran, so the finding
compares what the scrubber was handed with what actually went out. Every credential-shaped value carried a
unique `MKTS13…` sentinel. Both throwaway files lived under `node_modules/` and were deleted; nothing in any
repo was modified.
**Reads against:** [`docs/devprotocol/phase5/epics/E12.md`](../devprotocol/phase5/epics/E12.md) E12-S02,
E12-S03, E12-S06 · `BEs/marketplace-common/src/others/sentryBeforeSend.mts` ·
`BEs/dev/*/src/instrument.mts` · `@sentry/node` / `@sentry/core` / `@sentry/node-core` **10.69.0** ·
[`log-sink-inventory.md`](./log-sink-inventory.md) (E12-S12, every other sink)

---

## 1. Verdict

**No credential-bearing header reached the wire. Not one of the seven sentinels planted in
`authorization`, `cookie`, `proxy-authorization`, `x-forwarded-for`, `x-real-ip`, `x-introspectioncode` or
`user-agent` appeared in the sent envelope — but the scrubber is not why.** All seven were sitting in
`event.sdkProcessingMetadata.normalizedRequest.headers`, a bag `sentryBeforeSend` does not walk, and the SDK
drops `sdkProcessingMetadata` before serialisation. The protection that held is
`dataCollection.httpHeaders: { request: false }` at collection time, plus an internal field never being
serialised. E12-S02's three bags were all **empty** on the event that actually shipped.

**🔴 The raw request body did reach the wire, on the shipped configuration, unchanged.** `event.request.data`
carried the complete POST body — including a plaintext `password` in the GraphQL document *and* in
`variables` — into the transmitted envelope. `dataCollection.httpBodies: []` does not gate this and was never
going to: `@sentry/core/build/cjs/integrations/requestdata.js:27-28` sets `include.data = true`
unconditionally, with the comment *"dataCollection.httpBodies gates write-time, not read-time"*, and the
write-time gate is `httpIntegration`'s `maxRequestBodySize`, which defaults to `"medium"`
(`integrations/http/server-subscription.js:55-57`). `sentryBeforeSend` does not walk `event.request.data`.
This is the exact outcome `instrument.mts`'s own comment says the `dataCollection` block prevents, and it is
live today on all nine services whenever `DSN` is set. §5.

**🟠 `beforeSend` is not applied to transaction events, and transactions are where the client address lives.**
With `tracesSampleRate` set — it is not, in any service, which is the only reason this is latent —
`event.contexts.trace.data` carries `http.client_ip` (the first `x-forwarded-for` hop), `http.user_agent`,
`net.peer.ip` and `net.host.ip`, and every one of them was **present in the sent envelope**. `beforeSend`
never ran; `beforeSendTransaction` is not configured. The scrubber's `http.client_ip` entry — the key
E12-S02 was written around, and which `instrument.mts` says only the scrubber takes back out — is not
reached on the one event type that carries it. §6.

**🟠 Console output becomes payload.** `event.breadcrumbs` carried the service's own `console` calls with
their arguments. The scrubber does not walk breadcrumbs. §7.

E12-S02's key list and fixture are corrected in §8. Three stories follow in §9.

## 2. What was run

| | |
|---|---|
| Service | `marketplace-dev-public-resource`, `PORT=4098`, `NODE_ENV=development`, real Mongo + Redis |
| Instrumentation | the repo's own `src/instrument.mts`, unmodified, for the shipped-configuration pass |
| DSN | `http://e12s13publickey…@127.0.0.1:9911/1` — a local collector, no egress |
| Tee | `Sentry.addEventProcessor` writing each event to disk before `beforeSend`; circular-safe |
| Probe 1 | well-formed GraphQL POST `{ __typename }` |
| Probe 2 | a body carrying `password:"MKTS13…"` in the document **and** in `variables`, malformed by one trailing brace so Koa's body parser throws a `SyntaxError` — a non-`GraphQLError`, which is what `maybeCaptureSentryError` reports on |
| Headers on both | `authorization`, `cookie`, `proxy-authorization`, `x-forwarded-for: 198.51.100.42, 203.0.113.9`, `x-real-ip`, `x-introspectioncode`, `user-agent`, each with its own sentinel |
| Second pass | identical, with one knob changed — a copy of `instrument.mts` adding `tracesSampleRate: 1` — to observe the transaction path the shipped configuration never samples |

`tdwKoaErrorHandler`'s `maybeCaptureSentryError` reports only when `NODE_ENV === 'development'` **and** the
error is not a `GraphQLError`. Probe 2 is built to satisfy both, because that is the live reporting path —
not a synthetic `captureException`.

## 3. The event that shipped, verbatim

Redacted only where a sentinel stood in for a credential; nothing else is altered.

```json
{
  "event_id": "6d2c79625f8a4205b4090269d738d53e",
  "level": "error",
  "platform": "node",
  "environment": "production",
  "transaction": "POST /public-resource",
  "server_name": "pcgio",
  "request": {
    "method": "POST",
    "url": "http://127.0.0.1:4098/public-resource",
    "data": "{\"query\":\"mutation{ login(email:\\\"probe@example.invalid\\\", password:\\\"<REDACTED — a plaintext password sentinel>\\\"){ txt } }\",\"variables\":{\"password\":\"<REDACTED — a plaintext password sentinel>\"}}}"
  },
  "exception": { "values": [ { "type": "SyntaxError", "value": "Unexpected non-whitespace character after JSON at position 151 (line 1 column 152)" } ] },
  "contexts": { "trace": { "parent_span_id": "899bf5b828802a64", "span_id": "9be106ce1d0eb498", "trace_id": "5c9d95ea45bb4d749e9436f935da4c84" } },
  "breadcrumbs": [ … console calls with their arguments, §7 … ],
  "modules": { … 44 dependency names and versions … },
  "sdk": { "name": "sentry.javascript.node", "version": "10.69.0" }
}
```

Top-level keys, complete: `exception`, `event_id`, `level`, `platform`, `contexts`, `server_name`,
`timestamp`, `environment`, `sdk`, `transaction`, `breadcrumbs`, `request`, `modules`.

Absent, and each absence matters: **no `user`**, **no `spans`**, **no `contexts.trace.data`**, **no
`request.headers`**, **no `request.cookies`**, **no `sdkProcessingMetadata`**.

## 4. Where the headers actually are

| Marker | Pre-`beforeSend` | Sent envelope |
|---|---|---|
| `authorization` | 3 | **0** |
| `cookie` | 3 | **0** |
| `proxy-authorization` | 3 | **0** |
| `x-forwarded-for` second hop (`203.0.113.9`) | 3 | **0** |
| `x-forwarded-for` first hop (`198.51.100.42`) | 8 | 2 — §6 |
| `user-agent` | 5 | 2 — §6 |
| password in the body | 5 | **2** — §5 |
| the account email in the body | 5 | **2** — §5 |

Every pre-`beforeSend` occurrence of the first four sat in
`event.sdkProcessingMetadata.normalizedRequest.headers`, whose observed key list was:

```
host, accept, authorization, cookie, x-forwarded-for, x-real-ip,
proxy-authorization, x-introspectioncode, user-agent, content-type, content-length
```

`sdkProcessingMetadata` is internal SDK state and is removed before the envelope is serialised — the sent
event does not contain the key at all. So the correct statement is:

> On an error event, the request headers never reach any bag `beforeSend` is given. `event.request.headers`
> is empty because `dataCollection.httpHeaders: { request: false }` stopped the copy at collection time, and
> the only surviving copy is dropped by the serialiser.

Zero `http.request.header.*` or `http.response.header.*` attributes appeared anywhere in any sent envelope,
in either pass. That half of E12-S02's key list is correct and, on this configuration, never exercised.

## 5. 🔴 The request body

Measured on the **shipped** `src/instrument.mts`, with no option changed:

```
request.data = "{\"query\":\"mutation{ login(email:\"probe@example.invalid\", password:\"<sentinel>\"){ txt } }\",\"variables\":{\"password\":\"<sentinel>\"}}}"
```

Both sentinels — the one in the GraphQL document and the one in `variables` — appear in the transmitted
envelope. So does the email address.

### Why `httpBodies: []` does not stop it

Three files, all in `@sentry/core` 10.69.0:

- `integrations/http/server-subscription.js:55-57` — the body is captured whenever
  `maxRequestBodySize !== "none"`. `maxRequestBodySize` is an option of `httpIntegration`, defaults to
  `"medium"`, and is not part of `dataCollection`. The captured bytes go to
  `sdkProcessingMetadata.normalizedRequest.data` (`patch-request-to-capture-body.js:64`).
- `integrations/requestdata.js:27-28` — `include.data` is hard-wired `true`, above the comment
  *"Always attach body data that's already on the scope — dataCollection.httpBodies gates write-time, not
  read-time."*
- `integrations/requestdata.js:139-141` — `requestData.data = normalizedRequest.data`, copied onto
  `event.request`.

`dataCollection.httpBodies` reaches exactly one thing: the `http.request.body.data` **span** attribute
(`requestdata.js:98-104`). It has no bearing on `event.request.data`. `instrument.mts:63-64` calls `[]` "the
documented 'collect no bodies' value"; measured, it is the documented value for spans and not for events.

### What that means on this platform

Every request to every one of these nine services is a GraphQL POST, so the attached body is the envelope.
Concretely, and this is the reasoning E12-S03 already wrote down for a different key:

- `marketplace-dev-public-authorization` — `login`, `loginAdmin`, `loginUser` carry the password in
  `variables`
- `marketplace-dev-admin-authenticated-resource` — `adminUpdatePwd` carries `passwordOld` and `passwordNew`
- the ShopOwner and User surfaces carry the `personalData` that ADR-029 encrypts at rest

The reporting gate narrows the blast radius and does not close it: `maybeCaptureSentryError` fires only in
`development` and only for non-`GraphQLError`s, so a rejected login (a `GraphQLError`) is not reported —
but a body-parser failure, a middleware throw or any pre-Apollo error on that same request is, and it carries
whatever the caller sent. Probe 2 is precisely that case. → **E12-S21**.

## 6. 🟠 Transactions bypass the scrubber

With `tracesSampleRate: 1` — the only change — the same two requests produced two transaction events. Their
root-span attributes, in `event.contexts.trace.data`:

```
sentry.origin, sentry.op, sentry.source, sentry.sample_rate, url.full, url.path,
http.url, http.method, http.target, http.host, net.host.name, http.client_ip,
http.user_agent, http.scheme, http.flavor, net.transport,
http.request_content_length_uncompressed, otel.kind, url, sentry.graphql.operation,
original-description, http.response.status_code, http.status_code, http.status_text,
net.host.ip, net.host.port, net.peer.ip, net.peer.port
```

| Key | Pre-`beforeSend` | Sent envelope |
|---|---|---|
| `http.client_ip` | `"198.51.100.42"` | **`"198.51.100.42"`** |
| `http.user_agent` | the sentinel | **the sentinel** |
| `net.peer.ip` | `"::ffff:127.0.0.1"` | **`"::ffff:127.0.0.1"`** |
| `net.host.ip` | `"::ffff:127.0.0.1"` | **`"::ffff:127.0.0.1"`** |
| `request.data` | the body | **the body** |

Identical in and out: **`beforeSend` did not run.** The SDK routes transaction events to
`beforeSendTransaction`, which no service configures. `sentryBeforeSend` lists `http.client_ip` and walks
`event.contexts?.trace?.data`, so it would have removed the value — it is simply never called with it.

Three further observations about that shape:

- **`http.client_ip` is the first `x-forwarded-for` hop, not the socket peer.** The second hop
  (`203.0.113.9`) never appears: `httpServerSpansIntegration.js:44` reads the header and `:69` takes
  `ips.split(",")[0]`. E12-S02's citation of `:44,69` is confirmed exactly.
- **`http.user_agent` (`:70`), `net.peer.ip` and `net.host.ip` are in the same position** — network- or
  client-derived, set outside the `dataCollection` machinery, and **absent from the scrubber's key list**.
  `net.peer.ip` is the socket peer, which in production is nginx rather than the end user; `http.client_ip`
  is the end user. Both are network-derived, which is what the standing GDPR decision speaks to.
- **`event.spans` carries none of this.** The seven child spans on the sampled query were
  `tdwKoaErrorHandler`, two unnamed Koa middleware, `bodyParser`, `graphql.parse`, `graphql.validate` and
  `query`. The only non-trivial attributes on them were `graphql.source` (the document, which
  `graphQL: { document: true }` intends) and `graphql.operation.type`. **No variables**, no headers, no
  address. → **E12-S22**.

### 6.1 The three frontends are not latent — code-read, not measured

The capture above is the **node** SDK. Reading the three frontends afterwards, because §6 turns on whether
a sample rate is set anywhere:

| Repo | File | `tracesSampleRate` | `beforeSend` | `beforeSendTransaction` |
|---|---|---|---|---|
| `marketplace-user` | `src/instrument.ts:46` | `0.1` | absent | absent |
| `marketplace-admin` | `src/instrument.ts:46` | `0.1` | absent | absent |
| `marketplace-shopowner` | `src/instrument.ts:46` | `0.1` | absent | absent |

`sentryBeforeSend` lives in `BEs/marketplace-common/src/others/sentryBeforeSend.mts` and **no frontend
depends on `marketplace-common`** — so on the frontends no scrubber runs on any event, error or transaction,
and one in ten page loads already ships a transaction wherever a DSN is set. The nine backend services set
no sample rate; the three frontends have set one all along.

What that transaction *contains* is **not measured here**. `@sentry/react` is the browser SDK:
`http.client_ip`, `net.peer.ip` and `net.host.ip` come from `@sentry/node-core`'s
`httpServerSpansIntegration` and have no browser equivalent, so §6's key table must not be assumed to carry
over. The one thing §5 establishes is that a `dataCollection` category can gate write-time and not
read-time; whether `urlQueryParams: false` and `httpBodies: []` hold on the browser transport is the same
class of assumption, and it is unverified. → **E12-S24** measures it the way this finding measured the node
side.

## 7. 🟠 Breadcrumbs

`event.breadcrumbs` on the shipped-configuration error event carried the service's own `console` calls, each
with `data.arguments` holding the argument list verbatim, `category: "console"`. `sentryBeforeSend` does not
walk `event.breadcrumbs`.

This is where [`log-sink-inventory.md`](./log-sink-inventory.md) meets this finding. §4.3 there records that
`publicHelloArgs.mts:15` echoes a caller-supplied string to stdout, and §4.1 that `login.mts:117` /
`loginAdmin.mts:120` print `catch` plus the thrown error on the login path. Console output is not only a log
line — on any request that then errors, it is Sentry payload. → **E12-S22**.

## 8. E12-S02, corrected against the observation

| E12-S02 said | Measured | Verdict |
|---|---|---|
| `http.client_ip` is set outside `dataCollection`, `httpServerSpansIntegration.js:44,69` | exactly so; first `x-forwarded-for` hop | **confirmed** |
| the scrubber must strip `http.request.header.*` / `http.response.header.*` | those attributes never appear once `httpHeaders.request` is `false` | **confirmed, unexercised** |
| the keys live in `event.contexts.trace.data` **and in every `event.spans[].data`** | they live in `contexts.trace.data` only; child spans carry none of them | **corrected** |
| the fixture must model a span-attribute event | right in principle; the real shape is a **transaction** event's `contexts.trace.data`, and on an **error** event all three bags are empty | **corrected** |
| — | `beforeSend` never sees a transaction; `beforeSendTransaction` is unset | **new** |
| — | `http.user_agent`, `net.peer.ip`, `net.host.ip` are missing from the key list | **new** |
| — | `event.request.data` carries the raw body and is not walked | **new, 🔴** |
| — | `event.breadcrumbs` carries console arguments and is not walked | **new** |

**The fixture is rebuilt from the observation** as part of E12-S22: the key list in §6 above, taken from a
captured transaction, replaces the hand-built span-attribute object. The existing error-event tests stay —
they assert the scrubber is harmless on the shape that ships today, which the capture confirms is a shape
with none of these keys in it.

One smaller correction, unrelated to scrubbing: the sent event reads `"environment": "production"` while the
service logged *"Serving http://\*:4098/public-resource for development."* `Sentry.init` receives no
`environment`, so it defaults to `production` regardless of `NODE_ENV`. Every Dev event would land in the
production bucket of whatever project the DSN names. → **E12-S23**.

## 9. Stories

| Finding | Story | Severity |
|---|---|---|
| `event.request.data` ships the raw GraphQL body, §5 | **E12-S21** | 🔴 |
| Transactions bypass `beforeSend`; three keys and two bags missing from the scrubber, §6 / §7 | **E12-S22** | 🟠 |
| `environment` is `production` on a development service, §8 | **E12-S23** | 🟡 |
| Three frontends sample transactions at `0.1` with no scrubber of any kind, §6.1 | **E12-S24** | 🟠 |

Written into [`E12.md`](../devprotocol/phase5/epics/E12.md) §4 as part of closing this story. None is fixed
here.

## 10. What this finding does not cover

- **A real Sentry project.** The collector is local by design: capturing the envelope is the point, and
  sending a plaintext password to a third party to prove it would be sent is not a method. The transport,
  the serialiser and every integration are the real ones.
- **The other eight services.** One service was captured. The nine `instrument.mts` files are identical in
  the block that matters, and §5's mechanism is in `@sentry/core`, not in any service — but the observation
  is of one.
- **The frontends.** They initialise their own SDK and are outside E12-S02's subject. §6.1 records what
  reading their three `instrument.ts` files establishes and nothing more: a sample rate is set and no
  scrubber exists. **No frontend event was captured** — measuring one is E12-S24, and until it is measured
  no claim about what a browser transaction carries belongs in this document.
- **Every other sink.** [`log-sink-inventory.md`](./log-sink-inventory.md).
