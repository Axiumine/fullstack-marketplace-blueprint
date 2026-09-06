# Processor Inventory
# Marketplace

**Status:** engineering record - the legal column is deliberately unanswered, see §1
**Version:** 1.0
**Date:** 2026-09-06
**Author:** risk-agent
**Source:** [`RISK_REGISTER.md`](./RISK_REGISTER.md) R25 · [`phase1/NFR.md`](../phase1/NFR.md) NFR-CO02 and open question 6
**Changelog:** v1.0 - 2026-09-06: first inventory. Written because R25 said *a call is owed* on three named vendors and nobody had written down where the calls are, which made the decision more expensive than the decision deserved. Two flows that no document named turned up while deriving it: the OpenStreetMap **embed iframe** in the admin and shop-owner panels, which sends a shop's exact coordinates and the staff member's IP to `openstreetmap.org` on every address view, and **Turnstile**, which reaches `challenges.cloudflare.com` from all three frontends and again from the backend verifier - so Cloudflare is a live processor today rather than only at the edge in production.

## 1. What this is, and what it is not

Every third party that receives personal data from this platform, the call site that sends it, and what
crosses. It is an **engineering record**: it says where the data goes, because that is a fact about the
code that can be established by reading the code.

⚠️ **The Art 28 column is blank on purpose, and blank is not an oversight.** Whether an agreement exists,
must be executed, or is satisfied by a vendor's standard terms is the platform owner's and legal's, not
engineering's - [`phase1/NFR.md`](../phase1/NFR.md) open question 6 says so in as many words. Filling that
column with a guess would produce a compliance claim nobody made, which is worse than an empty cell.

⚠️ **This is not a lawful basis, a controller identity or a privacy notice.** Those three are the whole of
RISK_REGISTER R25 and none of them is engineering work either. `marketplace-user/src/routeOptions/privacy.tsx`
carries the same warning at the top of the page it renders.

## 2. Processors — third parties that receive personal data

| Processor | What it is for | Personal data crossing | Call site | Art 28 |
|---|---|---|---|---|
| Cloudflare (Turnstile) | bot challenge on every public write and login | the visitor's IP, browser and challenge signals, from the browser; then the token plus `TURNSTILE_SECRET` from the server | `marketplace-admin`, `marketplace-shopowner`, `marketplace-user` - `src/components/ui/Turnstile.tsx` loads `https://challenges.cloudflare.com/turnstile/v0/api.js`; `BEs/marketplace-common/src/others/assertTurnstile.mts` posts to `.../v0/siteverify` | |
| Cloudflare (edge, CDN, WAF) | the production edge in front of every vhost | every request in full, bodies included - so every credential, address and email the platform accepts | not in source: it is the production topology of [`ADR-039`](../phase3/adr/ADR-039-production-topology-cloudflare-app-host-trusted-datastore-segment.md), and reaches nothing on this workstation | |
| Sentry | error and performance telemetry | whatever survives `sentryBeforeSend` - the scrubber walks the event's bags, `dataCollection` is off and `tracesSampleRate` is 0.1, and none of that is a substitute for an agreement | `BEs/dev/*/src/instrument.mts` in all nine services and `src/instrument.ts` in all three frontends; DSN from `SENTRY_DSN` / `VITE_SENTRY_DSN` | |
| SocketLabs | transactional mail - verification, reset, approval | the recipient's email address and the link, which for two flows carries an identifying `:email/:hash` pair | `BEs/dev/marketplace-dev-public-resource` registration and reset mailers; credentials from `SOCKETLABS_SERVER_ID` / `SOCKETLABS_SERVER_APIKEY` | |
| OpenStreetMap - Nominatim, public instance | address lookup in the two staff panels | the free-text address a staff member types, plus their IP, sent to the public instance on every keystroke-debounced search | `marketplace-admin/src/lib/nominatim.ts:17` and `marketplace-shopowner/src/lib/nominatim.ts:17`, both `https://nominatim.openstreetmap.org/search` | |
| OpenStreetMap - `export/embed.html` | the map frame under an address in the two staff panels | the shop's exact coordinates in the URL, plus the staff member's IP and referrer, on every render of the frame | `marketplace-admin/src/lib/nominatim.ts:18` and `marketplace-shopowner/src/lib/nominatim.ts:18`, rendered by each panel's `src/components/ui/AddressMap.tsx` | |

⚠️ **`marketplace-user` is not on that list twice, and the difference is deliberate.** Its
`src/lib/nominatim.ts` calls `env.nominatimUrl`, which defaults to the root-relative `/nominatim`, and
`marketplace-nginx` proxies that to `mkt_nominatim` - `127.0.0.1:8080`, a self-hosted instance. The customer
surface therefore sends no address to OpenStreetMap at all, and its map is MapLibre over a self-hosted
PMTiles archive (`VITE_PMTILES_URL`, default `/map/basemap.pmtiles`) rather than an embed frame. The
`protomaps.com` and `openstreetmap.org/copyright` links in its footer are the licence attribution those two
ask for, and nothing fetches them.

## 3. Hosts that appear in source and receive nothing

Kept here because the check in §5 reads this file, and because the next reader should not have to re-derive
why each one is harmless.

| Host | Why it is not a processor |
|---|---|
| `schema.org` | the `@context` identifier in the JSON-LD `marketplace-user` renders. A URI used as a name; nothing dereferences it |
| `www.sitemaps.org` | the XML namespace of the sitemap. Also a name |
| `the-guild.dev` | the documentation link graphql-codegen writes into the banner of every generated `src/gql/*/gql.ts`. A comment |
| `www.openstreetmap.org/copyright`, `protomaps.com` | attribution links in a footer and under a map. The user's browser reaches them only if the user clicks |
| `127.0.0.1`, `example.it`, `www.example.it`, `evil.example`, `https://host` | test fixtures and local development. `evil.example` is a redirect-rejection fixture and must stay unreachable |

## 4. What this inventory cannot see

⚠️ **Three of the six processors are configured rather than coded**, so no scan of the source finds them and
none of them appears in §2 by its host name. Sentry is a DSN, SocketLabs is a server id and an API key,
Cloudflare's edge is a DNS record - all four values live in a gitignored environment file or in an account
somebody owns. **Pointing one of them somewhere else is a processor change that leaves no diff.**

⚠️ **The same is true in the other direction, and it is the sharper edge.** `VITE_NOMINATIM_URL` and
`VITE_PMTILES_URL` default to same-origin paths, which is what keeps the customer surface off the public OSM
API. Setting either to a third-party host turns a self-hosted dependency into a processor with a one-line
environment change and no code review - and **who runs the instance behind `mkt_nominatim` is itself an open
question**: `marketplace-nginx` proxies to `127.0.0.1:8080` and says nothing about whose machine that is in
production.

## 5. The check, and how to add a processor

`./scripts/audit-check.sh` §11 (MC-21) reads every tracked source file in the fifteen sub-repos, extracts
each absolute `http://` or `https://` host literal, and fails when one of them is named nowhere in this
file. It is a drift guard, not a compliance check: it stops a seventh third party appearing between register
reviews, and it cannot see anything in §4.

Adding an integration therefore means adding a row - to §2 if personal data crosses, to §3 if it provably
does not, with the reason written out. A host in neither place takes the check red, which is the intended
outcome: the argument is owed at the moment the call is added, not at the next audit.

## 6. What is still owed, and by whom

The three obligations of RISK_REGISTER R25 are unchanged by this document, because none of them is code:

1. **Lawful basis (Art 6)** - undecided. No consent field exists on `user` or `shopOwner`, nothing here
   sends marketing, and contract (Art 6(1)(b)) covers the account relationship on its face - but that
   reading is offered, not adopted.
2. **Controller identity (Art 13)** - blocked on the owner alone. It needs a legal entity's registered name
   and address, which exist nowhere in these sixteen repos and must not be invented.
3. **Processor agreements (Art 28)** - the six rows of §2, with their column empty.

Erasure, portability and retention are built and are not on this list:
[`ADR-041`](../phase3/adr/ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md),
[`ADR-046`](../phase3/adr/ADR-046-the-retention-window-is-an-undo-window.md) and
[`ADR-048`](../phase3/adr/ADR-048-an-admin-closes-a-customer-account.md) and
[`ADR-050`](../phase3/adr/ADR-050-the-scrub-stops-at-the-account-collections.md) carry them.
