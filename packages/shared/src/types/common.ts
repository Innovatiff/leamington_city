/**
 * Primitives shared by every collection. See SCHEMA.md.
 */

export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Every user-facing string is bilingual. Non-negotiable. */
export interface LocalizedText {
  en: string;
  es: string;
}

/** The app's canonical time zone. Feed days and hours are expressed in it. */
export const TIME_ZONE = 'America/Toronto';

/** `YYYY-MM-DD` in {@link TIME_ZONE}. Sorts lexicographically. */
export type DayKey = string;

export type CurrencyCode = 'CAD' | 'USD';
export const DEFAULT_CURRENCY: CurrencyCode = 'CAD';

/** Integer minor units (cents) plus currency. Never a float. */
export interface Money {
  amount: number;
  currency: CurrencyCode;
}

/** Plain lat/lng. Stored as a map, not a Firestore GeoPoint, so it survives JSON. */
export interface GeoPointLike {
  lat: number;
  lng: number;
}

export interface Address {
  line1: string;
  line2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export interface Socials {
  facebook: string | null;
  instagram: string | null;
  x: string | null;
  tiktok: string | null;
}

/** Minutes past local midnight, e.g. `{ open: 540, close: 1020 }` is 09:00–17:00. */
export interface HoursInterval {
  open: number;
  close: number;
}

/** Index 0 is Sunday. An empty array means closed that day. */
export type WeekHours = [
  HoursInterval[],
  HoursInterval[],
  HoursInterval[],
  HoursInterval[],
  HoursInterval[],
  HoursInterval[],
  HoursInterval[],
];

export const BUSINESS_CATEGORIES = [
  'restaurant',
  'cafe',
  'bakery',
  'grocery',
  'retail',
  'beauty',
  'health',
  'automotive',
  'home_services',
  'professional',
  'agriculture',
  'recreation',
  'lodging',
  'nonprofit',
  'other',
] as const;
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

export type PublishStatus = 'draft' | 'published' | 'expired' | 'archived';

/**
 * Denormalized parent-business snapshot embedded in offers, jobs and feed items
 * so a list renders from a single query. Kept fresh by
 * `functions/src/denormalize.ts` — never repaired at read time.
 */
export interface BusinessRef {
  id: string;
  slug: string;
  name: string;
  category: BusinessCategory;
  logoUrl: string | null;
  websiteUrl: string | null;
}

/** Model shape minus the synthetic document id. What you pass to `set()`. */
export type WithoutId<T extends { id: string }> = Omit<T, 'id'>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function isBusinessCategory(value: unknown): value is BusinessCategory {
  return (
    typeof value === 'string' && (BUSINESS_CATEGORIES as readonly string[]).includes(value)
  );
}
