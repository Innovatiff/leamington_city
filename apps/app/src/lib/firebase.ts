/**
 * Browser Firebase client.
 *
 * Loaded only by React islands, and lazily — a phone that never taps a
 * link-out button never downloads the Firestore or Functions SDK.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { connectFunctionsEmulator } from 'firebase/functions';
import type { ClickoutRequest, ClickoutResponse } from '@leamington/shared';

const REGION = 'northamerica-northeast1';

function config() {
  return {
    apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
    authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
  };
}

let app: FirebaseApp | null = null;
let functions: Functions | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  app = getApps()[0] ?? initializeApp(config());
  return app;
}

export function getAppFunctions(): Functions {
  if (functions) return functions;
  functions = getFunctions(getFirebaseApp(), REGION);
  if (import.meta.env.PUBLIC_USE_EMULATORS === '1') {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }
  return functions;
}

/**
 * Records the click and returns where to send the reader. The destination
 * comes back from the server: this app links out, and where it links to is not
 * a decision the browser gets to make.
 */
export async function recordClickout(
  request: ClickoutRequest,
): Promise<ClickoutResponse> {
  const callable = httpsCallable<ClickoutRequest, ClickoutResponse>(
    getAppFunctions(),
    'recordClickout',
  );
  const result = await callable(request);
  return result.data;
}

/** Anonymous, per-browser. Enough to de-duplicate clicks, not enough to identify. */
export function getSessionId(): string {
  const KEY = 'lc.sid';
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(KEY, created);
    return created;
  } catch {
    // Private mode, or storage disabled. A per-page id is still useful.
    return crypto.randomUUID();
  }
}
