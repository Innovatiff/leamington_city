/**
 * Firebase Analytics, off by default.
 *
 * The console snippet initialises Analytics unconditionally, and this app very
 * deliberately does not. Google Analytics sets identifiers and ships behaviour
 * off-device, and a large share of this site's readers are newcomers and
 * seasonal workers — the group with the least appetite for being tracked and
 * the least ability to object. Turning it on before there is a privacy notice
 * on the site would be a decision made for them.
 *
 * So it is one environment variable away, not zero:
 *
 *   PUBLIC_ENABLE_ANALYTICS=1
 *
 * Even then it is skipped for anyone signalling Global Privacy Control or Do
 * Not Track, and it is loaded lazily so a reader who never opts in never
 * downloads the SDK.
 */

import { getFirebaseApp } from './firebase';

interface PrivacySignals {
  globalPrivacyControl?: boolean;
  doNotTrack?: string;
}

function optedOut(): boolean {
  const nav = navigator as Navigator & PrivacySignals;
  if (nav.globalPrivacyControl === true) return true;
  return nav.doNotTrack === '1';
}

export function analyticsEnabled(): boolean {
  return import.meta.env.PUBLIC_ENABLE_ANALYTICS === '1';
}

/** Resolves to `false` when analytics stayed off, for whatever reason. */
export async function initAnalytics(): Promise<boolean> {
  if (!analyticsEnabled() || optedOut()) return false;

  const { getAnalytics, isSupported } = await import('firebase/analytics');
  // Unsupported in some browsers and in every server context.
  if (!(await isSupported())) return false;

  getAnalytics(getFirebaseApp());
  return true;
}
