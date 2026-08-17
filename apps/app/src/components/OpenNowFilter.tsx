import { useCallback, useEffect, useState } from 'react';
import {
  openStateAt,
  toLocalTimeParts,
  translate,
  type Locale,
  type WeekHours,
} from '@leamington/shared';

interface Props {
  locale: Locale;
  /** Cards to filter. Each carries its own `data-hours`. */
  selector?: string;
}

/**
 * "Open now" toggle for a statically rendered list.
 *
 * It hides existing DOM nodes rather than rendering the list itself, so the
 * server-generated markup — the part search engines read, and the part that
 * shows up before any JavaScript runs — stays complete. An island that owned
 * the list would render an empty page for crawlers.
 */
export default function OpenNowFilter({ locale, selector = '[data-business-card]' }: Props) {
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState<number | null>(null);

  const apply = useCallback(
    (on: boolean) => {
      const cards = document.querySelectorAll<HTMLElement>(selector);
      if (!on) {
        cards.forEach((card) => card.removeAttribute('hidden'));
        setVisible(null);
        return;
      }

      const { weekday, minutes } = toLocalTimeParts();
      let shown = 0;

      cards.forEach((card) => {
        let hours: WeekHours | null = null;
        const raw = card.dataset['hours'];
        if (raw) {
          try {
            hours = JSON.parse(raw) as WeekHours;
          } catch {
            // A card with unreadable hours stays visible: hiding a business
            // because of our own bad data is the worse failure.
            hours = null;
          }
        }
        // Unknown hours cannot be shown to be open, so they filter out.
        const open = hours !== null && openStateAt(hours, weekday, minutes).open;
        if (open) {
          card.removeAttribute('hidden');
          shown += 1;
        } else {
          card.setAttribute('hidden', '');
        }
      });

      setVisible(shown);
    },
    [selector],
  );

  // Re-apply on a timer so a page left open does not keep showing a business
  // that closed ten minutes ago.
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => apply(true), 60_000);
    return () => window.clearInterval(timer);
  }, [active, apply]);

  // Leaving the filter on while navigating away must not strand hidden nodes.
  useEffect(() => () => apply(false), [apply]);

  function toggle(): void {
    const next = !active;
    setActive(next);
    apply(next);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-pressed={active}
        onClick={toggle}
        className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold ${
          active
            ? 'border-brand-600 bg-brand-600 text-white'
            : 'border-neutral-300 bg-white text-neutral-700'
        }`}
      >
        {translate(locale, 'filter.openNow')}
      </button>
      {active && visible !== null && (
        <span className="text-sm text-neutral-600" aria-live="polite">
          {visible === 1
            ? translate(locale, 'search.oneResult')
            : translate(locale, 'search.resultCount', { count: visible })}
        </span>
      )}
    </div>
  );
}
