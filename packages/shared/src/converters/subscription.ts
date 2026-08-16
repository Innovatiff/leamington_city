import type { PaidTier, Subscription, SubscriptionStatus } from '../types/subscription.js';
import type { Codec, DocumentDataLike } from '../firestore/converter.js';
import {
  makeConverter,
  toBoolean,
  toDate,
  toDateOrNull,
  toEnum,
  toStringOrNull,
  toStringValue,
} from '../firestore/converter.js';

const TIERS: readonly PaidTier[] = ['claimed', 'plus', 'premium'];
const STATUSES: readonly SubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'canceled',
];

export const subscriptionCodec: Codec<Subscription> = {
  encode(model): DocumentDataLike {
    return {
      businessId: model.businessId,
      tier: model.tier,
      status: model.status,
      provider: model.provider,
      providerCustomerId: model.providerCustomerId,
      providerSubscriptionId: model.providerSubscriptionId,
      currentPeriodStart: model.currentPeriodStart,
      currentPeriodEnd: model.currentPeriodEnd,
      cancelAtPeriodEnd: model.cancelAtPeriodEnd,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  },

  decode(id, data): Subscription {
    return {
      id,
      // Doc id is the business id; the field is a convenience mirror.
      businessId: toStringValue(data['businessId'], id),
      tier: toEnum<PaidTier>(data['tier'], TIERS, 'claimed'),
      status: toEnum<SubscriptionStatus>(data['status'], STATUSES, 'canceled'),
      provider: toStringValue(data['provider']),
      providerCustomerId: toStringOrNull(data['providerCustomerId']),
      providerSubscriptionId: toStringOrNull(data['providerSubscriptionId']),
      currentPeriodStart: toDateOrNull(data['currentPeriodStart']),
      currentPeriodEnd: toDateOrNull(data['currentPeriodEnd']),
      cancelAtPeriodEnd: toBoolean(data['cancelAtPeriodEnd']),
      createdAt: toDate(data['createdAt']),
      updatedAt: toDate(data['updatedAt']),
    };
  },
};

export const subscriptionConverter = makeConverter(subscriptionCodec);
