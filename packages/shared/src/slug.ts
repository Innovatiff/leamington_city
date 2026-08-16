/**
 * Slugs are permanent public URLs. Generation lives here so the seed script,
 * the admin app and Cloud Functions cannot drift apart.
 */

/** Words dropped from the front of `sortName` so ordering is by the real name. */
const LEADING_ARTICLES = ['the ', 'a ', 'an ', 'la ', 'el ', 'los ', 'las '];

/**
 * Slug segments that would collide with an app route or read badly as a URL.
 * A business legitimately called "Search" still gets a slug — `search-2`.
 */
const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'business',
  'businesses',
  'en',
  'es',
  'feed',
  'jobs',
  'login',
  'new',
  'offers',
  'portal',
  'search',
  'settings',
]);

/**
 * Lowercase, ASCII-fold, strip punctuation, collapse to hyphens.
 * NFD + combining-mark removal handles the Spanish and French names that are
 * common locally (`Café Olé` → `cafe-ole`).
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019'`]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/** Article-stripped, lowercased name used for `orderBy` stability. */
export function toSortName(name: string): string {
  const lowered = name.trim().toLowerCase();
  for (const article of LEADING_ARTICLES) {
    if (lowered.startsWith(article)) return lowered.slice(article.length).trim();
  }
  return lowered;
}

export interface UniqueSlugOptions {
  /** Extra disambiguator tried before numeric suffixes, e.g. a street name. */
  hint?: string | undefined;
  /** Fallback stem when the name slugifies to nothing (emoji-only names happen). */
  fallback?: string;
}

/**
 * Returns a slug not present in `taken`, and adds it to `taken`.
 *
 * Order of attempts: the plain slug, then `slug-hint`, then `slug-2`, `slug-3`…
 * The set is mutated so callers can generate a whole CSV in one pass without
 * re-querying Firestore per row.
 */
export function uniqueSlug(
  name: string,
  taken: Set<string>,
  options: UniqueSlugOptions = {},
): string {
  const fallback = options.fallback ?? 'business';
  const base = slugify(name) || fallback;

  const candidates: string[] = [];
  if (!RESERVED_SLUGS.has(base)) candidates.push(base);

  const hintSlug = options.hint ? slugify(options.hint) : '';
  if (hintSlug) candidates.push(`${base}-${hintSlug}`);

  for (const candidate of candidates) {
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }

  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate) && !RESERVED_SLUGS.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/** Human-readable redemption code: unambiguous alphabet, no `0/O` or `1/I/L`. */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateRedemptionCode(length = 6, random: () => number = Math.random): string {
  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}
