import type { Locale } from './common.js';

export const REDEMPTION_STATES = ['issued', 'redeemed', 'expired', 'void'] as const;
export type RedemptionState = (typeof REDEMPTION_STATES)[number];

/**
 * Written exclusively by Cloud Functions. A user may read their own; nobody
 * writes one from a client, because the code and the counter have to be issued
 * together under a transaction.
 */
export interface Redemption {
  id: string;
  offerId: string;
  businessId: string;
  uid: string;
  /** Short human-readable code the staff member types in. */
  code: string;
  state: RedemptionState;
  issuedAt: Date;
  expiresAt: Date;
  redeemedAt: Date | null;
  /** Uid of the staff account that marked it redeemed. */
  redeemedBy: string | null;
  locale: Locale;
}

export interface IssueRedemptionRequest {
  offerId: string;
  locale: Locale;
}

export interface IssueRedemptionResponse {
  redemptionId: string;
  code: string;
  expiresAt: string;
}

export interface ConfirmRedemptionRequest {
  code: string;
}

/** How long an issued code stays valid before the counter is released. */
export const REDEMPTION_TTL_MINUTES = 30;
