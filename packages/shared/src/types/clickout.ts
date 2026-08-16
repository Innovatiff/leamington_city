import type { Locale } from './common.js';

export type ClickoutTargetType = 'business' | 'offer' | 'job';

export const CLICKOUT_SOURCES = [
  'feed',
  'directory',
  'detail',
  'search',
  'portal',
] as const;
export type ClickoutSource = (typeof CLICKOUT_SOURCES)[number];

/**
 * Append-only outbound-link analytics. Written exclusively by Cloud Functions —
 * clients call `recordClickout` and get the destination back, they never write
 * this collection and never read it.
 */
export interface Clickout {
  id: string;
  businessId: string;
  targetType: ClickoutTargetType;
  targetId: string;
  destinationUrl: string;
  uid: string | null;
  /** Anonymous, client-generated. Lets us de-duplicate without identifying anyone. */
  sessionId: string;
  locale: Locale;
  source: ClickoutSource;
  userAgent: string | null;
  referrer: string | null;
  createdAt: Date;
}

/** What a client sends to the `recordClickout` callable. */
export interface ClickoutRequest {
  targetType: ClickoutTargetType;
  targetId: string;
  sessionId: string;
  locale: Locale;
  source: ClickoutSource;
}

export interface ClickoutResponse {
  /** Server-resolved. The client does not get to choose where it is sent. */
  destinationUrl: string;
}
