import type { DayKey, Locale } from './common.js';

export type UserRole = 'admin' | 'owner';

export interface PushState {
  token: string | null;
  enabled: boolean;
  /**
   * `YYYY-MM-DD` of the last push delivered to this user. The enforcement point
   * for "max one push notification per user per day".
   */
  lastSentDay: DayKey | null;
}

export interface AppUser {
  /** Equals the Firebase Auth uid. */
  id: string;
  locale: Locale;
  /** Mirror of the `businessId` custom claim. The claim is authoritative. */
  businessId: string | null;
  /** Mirror of the `roles` custom claim. The claim is authoritative. */
  roles: UserRole[];
  push: PushState;
  savedBusinessIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** Custom claims minted by `functions/src/claims.ts`. Security rules read these. */
export interface AppClaims {
  businessId?: string;
  roles?: UserRole[];
}

/** Fields a user is allowed to change on their own document. Mirrors firestore.rules. */
export const USER_SELF_WRITABLE_FIELDS = [
  'locale',
  'push',
  'savedBusinessIds',
  'updatedAt',
] as const;

export function canPushToday(user: AppUser, today: DayKey): boolean {
  if (!user.push.enabled || !user.push.token) return false;
  return user.push.lastSentDay !== today;
}
