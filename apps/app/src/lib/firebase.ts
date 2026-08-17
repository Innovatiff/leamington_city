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
import { firebaseConfig, FUNCTIONS_REGION } from './site';

let app: FirebaseApp | null = null;
let functions: Functions | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  app = getApps()[0] ?? initializeApp(firebaseConfig());
  return app;
}

export function getAppFunctions(): Functions {
  if (functions) return functions;
  functions = getFunctions(getFirebaseApp(), FUNCTIONS_REGION);
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
