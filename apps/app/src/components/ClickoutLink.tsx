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
