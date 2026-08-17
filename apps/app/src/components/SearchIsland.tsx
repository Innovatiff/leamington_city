import { useEffect, useMemo, useState } from 'react';
import {
  BUSINESS_CATEGORIES,
  categoryMessageKey,
  localizedPath,
  openStateAt,
  toLocalTimeParts,
  translate,
  type BusinessCategory,
  type Locale,
} from '@leamington/shared';
import { foldForSearch, haystack, type SearchEntry, type SearchIndex } from '../lib/searchIndex';

interface Props {
  locale: Locale;
  indexUrl: string;
}

/**
 * Client-side search over the prebuilt static index.
 *
 * The index is one small JSON file generated at build time, so searching costs
 * no Firestore reads at all — which is the point: a directory whose search box
 * billed per keystroke would be the most expensive page on the site.
 */
export default function SearchIsland({ locale, indexUrl }: Props) {
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
    translate(locale, key, params);

  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<BusinessCategory | 'all'>('all');
  const [openOnly, setOpenOnly] = useState(false);
  const [now, setNow] = useState(() => toLocalTimeParts());

  useEffect(() => {
    let cancelled = false;
    fetch(indexUrl)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<SearchIndex>;
      })
      .then((index) => !cancelled && setEntries(index.entries))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [indexUrl]);

  // Keeps "Open now" honest if the tab is left open across a closing time.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(toLocalTimeParts()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Category labels are needed both for the picker and to make the category
  // name searchable ("bakery" should find a bakery).
  const categoryNames = useMemo(() => {
    const names = new Map<BusinessCategory, string>();
    for (const value of BUSINESS_CATEGORIES) {
      names.set(value, t(categoryMessageKey(value)));
    }
    return names;
  }, [locale]);

  const haystacks = useMemo(() => {
    if (!entries) return new Map<string, string>();
    const built = new Map<string, string>();
    for (const entry of entries) {
      built.set(entry.s, haystack(entry, categoryNames.get(entry.c) ?? ''));
    }
    return built;
  }, [entries, categoryNames]);

  const results = useMemo(() => {
    if (!entries) return [];
    const needle = foldForSearch(query.trim());
    const terms = needle.split(/\s+/).filter(Boolean);

    return entries.filter((entry) => {
      if (category !== 'all' && entry.c !== category) return false;
      if (openOnly && !openStateAt(entry.h, now.weekday, now.minutes).open) return false;
      if (terms.length === 0) return true;
      const target = haystacks.get(entry.s) ?? '';
      // Every term must appear — narrowing as you type is what people expect.
      return terms.every((term) => target.includes(term));
    });
  }, [entries, query, category, openOnly, now, haystacks]);

  const availableCategories = useMemo(() => {
    if (!entries) return [];
    const present = new Set(entries.map((entry) => entry.c));
    return BUSINESS_CATEGORIES.filter((value) => present.has(value));
  }, [entries]);

  return (
    <div>
      <div className="sticky top-14 z-30 -mx-4 border-b border-neutral-200 bg-white px-4 pb-3 pt-1">
        <label htmlFor="q" className="sr-only">
          {t('search.title')}
        </label>
        <div className="flex items-center gap-2">
          <input
            id="q"
            type="search"
            inputMode="search"
            autoComplete="off"
            enterKeyHint="search"
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-neutral-300 px-3 py-2
              text-base focus:border-brand-600 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="shrink-0 px-2 text-sm font-semibold text-neutral-600"
            >
              {t('search.clear')}
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            aria-pressed={openOnly}
            onClick={() => setOpenOnly((value) => !value)}
            className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-semibold ${
              openOnly
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-neutral-300 bg-white text-neutral-700'
            }`}
          >
            {t('filter.openNow')}
          </button>

          <label htmlFor="cat" className="sr-only">
            {t('filter.allCategories')}
          </label>
          <select
            id="cat"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as BusinessCategory | 'all')
            }
            className="min-h-[44px] shrink-0 rounded-full border border-neutral-300 bg-white
              px-3 text-sm font-semibold text-neutral-700"
          >
            <option value="all">{t('filter.allCategories')}</option>
            {availableCategories.map((value) => (
              <option key={value} value={value}>
                {categoryNames.get(value)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4" aria-live="polite">
        {failed && <p className="text-neutral-600">{t('common.error')}</p>}
        {!entries && !failed && <p className="text-neutral-600">{t('search.loading')}</p>}

        {entries && (
          <p className="text-sm text-neutral-600">
            {results.length === 1
              ? t('search.oneResult')
              : t('search.resultCount', { count: results.length })}
          </p>
        )}

        {entries && results.length === 0 && query.trim() && (
          <p className="mt-6 text-neutral-600">{t('search.noResults', { query })}</p>
        )}

        <ul className="mt-3 space-y-2">
          {results.map((entry) => (
            <li key={entry.s}>
              <a
                href={localizedPath(locale, `/${entry.cs}/${entry.s}`)}
                className="card flex items-center gap-3"
              >
                {entry.l && (
                  <img
                    src={entry.l}
                    alt=""
                    width="40"
                    height="40"
                    loading="lazy"
                    decoding="async"
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-900">{entry.n}</p>
                  <p className="truncate text-sm text-neutral-600">
                    {entry.d[locale] || entry.a || categoryNames.get(entry.c)}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
