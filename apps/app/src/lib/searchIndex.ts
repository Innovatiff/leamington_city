/**
 * Shape of the prebuilt static search index.
 *
 * Generated at build time by `src/pages/search-index.json.ts` and fetched once
 * by the search island. Keys are short and descriptions are truncated because
 * this file is downloaded in full over a phone connection before the first
 * keystroke can be answered — every field here is paid for by every searcher.
 */

import type { BusinessCategory, WeekHours } from '@leamington/shared';

export interface SearchEntry {
  /** Business slug. */
  s: string;
  /** Category enum value — the island localizes it for display. */
  c: BusinessCategory;
  /** Category URL segment, so the island can build a href without a lookup. */
  cs: string;
  /** Name. Not localized. */
  n: string;
  /** Short description, per locale, truncated. */
  d: { en: string; es: string };
  /** Street line, searchable and shown as the card's second line. */
  a: string;
  /** Tags, already slugified. */
  t: string[];
  /** Opening hours, for the Open Now filter. `null` when unknown. */
  h: WeekHours | null;
  /** Whether the business has a website — drives the card's CTA hint. */
  w: boolean;
  /** Logo URL, or null. */
  l: string | null;
}

export interface SearchIndex {
  generatedAt: string;
  entries: SearchEntry[];
}

/**
 * Lowercased, accent-folded haystack for one entry.
 *
 * Folding matters here: a Spanish-speaking user typing "panaderia" must match
 * "Panadería", and someone typing "cafe" must match "Café".
 */
export function foldForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function haystack(entry: SearchEntry, categoryName: string): string {
  return foldForSearch(
    [
      entry.n,
      entry.a,
      categoryName,
      // The enum value and URL slug alongside the display name, because
      // matching is substring-based and the label is often plural: someone
      // typing "bakery" would otherwise miss a business labelled "Bakeries".
      entry.c.replace(/_/g, ' '),
      entry.cs.replace(/-/g, ' '),
      // Both languages, so a Spanish description is findable from the English
      // page and vice versa — households here read in both.
      entry.d.en,
      entry.d.es,
      entry.t.join(' '),
    ].join(' '),
  );
}
