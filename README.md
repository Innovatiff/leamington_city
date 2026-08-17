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
| `apps/app` | Astro 5 public site. Static, React islands, Tailwind 4. |
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

Hosting targets assume three sites named `leamington-city`,
`leamington-city-portal` and `leamington-city-admin`. Create them under
Hosting, or edit the `targets` block in `.firebaserc` to match yours.

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
description_en/es, facebook, instagram, tags, lat, lng`. Free-text categories
are mapped onto the controlled vocabulary in `packages/shared`
(`"Restaurant - Full Service"` → `restaurant`).

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

```bash
pnpm deploy:rules       # firestore rules + indexes + storage rules
pnpm deploy:functions
pnpm deploy:hosting
```

Deploy rules before functions on a first run — several triggers assume the
indexes in `firestore.indexes.json` exist.
