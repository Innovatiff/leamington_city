/**
 * Structured data. Public pages are SEO-critical, so every generated page
 * carries JSON-LD alongside its canonical and hreflang tags.
 */

import type { Business, Job, Locale, Offer } from '@leamington/shared';
import { INTL_LOCALES, formatPhone, pick } from '@leamington/shared';

/** BCP-47 tag for `<html lang>` and hreflang. */
export function htmlLang(locale: Locale): string {
  return INTL_LOCALES[locale];
}

function absolute(site: string, path: string): string {
  return new URL(path, site).toString();
}

export function businessJsonLd(
  business: Business,
  locale: Locale,
  site: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': absolute(site, `/${locale}/business/${business.slug}`),
    name: business.name,
    description: pick(business.shortDescription, locale),
    url: business.websiteUrl ?? absolute(site, `/${locale}/business/${business.slug}`),
    telephone: business.phone ? formatPhone(business.phone) : undefined,
    email: business.email ?? undefined,
    image: business.heroUrl ?? business.logoUrl ?? undefined,
    logo: business.logoUrl ?? undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: [business.address.line1, business.address.line2]
        .filter(Boolean)
        .join(', '),
      addressLocality: business.address.city,
      addressRegion: business.address.province,
      postalCode: business.address.postalCode,
      addressCountry: business.address.country,
    },
    geo: business.geo
      ? {
          '@type': 'GeoCoordinates',
          latitude: business.geo.lat,
          longitude: business.geo.lng,
        }
      : undefined,
    sameAs: [
      business.socials.facebook,
      business.socials.instagram,
      business.socials.x,
      business.socials.tiktok,
    ].filter((entry): entry is string => Boolean(entry)),
  };
}

export function offerJsonLd(
  offer: Offer,
  locale: Locale,
  site: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: pick(offer.title, locale),
    description: pick(offer.description, locale),
    url: absolute(site, `/${locale}/business/${offer.business.slug}#offer-${offer.id}`),
    availabilityStarts: offer.startsAt.toISOString(),
    availabilityEnds: offer.endsAt.toISOString(),
    offeredBy: {
      '@type': 'LocalBusiness',
      name: offer.business.name,
      '@id': absolute(site, `/${locale}/business/${offer.business.slug}`),
    },
  };
}

export function jobJsonLd(
  job: Job,
  locale: Locale,
  site: string,
): Record<string, unknown> {
  const EMPLOYMENT_TYPE_LD: Record<string, string> = {
    full_time: 'FULL_TIME',
    part_time: 'PART_TIME',
    seasonal: 'TEMPORARY',
    contract: 'CONTRACTOR',
    temporary: 'TEMPORARY',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: pick(job.title, locale),
    description: pick(job.description, locale),
    datePosted: job.postedAt.toISOString(),
    validThrough: job.expiresAt.toISOString(),
    employmentType: EMPLOYMENT_TYPE_LD[job.employmentType] ?? 'OTHER',
    directApply: Boolean(job.applyUrl),
    url: absolute(site, `/${locale}/jobs#job-${job.id}`),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.business.name,
      sameAs: job.business.websiteUrl ?? undefined,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Leamington',
        addressRegion: 'ON',
        addressCountry: 'CA',
      },
    },
    baseSalary: job.compensation
      ? {
          '@type': 'MonetaryAmount',
          currency: job.compensation.currency,
          value: {
            '@type': 'QuantitativeValue',
            minValue: job.compensation.min / 100,
            maxValue: job.compensation.max / 100,
            unitText: job.compensation.period.toUpperCase(),
          },
        }
      : undefined,
  };
}

/** Drops `undefined` so the emitted JSON-LD has no null-ish noise. */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data, (_key, value: unknown) =>
    value === undefined ? undefined : value,
  );
}
