# Leamington App

## Non-negotiables
- This app does NOT contain ordering, menus, or kitchen panels. Those live on
  the individual client websites. The app links out via websiteUrl.
- Every user-facing string is bilingual EN/ES from packages/shared/i18n.
- Mobile-first. A 5-inch phone on a bad connection.
- Firestore reads cost money. Denormalize read paths. Never N+1 the feed.
- Public pages are SEO-critical: static generation, JSON-LD, hreflang, always.
- Max one push notification per user per day.

## Conventions
- TypeScript strict. Types and converters in packages/shared only.
- Cloud Functions for anything writing /clickouts, /redemptions, /subscriptions.
- Owner-facing UI assumes low technical literacy.

## Do not
- Add features outside the current phase.
- Add dependencies without asking.

## Layout
- `apps/app` — Astro 5 public site (static, React islands, Tailwind).
- `apps/portal` — Vite + React business-owner portal.
- `apps/admin` — Vite + React internal admin.
- `packages/shared` — types, Firestore converters, i18n. The only place types live.
- `functions` — Firebase Functions 2nd gen (TypeScript).
- `scripts` — operational scripts (`seed.ts`).

Locale of record: Leamington, Ontario, Canada (`America/Toronto`, CAD, en/es).
