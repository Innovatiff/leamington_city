/**
 * Collection ids in one place. Security rules, functions, seed and apps all
 * refer to these — a typo'd string literal is a silently empty query.
 */
export const COLLECTIONS = {
  businesses: 'businesses',
  offers: 'offers',
  jobs: 'jobs',
  feedDays: 'feedDays',
  clickouts: 'clickouts',
  redemptions: 'redemptions',
  subscriptions: 'subscriptions',
  users: 'users',
} as const;

export type CollectionId = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/** Collections a client may read without auth. Mirrors firestore.rules. */
export const PUBLIC_READ_COLLECTIONS: readonly CollectionId[] = [
  COLLECTIONS.businesses,
  COLLECTIONS.offers,
  COLLECTIONS.jobs,
  COLLECTIONS.feedDays,
];

/** Collections no client may write. Mirrors firestore.rules. */
export const FUNCTIONS_ONLY_WRITE_COLLECTIONS: readonly CollectionId[] = [
  COLLECTIONS.clickouts,
  COLLECTIONS.redemptions,
  COLLECTIONS.subscriptions,
  COLLECTIONS.feedDays,
];

export const docPath = {
  business: (businessId: string) => `${COLLECTIONS.businesses}/${businessId}`,
  offer: (offerId: string) => `${COLLECTIONS.offers}/${offerId}`,
  job: (jobId: string) => `${COLLECTIONS.jobs}/${jobId}`,
  /** `dayKey` is `YYYY-MM-DD` in America/Toronto. */
  feedDay: (dayKey: string) => `${COLLECTIONS.feedDays}/${dayKey}`,
  clickout: (clickoutId: string) => `${COLLECTIONS.clickouts}/${clickoutId}`,
  redemption: (redemptionId: string) => `${COLLECTIONS.redemptions}/${redemptionId}`,
  /** Subscription doc id is the business id. */
  subscription: (businessId: string) => `${COLLECTIONS.subscriptions}/${businessId}`,
  user: (uid: string) => `${COLLECTIONS.users}/${uid}`,
} as const;
