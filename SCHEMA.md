# Firestore schema

Authoritative data model. `packages/shared` is the only implementation of these
types and their converters; nothing else may redeclare them.

Conventions used throughout:

- **Bilingual strings** are `LocalizedText = { en: string; es: string }`. Every
  string a user can read is localized. Machine strings (slugs, ids, urls) are not.
- **Timestamps** are stored as Firestore `Timestamp` and surfaced to application
  code as JS `Date` by the converters. Never read a raw timestamp outside a converter.
- **Denormalization is deliberate.** Offers, jobs and feed entries carry a
  `BusinessRef` snapshot of the parent business so a list renders from one query.
  `functions/src/denormalize.ts` is responsible for keeping those copies fresh;
  application code must never join to fix them up at read time.
- **Money** is integer cents plus a currency code. Default `CAD`.
- **Dates without a time** (feed days, offer day-parting) are `YYYY-MM-DD` strings
  in `America/Toronto`. ISO-8601 sorts lexicographically, so range queries work.

## Collections

| Path | Read | Write | Notes |
| --- | --- | --- | --- |
| `businesses/{businessId}` | public | owner (claim `businessId`) | Directory record |
| `offers/{offerId}` | public | owner of `businessId` | Time-boxed deal |
| `jobs/{jobId}` | public | owner of `businessId` | Job posting |
| `feedDays/{YYYY-MM-DD}` | public | functions only | Precomputed daily feed |
| `clickouts/{clickoutId}` | none | functions only | Outbound-link analytics |
| `redemptions/{redemptionId}` | issuing user | functions only | Offer redemption |
| `subscriptions/{businessId}` | owner | functions only | Billing state |
| `users/{uid}` | self | self (restricted fields) | Prefs, push state |

---

### `businesses/{businessId}`

The directory record. `slug` is unique across the collection and is the public
URL segment (`/en/business/tommys-diner`).

| Field | Type | Notes |
| --- | --- | --- |
| `slug` | `string` | Unique, lowercase, `[a-z0-9-]`. Never reused. |
| `tier` | `'stub' \| 'claimed' \| 'plus' \| 'premium'` | `stub` = imported, unclaimed. |
| `status` | `'draft' \| 'published' \| 'hidden'` | Only `published` is publicly listed. |
| `name` | `string` | Legal/trading name. Not localized. |
| `sortName` | `string` | Lowercased, article-stripped, for `orderBy`. |
| `category` | `BusinessCategory` | Primary category, drives the feed. |
| `categories` | `BusinessCategory[]` | Includes `category`. `array-contains` queries. |
| `shortDescription` | `LocalizedText` | ≤160 chars. Cards and meta description. |
| `description` | `LocalizedText` | Long form. Detail page only. |
| `address` | `Address` | `province` defaults `ON`, `country` `CA`. |
| `geo` | `GeoPointLike \| null` | `{ lat, lng }`. Plain object, not `GeoPoint`. |
| `phone` | `string \| null` | E.164 (`+15195551234`). |
| `email` | `string \| null` | Public contact, not the owner login. |
| `websiteUrl` | `string \| null` | **The link-out target.** Ordering lives here, not in the app. |
| `socials` | `Socials` | `facebook`/`instagram`/`x`/`tiktok`, each nullable. |
| `hours` | `WeekHours \| null` | Per weekday intervals, `America/Toronto`. |
| `logoUrl` / `heroUrl` | `string \| null` | Storage download URLs. |
| `photos` | `string[]` | Ordered gallery. |
| `tags` | `string[]` | Free-form facets (`patio`, `halal`, `bilingual-staff`). |
| `counts` | `{ offers: number; jobs: number }` | Maintained by functions. Avoids count queries. |
| `rank` | `number` | Feed sort weight. Higher first. Tier-derived. |
| `claimedAt` | `Date \| null` | Set when an owner claim is approved. |
| `source` | `'seed' \| 'owner' \| 'admin'` | Provenance of the record. |
| `createdAt` / `updatedAt` | `Date` | Server timestamps. |

### `offers/{offerId}`

| Field | Type | Notes |
| --- | --- | --- |
| `businessId` | `string` | Parent. |
| `business` | `BusinessRef` | Denormalized `{ id, slug, name, category, logoUrl, websiteUrl }`. |
| `title` / `description` / `terms` | `LocalizedText` | `terms` may be empty strings. |
| `kind` | `'percent' \| 'amount' \| 'bogo' \| 'freebie' \| 'other'` | |
| `percentOff` | `number \| null` | Set when `kind === 'percent'`. |
| `amountOff` | `Money \| null` | Set when `kind === 'amount'`. |
| `channel` | `'in_store' \| 'online' \| 'both'` | |
| `code` | `string \| null` | Shown after redemption is issued. |
| `imageUrl` | `string \| null` | |
| `startsAt` / `endsAt` | `Date` | `endsAt` drives expiry queries. |
| `daysOfWeek` | `number[]` | `0`=Sunday. Empty = every day. |
| `status` | `'draft' \| 'published' \| 'expired' \| 'archived'` | |
| `redemptionLimit` | `number \| null` | Total across all users. `null` = unlimited. |
| `redemptionCount` | `number` | Functions only. |
| `perUserLimit` | `number` | Default `1`. |
| `featured` | `boolean` | Eligible for feed hero slot. |
| `createdAt` / `updatedAt` | `Date` | |

### `jobs/{jobId}`

| Field | Type | Notes |
| --- | --- | --- |
| `businessId`, `business` | as above | |
| `title` / `description` | `LocalizedText` | |
| `employmentType` | `'full_time' \| 'part_time' \| 'seasonal' \| 'contract' \| 'temporary'` | Seasonal matters here — greenhouse/agri work. |
| `workplace` | `'onsite' \| 'hybrid' \| 'remote'` | |
| `compensation` | `Compensation \| null` | `{ min, max, currency, period }`, cents. |
| `applyUrl` / `applyEmail` | `string \| null` | At least one required to publish. |
| `postedAt` / `expiresAt` | `Date` | |
| `status` | `'draft' \| 'published' \| 'expired' \| 'archived'` | |
| `createdAt` / `updatedAt` | `Date` | |

### `feedDays/{YYYY-MM-DD}`

One document per calendar day, written by a scheduled function. **The feed is a
single document read.** It carries fully rendered bilingual cards so the phone
never fans out into per-item lookups.

| Field | Type | Notes |
| --- | --- | --- |
| `date` | `string` | `YYYY-MM-DD`, equals the doc id. |
| `timeZone` | `string` | `America/Toronto`. |
| `generatedAt` | `Date` | |
| `items` | `FeedItem[]` | Ordered, capped at 60. |
| `heroItemId` | `string \| null` | Id of the item to render large. |
| `pushSentAt` | `Date \| null` | Guards the one-push-per-day rule. |

`FeedItem`: `{ id, type: 'offer' | 'job' | 'business', refId, businessId, rank,
title: LocalizedText, subtitle: LocalizedText, imageUrl, href, endsAt }`.
`href` is an in-app route, never an external URL — outbound links go through a
clickout so they can be counted.

### `clickouts/{clickoutId}`

Append-only, functions only. Never read by clients.

`{ businessId, targetType: 'business' | 'offer' | 'job', targetId,
destinationUrl, uid | null, sessionId, locale, source: 'feed' | 'directory' |
'detail' | 'search' | 'portal', userAgent | null, referrer | null, createdAt }`

### `redemptions/{redemptionId}`

Functions only for writes; a user may read their own.

`{ offerId, businessId, uid, code, state: 'issued' | 'redeemed' | 'expired' |
'void', issuedAt, expiresAt, redeemedAt | null, redeemedBy | null, locale }`

### `subscriptions/{businessId}`

Functions only. Doc id equals the business id.

`{ businessId, tier: 'claimed' | 'plus' | 'premium', status: 'trialing' |
'active' | 'past_due' | 'canceled', provider, providerCustomerId | null,
providerSubscriptionId | null, currentPeriodStart | null, currentPeriodEnd |
null, cancelAtPeriodEnd, createdAt, updatedAt }`

### `users/{uid}`

`{ locale, businessId | null, roles: ('admin' | 'owner')[], push: { token |
null, enabled, lastSentDay | null }, savedBusinessIds, createdAt, updatedAt }`

`push.lastSentDay` is a `YYYY-MM-DD` string and is the enforcement point for
"max one push per user per day". `roles` and `businessId` are mirrors of custom
claims — the claims are authoritative, these copies exist so the portal can
render without decoding a token.

## Indexes

Declared in `firestore.indexes.json`:

- `offers`: `status` + `endsAt` (asc) — live offers.
- `offers`: `businessId` + `status` + `endsAt` — owner portal.
- `offers`: `status` + `featured` + `rank` — feed candidates.
- `jobs`: `status` + `postedAt` (desc) — job board.
- `jobs`: `businessId` + `status` + `postedAt` — owner portal.
- `businesses`: `status` + `category` + `rank` — directory browse.
- `businesses`: `status` + `categories` (array) + `sortName` — faceted browse.
- `redemptions`: `uid` + `issuedAt` (desc) — user wallet.
