/**
 * Keeps denormalized copies honest.
 *
 * SCHEMA.md makes offers and jobs carry a `BusinessRef` snapshot so a list is
 * one query. That is only safe if something repairs the copies when the parent
 * changes — this file is that something. Read paths must never join.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { COLLECTIONS, businessCodec, toBusinessRef, type BusinessRef } from '@leamington/shared';
import { FieldValue, collections, db } from './firebase.js';
import './options.js';

/** Fields mirrored into `BusinessRef`. Only these need a fan-out. */
function refChanged(before: BusinessRef, after: BusinessRef): boolean {
  return (
    before.slug !== after.slug ||
    before.name !== after.name ||
    before.category !== after.category ||
    before.logoUrl !== after.logoUrl ||
    before.websiteUrl !== after.websiteUrl
  );
}

/** Firestore caps a batch at 500 writes. */
const BATCH_LIMIT = 500;

async function rewriteRefs(businessId: string, ref: BusinessRef): Promise<number> {
  let written = 0;

  for (const collection of [collections.offers(), collections.jobs()]) {
    const snapshot = await collection.where('businessId', '==', businessId).get();
    for (let index = 0; index < snapshot.docs.length; index += BATCH_LIMIT) {
      const batch = db.batch();
      for (const doc of snapshot.docs.slice(index, index + BATCH_LIMIT)) {
        batch.update(doc.ref, { business: ref, updatedAt: new Date() });
        written += 1;
      }
      await batch.commit();
    }
  }

  return written;
}

export const onBusinessWritten = onDocumentWritten(
  `${COLLECTIONS.businesses}/{businessId}`,
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!afterData) return; // Deleted: children are cleaned up separately.

    const after = businessCodec.decode(event.params['businessId'] ?? '', afterData);
    if (!beforeData) return; // Created: no children exist yet.

    const before = businessCodec.decode(event.params['businessId'] ?? '', beforeData);
    const beforeRef = toBusinessRef(before);
    const afterRef = toBusinessRef(after);
    if (!refChanged(beforeRef, afterRef)) return;

    const written = await rewriteRefs(after.id, afterRef);
    logger.info('business ref fanned out', { businessId: after.id, written });
  },
);

/**
 * `businesses.counts` exists so a business card never triggers a count query.
 * These two triggers are the only writers.
 */
function countDelta(before: unknown, after: unknown): number {
  const wasPublished = (before as { status?: string } | undefined)?.status === 'published';
  const isPublished = (after as { status?: string } | undefined)?.status === 'published';
  if (wasPublished === isPublished) return 0;
  return isPublished ? 1 : -1;
}

function businessIdOf(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const id = (candidate as { businessId?: unknown } | undefined)?.businessId;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return null;
}

export const onOfferWritten = onDocumentWritten(
  `${COLLECTIONS.offers}/{offerId}`,
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const delta = countDelta(before, after);
    if (delta === 0) return;

    const businessId = businessIdOf(after, before);
    if (!businessId) return;

    await db
      .collection(COLLECTIONS.businesses)
      .doc(businessId)
      .update({ 'counts.offers': FieldValue.increment(delta) })
      .catch((error: unknown) => logger.warn('offer count update failed', { businessId, error }));
  },
);

export const onJobWritten = onDocumentWritten(
  `${COLLECTIONS.jobs}/{jobId}`,
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const delta = countDelta(before, after);
    if (delta === 0) return;

    const businessId = businessIdOf(after, before);
    if (!businessId) return;

    await db
      .collection(COLLECTIONS.businesses)
      .doc(businessId)
      .update({ 'counts.jobs': FieldValue.increment(delta) })
      .catch((error: unknown) => logger.warn('job count update failed', { businessId, error }));
  },
);
