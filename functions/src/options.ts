import { setGlobalOptions } from 'firebase-functions/v2';

/**
 * Toronto region — the users are in Leamington, and Firestore lives in the same
 * region, so a callable is a same-region hop rather than a trip to us-central1.
 *
 * `maxInstances` is a cost guard, not a capacity plan. A directory app for one
 * town does not need to be able to spend without limit.
 */
export const REGION = 'northamerica-northeast1';

setGlobalOptions({
  region: REGION,
  maxInstances: 10,
  memory: '256MiB',
  timeoutSeconds: 60,
});

/** The scheduler expresses times in this zone. */
export const SCHEDULE_TIME_ZONE = 'America/Toronto';
