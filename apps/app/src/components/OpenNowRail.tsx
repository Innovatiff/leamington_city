import { useEffect, useMemo, useState } from 'react';
import {
  formatTimeOfDay,
  openStateAt,
  toLocalTimeParts,
  translate,
  type Locale,
  type WeekHours,
} from '@leamington/shared';

export interface RailItem {
  slug: string;
  name: string;
  href: string;
  cover: string;
  /** Local artwork to swap in if `cover` fails to load. */
  fallback: string;
  category: string;
  hours: WeekHours | null;
}

interface Props {
  locale: Locale;
  items: RailItem[];
  limit?: number;
}

/**
 * "Open right now" rail.
 *
 * This one section genuinely cannot be server-rendered: which doors are open
 * changes by the minute, and the page it lives on is a static file cached for
 * hours. So it renders a skeleton, then fills in on mount — and re-sorts as the
 * day moves, putting whatever is closing soonest first.
 */
export default function OpenNowRail({ locale, items, limit = 12 }: Props) {
  const [now, setNow] = useState<{ weekday: number; minutes: number } | null>(null);

  useEffect(() => {
    const tick = (): void => setNow(toLocalTimeParts());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const open = useMemo(() => {
    if (!now) return [];
    return items
      .map((item) => ({ item, state: openStateAt(item.hours, now.weekday, now.minutes) }))
      .filter((entry) => entry.state.open)
      // Closing soonest first: that is the one worth hurrying for.
      .sort((a, b) => (a.state.closesAt ?? 9999) - (b.state.closesAt ?? 9999))
      .slice(0, limit);
  }, [items, now, limit]);

  if (!now) {
    return (
      <ul className="flex gap-3 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 4 }, (_unused, index) => (
          <li key={index} className="w-56 shrink-0">
            <div className="skeleton aspect-[16/10] w-full rounded-[--radius-card]" />
            <div className="skeleton mt-2 h-4 w-3/4" />
            <div className="skeleton mt-1.5 h-3 w-1/2" />
          </li>
        ))}
      </ul>
    );
  }

  if (open.length === 0) {
    return (
      <p className="rounded-2xl bg-ink-50 px-5 py-8 text-center text-ink-600">
        {translate(locale, 'home.noneOpen')}
      </p>
    );
  }

  return (
    <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {open.map(({ item, state }) => (
        <li key={item.slug} className="w-56 shrink-0 snap-start sm:w-64">
          <a href={item.href} className="card card-interactive group block h-full">
            <div className="cover aspect-[16/10]">
              <img
                src={item.cover}
                data-fallback={item.fallback}
                alt=""
                width="320"
                height="200"
                loading="lazy"
                decoding="async"
                className="card-zoom"
              />
              <span className="badge absolute left-2.5 top-2.5 bg-leaf-600 text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                {translate(locale, 'business.openNow')}
              </span>
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-bold text-ink-900">{item.name}</p>
              <p className="mt-0.5 truncate text-xs text-ink-500">
                {state.closesAt !== null
                  ? translate(locale, 'business.closesAt', {
                      time: formatTimeOfDay(state.closesAt % 1440, locale),
                    })
                  : item.category}
              </p>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
