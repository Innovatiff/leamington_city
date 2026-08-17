/**
 * Translation lookup. Deliberately tiny and synchronous: the Astro build needs
 * it at render time, the React islands need it without a provider round-trip,
 * and a phone on a bad connection should not download an i18n runtime.
 */

import type { Locale } from '../types/common.js';
import { DEFAULT_LOCALE, LOCALES, isLocale } from '../types/common.js';
import { en, type MessageKey, type Messages } from './en.js';
import { es } from './es.js';

export type { MessageKey, Messages };
export { en, es };

export const CATALOGUES: Record<Locale, Messages> = { en, es };

export type TranslateParams = Record<string, string | number>;

/** Fills `{name}` placeholders. Unknown placeholders are left visible on purpose. */
function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

export function translate(
  locale: Locale,
  key: MessageKey,
  params?: TranslateParams,
): string {
  const catalogue = CATALOGUES[locale] ?? en;
  // `Messages` guarantees the key exists; the `?? en[key]` is belt-and-braces
  // for a catalogue loaded from a stale build.
  return interpolate(catalogue[key] ?? en[key], params);
}

/** Bound translator. `const t = useTranslator(locale); t('nav.feed')`. */
export function useTranslator(locale: Locale) {
  return (key: MessageKey, params?: TranslateParams): string =>
    translate(locale, key, params);
}

export { useTranslator as createTranslator };

/** The other locale. Powers the language toggle and hreflang pairs. */
export function alternateLocale(locale: Locale): Locale {
  return locale === 'en' ? 'es' : 'en';
}

/**
 * English is served unprefixed and Spanish under `/es/`.
 *
 * The public URLs are `/{category}/{slug}` and `/es/{category}/{slug}`, so the
 * default locale owns the root. Only non-default locales take a prefix.
 */
export function localeFromPath(pathname: string): Locale {
  const segment = pathname.split('/').filter(Boolean)[0];
  return isLocale(segment) && segment !== DEFAULT_LOCALE ? segment : DEFAULT_LOCALE;
}

/**
 * Locale-prefixed route.
 * `localizedPath('es', '/offers')` → `/es/offers`;
 * `localizedPath('en', '/offers')` → `/offers`.
 */
export function localizedPath(locale: Locale, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return normalized;
  return `/${locale}${normalized === '/' ? '' : normalized}`;
}

/** Best match from an `Accept-Language` header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag = '', ...rest] = part.trim().split(';');
      const q = rest.find((entry) => entry.trim().startsWith('q='));
      return { tag: tag.toLowerCase(), q: q ? Number(q.split('=')[1]) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split('-')[0];
    if (base && (LOCALES as readonly string[]).includes(base)) return base as Locale;
  }
  return DEFAULT_LOCALE;
}
