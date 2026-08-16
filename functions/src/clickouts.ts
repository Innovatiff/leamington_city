/**
 * Outbound link tracking.
 *
 * The client never writes /clickouts and never chooses the destination: it
 * names a target, and the function resolves the URL from Firestore and records
 * the hit. That keeps the collection unforgeable and keeps `websiteUrl` — the
 * one thing this app exists to link to — server-authoritative.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  CLICKOUT_SOURCES,
  LOCALES,
  type ClickoutRequest,
  type ClickoutResponse,
  type ClickoutSource,
  type ClickoutTargetType,
  type Locale,
} from '@leamington/shared';
import { collections } from './firebase.js';
import './options.js';

const TARGET_TYPES: readonly ClickoutTargetType[] = ['business', 'offer', 'job'];

function assertEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new HttpsError('invalid-argument', `Invalid ${field}.`);
  }
  return value as T;
}

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', `Missing ${field}.`);
  }
  return value.trim();
}

/** Only http(s) leaves the app. A stored `javascript:` URL must not be honoured. */
function assertSafeUrl(url: string | null): string {
  if (!url) throw new HttpsError('failed-precondition', 'No destination for this target.');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpsError('failed-precondition', 'Destination is not a valid URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new HttpsError('failed-precondition', 'Destination is not a web address.');
  }
  return parsed.toString();
}

async function resolveTarget(
  targetType: ClickoutTargetType,
  targetId: string,
): Promise<{ businessId: string; destinationUrl: string }> {
  if (targetType === 'business') {
    const snapshot = await collections.businesses().doc(targetId).get();
    const business = snapshot.data();
    if (!business) throw new HttpsError('not-found', 'Business not found.');
    return {
      businessId: business.id,
      destinationUrl: assertSafeUrl(business.websiteUrl),
    };
  }

  if (targetType === 'offer') {
    const snapshot = await collections.offers().doc(targetId).get();
    const offer = snapshot.data();
    if (!offer) throw new HttpsError('not-found', 'Offer not found.');
    return {
      businessId: offer.businessId,
      // The denormalized ref carries the website, so this stays a single read.
      destinationUrl: assertSafeUrl(offer.business.websiteUrl),
    };
  }

  const snapshot = await collections.jobs().doc(targetId).get();
  const job = snapshot.data();
  if (!job) throw new HttpsError('not-found', 'Job not found.');
  const destination =
    job.applyUrl ?? (job.applyEmail ? `mailto:${job.applyEmail}` : null);
  // An apply-by-email job is a legitimate destination that is not http(s).
  if (destination && destination.startsWith('mailto:')) {
    return { businessId: job.businessId, destinationUrl: destination };
  }
  return { businessId: job.businessId, destinationUrl: assertSafeUrl(destination) };
}

export const recordClickout = onCall<ClickoutRequest, Promise<ClickoutResponse>>(
  { cors: true, consumeAppCheckToken: false },
  async (request): Promise<ClickoutResponse> => {
    const data = request.data ?? ({} as ClickoutRequest);

    const targetType = assertEnum<ClickoutTargetType>(
      data.targetType,
      TARGET_TYPES,
      'targetType',
    );
    const targetId = assertNonEmptyString(data.targetId, 'targetId');
    const sessionId = assertNonEmptyString(data.sessionId, 'sessionId');
    const locale = assertEnum<Locale>(data.locale, LOCALES, 'locale');
    const source = assertEnum<ClickoutSource>(data.source, CLICKOUT_SOURCES, 'source');

    const { businessId, destinationUrl } = await resolveTarget(targetType, targetId);

    // Analytics must never block the navigation the user asked for. If the
    // write fails we still hand back the destination.
    try {
      await collections.clickouts().add({
        businessId,
        targetType,
        targetId,
        destinationUrl,
        uid: request.auth?.uid ?? null,
        sessionId,
        locale,
        source,
        userAgent: request.rawRequest.get('user-agent') ?? null,
        referrer: request.rawRequest.get('referer') ?? null,
        createdAt: new Date(),
      });
    } catch (error) {
      logger.error('clickout write failed', { targetType, targetId, error });
    }

    return { destinationUrl };
  },
);
