/**
 * Prebuilt static search index.
 *
 * Emitted once at build time and served as a plain file, so the search box
 * costs zero Firestore reads no matter how much it is used. Both locales live
 * in one document because the alternative — two files — would double the
 * cache footprint to save a few kilobytes on a dataset this size.
 */

import type { APIRoute } from 'astro';
import { categorySlug, truncate, pick } from '@leamington/shared';
import { getBusinesses } from '../lib/content';
import type { SearchEntry, SearchIndex } from '../lib/searchIndex';

/** Descriptions here are for disambiguation in a list, not for reading. */
const SUMMARY_LENGTH = 90;

export const GET: APIRoute = async () => {
  const businesses = await getBusinesses();

  const entries: SearchEntry[] = businesses.map((business) => ({
    s: business.slug,
    c: business.category,
    cs: categorySlug(business.category),
    n: business.name,
    d: {
      en: truncate(pick(business.shortDescription, 'en'), SUMMARY_LENGTH),
      es: truncate(pick(business.shortDescription, 'es'), SUMMARY_LENGTH),
    },
    a: business.address.line1,
    t: business.tags,
    h: business.hours,
    w: Boolean(business.websiteUrl),
    l: business.logoUrl,
  }));

  const index: SearchIndex = {
    generatedAt: new Date().toISOString(),
    entries,
  };

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Rebuilt on every deploy, and a deploy is what a data change triggers,
      // so it may be cached hard between them.
      'Cache-Control': 'public, max-age=0, s-maxage=3600, must-revalidate',
    },
  });
};
