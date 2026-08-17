/**
 * Every public URL in one place.
 *
 * English is unprefixed, Spanish sits under `/es/`. Business pages are
 * `/{categorySlug}/{businessSlug}`, so a business's URL depends on its
 * category — which means nothing may hand-build one from a slug alone.
 */

import {
  categorySlug,
  localizedPath,
  type Business,
  type BusinessCategory,
  type BusinessRef,
  type Locale,
} from '@leamington/shared';

/** Enough of a business to address it. Works for full docs and denormalized refs. */
export type Addressable = Pick<Business | BusinessRef, 'slug' | 'category'>;

export function businessPath(business: Addressable, locale: Locale): string {
  return localizedPath(locale, `/${categorySlug(business.category)}/${business.slug}`);
}

/** Path relative to the locale root — what `Base.astro` wants for hreflang. */
export function businessPathBare(business: Addressable): string {
  return `/${categorySlug(business.category)}/${business.slug}`;
}

export function categoryPath(category: BusinessCategory, locale: Locale): string {
  return localizedPath(locale, `/${categorySlug(category)}`);
}

export function categoryPathBare(category: BusinessCategory): string {
  return `/${categorySlug(category)}`;
}

export const ROUTES = {
  home: '/',
  offers: '/offers',
  jobs: '/jobs',
  directory: '/businesses',
  search: '/search',
  /** Static JSON consumed by the search island. Not locale-specific. */
  searchIndex: '/search-index.json',
  /** The owner portal is a separate app on its own host. */
  portal: 'https://portal.leamington.city',
} as const;

/** Where a "claim this listing" button points, for a given business. */
export function claimUrl(businessId: string): string {
  return `${ROUTES.portal}/claim?business=${encodeURIComponent(businessId)}`;
}

export function path(route: string, locale: Locale): string {
  return localizedPath(locale, route);
}
