/**
 * Firebase client for the internal admin app.
 *
 * Same email-link sign-in as the portal; what separates an admin from an owner
 * is the `roles` custom claim, which security rules and the callables check.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  doc,
  type Firestore,
} from 'firebase/firestore';
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
  type Functions,
} from 'firebase/functions';
import {
  COLLECTIONS,
  businessConverter,
  feedDayConverter,
  offerConverter,
  type UserRole,
} from '@leamington/shared';

const REGION = 'northamerica-northeast1';
const useEmulators = import.meta.env.VITE_USE_EMULATORS === '1';

/**
 * Firebase Web config for the `leamingtoncity` project.
 *
 * These are public identifiers — Google documents them as safe to ship in a
 * client bundle, because access control is firestore.rules, not secrecy. They
 * are inlined as defaults so a fresh clone runs with no `.env`; the environment
 * wins when it is set, which is how a staging project gets pointed elsewhere.
 */
const FALLBACK_CONFIG = {
  apiKey: 'AIzaSyAQgRAa8ECMyIkonsJhcNQWSz2fo-LTO0Y',
  authDomain: 'leamingtoncity.firebaseapp.com',
  projectId: 'leamingtoncity',
  storageBucket: 'leamingtoncity.firebasestorage.app',
  messagingSenderId: '909406298465',
  appId: '1:909406298465:web:5a27d81ebd582246af6520',
} as const;

function config() {
  const env = import.meta.env;
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || FALLBACK_CONFIG.apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || FALLBACK_CONFIG.authDomain,
    projectId: env.VITE_FIREBASE_PROJECT_ID || FALLBACK_CONFIG.projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || FALLBACK_CONFIG.storageBucket,
    messagingSenderId:
      env.VITE_FIREBASE_MESSAGING_SENDER_ID || FALLBACK_CONFIG.messagingSenderId,
    appId: env.VITE_FIREBASE_APP_ID || FALLBACK_CONFIG.appId,
  };
}

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;
let functionsInstance: Functions | undefined;

function getApp(): FirebaseApp {
  if (app) return app;
  app = getApps()[0] ?? initializeApp(config());
  return app;
}

export function auth(): Auth {
  if (authInstance) return authInstance;
  authInstance = getAuth(getApp());
  if (useEmulators) {
    connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  return authInstance;
}

export function db(): Firestore {
  if (dbInstance) return dbInstance;
  dbInstance = getFirestore(getApp());
  if (useEmulators) connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080);
  return dbInstance;
}

export function functions(): Functions {
  if (functionsInstance) return functionsInstance;
  functionsInstance = getFunctions(getApp(), REGION);
  if (useEmulators) connectFunctionsEmulator(functionsInstance, '127.0.0.1', 5001);
  return functionsInstance;
}

export const refs = {
  businesses: () =>
    collection(db(), COLLECTIONS.businesses).withConverter(businessConverter),
  business: (businessId: string) =>
    doc(db(), COLLECTIONS.businesses, businessId).withConverter(businessConverter),
  offers: () => collection(db(), COLLECTIONS.offers).withConverter(offerConverter),
  feedDay: (dayKey: string) =>
    doc(db(), COLLECTIONS.feedDays, dayKey).withConverter(feedDayConverter),
};

/** Mints the `businessId` custom claim. Admin-only, enforced server-side. */
export function assignBusinessOwner(input: {
  uid: string;
  businessId: string | null;
  roles?: UserRole[];
}): Promise<{ data: { ok: true } }> {
  return httpsCallable<typeof input, { ok: true }>(
    functions(),
    'assignBusinessOwner',
  )(input);
}

/** Fires the Netlify build hook now, bypassing the debounce. Admin-only. */
export function rebuildSite(): Promise<{ data: { triggered: boolean } }> {
  return httpsCallable<{ force?: boolean }, { triggered: boolean }>(
    functions(),
    'rebuildSite',
  )({ force: true });
}

/** Forces a feed rebuild for a day. Admin-only, enforced server-side. */
export function rebuildFeed(dayKey?: string): Promise<{ data: { items: number } }> {
  return httpsCallable<{ dayKey?: string }, { items: number }>(
    functions(),
    'rebuildFeed',
  )({ dayKey });
}

const EMAIL_KEY = 'lc.admin.email';

export async function sendSignInLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(auth(), email, {
    url: window.location.origin,
    handleCodeInApp: true,
  });
  localStorage.setItem(EMAIL_KEY, email);
}

export async function completeSignInFromLink(): Promise<boolean> {
  const client = auth();
  if (!isSignInWithEmailLink(client, window.location.href)) return false;

  const stored = localStorage.getItem(EMAIL_KEY);
  const email = stored ?? window.prompt('Confirm your email') ?? '';
  if (!email) return false;

  await signInWithEmailLink(client, email, window.location.href);
  localStorage.removeItem(EMAIL_KEY);
  window.history.replaceState({}, '', window.location.pathname);
  return true;
}
