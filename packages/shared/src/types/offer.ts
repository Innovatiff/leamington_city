import type { BusinessRef, DayKey, LocalizedText, Money, PublishStatus } from './common.js';

export const OFFER_KINDS = ['percent', 'amount', 'bogo', 'freebie', 'other'] as const;
export type OfferKind = (typeof OFFER_KINDS)[number];

export type OfferChannel = 'in_store' | 'online' | 'both';

export interface Offer {
  id: string;
  businessId: string;
  business: BusinessRef;
  title: LocalizedText;
  description: LocalizedText;
  terms: LocalizedText;
  kind: OfferKind;
  percentOff: number | null;
  amountOff: Money | null;
  channel: OfferChannel;
  code: string | null;
  imageUrl: string | null;
  startsAt: Date;
  endsAt: Date;
  /** `0` = Sunday. Empty means every day. */
  daysOfWeek: number[];
  status: PublishStatus;
  /** Total across all users. `null` = unlimited. */
  redemptionLimit: number | null;
  /** Functions-only counter. */
  redemptionCount: number;
  perUserLimit: number;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Live on `day` (a `YYYY-MM-DD` key) with `now` inside the window. */
export function isOfferLiveOn(offer: Offer, now: Date, weekday: number): boolean {
  if (offer.status !== 'published') return false;
  if (now < offer.startsAt || now > offer.endsAt) return false;
  if (offer.daysOfWeek.length > 0 && !offer.daysOfWeek.includes(weekday)) return false;
  if (offer.redemptionLimit !== null && offer.redemptionCount >= offer.redemptionLimit) {
    return false;
  }
  return true;
}

export function offerExpiresOn(offer: Offer, day: DayKey): boolean {
  return offer.endsAt.toISOString().slice(0, 10) === day;
}
