import { useEffect, useState } from 'react';
import {
  formatTimeOfDay,
  openStateAt,
  toLocalTimeParts,
  translate,
  INTL_LOCALES,
  type Locale,
  type OpenState,
  type WeekHours,
} from '@leamington/shared';

interface Props {
  hours: WeekHours | null;
  locale: Locale;
  /** Card-sized: the state and nothing else. */
  compact?: boolean;
  className?: string;
}

/**
 * Live open/closed indicator, computed on the client from the hours map.
 *
 * Deliberately not rendered during the build: a statically generated page is
 * cached for hours, and a baked-in "Open now" would be a lie within minutes.
 * The first client render is therefore empty, and the badge appears on mount —
 * which also means the answer is right for a phone whose clock is set to
 * another time zone, because the evaluation happens in America/Toronto.
 */
export default function OpenNowBadge({
  hours,
  locale,
  compact = false,
  className = '',
}: Props) {
  const [state, setState] = useState<OpenState | null>(null);

  useEffect(() => {
    function evaluate(): void {
      const { weekday, minutes } = toLocalTimeParts();
      setState(openStateAt(hours, weekday, minutes));
    }
    evaluate();
    // A minute is enough resolution for "closes at 5" and costs nothing.
    const timer = window.setInterval(evaluate, 60_000);
    return () => window.clearInterval(timer);
  }, [hours]);

  // Reserve the line so the badge appearing does not shift the layout.
  if (!state) {
    return <span className={`block h-5 ${className}`} aria-hidden="true" />;
  }

  if (state.unknown) {
    return (
      <span className={`text-xs font-medium text-ink-500 ${className}`}>
        {translate(locale, 'business.hoursUnknown')}
      </span>
    );
  }

  const weekdayName = (weekday: number): string =>
    new Intl.DateTimeFormat(INTL_LOCALES[locale], { weekday: 'long' }).format(
      // 2024-01-07 was a Sunday, so the index maps straight onto the date.
      new Date(Date.UTC(2024, 0, 7 + weekday)),
    );

  if (state.open) {
    // closesAt can exceed 1440 when the interval runs past midnight.
    const closes =
      state.closesAt !== null ? formatTimeOfDay(state.closesAt % 1440, locale) : null;

    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-semibold text-leaf-700 ${className}`}
      >
        <span className="dot-open" />
        {translate(locale, 'business.openNow')}
        {!compact && closes && (
          <span className="font-medium text-ink-500">
            · {translate(locale, 'business.closesAt', { time: closes })}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 ${className}`}
    >
      <span className="dot-closed" />
      {translate(locale, 'business.closedNow')}
      {!compact && state.opensAt !== null && state.opensWeekday !== null && (
        <span className="font-medium text-ink-400">
          ·{' '}
          {translate(locale, 'business.opensOn', {
            day: weekdayName(state.opensWeekday),
            time: formatTimeOfDay(state.opensAt, locale),
          })}
        </span>
      )}
    </span>
  );
}
