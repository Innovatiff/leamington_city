/**
 * Offer redemption.
 *
 * Issuing a code moves a shared counter, so it happens in a transaction inside
 * a Cloud Function. Security rules deny all client writes to /redemptions and
 * to `offers.redemptionCount`; this is the only path that can mint one.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  LOCALES,
  REDEMPTION_TTL_MINUTES,
  generateRedemptionCode,
  type ConfirmRedemptionRequest,
  type IssueRedemptionRequest,
  type IssueRedemptionResponse,
  type Locale,
} from '@leamington/shared';
import { collections, db } from './firebase.js';
import './options.js';

function requireUid(auth: { uid: string } | undefined): string {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Sign in to claim a deal.');
  return auth.uid;
}

export const issueRedemption = onCall<
  IssueRedemptionRequest,
  Promise<IssueRedemptionResponse>
>({ cors: true }, async (request): Promise<IssueRedemptionResponse> => {
  const uid = requireUid(request.auth);
  const offerId = request.data?.offerId;
  if (typeof offerId !== 'string' || offerId.length === 0) {
    throw new HttpsError('invalid-argument', 'Missing offerId.');
  }
  const locale: Locale = (LOCALES as readonly string[]).includes(request.data?.locale)
    ? request.data.locale
    : 'en';

  const now = new Date();
  const expiresAt = new Date(now.getTime() + REDEMPTION_TTL_MINUTES * 60_000);
  const offerRef = collections.offers().doc(offerId);
  const redemptionRef = collections.redemptions().doc();

  const code = await db.runTransaction(async (tx) => {
    const offer = (await tx.get(offerRef)).data();
    if (!offer) throw new HttpsError('not-found', 'Deal not found.');
    if (offer.status !== 'published') {
      throw new HttpsError('failed-precondition', 'This deal is not available.');
    }
    if (now < offer.startsAt || now > offer.endsAt) {
      throw new HttpsError('failed-precondition', 'This deal has ended.');
    }
    if (
      offer.redemptionLimit !== null &&
      offer.redemptionCount >= offer.redemptionLimit
    ) {
      throw new HttpsError('resource-exhausted', 'This deal has been fully claimed.');
    }

    // Per-user cap. Voided and expired codes do not count against it.
    const mine = await tx.get(
      collections
        .redemptions()
        .where('offerId', '==', offerId)
        .where('uid', '==', uid)
        .where('state', 'in', ['issued', 'redeemed']),
    );
    if (mine.size >= offer.perUserLimit) {
      throw new HttpsError('already-exists', 'You already claimed this deal.');
    }

    const issuedCode = generateRedemptionCode();

    tx.set(redemptionRef, {
      offerId,
      businessId: offer.businessId,
      uid,
      code: issuedCode,
      state: 'issued',
      issuedAt: now,
      expiresAt,
      redeemedAt: null,
      redeemedBy: null,
      locale,
    });

    // Reserve the slot now; `expireRedemptions` releases it if unused.
    tx.update(offerRef, {
      redemptionCount: offer.redemptionCount + 1,
      updatedAt: now,
    });

    return issuedCode;
  });

  return {
    redemptionId: redemptionRef.id,
    code,
    expiresAt: expiresAt.toISOString(),
  };
});

/** Staff-side confirmation. Callable by the business that issued the offer. */
export const confirmRedemption = onCall<ConfirmRedemptionRequest, Promise<{ ok: true }>>(
  { cors: true },
  async (request) => {
    requireUid(request.auth);
    const businessId = request.auth?.token['businessId'];
    if (typeof businessId !== 'string') {
      throw new HttpsError('permission-denied', 'This account manages no business.');
    }

    const code = request.data?.code?.trim().toUpperCase();
    if (!code) throw new HttpsError('invalid-argument', 'Missing code.');

    const matches = await collections
      .redemptions()
      .where('businessId', '==', businessId)
      .where('code', '==', code)
      .where('state', '==', 'issued')
      .limit(1)
      .get();

    const found = matches.docs[0];
    if (!found) throw new HttpsError('not-found', 'No open code matches that.');

    const redemption = found.data();
    const now = new Date();
    if (redemption.expiresAt < now) {
      throw new HttpsError('deadline-exceeded', 'That code has expired.');
    }

    await found.ref.update({
      state: 'redeemed',
      redeemedAt: now,
      redeemedBy: request.auth?.uid ?? null,
    });

    return { ok: true } as const;
  },
);
