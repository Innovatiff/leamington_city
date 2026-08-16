/**
 * Custom claims.
 *
 * `request.auth.token.businessId` is what firestore.rules checks to decide who
 * may write a business document, so minting it is an admin-only operation and
 * lives here. The `users/{uid}` mirror exists only so the portal can render
 * without decoding a token — the claim is authoritative.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { logger } from 'firebase-functions';
import type { AppClaims, UserRole } from '@leamington/shared';
import { collections } from './firebase.js';
import './options.js';

function requireAdmin(token: Record<string, unknown> | undefined): void {
  const roles = token?.['roles'];
  if (!Array.isArray(roles) || !roles.includes('admin')) {
    throw new HttpsError('permission-denied', 'Admins only.');
  }
}

interface AssignBusinessRequest {
  uid: string;
  /** `null` revokes the assignment. */
  businessId: string | null;
  roles?: UserRole[];
}

export const assignBusinessOwner = onCall<AssignBusinessRequest, Promise<{ ok: true }>>(
  { cors: true },
  async (request) => {
    requireAdmin(request.auth?.token);

    const { uid, businessId } = request.data ?? ({} as AssignBusinessRequest);
    if (typeof uid !== 'string' || uid.length === 0) {
      throw new HttpsError('invalid-argument', 'Missing uid.');
    }
    if (businessId !== null && typeof businessId !== 'string') {
      throw new HttpsError('invalid-argument', 'businessId must be a string or null.');
    }

    if (businessId) {
      const business = await collections.businesses().doc(businessId).get();
      if (!business.exists) throw new HttpsError('not-found', 'Business not found.');
    }

    const roles: UserRole[] = request.data.roles ?? (businessId ? ['owner'] : []);
    const claims: AppClaims = {};
    if (businessId) claims.businessId = businessId;
    if (roles.length > 0) claims.roles = roles;

    await getAuth().setCustomUserClaims(uid, claims);

    const now = new Date();
    await collections
      .users()
      .doc(uid)
      .set(
        {
          locale: 'en',
          businessId,
          roles,
          push: { token: null, enabled: false, lastSentDay: null },
          savedBusinessIds: [],
          createdAt: now,
          updatedAt: now,
        },
        { merge: true },
      );

    // A business with an owner is no longer a stub.
    if (businessId) {
      await collections.businesses().doc(businessId).update({
        tier: 'claimed',
        claimedAt: now,
        updatedAt: now,
      });
    }

    logger.info('claims assigned', { uid, businessId, roles });
    return { ok: true } as const;
  },
);
