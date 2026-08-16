import type { DayKey, LocalizedText } from './common.js';

export type FeedItemType = 'offer' | 'job' | 'business';

/**
 * A fully rendered card. Everything the phone needs to paint the row is here —
 * reading a feed day is one document read and zero follow-ups.
 */
export interface FeedItem {
  id: string;
  type: FeedItemType;
  refId: string;
  businessId: string;
  rank: number;
  title: LocalizedText;
  subtitle: LocalizedText;
  imageUrl: string | null;
  /** In-app route. Outbound links go through a clickout so they can be counted. */
  href: string;
  endsAt: Date | null;
}

export interface FeedDay {
  /** Equals `date`, which equals the document id. */
  id: DayKey;
  date: DayKey;
  timeZone: string;
  generatedAt: Date;
  items: FeedItem[];
  heroItemId: string | null;
  /** Set by the push function. Guards the one-push-per-day rule. */
  pushSentAt: Date | null;
}

/** Hard cap so a feed document stays small on a bad connection. */
export const MAX_FEED_ITEMS = 60;
