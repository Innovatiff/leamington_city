/**
 * Admin SDK singleton plus converter-bound collection accessors.
 *
 * Every read in this codebase goes through one of these helpers, so no function
 * ever touches a raw `DocumentData`.
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  appUserConverter,
  businessConverter,
  clickoutConverter,
  feedDayConverter,
  jobConverter,
  offerConverter,
  redemptionConverter,
  subscriptionConverter,
} from '@leamington/shared';

if (getApps().length === 0) {
  initializeApp();
}

export const db: Firestore = getFirestore();
export { FieldValue };

export const collections = {
  businesses: () => db.collection(COLLECTIONS.businesses).withConverter(businessConverter),
  offers: () => db.collection(COLLECTIONS.offers).withConverter(offerConverter),
  jobs: () => db.collection(COLLECTIONS.jobs).withConverter(jobConverter),
  feedDays: () => db.collection(COLLECTIONS.feedDays).withConverter(feedDayConverter),
  clickouts: () => db.collection(COLLECTIONS.clickouts).withConverter(clickoutConverter),
  redemptions: () =>
    db.collection(COLLECTIONS.redemptions).withConverter(redemptionConverter),
  subscriptions: () =>
    db.collection(COLLECTIONS.subscriptions).withConverter(subscriptionConverter),
  users: () => db.collection(COLLECTIONS.users).withConverter(appUserConverter),
} as const;
