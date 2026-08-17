/**
 * Firebase Analytics.
 *
 * On by default. Set `PUBLIC_ENABLE_ANALYTICS=0` to turn it off for a build —
 * useful for a staging deploy you do not want polluting the numbers.
 *
 * Three properties this module guarantees, because analytics is the one thing on
 * the page that must never matter more than the page:
 *
 *   1. **It cannot break anything.** Roughly a third of readers run a content
 *      blocker, and `googletagmanager.com` is on every blocklist. Every path
 *      here swallows its own failures, so a blocked load is a no-op: nothing
 *      throws, nothing is left unhandled, and the page renders identically.
 *      (The Firebase SDK still logs one `TypeError: Failed to fetch` of its own
 *      when its endpoints are unreachable. That is inside the SDK, not a
 *      rejection we can intercept — an earlier version of this file tried, with
 *      an `unhandledrejection` guard that provably never fired. Silencing it
 *      would mean `setLogLevel('silent')` across all of Firebase, which would
 *      also hide real Functions errors. Not worth the trade.)
 *   2. **It is lazy.** The SDK is a dynamic import, so it is never on the
 *      critical path for first paint on a phone.
 *   3. **It honours opt-out signals.** Global Privacy Control is a legally
 *      recognised request in several jurisdictions, and Do Not Track is a plain
 *      statement of preference. Both are respected.
 */

import type { Analytics } from 'firebase/analytics';
import { getFirebaseApp } from './firebase';

interface PrivacySignals {
  globalPrivacyControl?: boolean;
  doNotTrack?: string;
}

/** True when the reader has asked, at the browser level, not to be tracked. */
export function optedOut(): boolean {
  const nav = navigator as Navigator & PrivacySignals;
  if (nav.globalPrivacyControl === true) return true;
  return nav.doNotTrack === '1';
}

/** Off only when explicitly disabled, so a missing env var still collects. */
export function analyticsEnabled(): boolean {
  return import.meta.env.PUBLIC_ENABLE_ANALYTICS !== '0';
}

let instance: Analytics | null = null;
let started: Promise<Analytics | null> | null = null;

/**
 * Initialises Analytics once per page and resolves to `null` when it did not
 * start — disabled, opted out, unsupported, or blocked.
 */
export function initAnalytics(): Promise<Analytics | null> {
  if (started) return started;

  started = (async () => {
    if (!analyticsEnabled() || optedOut()) return null;

    try {
      const { getAnalytics, isSupported } = await import('firebase/analytics');
      // False in browsers without the required APIs, and in any server context.
      if (!(await isSupported())) return null;
      instance = getAnalytics(getFirebaseApp());
      return instance;
    } catch {
      // Blocked by an extension, offline, or misconfigured. Not our problem to
      // surface: the reader came here for a phone number, not for telemetry.
      return null;
    }
  })();

  return started;
}

/**
 * Records an event, if analytics is running. Never throws and never awaits
 * anything the caller depends on.
 *
 * `page_view` is not sent from here — gtag collects it automatically on load,
 * and this site is a set of separate documents rather than a single-page app,
 * so every navigation is already a fresh page view.
 */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  void (async () => {
    try {
      const analytics = await initAnalytics();
      if (!analytics) return;
      const { logEvent } = await import('firebase/analytics');
      logEvent(analytics, name, params);
    } catch {
      // Same reasoning as above.
    }
  })();
}
