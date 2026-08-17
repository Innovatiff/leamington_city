/**
 * Build-time data source.
 *
 * Every public page is statically generated, so these run in Node during
 * `astro build` and never in a browser. They use the Admin SDK, which bypasses
 * security rules — that is fine here because only published documents are
 * selected, and the output is a static file.
 *
 * If no credentials are configured the build still succeeds with an empty
 * dataset: a broken deploy pipeline should not be indistinguishable from a
 * broken site, and `astro build` is run in CI before any secret is available.
 */

import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  businessConverter,
  feedDayConverter,
  jobConverter,
  offerConverter,
  toDayKey,
  type Business,
  type BusinessCategory,
  type FeedDay,
  type Job,
  type Offer,
} from '@leamington/shared';

let firestore: Firestore | null | undefined;

function db(): Firestore | null {
  if (firestore !== undefined) return firestore;

  const projectId =
    process.env['GOOGLE_CLOUD_PROJECT'] ?? process.env['PUBLIC_FIREBASE_PROJECT_ID'];
  const hasCredentials =
    Boolean(process.env['GOOGLE_APPLICATION_CREDENTIALS']) ||
    Boolean(process.env['FIRESTORE_EMULATOR_HOST']) ||
    Boolean(process.env['GCLOUD_PROJECT']);

  if (!projectId || !hasCredentials) {
    console.warn(
      '[content] No Firebase credentials found — building with an empty dataset.\n' +
        '          Set GOOGLE_APPLICATION_CREDENTIALS and GOOGLE_CLOUD_PROJECT, or\n' +
        '          FIRESTORE_EMULATOR_HOST, to generate real pages.',
    );
    firestore = null;
    return firestore;
  }

  if (getApps().length === 0) {
    initializeApp({
      ...(process.env['FIRESTORE_EMULATOR_HOST']
        ? {}
        : { credential: applicationDefault() }),
      projectId,
    });
  }
  firestore = getFirestore();
  return firestore;
}

/** Every published business, ordered for the directory. */
export async function getBusinesses(): Promise<Business[]> {
  const client = db();
  if (!client) return [];
  const snapshot = await client
    .collection(COLLECTIONS.businesses)
    .withConverter(businessConverter)
    .where('status', '==', 'published')
    .get();

  return snapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => b.rank - a.rank || a.sortName.localeCompare(b.sortName));
}

/**
 * Published businesses grouped by category, ordered within each group.
 *
 * One pass over one query — category pages must not each run their own read.
 */
export async function getBusinessesByCategory(): Promise<
  Map<BusinessCategory, Business[]>
> {
  const businesses = await getBusinesses();
  const grouped = new Map<BusinessCategory, Business[]>();
  for (const business of businesses) {
    const bucket = grouped.get(business.category) ?? [];
    bucket.push(business);
    grouped.set(business.category, bucket);
  }
  return grouped;
}

export async function getBusinessBySlug(slug: string): Promise<Business | null> {
  const client = db();
  if (!client) return null;
  const snapshot = await client
    .collection(COLLECTIONS.businesses)
    .withConverter(businessConverter)
    .where('slug', '==', slug)
    .limit(1)
    .get();
  return snapshot.docs[0]?.data() ?? null;
}

/** Live offers. The denormalized `business` field means no follow-up reads. */
export async function getLiveOffers(now = new Date()): Promise<Offer[]> {
  const client = db();
  if (!client) return [];
  const snapshot = await client
    .collection(COLLECTIONS.offers)
    .withConverter(offerConverter)
    .where('status', '==', 'published')
    .where('endsAt', '>=', now)
    .orderBy('endsAt', 'asc')
    .get();
  return snapshot.docs.map((doc) => doc.data()).filter((offer) => offer.startsAt <= now);
}

export async function getOffersForBusiness(businessId: string): Promise<Offer[]> {
  const offers = await getLiveOffers();
  return offers.filter((offer) => offer.businessId === businessId);
}

export async function getOpenJobs(now = new Date()): Promise<Job[]> {
  const client = db();
  if (!client) return [];
  const snapshot = await client
    .collection(COLLECTIONS.jobs)
    .withConverter(jobConverter)
    .where('status', '==', 'published')
    .orderBy('postedAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => doc.data()).filter((job) => job.expiresAt >= now);
}

/**
 * Today's precomputed feed — a single document read. The page is rebuilt daily
 * by the deploy hook; the client re-reads the same document to refresh.
 */
export async function getFeedDay(dayKey = toDayKey()): Promise<FeedDay | null> {
  const client = db();
  if (!client) return null;
  const snapshot = await client
    .collection(COLLECTIONS.feedDays)
    .withConverter(feedDayConverter)
    .doc(dayKey)
    .get();
  return snapshot.data() ?? null;
}
