import type { Business, BusinessSource, BusinessStatus, BusinessTier } from '../types/business.js';
import { BUSINESS_TIERS } from '../types/business.js';
import type { Codec, DocumentDataLike } from '../firestore/converter.js';
import {
  makeConverter,
  optional,
  optionalCopy,
  toDate,
  toDateOrNull,
  toEnum,
  toMap,
  toNumber,
  toStringArray,
  toStringOrNull,
  toStringValue,
} from '../firestore/converter.js';
import * as f from '../firestore/fields.js';

const STATUSES: readonly BusinessStatus[] = ['draft', 'published', 'hidden'];
const SOURCES: readonly BusinessSource[] = ['seed', 'owner', 'admin'];

export const businessCodec: Codec<Business> = {
  encode(model): DocumentDataLike {
    return {
      slug: model.slug,
      tier: model.tier,
      status: model.status,
      name: model.name,
      sortName: model.sortName,
      category: model.category,
      categories: model.categories,
      shortDescription: optionalCopy(model.shortDescription),
      description: optionalCopy(model.description),
      address: optionalCopy(model.address),
      geo: optional(model.geo, (geo) => ({ lat: geo.lat, lng: geo.lng })),
      phone: model.phone,
      email: model.email,
      websiteUrl: model.websiteUrl,
      socials: optionalCopy(model.socials),
      hours: model.hours,
      logoUrl: model.logoUrl,
      heroUrl: model.heroUrl,
      photos: model.photos,
      tags: model.tags,
      counts: optional(model.counts, (counts) => ({
        offers: counts.offers,
        jobs: counts.jobs,
      })),
      rank: model.rank,
      claimedAt: model.claimedAt,
      source: model.source,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  },

  decode(id, data): Business {
    const primary = f.category(data['category']);
    const counts = toMap(data['counts']);
    return {
      id,
      slug: toStringValue(data['slug'], id),
      tier: toEnum<BusinessTier>(data['tier'], BUSINESS_TIERS, 'stub'),
      status: toEnum<BusinessStatus>(data['status'], STATUSES, 'draft'),
      name: toStringValue(data['name']),
      sortName: toStringValue(data['sortName'], toStringValue(data['name']).toLowerCase()),
      category: primary,
      categories: f.categories(data['categories'], primary),
      shortDescription: f.localizedText(data['shortDescription']),
      description: f.localizedText(data['description']),
      address: f.address(data['address']),
      geo: f.geoPoint(data['geo']),
      phone: toStringOrNull(data['phone']),
      email: toStringOrNull(data['email']),
      websiteUrl: toStringOrNull(data['websiteUrl']),
      socials: f.socials(data['socials']),
      hours: f.weekHours(data['hours']),
      logoUrl: toStringOrNull(data['logoUrl']),
      heroUrl: toStringOrNull(data['heroUrl']),
      photos: toStringArray(data['photos']),
      tags: toStringArray(data['tags']),
      counts: {
        offers: toNumber(counts['offers']),
        jobs: toNumber(counts['jobs']),
      },
      rank: toNumber(data['rank']),
      claimedAt: toDateOrNull(data['claimedAt']),
      source: toEnum<BusinessSource>(data['source'], SOURCES, 'seed'),
      createdAt: toDate(data['createdAt']),
      updatedAt: toDate(data['updatedAt']),
    };
  },
};

export const businessConverter = makeConverter(businessCodec);

/** The denormalized snapshot embedded in offers, jobs and feed items. */
export function toBusinessRef(business: Business) {
  return {
    id: business.id,
    slug: business.slug,
    name: business.name,
    category: business.category,
    logoUrl: business.logoUrl,
    websiteUrl: business.websiteUrl,
  };
}
