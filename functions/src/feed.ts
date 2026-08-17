/**
 * Daily feed builder.
 *
 * The feed is one document per day carrying fully rendered bilingual cards.
 * Building it here is what makes the phone's read a single document fetch —
 * per CLAUDE.md, the feed must never fan out.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  MAX_FEED_ITEMS,
  TIME_ZONE,
  categorySlug,
  toDayKey,
  toWeekday,
  truncate,
  type FeedDay,
  type FeedItem,
  type Job,
  type Offer,
} from '@leamington/shared';
import { collections } from './firebase.js';
import { SCHEDULE_TIME_ZONE } from './options.js';

function offerHeadline(offer: Offer): { en: string; es: string } {
  return { en: offer.title.en, es: offer.title.es };
}

function offerToItem(offer: Offer, now: Date): FeedItem {
  // Featured offers float; among the rest, the ones ending soonest go first,
  // because urgency is what makes a daily feed worth opening.
  const hoursLeft = Math.max(
    0,
    (offer.endsAt.getTime() - now.getTime()) / (1000 * 60 * 60),
  );
  const rank = (offer.featured ? 1000 : 0) + Math.max(0, 200 - hoursLeft);

  return {
    id: `offer:${offer.id}`,
    type: 'offer',
    refId: offer.id,
    businessId: offer.businessId,
    rank,
    title: offerHeadline(offer),
    subtitle: {
      en: truncate(offer.business.name, 60),
      es: truncate(offer.business.name, 60),
    },
    imageUrl: offer.imageUrl ?? offer.business.logoUrl,
    // In-app route, locale-agnostic: the app prefixes it per locale. Business
    // pages live under their category, so the ref's category is part of the URL.
    href: `/${categorySlug(offer.business.category)}/${offer.business.slug}#offer-${offer.id}`,
    endsAt: offer.endsAt,
  };
}

function jobToItem(job: Job): FeedItem {
  return {
    id: `job:${job.id}`,
    type: 'job',
    refId: job.id,
    businessId: job.businessId,
    // Jobs sit below live deals but above evergreen business cards.
    rank: 100,
    title: job.title,
    subtitle: {
      en: job.business.name,
      es: job.business.name,
    },
    imageUrl: job.business.logoUrl,
    href: `/jobs#job-${job.id}`,
    endsAt: job.expiresAt,
  };
}

/** Builds (and writes) the feed document for `dayKey`. */
export async function buildFeedDay(dayKey: string, now = new Date()): Promise<FeedDay> {
  const weekday = toWeekday(now);

  const [offerSnapshot, jobSnapshot] = await Promise.all([
    collections
      .offers()
      .where('status', '==', 'published')
      .where('endsAt', '>=', now)
      .orderBy('endsAt', 'asc')
      .limit(MAX_FEED_ITEMS * 2)
      .get(),
    collections
      .jobs()
      .where('status', '==', 'published')
      .orderBy('postedAt', 'desc')
      .limit(20)
      .get(),
  ]);

  const offers = offerSnapshot.docs
    .map((doc) => doc.data())
    .filter((offer) => offer.startsAt <= now)
    .filter(
      (offer) => offer.daysOfWeek.length === 0 || offer.daysOfWeek.includes(weekday),
    )
    .filter(
      (offer) =>
        offer.redemptionLimit === null || offer.redemptionCount < offer.redemptionLimit,
    );

  const jobs = jobSnapshot.docs
    .map((doc) => doc.data())
    .filter((job) => job.expiresAt >= now);

  const items = [...offers.map((offer) => offerToItem(offer, now)), ...jobs.map(jobToItem)]
    .sort((a, b) => b.rank - a.rank)
    .slice(0, MAX_FEED_ITEMS);

  const feedDay: FeedDay = {
    id: dayKey,
    date: dayKey,
    timeZone: TIME_ZONE,
    generatedAt: now,
    items,
    heroItemId: items[0]?.id ?? null,
    pushSentAt: null,
  };

  const ref = collections.feedDays().doc(dayKey);
  const existing = await ref.get();
  await ref.set(
    {
      ...feedDay,
      // Rebuilding must not re-arm the daily push.
      pushSentAt: existing.data()?.pushSentAt ?? null,
    },
    { merge: false },
  );

  logger.info('feed built', { dayKey, items: items.length });
  return feedDay;
}

/** 05:30 America/Toronto — done before the town is awake. */
export const buildDailyFeed = onSchedule(
  { schedule: '30 5 * * *', timeZone: SCHEDULE_TIME_ZONE, retryCount: 3 },
  async () => {
    const now = new Date();
    await buildFeedDay(toDayKey(now), now);
  },
);

/** Admin escape hatch for "the feed looks wrong right now". */
export const rebuildFeed = onCall<{ dayKey?: string }, Promise<{ items: number }>>(
  { cors: true },
  async (request) => {
    const roles = request.auth?.token['roles'];
    if (!Array.isArray(roles) || !roles.includes('admin')) {
      throw new HttpsError('permission-denied', 'Admins only.');
    }
    const now = new Date();
    const dayKey = request.data?.dayKey ?? toDayKey(now);
    const feedDay = await buildFeedDay(dayKey, now);
    return { items: feedDay.items.length };
  },
);
