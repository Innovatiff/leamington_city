/**
 * Project and site constants for the public app.
 *
 * The Firebase Web config is a set of *public* identifiers — Google documents
 * them as safe to ship in a client bundle, because access control is
 * firestore.rules, not secrecy. They are inlined as defaults so a fresh clone
 * builds and runs with no `.env` at all; anything in the environment wins, which
 * is how a staging project gets pointed somewhere else.
 *
 * Restrict the browser key by HTTP referrer in the Google Cloud console anyway.
 * Public does not mean "fine for anyone to bill against your project".
 */

const FALLBACK = {
  apiKey: 'AIzaSyAQgRAa8ECMyIkonsJhcNQWSz2fo-LTO0Y',
  authDomain: 'leamingtoncity.firebaseapp.com',
  projectId: 'leamingtoncity',
  storageBucket: 'leamingtoncity.firebasestorage.app',
  messagingSenderId: '909406298465',
  appId: '1:909406298465:web:5a27d81ebd582246af6520',
  measurementId: 'G-VEQP4Y4KGX',
} as const;

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export function firebaseConfig(): FirebaseWebConfig {
  const env = import.meta.env;
  return {
    apiKey: env.PUBLIC_FIREBASE_API_KEY || FALLBACK.apiKey,
    authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN || FALLBACK.authDomain,
    projectId: env.PUBLIC_FIREBASE_PROJECT_ID || FALLBACK.projectId,
    storageBucket: env.PUBLIC_FIREBASE_STORAGE_BUCKET || FALLBACK.storageBucket,
    messagingSenderId:
      env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || FALLBACK.messagingSenderId,
    appId: env.PUBLIC_FIREBASE_APP_ID || FALLBACK.appId,
    measurementId: env.PUBLIC_FIREBASE_MEASUREMENT_ID || FALLBACK.measurementId,
  };
}

/** Cloud Functions region. Same hop as Firestore — see functions/src/options.ts. */
export const FUNCTIONS_REGION = 'northamerica-northeast1';

/**
 * Canonical origin, used for canonical/hreflang/JSON-LD when `Astro.site` is
 * not set. Swap `PUBLIC_SITE_URL` when the custom domain is live.
 */
export const SITE_URL =
  import.meta.env.PUBLIC_SITE_URL || 'https://leamingtoncity.web.app';

/** The owner portal and internal admin are separate Firebase Hosting sites. */
export const PORTAL_URL = 'https://leamingtoncity-portal.web.app';
export const ADMIN_URL = 'https://leamingtoncity-admin.web.app';
