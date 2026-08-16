import type { BusinessTier } from './business.js';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

/** Paid tiers only — `stub` is never a subscription. */
export type PaidTier = Exclude<BusinessTier, 'stub'>;

/**
 * Billing state, keyed by business id. Functions only, both directions:
 * the portal reads it to render, but every mutation arrives from a provider
 * webhook.
 */
export interface Subscription {
  /** Equals `businessId`. */
  id: string;
  businessId: string;
  tier: PaidTier;
  status: SubscriptionStatus;
  provider: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function grantsPublishing(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  return subscription.status === 'active' || subscription.status === 'trialing';
}
