# Marketplace — workspace reference

This file holds what [`CLAUDE.md`](./CLAUDE.md) used to carry before it was trimmed to identity, routing
and hard rules: the rationale, reference tables and worked detail behind them. Read `CLAUDE.md` first —
it is the one that is auto-loaded into every session.

## Build state — surface depth

Four surfaces, all present, at very different depths.

| Surface | Audience | Built |
|---|---|---|
| Public pages | anonymous | backend + the SSR half of `marketplace-user` |
| Customer area | end customer | **identity only** — `user` collection, service pair, private area |
| Shop-owner area | `ShopOwner` | backend + `marketplace-shopowner` |
| Admin area | `Admin` | backend + `marketplace-admin` |

**"Customer area built" means identity, not commerce, permanently.** A customer can register, confirm
their email, log in, fill in personal data, keep several addresses and name one the default. They cannot
buy anything and never will: **no cart, no order, no order state machine, no delivery, no payment** — no
collection, no resolver, no design, and `item` carries no price for that reason. Those four are
**permanently out of scope** by the platform owner's decision of 2026-08-27
([`ADR-038`](./docs/devprotocol/phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)). Re-opening
it takes a superseding ADR, which is the platform owner's call alone.

Do not describe the unbuilt parts to the user as if they exist, and do not assume a missing piece is an
oversight. The commerce four are not merely missing: they are declined.

### Adding a fifth tier

Follows the recipe the four establish: a collection + migration → a `tier` value in the session → a
service pair of its own → resolvers → a frontend.

## Naming rules — detail

Everything is English, with no exception — domain names, identifiers, function names, collection and
field names, UI text, routes, comments, test fixtures, migrations. There is no second language anywhere
in these sixteen repos.

A field whose meaning is not obvious from its English name gets a comment saying exactly what it holds —
see [`docs/devprotocol/phase2/UBIQUITOUS_LANGUAGE.md`](./docs/devprotocol/phase2/UBIQUITOUS_LANGUAGE.md)
§12 for the five registration fields on `company`, where `legalName` (registered name) and `publicName`
(trading name) are the pair worth knowing. The `en-GB` locale the frontends format dates with, and the
`english` stemming on the two text indexes, are market choices rather than names.

## Roles, collections and services

The word *operator* used to mean the `Admin` tier; it is banned (see `CLAUDE.md`) because a fourth word
for a role that already has a name is how a reader ends up asking which of the three it was.

| Business role | Code name | Where |
|---|---|---|
| Shop owner | `ShopOwner` | `shopOwner` collection, `authenticated-*` services |
| Admin — runs the platform | `Admin` | `admin` collection, `admin-authenticated-*` services |
| End customer | `User` | `user` collection, `user-authenticated-*` services |
| Company — **also the shop** | `Company` | `company` collection, FK `idShopOwner` |
| Catalogue entry | `Item` | `item` collection, FK `idCompany` |
| Category / subcategory | `ItemCategory` | `itemCategory` collection, self-FK `idParent`, admin-only writes |
| Shop as a **separate** thing | — | does not exist and will not — a shop *is* a `company` |
| Order, cart, delivery, payment | — | not implemented |

## The shape, in one screen

Nine Koa 3 + Apollo Server 5 backend services, split on **tier** (who) × **concern** (what); three
frontends, one per tier; one shared npm lib; one migrations repo. (Also documented, with a `Concern`
column, in [`docs/architecture.md`](./docs/architecture.md) §Services — the table below is the quick
version.)

| Service | Port | Tier |
|---|---|---|
| `marketplace-dev-admin-authenticated-resource` | 4024 | Admin |
| `marketplace-dev-admin-authenticated-authorization` | 4025 | Admin |
| `marketplace-dev-authenticated-resource` | 4026 | ShopOwner |
| `marketplace-dev-public-resource` | 4027 | public |
| `marketplace-dev-public-authorization` | 4028 | public |
| `marketplace-dev-authenticated-authorization` | 4029 | ShopOwner |
| `marketplace-dev-authenticated-logout` | 4030 | **all three** |
| `marketplace-dev-user-authenticated-authorization` | 4031 | User |
| `marketplace-dev-user-authenticated-resource` | 4032 | User |

Frontends: `marketplace-admin` 3043 (SPA) · `marketplace-shopowner` 3044 (SPA) · `marketplace-user`
3045 (SSR public + CSR account area).

**authorization** = token lifecycle only. **resource** = domain GraphQL. Put a new domain query or
mutation in a **resource** service.

MongoDB, 6 collections, strict `$jsonSchema` with `additionalProperties: false` (also diagrammed in
[`docs/data-model.md`](./docs/data-model.md)):

```
shopOwner ──idShopOwner──> company ──idCompany──> item ──idCategory──> itemCategory
                                                                            ▲
                                                                    idParent ┘  (one level only)
admin, user — outside the chain
```
