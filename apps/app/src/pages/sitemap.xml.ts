/**
 * Sitemap with per-URL hreflang alternates.
 *
 * Hand-rolled rather than added as an integration: `@astrojs/sitemap` does not
 * emit `xhtml:link` alternates per entry, and a bilingual site that does not
 * declare its language pairs gets one of the two indexed and not the other.
 */

import type { APIRoute } from 'astro';
import {
  BUSINESS_CATEGORIES,
  LOCALES,
  localizedPath,
  type Locale,
} from '@leamington/shared';
import { getBusinesses, getLiveOffers, getOpenJobs } from '../lib/content';
import { businessPathBare, categoryPathBare, ROUTES } from '../lib/routes';
import { SITE_URL } from '../lib/site';

interface Entry {
  path: string;
  lastmod: Date;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function urlEntry(site: string, entry: Entry, locale: Locale): string {
  const loc = new URL(localizedPath(locale, entry.path), site).toString();
  const alternates = LOCALES.map((other) => {
    const href = new URL(localizedPath(other, entry.path), site).toString();
    return `    <xhtml:link rel="alternate" hreflang="${other}" href="${escapeXml(href)}"/>`;
  }).join('\n');
  const xDefault = new URL(localizedPath('en', entry.path), site).toString();

  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${entry.lastmod.toISOString()}</lastmod>`,
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    alternates,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(xDefault)}"/>`,
    '  </url>',
  ].join('\n');
}

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.toString() ?? SITE_URL;
  const now = new Date();

  const [businesses, offers, jobs] = await Promise.all([
    getBusinesses(),
    getLiveOffers(),
    getOpenJobs(),
  ]);

  const populatedCategories = new Set(businesses.map((business) => business.category));

  const entries: Entry[] = [
    { path: ROUTES.home, lastmod: now, changefreq: 'daily', priority: '1.0' },
    { path: ROUTES.offers, lastmod: now, changefreq: 'daily', priority: '0.9' },
    { path: ROUTES.jobs, lastmod: now, changefreq: 'daily', priority: '0.8' },
    { path: ROUTES.directory, lastmod: now, changefreq: 'weekly', priority: '0.8' },

    // Category indexes — only the ones that were actually generated.
    ...BUSINESS_CATEGORIES.filter((category) => populatedCategories.has(category)).map(
      (category): Entry => ({
        path: categoryPathBare(category),
        lastmod: now,
        changefreq: 'weekly',
        priority: '0.7',
      }),
    ),

    ...businesses.map(
      (business): Entry => ({
        path: businessPathBare(business),
        lastmod: business.updatedAt,
        changefreq: 'weekly',
        // A claimed listing is richer and worth more crawl budget than a stub.
        priority: business.tier === 'stub' ? '0.4' : '0.7',
      }),
    ),
  ];

  // Offers and jobs live on pages already listed above; they only move lastmod.
  const freshest = [...offers, ...jobs].reduce(
    (latest, item) => (item.updatedAt > latest ? item.updatedAt : latest),
    new Date(0),
  );
  if (freshest.getTime() > 0) {
    for (const entry of entries) {
      if (entry.path === ROUTES.offers || entry.path === ROUTES.jobs) {
        entry.lastmod = freshest;
      }
    }
  }

  // `/search` is deliberately absent: it is noindex.
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries.flatMap((entry) => LOCALES.map((locale) => urlEntry(origin, entry, locale))),
    '</urlset>',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
