# ADR-020 — Route files are one-line createFileRoute calls with behaviour in router-free routeOptions constants
# Marketplace

**Status:** accepted
**Date:** 2026-08-05
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

`marketplace-user` is the one server-rendered surface on the platform — TanStack Start, public routes SSR,
`/account/*` `ssr: false` (CON-10). Route behaviour (`loader`, `head`, `validateSearch`, `component`) needs
unit coverage without a router mounted, because the platform-wide gate is 100% coverage on all four metrics
plus 100 mutation score (CON-08) and that gate does not carve out an exception for router-bound code.

TanStack Router's file-based routing wants one file per route under `src/routes/`, named by path segment
(`shop.$slug.index.tsx`, `category.$slug.$childSlug.tsx`, `account.addresses.tsx` — confirmed on disk in
`marketplace-user/src/routes/`). The framework also runs a code-splitter over those files that looks for
literal `loader`/`head`/`component` properties to split into per-route chunks. Two goals collide: testable
behaviour wants plain functions/objects importable in isolation; the splitter wants literal properties in
the route file itself to do its job.

[`marketplace-user/CLAUDE.md`](https://github.com/Axiumine/marketplace-user/blob/main/CLAUDE.md) (cited from the parent [`docs/frontends.md`](../../../frontends.md) §marketplace-user) records the resolution
already taken: route files became one-line `createFileRoute(id)(options)` calls, and the actual `loader`,
`head`, `validateSearch`, `component` live in `src/routeOptions/` as plain constants with no router
dependency.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Behaviour inline in each `src/routes/*.tsx` file (framework default) | Splitter sees literal properties, gets true per-route chunking | `loader`/`head`/`validateSearch` become untestable without mounting a full router — the 100%-coverage gate (CON-08) then forces router-integration tests for what should be unit-level logic; route files grow large and mix routing wiring with business logic |
| Route file re-exports a factory function that builds options at call time (`createOptions()`) | Slightly more indirection than a bare object, some testability | Splitter's static analysis still can't see through the function call boundary any better than through an import — same chunking loss as the chosen option, with none of its simplicity |
| One-line `createFileRoute(id)(options)` per route file, behaviour in `src/routeOptions/*.tsx` constants (chosen) | `loader`/`head`/`validateSearch` are plain functions/objects, importable and testable with zero router bootstrap; route file is pure wiring, one line, impossible to get wrong | Splitter reads literal properties and cannot see into an imported identifier — no route is split out of the entry chunk (measured, accepted below) |

---

## Decision

Adopt option 3, row 3 of the table above: `src/routes/*.tsx` files are one-line
`createFileRoute('/path')(someRouteOptions)` calls (e.g. `marketplace-user/src/routes/index.tsx`:
`export const Route = createFileRoute('/')(homeRouteOptions)`), and every `loader`, `head`,
`validateSearch` and `component` lives in a matching `src/routeOptions/*.tsx` file as a plain, router-free
export (e.g. `marketplace-user/src/routeOptions/home.tsx:120`:
`export const homeRouteOptions = { loader, head, component: Home }`).

The reasoning is testability first: `loader` and `head` in `routeOptions/home.tsx` are ordinary functions
taking `{ context }` / `{ loaderData }` — they can be unit-tested with a hand-built `RouterContext` and no
`@tanstack/react-router` test harness, which is what makes 100% coverage and 100 mutation score (CON-08)
achievable on route logic without turning every test into an integration test. The measured cost — losing
per-route code splitting — was accepted explicitly rather than discovered later: the framework's splitter
reads literal properties on the route file itself and cannot see into an imported identifier, so with this
structure no route is split out of the entry chunk. That cost was judged acceptable because the one chunk
on this platform actually worth splitting, MapLibre GL at roughly 950 KB, is already handled by a separate
mechanism — the map is a dynamically-imported island (`marketplace-user/src/features/map/MapIsland.tsx:26`,
`const ShopMapLazy = lazy(async () => import('./ShopMap'))`), so it never lands in the entry chunk
regardless of how routes are split.

---

## Consequences

### Positive
- `loader`/`head`/`validateSearch` are unit-testable in isolation, no router mount required — this is what
  let `marketplace-user` reach 100%/100 (66 test files, 1165 tests, 2028/6/0 mutants per
  [`docs/frontends.md`](../../../frontends.md) §Current suite sizes) without router-integration tests standing in for unit tests.
- Route files (`src/routes/*.tsx`) are uniform and nearly impossible to get wrong — one import, one
  `createFileRoute` call. Routing wiring and business logic are physically separated.
- The pairing with `src/router.ts`'s `RouterContext` type keeps `loader`/`head` signatures consistent across
  every route without importing router internals.

### Negative
- No route-level code splitting: all `loader`/`head`/`validateSearch`/`component` code across every route
  ends up in the entry chunk. Accepted cost, not a defect — recorded here so it is not "discovered" again
  as a regression.
- One more file to keep in sync per route: adding a route means both a `src/routes/*.tsx` wiring file and a
  `src/routeOptions/*.tsx` behaviour file: (confirmed 1:1 by directory listing — 18 files each, `home.tsx`
  paired with `index.tsx`, `shop.tsx` with `shop.$slug.index.tsx`, etc.). A route added to one directory and
  forgotten in the other fails at build/type-check time (`createFileRoute` expects an options object of the
  right shape), not silently.

### Risks
- **Entry chunk grows unbounded as routes are added.** Revisit if the entry chunk (measured via
  `yarn build` output in `marketplace-user/dist/client`) crosses a size budget nobody has set yet — this ADR
  does not define one, only records that MapLibre was the one chunk worth splitting at the time of writing.
- **A future non-MapLibre heavy dependency lands in a route's `component`.** The island pattern
  (`lazy(() => import(...))` inside a small wrapper, as in `MapIsland.tsx`) is the mitigation already proven
  once; if it is not reapplied per-dependency, the entry chunk absorbs it silently because the splitter
  still can't see through `routeOptions` imports.

---

## Compliance

Verify on disk: every file in `marketplace-user/src/routes/` should be short (one `import` of a router
function, one `import` from `@/routeOptions/...`, one `export const Route = createFileRoute(...)(...)`
statement) — `grep -c "" marketplace-user/src/routes/<file>.tsx` returning much more than ~5 lines for a
route file is the violation signal. Verify the pairing with `ls marketplace-user/src/routes/
marketplace-user/src/routeOptions/` — a route file with no matching `routeOptions` export, or `loader`/
`head`/`validateSearch` logic written directly inside `src/routes/*.tsx` instead of imported, is a
violation. Coverage/mutation gates (`yarn test:cov`, `yarn test:mutation` in `marketplace-user`) enforce the
underlying goal indirectly: router-bound logic that resists unit testing tends to surface as a coverage or
mutation gap in `src/routeOptions/`.
