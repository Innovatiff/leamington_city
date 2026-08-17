/**
 * Decoders for the composite value objects in SCHEMA.md.
 */

import type {
  Address,
  BusinessCategory,
  CurrencyCode,
  GeoPointLike,
  HoursInterval,
  LocalizedText,
  Money,
  Socials,
  WeekHours,
} from '../types/common.js';
import { BUSINESS_CATEGORIES, DEFAULT_CURRENCY } from '../types/common.js';
import type { BusinessRef } from '../types/common.js';
import {
  toEnum,
  toMap,
  toNumber,
  toStringOrNull,
  toStringValue,
  type DocumentDataLike,
} from './converter.js';

export function localizedText(value: unknown): LocalizedText {
  const map = toMap(value);
  const en = toStringValue(map['en']);
  // A missing Spanish string falls back to English rather than rendering blank.
  // Untranslated is bad; empty is worse.
  return { en, es: toStringValue(map['es'], en) };
}

export function emptyLocalizedText(): LocalizedText {
  return { en: '', es: '' };
}

export function address(value: unknown): Address {
  const map = toMap(value);
  return {
    line1: toStringValue(map['line1']),
    line2: toStringOrNull(map['line2']),
    city: toStringValue(map['city'], 'Leamington'),
    province: toStringValue(map['province'], 'ON'),
    postalCode: toStringValue(map['postalCode']),
    country: toStringValue(map['country'], 'CA'),
  };
}

export function geoPoint(value: unknown): GeoPointLike | null {
  if (value === null || value === undefined) return null;
  // A GeoPoint instance from either SDK exposes latitude/longitude getters.
  const candidate = value as { latitude?: unknown; longitude?: unknown };
  if (typeof candidate.latitude === 'number' && typeof candidate.longitude === 'number') {
    return { lat: candidate.latitude, lng: candidate.longitude };
  }
  const map = toMap(value);
  if (typeof map['lat'] === 'number' && typeof map['lng'] === 'number') {
    return { lat: map['lat'], lng: map['lng'] };
  }
  return null;
}

export function socials(value: unknown): Socials {
  const map = toMap(value);
  return {
    facebook: toStringOrNull(map['facebook']),
    instagram: toStringOrNull(map['instagram']),
    x: toStringOrNull(map['x']),
    tiktok: toStringOrNull(map['tiktok']),
  };
}

function hoursInterval(value: unknown): HoursInterval | null {
  const map = toMap(value);
  const open = map['open'];
  const close = map['close'];
  if (typeof open !== 'number' || typeof close !== 'number') return null;
  return { open, close };
}

/**
 * Decodes opening hours.
 *
 * The model is a 7-tuple of interval arrays, but Firestore **forbids nested
 * arrays**, so the wire format is a map keyed by weekday: `{ '0': [...], ... }`.
 * The array form is still accepted on read because it is what a JSON export or
 * a hand-written fixture naturally looks like.
 */
export function weekHours(value: unknown): WeekHours | null {
  const readDay = (day: unknown): HoursInterval[] =>
    Array.isArray(day)
      ? day.map(hoursInterval).filter((entry): entry is HoursInterval => entry !== null)
      : [];

  if (Array.isArray(value)) {
    if (value.length !== 7) return null;
    return value.map(readDay) as WeekHours;
  }

  if (typeof value === 'object' && value !== null) {
    const map = toMap(value);
    // A map with none of the seven keys is not an hours map, it is noise.
    if (!Object.keys(map).some((key) => /^[0-6]$/.test(key))) return null;
    return Array.from({ length: 7 }, (_unused, day) => readDay(map[String(day)])) as WeekHours;
  }

  return null;
}

/** Encodes to the map form Firestore accepts. See {@link weekHours}. */
export function encodeWeekHours(hours: WeekHours): DocumentDataLike {
  const encoded: DocumentDataLike = {};
  hours.forEach((intervals, day) => {
    encoded[String(day)] = intervals.map((interval) => ({
      open: interval.open,
      close: interval.close,
    }));
  });
  return encoded;
}

export function money(value: unknown): Money | null {
  if (value === null || value === undefined) return null;
  const map = toMap(value);
  if (typeof map['amount'] !== 'number') return null;
  return {
    amount: map['amount'],
    currency: toEnum<CurrencyCode>(map['currency'], ['CAD', 'USD'], DEFAULT_CURRENCY),
  };
}

export function category(value: unknown): BusinessCategory {
  return toEnum<BusinessCategory>(value, BUSINESS_CATEGORIES, 'other');
}

export function categories(value: unknown, primary: BusinessCategory): BusinessCategory[] {
  const list = Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string')
        .filter((entry): entry is BusinessCategory =>
          (BUSINESS_CATEGORIES as readonly string[]).includes(entry),
        )
    : [];
  // The primary category is always a member — `array-contains` browse depends on it.
  return list.includes(primary) ? list : [primary, ...list];
}

export function businessRef(value: unknown): BusinessRef {
  const map = toMap(value);
  return {
    id: toStringValue(map['id']),
    slug: toStringValue(map['slug']),
    name: toStringValue(map['name']),
    category: category(map['category']),
    logoUrl: toStringOrNull(map['logoUrl']),
    websiteUrl: toStringOrNull(map['websiteUrl']),
  };
}

export function encodeBusinessRef(ref: BusinessRef): DocumentDataLike {
  return {
    id: ref.id,
    slug: ref.slug,
    name: ref.name,
    category: ref.category,
    logoUrl: ref.logoUrl,
    websiteUrl: ref.websiteUrl,
  };
}
