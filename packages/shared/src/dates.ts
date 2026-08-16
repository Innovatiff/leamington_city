/**
 * Day-key helpers. Everything user-facing happens in America/Toronto, which is
 * UTC-5 or UTC-4 depending on the date — so day keys are always derived through
 * `Intl`, never by slicing an ISO string.
 */

import { TIME_ZONE, type DayKey } from './types/common.js';

const DAY_KEY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  weekday: 'short',
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** `YYYY-MM-DD` for `instant` as observed in Leamington. */
export function toDayKey(instant: Date = new Date()): DayKey {
  // en-CA formats as YYYY-MM-DD natively.
  return DAY_KEY_FORMATTER.format(instant);
}

/** `0` = Sunday, matching `Offer.daysOfWeek`. */
export function toWeekday(instant: Date = new Date()): number {
  return WEEKDAY_INDEX[WEEKDAY_FORMATTER.format(instant)] ?? 0;
}

export function addDays(dayKey: DayKey, days: number): DayKey {
  const [year, month, day] = dayKey.split('-').map(Number);
  // Noon UTC keeps the arithmetic clear of both DST transitions.
  const base = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function isValidDayKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
