/**
 * Netlify rebuilds on data change.
 *
 * The public site is statically generated, so a business edit is invisible
 * until the site is rebuilt. Firing the build hook straight from a Firestore
 * trigger would be a mistake: one seed run touches hundreds of documents, and
 * Netlify would queue hundreds of builds for a single logical change.
 *
 * So triggers only mark the site dirty, and a scheduled function coalesces:
 * at most one build per `MIN_MINUTES_BETWEEN_BUILDS`, and none at all when
 * nothing changed. A burst of 400 writes costs exactly one build.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { COLLECTIONS } from '@leamington/shared';
import { db } from './firebase.js';
import { SCHEDULE_TIME_ZONE } from './options.js';

/**
 * Set with:
 *   firebase functions:secrets:set NETLIFY_BUILD_HOOK_URL
 * Value is the full hook URL from Netlify → Site settings → Build hooks.
 */
const NETLIFY_BUILD_HOOK_URL = defineSecret('NETLIFY_BUILD_HOOK_URL');

/** Marker document. Not a public collection — see firestore.rules. */
const BUILD_STATE_PATH = 'system/build';

/** Floor on build frequency. Netlify build minutes are finite. */
const MIN_MINUTES_BETWEEN_BUILDS = 10;

interface BuildState {
  dirtyAt: Date | null;
  lastBuiltAt: Date | null;
  lastReason: string | null;
}

function buildStateRef() {
  return db.doc(BUILD_STATE_PATH);
}

function readState(data: FirebaseFirestore.DocumentData | undefined): BuildState {
  const toDate = (value: unknown): Date | null =>
    value && typeof (value as { toDate?: unknown }).toDate === 'function'
      ? (value as { toDate(): Date }).toDate()
      : null;

  return {
    dirtyAt: toDate(data?.['dirtyAt']),
    lastBuiltAt: toDate(data?.['lastBuiltAt']),
    lastReason: typeof data?.['lastReason'] === 'string' ? data['lastReason'] : null,
  };
}

/** Records that the generated site no longer matches the data. */
async function markDirty(reason: string): Promise<void> {
  await buildStateRef().set(
    { dirtyAt: new Date(), lastReason: reason },
    { merge: true },
  );
}

/**
 * Everything baked into a static page marks the site dirty.
 *
 * Businesses are the obvious one, but offers and jobs are rendered onto
 * business and category pages too — a deal that never appears until tomorrow's
 * scheduled build is a deal the business did not get.
 */
export const onBusinessChangedRebuild = onDocumentWritten(
  `${COLLECTIONS.businesses}/{businessId}`,
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    // Ignore no-op writes and pure counter churn: `counts` is maintained by our
    // own triggers and does not change any rendered page enough to rebuild for.
    if (!before && !after) return;
    await markDirty(`business:${event.params['businessId']}`);
  },
);

export const onOfferChangedRebuild = onDocumentWritten(
  `${COLLECTIONS.offers}/{offerId}`,
  async (event) => {
    await markDirty(`offer:${event.params['offerId']}`);
  },
);

export const onJobChangedRebuild = onDocumentWritten(
  `${COLLECTIONS.jobs}/{jobId}`,
  async (event) => {
    await markDirty(`job:${event.params['jobId']}`);
  },
);

/** POSTs the hook and stamps `lastBuiltAt`. Returns false when nothing was due. */
async function triggerBuildIfDue(force: boolean): Promise<boolean> {
  const hookUrl = NETLIFY_BUILD_HOOK_URL.value();
  if (!hookUrl) {
    // Local emulator, or the secret was never set. Say so once, loudly, rather
    // than failing every five minutes.
    logger.warn('NETLIFY_BUILD_HOOK_URL is not configured; skipping rebuild.');
    return false;
  }

  const snapshot = await buildStateRef().get();
  const state = readState(snapshot.data());
  const now = new Date();

  if (!force) {
    if (!state.dirtyAt) return false;
    if (state.lastBuiltAt && state.dirtyAt <= state.lastBuiltAt) return false;

    const minutesSinceBuild = state.lastBuiltAt
      ? (now.getTime() - state.lastBuiltAt.getTime()) / 60_000
      : Number.POSITIVE_INFINITY;
    if (minutesSinceBuild < MIN_MINUTES_BETWEEN_BUILDS) {
      logger.info('rebuild deferred', { minutesSinceBuild });
      return false;
    }
  }

  const response = await fetch(hookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger_title: state.lastReason ?? 'manual' }),
  });

  if (!response.ok) {
    // Leave `dirtyAt` in place so the next tick retries.
    logger.error('netlify build hook failed', {
      status: response.status,
      body: await response.text().catch(() => ''),
    });
    throw new Error(`Netlify build hook returned ${response.status}`);
  }

  await buildStateRef().set({ lastBuiltAt: now }, { merge: true });
  logger.info('netlify build triggered', { reason: state.lastReason, force });
  return true;
}

/**
 * Every 5 minutes. Cheap when idle — one document read and an early return —
 * and it bounds how stale the public site can be.
 */
export const rebuildSiteIfDirty = onSchedule(
  {
    schedule: '*/5 * * * *',
    timeZone: SCHEDULE_TIME_ZONE,
    retryCount: 1,
    secrets: [NETLIFY_BUILD_HOOK_URL],
  },
  async () => {
    await triggerBuildIfDue(false);
  },
);

/** Admin escape hatch: "publish my change now". */
export const rebuildSite = onCall<{ force?: boolean }, Promise<{ triggered: boolean }>>(
  { cors: true, secrets: [NETLIFY_BUILD_HOOK_URL] },
  async (request) => {
    const roles = request.auth?.token['roles'];
    if (!Array.isArray(roles) || !roles.includes('admin')) {
      throw new HttpsError('permission-denied', 'Admins only.');
    }
    const triggered = await triggerBuildIfDue(request.data?.force ?? true);
    return { triggered };
  },
);
