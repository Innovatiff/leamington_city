/**
 * Open/closed evaluation.
 *
 * Lives here rather than in the app because two very different callers need
 * identical answers: the build, and a React island running on a phone whose
 * clock may be set to any time zone in the world. Everything is computed from
 * a (weekday, minutes-past-midnight) pair expressed in America/Toronto, so the
 * device's own zone never enters into it.
 *
 * Intervals where `close <= open` are treated as spanning midnight — a kitchen
 * open 22:00–02:00 is one interval, not two.
 */

import type { HoursInterval, WeekHours } from './types/common.js';

export interface OpenState {
  open: boolean;
  /**
   * When open: minutes-past-midnight *of the current day* at which it closes.
   * Values above 1440 mean the closing time falls after midnight.
   */
  closesAt: number | null;
  /** When closed: the next weekday it opens (0 = Sunday), or `null` if never. */
  opensWeekday: number | null;
  /** When closed: minutes-past-midnight of that next opening. */
  opensAt: number | null;
  /** True when no hours are recorded at all, so the UI can stay silent. */
  unknown: boolean;
}

const MINUTES_PER_DAY = 1440;

function normalizeDay(day: number): number {
  return ((day % 7) + 7) % 7;
}

function intervalsFor(hours: WeekHours, day: number): HoursInterval[] {
  return hours[normalizeDay(day)] ?? [];
}

function hasAnyHours(hours: WeekHours): boolean {
  return hours.some((day) => day.length > 0);
}

/** Does `interval`, starting on its own day, cover midnight? */
function spansMidnight(interval: HoursInterval): boolean {
  return interval.close <= interval.open;
}

/**
 * Evaluates the schedule at a given local weekday and minute.
 *
 * `weekday` is 0 = Sunday, matching `Offer.daysOfWeek` and `WeekHours`.
 */
export function openStateAt(
  hours: WeekHours | null,
  weekday: number,
  minutes: number,
): OpenState {
  if (!hours || !hasAnyHours(hours)) {
    return { open: false, closesAt: null, opensWeekday: null, opensAt: null, unknown: true };
  }

  const day = normalizeDay(weekday);

  // Currently inside one of today's intervals?
  for (const interval of intervalsFor(hours, day)) {
    if (spansMidnight(interval)) {
      if (minutes >= interval.open) {
        return {
          open: true,
          closesAt: interval.close + MINUTES_PER_DAY,
          opensWeekday: null,
          opensAt: null,
          unknown: false,
        };
      }
    } else if (minutes >= interval.open && minutes < interval.close) {
      return {
        open: true,
        closesAt: interval.close,
        opensWeekday: null,
        opensAt: null,
        unknown: false,
      };
    }
  }

  // Still inside an interval that started yesterday and ran past midnight.
  for (const interval of intervalsFor(hours, day - 1)) {
    if (spansMidnight(interval) && minutes < interval.close) {
      return {
        open: true,
        closesAt: interval.close,
        opensWeekday: null,
        opensAt: null,
        unknown: false,
      };
    }
  }

  // Closed. Find the next opening within a week.
  for (let offset = 0; offset < 8; offset += 1) {
    const candidateDay = normalizeDay(day + offset);
    const earliest = intervalsFor(hours, candidateDay)
      .filter((interval) => offset > 0 || interval.open > minutes)
      .reduce<number | null>(
        (best, interval) => (best === null || interval.open < best ? interval.open : best),
        null,
      );

    if (earliest !== null) {
      return {
        open: false,
        closesAt: null,
        opensWeekday: candidateDay,
        opensAt: earliest,
        unknown: false,
      };
    }
  }

  return { open: false, closesAt: null, opensWeekday: null, opensAt: null, unknown: false };
}

/** True when the schedule has at least one interval covering the given moment. */
export function isOpenAt(
  hours: WeekHours | null,
  weekday: number,
  minutes: number,
): boolean {
  return openStateAt(hours, weekday, minutes).open;
}
