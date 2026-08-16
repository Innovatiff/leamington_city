/**
 * Locale-aware display helpers. Every one of these takes a `Locale` — there is
 * no "default rendering" in a bilingual app.
 */

import type { Locale, LocalizedText, Money } from './types/common.js';
import { DEFAULT_LOCALE, TIME_ZONE } from './types/common.js';
import type { Compensation } from './types/job.js';

/** Maps app locales onto the BCP-47 tags `Intl` expects for this region. */
export const INTL_LOCALES: Record<Locale, string> = {
  en: 'en-CA',
  es: 'es-419',
};

/** Picks a locale's string, falling back to English rather than rendering blank. */
export function pick(text: LocalizedText, locale: Locale): string {
  const value = text[locale];
  return value && value.length > 0 ? value : text[DEFAULT_LOCALE];
}

export function formatMoney(money: Money, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: 'currency',
    currency: money.currency,
  }).format(money.amount / 100);
}

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatTimeOfDay(minutesPastMidnight: number, locale: Locale): string {
  const hours = Math.floor(minutesPastMidnight / 60) % 24;
  const minutes = minutesPastMidnight % 60;
  const reference = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
  }).format(reference);
}

/** `+15195551234` → `(519) 555-1234`. Non-NANP numbers are returned untouched. */
export function formatPhone(e164: string): string {
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (!match) return e164;
  return `(${match[1]}) ${match[2]}-${match[3]}`;
}

/** Best-effort E.164 for Canadian input. Returns `null` if it is not 10/11 digits. */
export function toE164(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/** `N8H 1A1`. Returns the trimmed input when it does not look like a postal code. */
export function formatPostalCode(input: string): string {
  const compact = input.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)
    ? `${compact.slice(0, 3)} ${compact.slice(3)}`
    : input.trim();
}

export function formatCompensation(compensation: Compensation, locale: Locale): string {
  const formatter = new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: 'currency',
    currency: compensation.currency,
    maximumFractionDigits: compensation.period === 'hour' ? 2 : 0,
  });
  const low = formatter.format(compensation.min / 100);
  if (compensation.max <= compensation.min) return low;
  return `${low} – ${formatter.format(compensation.max / 100)}`;
}

/** Truncates on a word boundary. Used for card copy and meta descriptions. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
