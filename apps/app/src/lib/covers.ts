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
 * Deterministic tile colour for a monogram avatar, as a hue in degrees.
 * Businesses without a logo still need to be visually distinguishable in a list.
 */
export function monogramHue(seed: string): number {
  return hash(seed) % 360;
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
