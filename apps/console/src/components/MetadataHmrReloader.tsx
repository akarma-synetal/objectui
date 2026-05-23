// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MetadataHmrReloader
 *
 * Dev-only component. Subscribes to the server's metadata-events SSE
 * stream and triggers `location.reload()` (debounced) whenever any
 * metadata file changes on disk.
 *
 * Why a full reload?
 *   Studio owns its metadata-fetching layer and can invalidate granular
 *   caches via `useMetadataHmr` + custom `subscribe(...)` listeners.
 *   The runtime Console, by contrast, leans entirely on
 *   `@object-ui/app-shell` and the `@object-ui/plugin-*` packs for
 *   data loading — their caches are not externally invalidatable. A
 *   debounced page reload is the simplest reliable strategy in dev.
 *
 * Mount-time gating
 *   - `enabled` defaults to `import.meta.env.DEV` so production builds
 *     never run this component.
 *   - SSR-safe: no-op when `window`/`EventSource` are unavailable.
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export interface MetadataHmrReloaderProps {
  /** Toggle to force-disable. Defaults to `import.meta.env.DEV`. */
  enabled?: boolean;
  /** SSE endpoint. Defaults to the standard dev route. */
  url?: string;
  /** Debounce window in ms — coalesces bursts from one edit. */
  debounceMs?: number;
  /** Reconnect delay after the connection drops. */
  reconnectDelayMs?: number;
}

export function MetadataHmrReloader({
  enabled = (import.meta as any).env?.DEV ?? false,
  url = '/api/v1/dev/metadata-events',
  debounceMs = 400,
  reconnectDelayMs = 2000,
}: MetadataHmrReloaderProps) {
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const scheduleReload = (reason: string) => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        try {
          toast.info(`Metadata changed (${reason}) — reloading…`, { duration: 800 });
        } catch { /* toaster may be unmounted */ }
        // Small extra delay so the toast paints before navigation.
        setTimeout(() => {
          try { window.location.reload(); } catch { /* noop */ }
        }, 150);
      }, debounceMs);
    };

    const onChange = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as {
          metadataType?: string;
          name?: string;
        };
        const label = data?.name
          ? `${data.metadataType ?? 'metadata'}:${data.name}`
          : 'metadata';
        scheduleReload(label);
      } catch {
        scheduleReload('change');
      }
    };

    const onReload = (event: MessageEvent<string>) => {
      let reason = 'rebuild';
      try {
        const data = JSON.parse(event.data) as { reason?: string };
        reason = data?.reason ?? reason;
      } catch { /* tolerate */ }
      scheduleReload(reason);
    };

    const connect = () => {
      if (cancelled) return;
      try {
        es = new EventSource(url);
        es.addEventListener('metadata-change', onChange as EventListener);
        es.addEventListener('reload', onReload as EventListener);
        es.addEventListener('error', () => {
          if (cancelled) return;
          if (es?.readyState === EventSource.CLOSED) {
            es = null;
            retryTimer = setTimeout(connect, reconnectDelayMs);
          }
        });
      } catch {
        retryTimer = setTimeout(connect, reconnectDelayMs);
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      if (es) { try { es.close(); } catch { /* noop */ } }
    };
  }, [enabled, url, debounceMs, reconnectDelayMs]);

  return null;
}
