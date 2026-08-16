/**
 * The daily push.
 *
 * CLAUDE.md: max one push notification per user per day. That is enforced in
 * two independent places, because "we sent it twice" is the kind of bug that
 * loses an install permanently:
 *
 *   1. `feedDays/{day}.pushSentAt` — a per-day latch, so a retried or manually
 *      re-run job cannot fan out a second time.
 *   2. `users/{uid}.push.lastSentDay` — a per-user latch, written in the same
 *      pass, so a user who somehow lands in two batches is still only sent one.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { toDayKey, translate, type FeedDay, type Locale } from '@leamington/shared';
import { collections, db } from './firebase.js';
import { SCHEDULE_TIME_ZONE } from './options.js';

/** FCM caps a multicast at 500 tokens. */
const MULTICAST_LIMIT = 500;

export const sendDailyPush = onSchedule(
  { schedule: '0 11 * * *', timeZone: SCHEDULE_TIME_ZONE, retryCount: 1 },
  async () => {
    const now = new Date();
    const dayKey = toDayKey(now);
    const feedRef = collections.feedDays().doc(dayKey);

    // Latch 1: claim the day. If another run already claimed it, stop.
    const claimed = await db.runTransaction<FeedDay | null>(async (tx) => {
      const feedDay = (await tx.get(feedRef)).data();
      if (!feedDay) return null;
      if (feedDay.pushSentAt !== null) return null;
      if (feedDay.items.length === 0) return null;
      tx.update(feedRef, { pushSentAt: now });
      return feedDay;
    });

    if (!claimed) {
      logger.info('daily push skipped', { dayKey });
      return;
    }

    const offerCount = claimed.items.filter((item) => item.type === 'offer').length;

    const recipients = await collections
      .users()
      .where('push.enabled', '==', true)
      .get();

    // Latch 2: per user, and grouped by locale so the copy is right.
    const byLocale = new Map<Locale, { uid: string; token: string }[]>();
    for (const doc of recipients.docs) {
      const user = doc.data();
      if (!user.push.token) continue;
      if (user.push.lastSentDay === dayKey) continue;
      const bucket = byLocale.get(user.locale) ?? [];
      bucket.push({ uid: user.id, token: user.push.token });
      byLocale.set(user.locale, bucket);
    }

    const messaging = getMessaging();
    let sent = 0;

    for (const [locale, targets] of byLocale) {
      const notification = {
        title: translate(locale, 'push.dailyTitle'),
        body: translate(locale, 'push.dailyBody', { count: offerCount }),
      };

      for (let index = 0; index < targets.length; index += MULTICAST_LIMIT) {
        const chunk = targets.slice(index, index + MULTICAST_LIMIT);
        const response = await messaging.sendEachForMulticast({
          tokens: chunk.map((target) => target.token),
          notification,
          data: { dayKey, href: `/${locale}` },
        });

        const batch = db.batch();
        response.responses.forEach((result, position) => {
          const target = chunk[position];
          if (!target) return;
          if (result.success) {
            batch.update(collections.users().doc(target.uid), {
              'push.lastSentDay': dayKey,
            });
            sent += 1;
          } else {
            // A dead token is the usual cause; stop trying it.
            const code = result.error?.code ?? '';
            if (code.includes('registration-token-not-registered')) {
              batch.update(collections.users().doc(target.uid), {
                'push.token': null,
                'push.enabled': false,
              });
            }
          }
        });
        await batch.commit();
      }
    }

    logger.info('daily push sent', { dayKey, sent, offerCount });
  },
);
