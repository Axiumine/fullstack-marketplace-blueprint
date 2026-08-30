# Frontends — one app per tier

| App | Tier | Port | Rendering | Backends |
|---|---|---|---|---|
| `marketplace-admin` | `Admin` | 3043 | SPA | 4024 / 4025 / 4028 / 4030 |
| `marketplace-shopowner` | `ShopOwner` | 3044 | SPA | 4026 / 4029 / 4028 / 4030 |
| `marketplace-user` | `User` + anonymous | 3045 | **SSR** public, `ssr: false` for `/account/*` | 4027 / 4028 / 4030 / 4031 / 4032 |

One app per tier, not one app that switches on role (ADR-027). All three are Vite 8 + React 19 +
TypeScript strict, and each has its own [`CLAUDE.md`](../CLAUDE.md), [`README.md`](../README.md) and `COVERAGE.md` — **read them before
editing that app.**

## Traps common to all three

- **`schema/*.graphql` are hand-maintained slices, not the contract.** No service has an SDL file — all
  nine build their schema programmatically. The resolvers are the source of truth; the slices drift and
  must be re-checked before any operation is added or changed.
- **`preferGetMethod: false` is load-bearing** (ADR-021). Every service sets `csrfPrevention: true`,
  which rejects a GET carrying none of Apollo's preflight-forcing headers — and urql sends none. At the
  default, every query short enough to fit in a URL fails with a CSRF message while mutations work.
- **urql `context.url` objects must be module constants** (`CTX_*` in `src/api/endpoints.ts`). A
  `{ url }` literal in a component body is a new object per render, and urql re-executes on context
  change — an infinite refetch loop.
- **Create/delete mutations answer a bare `Boolean`**, so the document cache invalidates nothing unless
  the call site passes `additionalTypenames`.
- **All three login pages render Cloudflare Turnstile**, each from its own copy of
  `src/components/ui/Turnstile.tsx`. `VITE_TURNSTILE_SITE_KEY` is the public half of the key pair and an
  empty value renders no widget — the normal state of a developer box and of every suite. That is safe
  because the server decides: `guardPublicLogin` on 4028 verifies a token only where `TURNSTILE_SECRET`
  is set. ⚠️ The token variable must still be *sent* (`turnstileToken: null` is the correct request
  locally); a form that drops it looks identical on screen and fails only against a deployment that
  holds the secret.
- Gated at **100% coverage and 100% mutation score**, plus `yarn lint:check`, `tsc --noEmit` and
  Qodana — all five in `.githooks/pre-push`, all but mutation in `.githooks/pre-commit`.

## marketplace-admin and marketplace-shopowner (SPA)

Stack: TanStack Router (route tree in code, not generated) · urql + `cacheExchange` +
`@urql/exchange-auth` · graphql-codegen `client-preset`, one project per access level · TanStack Table
· react-hook-form + zod · Tailwind 4 · Sentry.

`marketplace-admin` is the admin app: `loginAdmin`, then manage *shopOwners* — and, since 2026-08-25,
*customers* as well: `/customers` pages `user` accounts through `usersActiveTbl` and suspends or restores
one with `userUpdateStatus`, both on 4024 (E19). Since 2026-08-29 it opens with a counter and a
registrations chart above that table — `usersStats` and `usersPerPeriod`, the counterparts of the pair
`/shopOwners` has always had (E19 §6 question 2). ⚠️ **Since 2026-08-30 both admin tables filter by account
state, and both offer four of them** — Active, Suspended, Closed and Closed & suspended, carried in the URL
as `?status=` and sent to the service as the `disabled` / `deleted` pair both table queries take as
required booleans (ADR-049). Four rather than three because the two flags are independent: an account
suspended and *then* closed carries both, and it belonged to no filter either screen offered — `/customers`
had two, `/shopOwners` had none, so a shop owner left that table the moment an admin acted on them. The
state is never sent as a name: an *all accounts* option would unbind the leading field of the indexes both
tables page on and turn the sort into a blocking one. ⚠️ **The customers screen still has no search box and one
sortable column, deliberately** — ADR-029 encrypts every other field on `user`, `registeredAt` and the status flags
being the only ones left to sort or filter on. The counter and the chart are not an exception to that: a
count reads no field at all and the chart buckets `registeredAt`, so what the encryption blocks is matching
and ordering, never counting. `marketplace-shopowner`
mirrors it — same stack, same conventions, same hooks — and is deliberately thinner because the tier
behind it is. `marketplace-dev-authenticated-resource` exposes `shopOwnerCompanies`, `companyItems`,
`itemCategories` and eight mutations (`company*` plus `itemAdd` / `itemUpdate` / `itemUpdatePublished` /
`itemDel`). ⚠️ **Two of the eight are publish-only** — `companyUpdatePublished` and `itemUpdatePublished`,
split out on 2026-08-14 because the flag used to sit inside the update inputs and every save wrote it. The
items screen calls its one; nothing on either frontend calls the company one, which is a missing control
rather than a missing resolver. The admin
app's profile, password-change, personal-data, statistics and paginated-table screens have no
counterpart there and were pruned rather than stubbed.

⚠️ **The admin app's `/categories` screen is the taxonomy's only UI, and it adds two behaviours no
other layer has.** `position` is capped at 999999999 in the form
(`marketplace-admin/src/features/categories/Categories.tsx:55`, `MAX_POSITION`) while the resolver checks
whole and non-negative only — so without that bound a wider value reaches the collection and fails the
`$jsonSchema` as a 500 naming no field, which is the failure the cap exists to keep off the screen. And
the tree is rendered defensively: `orderedCategories` appends a subcategory whose parent it cannot find at
the end of the list instead of dropping it, and `parentLabel` renders `---` in place of that parent, so an
orphan stays visible and editable. **No API call can produce one** — `throwIfParentNotTopLevel` has
refused a missing parent since the three resolvers first shipped — so what the bucket defends against is a
write made straight against MongoDB, and
`marketplace-admin/test/features/categories/Categories.test.tsx:174` holds it in place.

⚠️ **Three shopowner-side differences are deliberate and must not be "corrected" back to the admin
app's shape:**

- `companyAdd` answers `OnlyIdType`, not `Boolean`.
- `GraphQLInputCompanyPosition` **requires** `type: String!` on the ShopOwner tier and **forbids** it on
  the Admin one, which stamps `'Point'` server-side.
- Password recovery *is* available to `ShopOwner` (`resetPwdFlow` binds that model) — it simply has no
  screens yet.

## marketplace-user (TanStack Start, SSR)

The customer app, and the only server-rendered thing on the platform. TanStack Start (Vite 8 + React 19
+ TanStack Router SSR) · urql · graphql-codegen `client-preset` · react-hook-form + zod · Tailwind 4 ·
MapLibre GL 6 + Protomaps PMTiles behind two dynamically-imported islands · Sentry.

Its own [`CLAUDE.md`](../CLAUDE.md) carries the full trap list. The five that matter from outside:

- ⚠️ **This app carries both of the platform's registrations, and they are two pages on purpose.**
  `/register` writes a `user` through `userRegister`; `/register/seller` writes a `shopOwner` through
  `shopOwnerRegister`, both on public-resource (4027). Nothing moves an account between the two
  collections (ADR-002 — the role *is* the collection), so a seller who fills in the customer form has
  spent their address on an account they cannot trade from. Each page therefore links to the other, and
  the footer offers both. The seller's page deliberately has **no** sign-in link: `/login` here
  authenticates against `user` and would refuse a shop owner with a wrong-password error, so their way
  in is the link in the activation mail, to an app on another origin.

- **The private area is four screens, and the fourth ends the account** — `/account` (profile),
  `/account/addresses`, `/account/password` and `/account/close`, plus sign-out. The last one sends
  `userDel` with an **empty variable set** (the session names the account; an id from a browser would make
  it "close any customer's account") and then signs out, and it states in words what a refused login
  deliberately will not: every session ends, the undo is *registering again* at the same address within
  thirty days and never *logging in*, a suspension survives the round trip, and day 30 overwrites the
  personal fields rather than removing the document. ⚠️ **That copy has to agree with `/privacy`**, which
  makes the same three statements publicly — they are one pair of pages over ADR-041 and ADR-046, and
  drifting apart is how one of them becomes false. It is the one write on this tier sent **without**
  invalidating `GraphQLUserMe`: there is no account left to re-read, and the invalidation would only race
  the sign-out for a 401. The shop owner's counterpart is the `/account` card in `marketplace-shopowner`.

- ⚠️ **Public routes are SSR, `/account/*` is `ssr: false`, and that pairing is a security boundary**
  (ADR-018). Rendering authenticated HTML on a server behind a shared `proxy_cache` is how one
  customer's data reaches another. The cache bypasses on the session cookie and the account routes never
  render server-side — two halves of one mechanism; weakening either alone is enough to leak.
- **The SSR server talks to public-resource directly** over `PUBLIC_RESOURCE_URL` (deliberately *not*
  `VITE_`-prefixed, which would inline a loopback address into the client bundle), building **a new urql
  client per request** (ADR-019) — a shared one would serve one visitor's cached response to the next.
- **`yarn start` runs `serve.mjs`, not the build output.** `vite build` emits `dist/server/server.js`, a
  `{ fetch }` handler with no listener; `.output/` belongs to the Nitro preset, which is not installed.
  nginx serves `dist/client`, the Node process serves SSR only.
- **Route files are one-line `createFileRoute(id)(options)` calls** (ADR-020), with the behaviour in
  `src/routeOptions/` as router-free constants so loaders, `head` and `validateSearch` are testable
  without mounting a router. Accepted cost: the framework's splitter reads literal properties and cannot
  see into an imported identifier, so no route is split out of the entry chunk. The one chunk worth
  splitting — MapLibre, ~950 KB — is split anyway by the islands' dynamic imports.

- **Two maps, both islands, and the second one writes.** `ShopMap` shows catalogue pins; `PositionPicker`
  is the draggable pin in the account area's address form, which is how a customer address acquires
  `position` at all — the geocoder places it when a suggestion is picked, the pin corrects it, and an
  address Nominatim does not know is placed by hand. `position` stays optional either way. Both are
  reached only through their island, as is `src/features/map/pmtiles.ts`, which registers the `pmtiles://`
  protocol once per document and pulls in `maplibre-gl` for anything that imports it.
- **The picked position is one form field, written by three surfaces.** `AddressForm` holds it as a single
  `"lon,lat"` **string** — not two numeric fields — and picking a geocoder suggestion, dropping or dragging
  the pin, and the "Remove position" control all write that one field, which the map then reads back. That
  is what keeps the three from disagreeing, and `''` is the only honest "no position": a numeric pair would
  have to spell it as `NaN` or `0`, and half a position is not a degraded one, it is a wrong one. The pin is
  the **correction** surface, never the primary one — the address fields and their suggestions stay
  sufficient on their own, because a canvas cannot be dragged with a keyboard.
- ⚠️ **A point the map itself produced never re-frames the map.** A drag or a click leaves the viewport
  alone; only a point arriving from the geocoder eases to it, at zoom 16 (`ZOOM_ADDRESS` in
  `src/features/map/PositionPicker.tsx`, against `ZOOM_COUNTRY` 3 when there is no position yet). Without
  that exemption the map walks across the screen chasing the pin the customer just let go of.
- ⚠️ **`[longitude, latitude]`, in that order, on every boundary.** GeoJSON's order — reversed from
  MapLibre's `{lng, lat}` and from Nominatim's named `lat`/`lon`, so both adapters flip it, and a swap
  survives every type-check and puts the point in the sea. Stored rounded to **six decimals** (~11 cm),
  which is shorter than the float that reaches the field and precise past any use this platform has.

## marketplace-services-status

A dashboard app that is **not** a repo of its own — it is a subdirectory tracked by the parent
workspace (ADR-025). Three consequences before editing it:

- **Its gates live in the parent's `.githooks/`.** `pre-commit` runs `yarn test:cov` and Qodana scoped
  to staged non-`*.md` paths under `marketplace-services-status/`; `pre-push` runs `test:cov` → `test:mutation` →
  Qodana **unscoped**, because a push carries `--no-verify` commits and merge commits that `pre-commit`
  never saw.
- **No `lint` script** — it is not one of the thirteen eslint/prettier packages. `tsc` runs as the first
  half of its own `test:cov` (`yarn build && vitest run --coverage`), so a type error fails the coverage
  gate before a single test executes. **Read the first error in that output, not the last.**
- **Its own Qodana Cloud project (`xPKXD`) and its own token.** Do not point it at another repo's token
   — the reports would land in that project and corrupt its baseline.

⚠️ `marketplace-services-status/qodana.sh` must stay mode `100755`. At `100644` the invocation dies with
`Permission denied` before reaching Qodana and reports as a scan failure pointing at a SARIF that was
never created. Both parent hooks now test executability separately from existence and print the two
fixing commands — `chmod +x` **and** `git update-index --chmod=+x`, since the mode is tracked.

## Current suite sizes

| App | Test files | Tests | Mutants killed / timed out / survived |
|---|---|---|---|
| `marketplace-admin` | 71 | 1071 | 2053 / 7 / 0 |
| `marketplace-shopowner` | 49 | 677 | 1083 / 5 / 0 |
| `marketplace-user` | 76 | 1433 | 2171 / 7 / 0 |
| `marketplace-services-status` | 7 | 379 | 1102 / 1 / 0 |

File and test counts are a `yarn test` run of 2026-08-25, except `marketplace-user`'s, recounted
2026-08-29 with the close-account screen. ⚠️ **The mutant columns are older than that** —
they are each app's last `pre-push` run, and `marketplace-admin`'s predates the nine files and 229 tests
E19 added. The gate is hook-only in all four repos, so the next push is what re-measures them; do not
start a run to refresh this table.
