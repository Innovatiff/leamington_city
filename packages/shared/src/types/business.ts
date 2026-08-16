import type {
  Address,
  BusinessCategory,
  GeoPointLike,
  LocalizedText,
  Socials,
  WeekHours,
} from './common.js';

/**
 * Tier ladder. `stub` records are bulk-imported and unclaimed — they are
 * publicly listed but carry no owner and no editable content.
 */
export const BUSINESS_TIERS = ['stub', 'claimed', 'plus', 'premium'] as const;
export type BusinessTier = (typeof BUSINESS_TIERS)[number];

export type BusinessStatus = 'draft' | 'published' | 'hidden';
export type BusinessSource = 'seed' | 'owner' | 'admin';

/** Feed sort weight by tier. Higher sorts first. */
export const TIER_RANK: Record<BusinessTier, number> = {
  stub: 0,
  claimed: 10,
  plus: 20,
  premium: 30,
};

export interface BusinessCounts {
  offers: number;
  jobs: number;
}

export interface Business {
  id: string;
  slug: string;
  tier: BusinessTier;
  status: BusinessStatus;
  name: string;
  /** Lowercased, article-stripped. Exists solely so `orderBy` is stable. */
  sortName: string;
  category: BusinessCategory;
  /** Always includes `category`. Queried with `array-contains`. */
  categories: BusinessCategory[];
  shortDescription: LocalizedText;
  description: LocalizedText;
  address: Address;
  geo: GeoPointLike | null;
  /** E.164, e.g. `+15195551234`. */
  phone: string | null;
  email: string | null;
  /** The link-out target. Ordering and menus live here, not in this app. */
  websiteUrl: string | null;
  socials: Socials;
  hours: WeekHours | null;
  logoUrl: string | null;
  heroUrl: string | null;
  photos: string[];
  tags: string[];
  counts: BusinessCounts;
  rank: number;
  claimedAt: Date | null;
  source: BusinessSource;
  createdAt: Date;
  updatedAt: Date;
}

export function isPubliclyListed(business: Business): boolean {
  return business.status === 'published';
}
