import { useState, type MouseEvent } from 'react';
import type { ClickoutSource, ClickoutTargetType, Locale } from '@leamington/shared';

interface Props {
  targetType: ClickoutTargetType;
  targetId: string;
  /** Rendered as the anchor href so the link works without JavaScript. */
  fallbackUrl: string;
  locale: Locale;
  source: ClickoutSource;
  label: string;
  className?: string;
}

/** Host only — the full destination URL is already in /clickouts, and an
 * analytics event does not need to carry query strings that may hold anything. */
function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

/**
 * The one thing this app does: send people to the business's own website.
 *
 * The anchor's href is the real destination, so it is a working link before
 * hydration and for anyone with JavaScript off. When JS is available the click
 * is routed through the `recordClickout` callable, which counts the hit and
 * returns the server's idea of the destination — the client never gets to
 * decide where a clickout points.
 */
export default function ClickoutLink({
  targetType,
  targetId,
  fallbackUrl,
  locale,
  source,
  label,
  className = 'btn-primary w-full',
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleClick(event: MouseEvent<HTMLAnchorElement>): Promise<void> {
    // Let modified clicks (new tab, download) behave normally.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (busy) return;
    setBusy(true);

    // The outbound click is the conversion this whole app exists to produce, so
    // it is recorded before anything that can fail. Putting this after the
    // callable would mean losing the event whenever the function is slow, cold,
    // or unreachable — exactly the cases where the reader still left the site.
    // `trackEvent` never throws and is not awaited.
    void import('../lib/analytics').then(({ trackEvent }) => {
      trackEvent('clickout', {
        target_type: targetType,
        target_id: targetId,
        source,
        locale,
        destination_host: safeHost(fallbackUrl),
      });
    });

    try {
      // Loaded on demand: a reader who never taps this never pays for the SDK.
      const { recordClickout, getSessionId } = await import('../lib/firebase');
      const { destinationUrl } = await recordClickout({
        targetType,
        targetId,
        sessionId: getSessionId(),
        locale,
        source,
      });
      window.location.href = destinationUrl;
    } catch {
      // Analytics must never cost someone the link they asked for.
      window.location.href = fallbackUrl;
    } finally {
      setBusy(false);
    }
  }

  return (
    <a
      href={fallbackUrl}
      onClick={handleClick}
      rel="noopener nofollow"
      aria-busy={busy || undefined}
      className={className}
    >
      {label}
    </a>
  );
}
