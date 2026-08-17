import { useEffect, useState } from 'react';
import {
  openStateAt,
  toLocalTimeParts,
  translate,
  type Locale,
  type WeekHours,
} from '@leamington/shared';

interface Props {
  locale: Locale;
  businesses: number;
  offers: number;
  jobs: number;
  /** Hours for every listed business, so "open now" is counted on the client. */
  hours: (WeekHours | null)[];
}

/**
 * The hero's live counters.
 *
 * Three of the four numbers are known at build time and rendered immediately.
 * The fourth — how many places are open right now — cannot be, so it counts up
 * on mount. That single moving number is what makes the page feel like it is
 * describing the town today rather than whenever it was last deployed.
 */
export default function LiveStats({ locale, businesses, offers, jobs, hours }: Props) {
  const [openNow, setOpenNow] = useState<number | null>(null);

  useEffect(() => {
    function count(): void {
      const { weekday, minutes } = toLocalTimeParts();
      setOpenNow(
        hours.reduce(
          (total, week) => total + (openStateAt(week, weekday, minutes).open ? 1 : 0),
          0,
        ),
      );
    }
    count();
    const timer = window.setInterval(count, 60_000);
    return () => window.clearInterval(timer);
  }, [hours]);

  const stats: { value: string; label: string; live?: boolean }[] = [
    { value: String(businesses), label: translate(locale, 'home.statBusinesses') },
    {
      value: openNow === null ? '—' : String(openNow),
      label: translate(locale, 'home.statOpenNow'),
      live: true,
    },
    { value: String(offers), label: translate(locale, 'home.statOffers') },
    { value: String(jobs), label: translate(locale, 'home.statJobs') },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm"
        >
          <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/70">
            {stat.live && <span className="dot-open" />}
            {stat.label}
          </dt>
          <dd className="mt-0.5 text-2xl font-extrabold tabular-nums text-white">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
