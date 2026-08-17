/**
 * Cover imagery.
 *
 * A directory where half the listings have no photograph looks abandoned, and
 * most imported listings will never have one. So every business gets a cover:
 * its own `heroUrl` when it has one, otherwise a generated category scene
 * (see `scripts/generate-imagery.mjs`).
 *
 * The generated fallback is chosen deterministically from the slug, so a given
 * business keeps the same picture across builds — a cover that reshuffled on
 * every deploy would make the whole site feel unstable.
 */

import { categorySlug, type Business, type BusinessCategory } from '@leamington/shared';

/** Variants generated per category. Keep in sync with the generator. */
const VARIANTS = 3;

/** FNV-1a. Small, stable, and not a security boundary. */
function hash(value: string): number {
  let out = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    out ^= value.charCodeAt(i);
    out = Math.imul(out, 0x01000193);
  }
  return out >>> 0;
}

export function categoryCover(category: BusinessCategory, seed = ''): string {
  const variant = (hash(seed || category) % VARIANTS) + 1;
  return `/img/covers/${categorySlug(category)}-${variant}.jpg`;
}

/** The image to show for a business. Real photography always wins. */
export function businessCover(business: Pick<Business, 'slug' | 'category' | 'heroUrl'>): string {
  return business.heroUrl ?? categoryCover(business.category, business.slug);
}

/**
 * Where to fall back if the chosen cover fails to load.
 *
 * Always the local generated art, never another remote URL — the whole point is
 * to land somewhere that cannot itself 404. Wire it to `data-fallback` on the
 * `<img>` and the listener in Base.astro does the rest.
 */
export function coverFallback(
  business: Pick<Business, 'slug' | 'category'>,
): string {
  return categoryCover(business.category, business.slug);
}

/**
 * One fallback per gallery slot.
 *
 * A single shared fallback meant that if every remote photo failed, the gallery
 * showed the same picture three times — which reads as a bug rather than as a
 * graceful degradation. Seeding by index spreads them across the category's
 * variants instead.
 */
export function galleryFallbacks(
  business: Pick<Business, 'slug' | 'category'>,
  count: number,
): string[] {
  return Array.from({ length: count }, (_unused, index) =>
    categoryCover(business.category, `${business.slug}#${index}`),
  );
}

/**
 * Photos for the gallery. Deliberately does NOT fall back to the cover: a
 * one-item gallery showing the same picture as the header reads as a bug, and
 * the section hides itself when this is empty.
 */
export function businessPhotos(
  business: Pick<Business, 'photos'>,
): string[] {
  return business.photos;
}

export const HERO_COVER = '/img/covers/hero.jpg';

/**
 * Hues a monogram tile may use, in oklch degrees.
 *
 * Deliberately not the whole colour wheel: picking freely produced maroon and
 * magenta avatars sitting next to a blue-and-yellow page. These run gold →
 * green → teal → blue → indigo, so a list of thirty is still varied without
 * anything landing outside the brand.
 */
const MONOGRAM_HUES = [88, 112, 148, 176, 198, 222, 244, 262] as const;

/**
 * Deterministic tile hue for a monogram avatar.
 * Businesses without a logo still need to be distinguishable in a list.
 */
export function monogramHue(seed: string): number {
  return MONOGRAM_HUES[hash(seed) % MONOGRAM_HUES.length] ?? MONOGRAM_HUES[0];
}

export function monogram(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return (words[0] ?? '').slice(0, 2).toUpperCase();
  return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase();
}
