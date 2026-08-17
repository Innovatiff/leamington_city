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
export default function OpenNowBadge({ hours, locale, className = '' }: Props) {
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
  if (!state) return <p className={`h-6 ${className}`} aria-hidden="true" />;

  if (state.unknown) {
    return (
      <p className={`text-sm text-neutral-500 ${className}`}>
        {translate(locale, 'business.hoursUnknown')}
      </p>
    );
  }

  const weekdayName = (weekday: number): string =>
    new Intl.DateTimeFormat(INTL_LOCALES[locale], { weekday: 'long' }).format(
      // 2024-01-07 was a Sunday, so the index maps straight onto the date.
      new Date(Date.UTC(2024, 0, 7 + weekday)),
    );

  if (state.open) {
    return (
      <p className={`text-sm font-semibold text-green-700 ${className}`}>
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green-600" />
        {translate(locale, 'business.openNow')}
        {state.closesAt !== null && (
          <span className="ml-1 font-normal text-neutral-600">
            ·{' '}
            {translate(locale, 'business.closesAt', {
              // closesAt can exceed 1440 when the interval runs past midnight.
              time: formatTimeOfDay(state.closesAt % 1440, locale),
            })}
          </span>
        )}
      </p>
    );
  }

  return (
    <p className={`text-sm font-semibold text-neutral-700 ${className}`}>
      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-neutral-400" />
      {translate(locale, 'business.closedNow')}
      {state.opensAt !== null && state.opensWeekday !== null && (
        <span className="ml-1 font-normal text-neutral-600">
          ·{' '}
          {translate(locale, 'business.opensOn', {
            day: weekdayName(state.opensWeekday),
            time: formatTimeOfDay(state.opensAt, locale),
          })}
        </span>
      )}
    </p>
  );
}
