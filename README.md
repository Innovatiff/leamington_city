# Leamington

A bilingual (EN/ES) directory of Leamington, Ontario businesses: their deals,
their job postings, and a link out to their own websites.

This app does **not** do ordering, menus or kitchen panels — those live on the
individual client websites, and the app links out via `websiteUrl`. See
[CLAUDE.md](./CLAUDE.md) for the full set of non-negotiables and
[SCHEMA.md](./SCHEMA.md) for the data model.

## Layout

| Path | What it is |
| --- | --- |
| `apps/app` | Astro 5 public site. Static, React islands, Tailwind 4. Deployed to Netlify. |
| `apps/portal` | Vite + React business-owner portal. |
| `apps/admin` | Vite + React internal admin. |
| `packages/shared` | Types, Firestore converters, i18n. The only place types live. |
| `functions` | Firebase Functions 2nd gen (TypeScript). |
| `scripts` | `seed.ts` and its CSV reader. |

## Getting started

Requires Node 22 and pnpm 10. The Firebase CLI is used for emulators and
deploys but is deliberately not a workspace dependency — install it once with
`npm i -g firebase-tools`.

```bash
pnpm install
cp .env.example .env      # fill in from the Firebase console
pnpm build:shared         # apps import the built package, so build it first
```

Point the workspace at your Firebase project in **one** place — the `default`
entry in [`.firebaserc`](./.firebaserc). The CLI, emulators and deploys all
follow from it. `.env` then carries the Web app config for the browser
(`PUBLIC_*` for Astro, `VITE_*` for the two Vite apps — same values, two
prefixes, because each bundler only exposes its own).

Firebase Hosting serves the portal and admin only, from sites named
`leamington-city-portal` and `leamington-city-admin`. Create them under
Hosting, or edit the `targets` block in `.firebaserc` to match yours. The
public site is built and served by Netlify — see [Deploying](#deploying).

### URLs

English is unprefixed and Spanish sits under `/es/`:

| | English | Spanish |
| --- | --- | --- |
| Today's feed | `/` | `/es` |
| Directory | `/businesses` | `/es/businesses` |
| Category | `/restaurants` | `/es/restaurants` |
| Business | `/restaurants/erie-shore-diner` | `/es/restaurants/erie-shore-diner` |
| Search | `/search` | `/es/search` |

A business page's URL contains its category, so nothing builds one from a slug
alone — use `businessPath()` from `apps/app/src/lib/routes.ts`. Category URL
segments are fixed in `packages/shared/src/categories.ts` and are **not**
translated; only their display names are.

`/search` is `noindex`: its results are built client-side, so there is nothing
there for a crawler. The category pages are the indexable surface, and each one
is fully server-rendered with `ItemList` JSON-LD.

### Design and imagery

Navigation is at the top on every breakpoint — there is no bottom tab bar. On a
phone the header carries the brand, search and language switch on one row and
the section links on a second.

`packages/shared/src/i18n` is still the only source of user-facing strings; the
design layer adds no hard-coded copy.

Every business needs a picture, and most imported listings will never have one,
so `apps/app/src/lib/covers.ts` falls back to a generated category scene chosen
deterministically from the slug — the same business keeps the same picture
across builds. Real photography always wins: set `heroUrl` or `photos` on a
business and the generated cover is no longer used.

The covers themselves are built by `scripts/generate-imagery.mjs`, which
rasterises layered SVG scenes through Chromium into
`apps/app/public/img/covers/`. Each category has three visually distinct
compositions so a category page never shows the same picture four times.
Regenerate with:

```bash
node scripts/generate-imagery.mjs     # needs playwright available
```

They are committed, so a normal build does not need to run it.

### Filling the directory for development

```bash
pnpm seed -- --file scripts/data/leamington-businesses.sample.csv --emulator --commit
pnpm seed:demo -- --emulator --commit
```

The sample CSV carries 30 Leamington businesses with hours, coordinates and
bilingual copy; `seed:demo` adds 16 offers and 10 jobs on top. `seed:demo` is a
development tool — it never touches a business an owner has claimed, and it is
not part of the production import path.

### Search and the Open Now filter

`/search-index.json` is generated at build time from Firestore and is the only
thing the search island fetches — searching costs zero Firestore reads no
matter how heavily it is used. It carries each business's opening hours, which
is what lets the Open Now filter work offline of any API.

Open/closed is evaluated by `openStateAt()` in `packages/shared/src/hours.ts`
from a `(weekday, minutes)` pair in `America/Toronto`, so the answer is correct
on a phone whose clock is set to another zone. Intervals where `close <= open`
span midnight — a kitchen open `20:00-02:00` is one interval, not two.

On category and directory pages the filter hides already-rendered cards rather
than owning the list, so the server-rendered markup stays complete for crawlers
and for anyone without JavaScript.

### Develop

```bash
firebase emulators:start   # auth, firestore, functions, storage
pnpm dev:app               # http://localhost:4321
pnpm dev:portal            # http://localhost:5174
pnpm dev:admin             # http://localhost:5175
```

Set `PUBLIC_USE_EMULATORS=1` and `VITE_USE_EMULATORS=1` in `.env` so the
clients talk to the emulators instead of production.

### Build and check

```bash
pnpm build        # shared → apps + functions
pnpm typecheck    # every workspace, including astro check
```

`apps/app` reads Firestore at build time through the Admin SDK. With no
credentials it builds an empty site and says so — that is intentional, so CI
can build without secrets. To generate real pages, set
`GOOGLE_APPLICATION_CREDENTIALS` and `GOOGLE_CLOUD_PROJECT`, or point
`FIRESTORE_EMULATOR_HOST` at a running emulator.

## Seeding businesses

`scripts/seed.ts` ingests a CSV of Leamington businesses into stub-tier
documents with generated unique slugs.

```bash
# Dry run (the default) — prints what it would do and writes nothing
pnpm seed -- --file scripts/data/leamington-businesses.sample.csv

# Against the local emulator
pnpm seed -- --file ./data/leamington.csv --emulator --commit

# Against the real project
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
  pnpm seed -- --file ./data/leamington.csv --commit
```

Columns are matched case- and separator-insensitively, and only `name` is
required: `name, category, address_line1, address_line2, city, province,
postal_code, phone, email, website, short_description_en/es,
description_en/es, facebook, instagram, tags, lat, lng, hours_mon … hours_sun`.
Free-text categories are mapped onto the controlled vocabulary in
`packages/shared` (`"Restaurant - Full Service"` → `restaurant`).

Hours accept `9:00-17:00`, `9-17`, several ranges in one cell
(`8:00-12:00;13:00-17:00`), `20:00-02:00` for past midnight, and `closed` (or
an empty cell). Leaving every hours column blank stores `null`, which the app
renders as "Hours not listed" rather than guessing.

Three properties worth relying on:

- **Slugs are permanent.** They are generated once, deduplicated against the
  whole collection, and a row that matches an existing business keeps the slug
  it already has. Collisions fall back to the street (`marios-auto-service`,
  then `marios-auto-service-900-seacliff-dr`) before resorting to `-2`.
- **Re-running is safe.** Rows are matched on normalised name + postal code, so
  a second run updates in place instead of duplicating.
- **Claimed businesses are never touched.** Once `tier !== 'stub'`, the seed
  skips the row rather than overwriting an owner's edits.

## Security model

`firestore.rules` is the authority; `packages/shared/src/firestore/paths.ts`
mirrors it in constants so application code can't drift.

- **Public read**: `businesses`, `offers`, `jobs`, `feedDays`.
- **Business documents**: writable only by a user whose `businessId` custom
  claim equals the document id, and only across owner-editable fields — tier,
  rank, counts and slug are not among them.
- **`clickouts` and `redemptions`**: no client writes at all. Cloud Functions
  use the Admin SDK, which bypasses rules, so "functions only" is expressed as
  `allow write: if false` rather than a fictional service-account condition.
  Clients go through the `recordClickout` and `issueRedemption` callables.
- **`subscriptions`**: readable by the owning business, written only by
  provider webhooks.

Custom claims are minted by the `assignBusinessOwner` callable
(`functions/src/claims.ts`), which is itself admin-only.

## Deploying

The public site goes to **Netlify**; the portal and admin stay on **Firebase
Hosting**.

```bash
pnpm deploy:rules       # firestore rules + indexes + storage rules
pnpm deploy:functions
pnpm deploy:hosting     # portal + admin only
```

Deploy rules before functions on a first run — several triggers assume the
indexes in `firestore.indexes.json` exist.

### Netlify

`netlify.toml` at the repo root builds `apps/app`. Netlify needs credentials to
read Firestore during the build; set these as site environment variables:

- `GOOGLE_CLOUD_PROJECT` and `GOOGLE_APPLICATION_CREDENTIALS` (or write the
  service-account JSON out in a prebuild step)
- `PUBLIC_SITE_URL` — required for correct canonical and hreflang tags
- `PUBLIC_FIREBASE_*` — web config used by the client islands

Without credentials the build still succeeds with an empty dataset and says so,
so a misconfigured deploy is loud rather than silently blank.

### Rebuilding on data change

The site is static, so a business edit is invisible until it rebuilds. Create a
build hook in Netlify (Site settings → Build hooks) and store it as a secret:

```bash
firebase functions:secrets:set NETLIFY_BUILD_HOOK_URL
```

Firestore triggers on `businesses`, `offers` and `jobs` only mark the site
dirty in `system/build`; `rebuildSiteIfDirty` runs every five minutes and fires
the hook at most once per ten. That matters: firing the hook straight from a
trigger would queue one build per document, so a single seed run of 400
businesses would cost 400 builds instead of one.

Admins can force a publish immediately with the "Publish site now" button in
the admin app, which calls the `rebuildSite` callable.
