/**
 * Housekeeping.
 *
 * Two things rot silently: offers and jobs that are past their end date but
 * still marked `published`, and redemption codes that were issued, never shown
 * to a staff member, and are holding a slot against `redemptionLimit`.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { FieldValue, collections, db } from './firebase.js';
import { SCHEDULE_TIME_ZONE } from './options.js';

const PAGE = 300;

async function expirePublished(
  collection: ReturnType<typeof collections.offers> | ReturnType<typeof collections.jobs>,
  field: 'endsAt' | 'expiresAt',
  now: Date,
): Promise<number> {
  const stale = await collection
    .where('status', '==', 'published')
    .where(field, '<', now)
    .limit(PAGE)
    .get();

  if (stale.empty) return 0;

  const batch = db.batch();
  for (const doc of stale.docs) {
    batch.update(doc.ref, { status: 'expired', updatedAt: now });
  }
  await batch.commit();
  return stale.size;
}

/** Releases the counter slot an unused code was holding. */
async function releaseStaleRedemptions(now: Date): Promise<number> {
  const stale = await collections
    .redemptions()
    .where('state', '==', 'issued')
    .where('expiresAt', '<', now)
    .limit(PAGE)
    .get();

  if (stale.empty) return 0;

  const batch = db.batch();
  for (const doc of stale.docs) {
    batch.update(doc.ref, { state: 'expired' });
    batch.update(collections.offers().doc(doc.data().offerId), {
      redemptionCount: FieldValue.increment(-1),
    });
  }
  await batch.commit();
  return stale.size;
}

/** Every 15 minutes: frequent enough that a held slot frees up while a customer waits. */
export const runHousekeeping = onSchedule(
  { schedule: '*/15 * * * *', timeZone: SCHEDULE_TIME_ZONE, retryCount: 1 },
  async () => {
    const now = new Date();
    const [offers, jobs, redemptions] = [
      await expirePublished(collections.offers(), 'endsAt', now),
      await expirePublished(collections.jobs(), 'expiresAt', now),
      await releaseStaleRedemptions(now),
    ];
    if (offers || jobs || redemptions) {
      logger.info('housekeeping', { offers, jobs, redemptions });
    }
  },
);
