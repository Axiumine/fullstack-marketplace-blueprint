# ADR-028 — GraphQL is the whole API; the only REST endpoints serve email verification
# Marketplace

**Status:** accepted
**Date:** 2026-08-05
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

9 hand-rolled Koa 3 servers, each mounting Apollo Server 5 at one path via `@as-integrations/koa`. Entry always `src/index.mts`. Every domain query/mutation across all tiers (public, ShopOwner, Admin, User) goes through one of these 9 GraphQL endpoints — no REST CRUD anywhere.

One real constraint breaks the pattern: email verification. `userRegister` and `shopOwnerAdd` send a link inside an email (`BEs/dev/marketplace-dev-public-resource/src/middleware/router/index.mts:18-24` explains the SocketLabs flow). A link in an email is opened by a browser doing a plain `GET` — no GraphQL client is involved on the click, no `Authorization` header, no request body to carry a mutation. The endpoint has to be reachable by a bare hyperlink.

`marketplace-dev-public-resource/src/index.mts` already mounts Apollo at `ENDPOINT = '/public-resource'` (`src/index.mts:19`) behind `ctx.path === ENDPOINT` inline dispatch (`src/index.mts:127`). Two flows need a hash comparison and a redirect, not a schema: ShopOwner verification (`routerVerifyEmail`, backed by `@lib/access/verifyEmailFlow.mjs`) and User verification (`routerVerifyEmailUser`, backed by `@lib/access/verifyEmailFlowUser.mjs`) — kept as two separate routes rather than one shared handler, because email + hash alone cannot say which collection minted the pair (`src/middleware/router/index.mts:18-24`).

## Options considered

| Option | Pros | Cons |
|---|---|---|
| GraphQL mutation for verification, client-side hash grab from URL then mutate | Zero REST surface, one API style everywhere | The link is clicked from an email client / browser directly — nothing runs client JS to fire the mutation before the user sees a result; would require a throwaway HTML page just to bootstrap a GraphQL call for a one-shot GET |
| Real `@koa/router` mounted alongside Apollo in `marketplace-dev-public-resource`, prefix `/check` | Handles a bare `GET` from any mail client with no JS; matches what the link literally is | Introduces a second dispatch mechanism in one service; a route an HTTP-contract extractor can see that the other 8 services don't have, so tooling built for "GraphQL everywhere" needs an exception |
| REST endpoints on every service, GraphQL dropped or downgraded to a thin layer | Uniform, tool-friendly HTTP contracts across all 9 | Throws away Apollo's typed schema, codegen (`graphql-codegen client-preset`, used by all 3 frontends), and the resolver-layout convention (`src/graphQLApi/schema/`) for every other operation on the platform — disproportionate to a 3-route problem |

## Decision

Option 2, row 2 of the table above: keep GraphQL as the whole API and mount a real `@koa/router` only in `marketplace-dev-public-resource`, prefix `/check`, alongside the Apollo endpoint on the same Koa `app` (`app.use(router.routes())` then `app.use(router.allowedMethods())` before the `ctx.path === ENDPOINT` Apollo dispatch, `src/index.mts:109-110` vs `:126-129`). 3 routes:

- `GET /check/` — no-op, empty body (`src/middleware/router/index.mts:12-14`)
- `GET /check/verify-email/:email/:hash` — ShopOwner verification
- `GET /check/verify-email-user/:email/:hash` — User verification, kept as its own route rather than a branch on the first because the two collections can't be told apart from the URL alone

Reasoning: option 1 is disqualified structurally, not on preference — a `GET` clicked from a mail client cannot be made to first run a GraphQL client. Option 3 is disproportionate — it would rebuild schema, codegen and the resolver-layout convention (`src/graphQLApi/schema/queries|mutations/`) across all 9 services to solve a problem that exists in exactly one of them. Option 2 confines the exception to where the forcing function lives.

## Consequences

### Positive
- Every domain operation stays one shape (GraphQL mutation/query, resolver under `src/graphQLApi/schema/` or, for this one service, `src/graphQLPublic/schema/`), so `graphql-codegen client-preset` and the frontend query conventions apply uniformly with zero carve-outs.
- The email-click flow needs no client JS and no intermediate page — the link works from any mail client, any browser, no cookies required.
- The blast radius of the REST exception is contained to one file (`BEs/dev/marketplace-dev-public-resource/src/middleware/router/index.mts`) in one service.

### Negative
- HTTP contract extraction across this platform yields **zero cross-links**. GitNexus's route extractor recognises `router.get(...)` / `app.post(...)` / NestJS decorators; the inline `ctx.path === ENDPOINT` dispatch that all 9 Apollo mounts use is invisible to it, and `.mts`/`.mjs` aren't even in its extension registry. Re-verified 2026-08-05 across all 14 indexed repos: 6 contracts registered, 0 cross-links — the 3 `@koa/router` GETs in `marketplace-dev-public-resource` are the providers, and the 3 consumers are each frontend's unrelated `searchAddresses` call to the external Nominatim API, a disjoint set that can never match.
- Cross-service impact analysis for anything that travels as GraphQL-over-`fetch` — which is everything except these 3 routes — must be done by hand; `route_map`, contract cross-links and `group impact` across the HTTP boundary return nothing (`docs/gitnexus.md`, "HTTP contract extraction does not work on this platform").
- One service now carries two request-dispatch mechanisms (`@koa/router` for `/check/*`, inline `ctx.path` check for `/public-resource`) instead of the one every other service has.

### Risks
- **Risk:** a future contributor, seeing GitNexus report "0 cross-links" or "6 contracts", assumes the platform has little HTTP surface worth checking and skips manual review of a cross-service change. Revisit if a production incident traces back to an unreviewed cross-service GraphQL call that a route-map tool would have caught had one existed.
- **Risk:** someone adds a 4th REST-shaped route on a hunch that "REST is easier here too," eroding the GraphQL-everywhere property this ADR protects. Revisit only if a second genuinely non-GraphQL-client consumer (not a browser-clicked link) needs a new service; until then a new REST route in any service other than `marketplace-dev-public-resource` is a smell, not a pattern.
- **Risk:** the `verify-email` / `verify-email-user` route split relies on `USER_VERIFY_LINK_PATH` staying in step with the literal path in `src/middleware/router/index.mts:25`. Revisit if the two ever drift — the failure mode is a customer verification link 404ing or silently hitting the ShopOwner flow.

## Compliance

Verify: `grep -rn "@koa/router" BEs/dev/*/package.json` must return exactly one hit, `marketplace-dev-public-resource/package.json`. `grep -rln "@as-integrations/koa" BEs/dev/*/src/index.mts` must return all 9 services. `grep -c "router.get" BEs/dev/marketplace-dev-public-resource/src/middleware/router/index.mts` must return 3.

Violation looks like: a `@koa/router` or `@koa/router`-equivalent import inside `src/` of any service other than `marketplace-dev-public-resource`; a new route added under `/check` for something that is not an email-click target; or a domain query/mutation implemented as a REST handler instead of a resolver under `src/graphQLApi/schema/` (or `src/graphQLPublic/schema/` in `marketplace-dev-public-resource`).
