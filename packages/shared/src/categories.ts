/**
 * Category URL segments.
 *
 * Business pages live at `/{category}/{slug}`, so a category's slug is part of
 * a permanent public URL and cannot be derived ad hoc at each call site.
 * The mapping is explicit rather than computed so that renaming an enum member
 * is a compile error here instead of a silent 404 across the whole directory.
 */

import { BUSINESS_CATEGORIES, type BusinessCategory } from './types/common.js';
import type { MessageKey } from './i18n/en.js';

export const CATEGORY_SLUGS: Record<BusinessCategory, string> = {
  restaurant: 'restaurants',
  cafe: 'cafes',
  bakery: 'bakeries',
  grocery: 'grocery',
  retail: 'shops',
  beauty: 'beauty',
  health: 'health',
  automotive: 'automotive',
  home_services: 'home-services',
  professional: 'professional',
  agriculture: 'agriculture',
  recreation: 'recreation',
  lodging: 'lodging',
  nonprofit: 'community',
  other: 'other',
};

const SLUG_TO_CATEGORY: Record<string, BusinessCategory> = Object.fromEntries(
  Object.entries(CATEGORY_SLUGS).map(([category, slug]) => [slug, category]),
) as Record<string, BusinessCategory>;

export const CATEGORY_SLUG_LIST: readonly string[] = BUSINESS_CATEGORIES.map(
  (category) => CATEGORY_SLUGS[category],
);

export function categorySlug(category: BusinessCategory): string {
  return CATEGORY_SLUGS[category];
}

export function categoryFromSlug(slug: string): BusinessCategory | null {
  return SLUG_TO_CATEGORY[slug] ?? null;
}

/** i18n key for a category's display name. */
export function categoryMessageKey(category: BusinessCategory): MessageKey {
  return `category.${category}` as MessageKey;
}
