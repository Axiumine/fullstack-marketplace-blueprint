# One Real Sentry Event, Captured and Read

# Marketplace

**Status:** investigation finding — closes *Investigation: capture one real Sentry event and read it* and *What a frontend actually sends is measured, and scrubbed*. Not baselined, not a requirement document
**Version:** 1.3
**Date:** 2026-08-31
**Changelog:** v1.0 — the capture. v1.1 — §6.1 added after reading the three frontends: they set
`tracesSampleRate: 0.1` and configure no scrubber, so §6's finding is latent on the backend only. Nothing
measured changed; a scope claim that was too narrow is now stated, and the browser payload is named as
unmeasured, ahead of *What a frontend actually sends is measured, and scrubbed*. v1.2 — **§9, the browser
capture** — closing that story: nine envelopes from two apps, both event
kinds. `httpBodies: []` holds and `urlQueryParams: false` does not; the address bar ships in five places on
both kinds. Corrects §6.1 — with no `browserTracingIntegration` registered, the three apps ship **no**
transaction at all, so `tracesSampleRate: 0.1` is a rate applied to nothing. v1.3 — every probe
sentinel is named for what it probes; nothing measured changed.
**Scope:** what a Sentry event built by one of these nine services actually contains when the request that
produced it carried an `authorization` header, a cookie, forwarding headers and a body — and, since v1.2,
what one built by the three browser apps contains when the page carries a credential in its URL. It settles
the one thing *The scrubber walks where the headers actually are* could not: every claim in that story rests on reading `node_modules`, and this one
reads an event.
**Method:** measurement, not reading. `marketplace-dev-public-resource` was restarted on port 4098 with its
own `src/instrument.mts` and a `DSN` pointing at a **local collector on 127.0.0.1:9911** that writes every
envelope to a file — so a real event was built, serialised and transmitted by the real transport, and nothing
left this host. A throwaway `addEventProcessor` teed each event **before** `beforeSend` ran, so the finding
compares what the scrubber was handed with what actually went out. Every credential-shaped value carried a
unique `PASSWORDPROBE…` sentinel. Both throwaway files lived under `node_modules/` and were deleted; nothing in any
repo was modified.
**Reads against:** *The scrubber walks where the headers actually are*, *`sendDefaultPii` is off in all nine services* and *No network-derived value reaches telemetry* in [`docs/devprotocol/phase5/TELEMETRY_EGRESS_HARDENING.md`](../devprotocol/phase5/TELEMETRY_EGRESS_HARDENING.md) · `BEs/marketplace-common/src/others/sentryBeforeSend.mts` ·
`BEs/dev/*/src/instrument.mts` · `@sentry/node` / `@sentry/core` / `@sentry/node-core` **10.69.0** ·
[`log-sink-inventory.md`](./log-sink-inventory.md) (*Investigation: what do the application and access logs actually contain*, every other sink)

---

## 1. Verdict

**No credential-bearing header reached the wire. Not one of the seven sentinels planted in
`authorization`, `cookie`, `proxy-authorization`, `x-forwarded-for`, `x-real-ip`, `x-introspectioncode` or
`user-agent` appeared in the sent envelope — but the scrubber is not why.** All seven were sitting in
`event.sdkProcessingMetadata.normalizedRequest.headers`, a bag `sentryBeforeSend` does not walk, and the SDK
drops `sdkProcessingMetadata` before serialisation. The protection that held is
`dataCollection.httpHeaders: { request: false }` at collection time, plus an internal field never being
serialised. The three bags named in *The scrubber walks where the headers actually are* were all **empty** on the event that actually shipped.

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
that *The scrubber walks where the headers actually are* was written around, and which `instrument.mts` says only the scrubber takes back out — is not
reached on the one event type that carries it. §6.

**🟠 Console output becomes payload.** `event.breadcrumbs` carried the service's own `console` calls with
their arguments. The scrubber does not walk breadcrumbs. §7.

**🔴 In a browser the leak is the URL itself, and `urlQueryParams: false` does not stop it.** Measured in
v1.2 against the same collector with the real `@sentry/react` transport: a page opened at
`/reset-password/confirm?token=…#/…` shipped that whole address — query string and fragment — on
`event.request.url`, on `contexts.trace.data['url.full']`, on the `description` of eight browser-metric spans,
on the `Referer` header and on both `from` and `to` of the navigation breadcrumb, which then carried it onto
**every later event of the session**. Nothing is added by a misconfiguration: `httpContextIntegration` copies
`location.href` unconditionally and `urlQueryParams` gates a field the browser never fills in. `httpBodies:
[]` does hold. §9.

The key list and fixture built for *The scrubber walks where the headers actually are* are corrected in §8. Five stories follow in §10.

## 2. What was run

| | |
|---|---|
| Service | `marketplace-dev-public-resource`, `PORT=4098`, `NODE_ENV=development`, real Mongo + Redis |
| Instrumentation | the repo's own `src/instrument.mts`, unmodified, for the shipped-configuration pass |
| DSN | `http://backendprobepublickey…@127.0.0.1:9911/1` — a local collector, no egress |
| Tee | `Sentry.addEventProcessor` writing each event to disk before `beforeSend`; circular-safe |
| Probe 1 | well-formed GraphQL POST `{ __typename }` |
| Probe 2 | a body carrying `password:"PASSWORDPROBE…"` in the document **and** in `variables`, malformed by one trailing brace so Koa's body parser throws a `SyntaxError` — a non-`GraphQLError`, which is what `maybeCaptureSentryError` reports on |
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
in either pass. That half of the key list from *The scrubber walks where the headers actually are* is correct and, on this configuration, never exercised.

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
Concretely, and this is the same reasoning *`sendDefaultPii` is off in all nine services* already wrote down for a different key:

- `marketplace-dev-public-authorization` — `login`, `loginAdmin`, `loginUser` carry the password in
  `variables`
- `marketplace-dev-admin-authenticated-resource` — `adminUpdatePwd` carries `passwordOld` and `passwordNew`
- the ShopOwner and User surfaces carry the `personalData` that ADR-029 encrypts at rest

The reporting gate narrows the blast radius and does not close it: `maybeCaptureSentryError` fires only in
`development` and only for non-`GraphQLError`s, so a rejected login (a `GraphQLError`) is not reported —
but a body-parser failure, a middleware throw or any pre-Apollo error on that same request is, and it carries
whatever the caller sent. Probe 2 is precisely that case. → **The request body never reaches Sentry**.

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
  `ips.split(",")[0]`. The citation of `:44,69` in *The scrubber walks where the headers actually are* is confirmed exactly.
- **`http.user_agent` (`:70`), `net.peer.ip` and `net.host.ip` are in the same position** — network- or
  client-derived, set outside the `dataCollection` machinery, and **absent from the scrubber's key list**.
  `net.peer.ip` is the socket peer, which in production is nginx rather than the end user; `http.client_ip`
  is the end user. Both are network-derived, which is what the standing GDPR decision speaks to.
- **`event.spans` carries none of this.** The seven child spans on the sampled query were
  `tdwKoaErrorHandler`, two unnamed Koa middleware, `bodyParser`, `graphql.parse`, `graphql.validate` and
  `query`. The only non-trivial attributes on them were `graphql.source` (the document, which
  `graphQL: { document: true }` intends) and `graphql.operation.type`. **No variables**, no headers, no
  address. → **The scrubber runs on every event type and covers every bag that carries data**.

### 6.1 The three frontends — code-read, not measured

⚠️ **Superseded by §9 in v1.2, on both halves.** The table below is still accurate as a reading of the three
files *as they were*; the conclusion drawn from it was wrong in one direction and right in the other. Wrong:
"one in ten page loads already ships a transaction" — no `browserTracingIntegration` is registered, so the
apps shipped none, and §9.1 measures that. Right: no scrubber ran on any browser event, and §9 measures what
that costs. Both `beforeSend` and `beforeSendTransaction` are now wired in all three apps.

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
class of assumption, and it is unverified. → **What a frontend actually sends is measured, and scrubbed** measures it the way this finding measured the node
side.

## 7. 🟠 Breadcrumbs

`event.breadcrumbs` on the shipped-configuration error event carried the service's own `console` calls, each
with `data.arguments` holding the argument list verbatim, `category: "console"`. `sentryBeforeSend` does not
walk `event.breadcrumbs`.

This is where [`log-sink-inventory.md`](./log-sink-inventory.md) meets this finding. §4.3 there records that
`publicHelloArgs.mts:15` echoes a caller-supplied string to stdout, and §4.1 that `login.mts:117` /
`loginAdmin.mts:120` print `catch` plus the thrown error on the login path. Console output is not only a log
line — on any request that then errors, it is Sentry payload. → **The scrubber runs on every event type and covers every bag that carries data**.

## 8. The scrubber walks where the headers actually are, corrected against the observation

| Original claim | Measured | Verdict |
|---|---|---|
| `http.client_ip` is set outside `dataCollection`, `httpServerSpansIntegration.js:44,69` | exactly so; first `x-forwarded-for` hop | **confirmed** |
| the scrubber must strip `http.request.header.*` / `http.response.header.*` | those attributes never appear once `httpHeaders.request` is `false` | **confirmed, unexercised** |
| the keys live in `event.contexts.trace.data` **and in every `event.spans[].data`** | they live in `contexts.trace.data` only; child spans carry none of them | **corrected** |
| the fixture must model a span-attribute event | right in principle; the real shape is a **transaction** event's `contexts.trace.data`, and on an **error** event all three bags are empty | **corrected** |
| — | `beforeSend` never sees a transaction; `beforeSendTransaction` is unset | **new** |
| — | `http.user_agent`, `net.peer.ip`, `net.host.ip` are missing from the key list | **new** |
| — | `event.request.data` carries the raw body and is not walked | **new, 🔴** |
| — | `event.breadcrumbs` carries console arguments and is not walked | **new** |

**The fixture is rebuilt from the observation** as part of *The scrubber runs on every event type and covers every bag that carries data*: the key list in §6 above, taken from a
captured transaction, replaces the hand-built span-attribute object. The existing error-event tests stay —
they assert the scrubber is harmless on the shape that ships today, which the capture confirms is a shape
with none of these keys in it.

One smaller correction, unrelated to scrubbing: the sent event reads `"environment": "production"` while the
service logged *"Serving http://\*:4098/public-resource for development."* `Sentry.init` receives no
`environment`, so it defaults to `production` regardless of `NODE_ENV`. Every Dev event would land in the
production bucket of whatever project the DSN names. → **Sentry's environment matches the deployment**.

## 9. 🔴 The browser, measured — closes *What a frontend actually sends is measured, and scrubbed*

§6.1 recorded what reading three `instrument.ts` files establishes and refused to say more. This section is
the capture that replaces it. Same method as §2, browser side: `marketplace-user` and `marketplace-admin`
were built for production with a DSN pointing at the same local collector, opened in a real Chromium, and
every envelope the real `@sentry/react` transport sent was written to a file. **Nine envelopes**, both event
kinds, two of the three apps. Nothing left this host.

### 9.1 What was run

| | |
|---|---|
| Apps | `marketplace-user` (`yarn build` + preview on 3146) and `marketplace-admin` (3147) — production bundles, not `yarn dev` |
| Instrumentation | each app's own `src/instrument.ts`, with **two** harness-only changes, below |
| DSN | `http://frontendprobepublickey…@127.0.0.1:9911/1` — the §2 collector, no egress |
| Probe URL | `/reset-password/confirm?token=TOKENQUERYPROBE&email=probe%40example.invalid#/probe%40example.invalid/HASHFRAGMENTPROBE` — a query string **and** a fragment, each with its own sentinel, on the one route that carries a credential |
| Probe 1 | an uncaught `Error` thrown from a `setTimeout`, the live `GlobalHandlers` path |
| Probe 2 | a `fetch` POST to `/graphql-user-authorization?probeQuery=FETCHQUERYPROBE` with a JSON body carrying a password sentinel |
| Probe 3 | a client-side navigation to `/account/addresses?nav=NAVPARAMPROBE#navfragmentprobe`, then a **second** error — to observe what the first page leaves behind on later events |
| Restored | both patched `instrument.ts` restored from backup; `git status` clean in both repos before any commit |

**The two harness changes, and why the second one is a finding of its own.** `tracesSampleRate` was raised
from `0.1` to `1` so a transaction was certain rather than one-in-ten. And `browserTracingIntegration()` was
**added** — because without it there is no transaction to sample at all:
`@sentry/browser/build/npm/esm/prod/sdk.js:15-31` builds `getDefaultIntegrations()` from `InboundFilters`,
`FunctionToString`, `BrowserApiErrors`, `Breadcrumbs`, `GlobalHandlers`, `LinkedErrors`, `Dedupe`,
`HttpContext` and `BrowserSession`, and browser tracing is not on that list. **So §6.1's "one in ten page
loads already ships a transaction" was wrong**: on the shipped configuration the three apps ship *none*, and
`tracesSampleRate: 0.1` is a rate applied to nothing. That makes the transaction findings below latent-until-
integration rather than live — but only that, because the scrubber has to be right before the integration is
added, not after.

⚠️ One harness trap worth recording: `Dedupe` is a default integration, and a second error with the same
message is discarded locally as a `client_report` with `reason: "event_processor"` — an empty capture that
looks like a broken harness. Each probe error carries a distinct message for that reason.

### 9.2 The two acceptance questions, answered from the envelope

| Assumption from §4 / §6.1 | Measured on the browser transport | Verdict |
|---|---|---|
| `httpBodies: []` holds | the `fetch` breadcrumb carried `method`, `url`, `__span` and `status_code` — **no body**, on a POST whose body held a password sentinel | **holds** |
| `urlQueryParams: false` holds | the full address bar, query string **and** fragment, shipped in **five** distinct places | **does not hold** 🔴 |

`urlQueryParams` is not being ignored — it gates a field the browser never fills in. `event.request.url` is
written by `httpContextIntegration` (`@sentry/browser/…/integrations/httpcontext.js`), whose `preprocessEvent`
calls `getHttpRequestData()` and assigns `location.href` with no `dataCollection` gate on the path;
`@sentry/core/…/integrations/requestdata.js:58` says the same in a comment — *"No dataCollection equivalent —
URL is always included"*. The option controls `request.query_string`, which the node SDK fills and the browser
does not.

### 9.3 Where the address bar went, verbatim

Sentinels kept, host as captured. From `envelope-004.txt` (error) and `envelope-003.txt` (pageload
transaction):

```json
"request": {
  "url": "http://127.0.0.1:3146/reset-password/confirm?token=TOKENQUERYPROBE&email=probe%40example.invalid&cb=2#/probe%40example.invalid/HASHFRAGMENTPROBE",
  "headers": {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
  }
}
```

```json
"contexts": { "trace": { "data": {
  "sentry.op": "pageload", "sentry.source": "url",
  "url.path": "/reset-password/confirm",
  "url.full": "http://127.0.0.1:3146/reset-password/confirm?token=TOKENQUERYPROBE&email=probe%40example.invalid&cb=2#/probe%40example.invalid/HASHFRAGMENTPROBE",
  "effectiveConnectionType": "4g", "deviceMemory": "32 GB", "hardwareConcurrency": "32",
  "lcp.element": "div.flex.flex-col.gap-1 > p#password-hint.text-xs.text-tip"
} } }
```

```json
"breadcrumbs": [ { "category": "navigation", "data": {
  "from": "/reset-password/confirm?token=TOKENQUERYPROBE&email=probe%40example.invalid&cb=2#/probe%40example.invalid/HASHFRAGMENTPROBE",
  "to": "/account/addresses?nav=NAVPARAMPROBE#navfragmentprobe"
} } ]
```

Five places, on **both** event kinds:

| Where | Carries | On |
|---|---|---|
| `event.request.url` | `location.href` whole | error **and** transaction |
| `contexts.trace.data['url.full']` | the same string | transaction |
| `spans[].description` | the same string, on **eight** `browser.*` metric spans — `domContentLoadedEvent`, `loadEvent`, `connect`, `cache`, `DNS`, `request`, `response`, and the resource spans' own `url.full` | transaction |
| `breadcrumbs[].data.from` / `.to` | the previous page and the next one, whole | error and transaction |
| `request.headers.Referer` | the previous page, whole, on a real cross-page load | error and transaction |

⚠️ **The navigation breadcrumb is the one that outlives the page.** Probe 3 navigated *away* from the reset
URL and then errored; the reset URL — token, address and one-time hash — was still in `data.from` on that
later error **and** on the later transaction. A credential in a URL is not scoped to the event raised on that
URL; it rides the rest of the session.

`url.path` carries neither part and is the reason the fix is a truncation rather than a deletion.
`marketplace-admin` on 3147 produced the identical shape, which is what makes this a property of the SDK
rather than of one app's router.

### 9.4 What the browser adds that the node key list does not name

The node key list, from *The scrubber walks where the headers actually are*, was built from `@sentry/node-core`'s `httpServerSpansIntegration`. None of
`http.client_ip`, `net.peer.ip`, `net.host.ip` or `http.request.header.*` appeared in any browser envelope —
they have no browser equivalent, exactly as §6.1 warned. What appeared instead:

| Key | What it is | Decision |
|---|---|---|
| `url`, `url.full`, `http.url`, `http.target` | the address bar | **added** to the key list, sanitised to the path |
| `referer` / `referrer` | the previous page's whole URL, written by the same unconditional `httpContextIntegration` call as the agent string — so `httpHeaders: { request: false }` does not stop it either | **added**, sanitised to the path |
| `breadcrumbs[].data.from` / `.to` | a URL on a `navigation` breadcrumb and free text anywhere else | **added**, at that one site only |
| `spans[].description` | free text; the address bar on eight spans, `first-contentful-paint` or a CSS selector on others | sanitised **only when the value starts like a URL** |
| `User-Agent` header | the browser's own | already removed — `user-agent` was added to the key list under *The scrubber runs on every event type and covers every bag that carries data* (§6 found it absent beforehand) |
| `deviceMemory`, `hardwareConcurrency`, `effectiveConnectionType`, `contexts.culture.*` | fingerprinting entropy: 32 GB / 32 cores / `4g` / `locale: it`, `timezone: Europe/Rome` | **kept, deliberately** — see the residual below |

The truncation removes everything from the first `?` **or** `#`. Both, not the fragment alone: a fragment is
what a reset link carries since the fix that moved the credential off the URL (*The customer's reset
credential leaves the URL*), a query string is what one built before that carries, and the SDK
copies `location.href` whole either way.

### 9.5 One implementation, not three

`sentryBeforeSend` is published for frontend use rather than copied into the three apps. The reason, stated
because the story asks for it: the three frontends share no package of their own, so "one implementation"
in any other place would be a new package built for one function; the module imports nothing and walks plain
object bags, so it is browser-safe by construction and the existing `./others/sentryBeforeSend` subpath export
puts exactly one file into a browser bundle, not the Mongoose models beside it; and a consumer opts in *by
declaration*, so the three `package.json` entries plus one published version are the whole of the
plumbing. Three
copies would have to be corrected three times, and the first correction that reaches two of them is the leak.

It is wired as **both** `beforeSend` and `beforeSendTransaction` in all three apps, for §6's reason applied to
the browser: `url.full` and the eight span descriptions are on the transaction, which the first hook never
sees.

### 9.6 Residuals, stated rather than fixed

- **The path itself is not redacted.** A reset link built before the credential moved off the URL carries its
  credential in the path, and truncating at `?` keeps the path. Nothing on this platform mints that shape any
  more — the fix that moved the credential into the fragment (*The customer's reset credential leaves the
  URL*) is why the truncation removes it — and the old links die with their 60-minute window. Adding route
  knowledge to a shared scrubber to cover a transitional shape was rejected as the worse trade: no
  verify-email route exists in any frontend, so this is the only path-carried credential there has ever been.
- **Device and culture entropy is kept.** `deviceMemory`, `hardwareConcurrency`, `effectiveConnectionType` and
  `contexts.culture` are fingerprinting inputs, and they are also the entire payload of the performance
  product the transaction exists to feed. They are not credentials and they are not the client address. The
  decision is to keep them; it is written down here so that a future reader finds a decision rather than an
  oversight.
- **`marketplace-shopowner` was not captured.** Two of three apps were, and the two agreed to the byte on
  every bag in §9.3. The third shares the SDK, the version and the `Sentry.init` block; its scrubber is wired
  and its gates run, but no envelope of its own was read.

## 10. Stories

| Finding | Story | Severity |
|---|---|---|
| `event.request.data` ships the raw GraphQL body, §5 | **The request body never reaches Sentry** | 🔴 |
| Transactions bypass `beforeSend`; three keys and two bags missing from the scrubber, §6 / §7 | **The scrubber runs on every event type and covers every bag that carries data** | 🟠 |
| `environment` is `production` on a development service, §8 | **Sentry's environment matches the deployment** | 🟡 |
| Three frontends sample transactions at `0.1` with no scrubber of any kind, §6.1 | **What a frontend actually sends is measured, and scrubbed** | 🟠 |
| The browser ships the whole address bar in five places and no option stops it, §9 | **What a frontend actually sends is measured, and scrubbed** | 🔴 |

Written into [`TELEMETRY_EGRESS_HARDENING.md`](../devprotocol/phase5/TELEMETRY_EGRESS_HARDENING.md) §4 as part of closing this story. The first four
were not fixed here; the fifth was measured and fixed under that same story in the same piece of work, which is why
§9 carries its own residual table.

## 11. What this finding does not cover

- **A real Sentry project.** The collector is local by design: capturing the envelope is the point, and
  sending a plaintext password to a third party to prove it would be sent is not a method. The transport,
  the serialiser and every integration are the real ones. This holds for §9 as much as for §3.
- **The other eight services.** One service was captured. The nine `instrument.mts` files are identical in
  the block that matters, and §5's mechanism is in `@sentry/core`, not in any service — but the observation
  is of one.
- **`marketplace-shopowner`.** Two of the three browser apps were captured and agreed to the byte; the third
  was not. §9.6.
- **A browser transaction on the shipped configuration.** There is none — §9.1. The transaction §9 reads was
  produced by registering `browserTracingIntegration()` in the harness, which is what the apps would have to
  do for the sample rate they already set to mean anything. The scrubber is wired for that day; the day has
  not come.
- **Session Replay and `contexts.culture`.** No replay integration is registered anywhere, so none was
  captured. `culture` is kept on purpose, not overlooked — §9.6.
- **Every other sink.** [`log-sink-inventory.md`](./log-sink-inventory.md).
