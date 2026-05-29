// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MetadataResourceHistoryPage — durable change log for one item
 * (Phase 3c).
 *
 * Calls `client.history(type, name)`. The framework returns
 * `{ events: MetadataEvent[] }` where each event records who saved
 * what, with a monotonic `seq`. We render a vertical timeline; clicking
 * an event expands its payload diff.
 *
 * Rollback is intentionally not exposed in MVP — restoring a previous
 * version is just `client.save(type, name, oldPayload)` which already
 * works, but a one-click revert needs a confirmation flow we'll add
 * once admins ask for it.
 */

import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@object-ui/components';
import { Badge } from '@object-ui/components';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { PageShell } from './PageShell';
import {
  useMetadataClient,
  useMetadataTypes,
  type RichMetadataTypeEntry,
} from './useMetadata';

export interface MetadataResourceHistoryPageProps {
  type?: string;
  name?: string;
}

type HistoryEvent = {
  seq?: number;
  kind?: string;
  actor?: string | null;
  at?: string | number;
  payload?: unknown;
  [k: string]: unknown;
};

export function MetadataResourceHistoryPage({
  type: typeProp,
  name: nameProp,
}: MetadataResourceHistoryPageProps) {
  const params = useParams<{ type?: string; name?: string }>();
  const type = typeProp ?? params.type ?? '';
  const name = nameProp ?? params.name ?? '';
  const navigate = useNavigate();
  const client = useMetadataClient();
  const { entries } = useMetadataTypes(client);
  const entry: RichMetadataTypeEntry | undefined = entries.find((t) => t.type === type);

  const [refreshKey, setRefreshKey] = React.useState(0);
  const [eventCount, setEventCount] = React.useState(0);

  return (
    <PageShell
      entry={entry ?? { type, label: type }}
      itemName={name}
      subtitle="Version history"
      stats={[{ label: 'Events', value: eventCount }]}
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`../${encodeURIComponent(name)}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to item
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </>
      }
    >
      <div className="p-6 max-w-4xl">
        <HistoryPanel
          type={type}
          name={name}
          refreshKey={refreshKey}
          onCount={setEventCount}
          client={client}
        />
      </div>
    </PageShell>
  );
}

/**
 * Embeddable version of the history timeline. Re-used by both the
 * routed full page and the right-side sheet on the edit page so we
 * keep a single visual + fetching implementation.
 */
export function HistoryPanel({
  type,
  name,
  refreshKey = 0,
  onCount,
  client,
}: {
  type: string;
  name: string;
  refreshKey?: number;
  onCount?: (n: number) => void;
  client: ReturnType<typeof useMetadataClient>;
}) {
  const [events, setEvents] = React.useState<HistoryEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const result = await client.history<any>(type, name, { limit: 100 });
        if (cancelled) return;
        const list = Array.isArray(result)
          ? result
          : Array.isArray(result?.events)
            ? result.events
            : [];
        // Reverse chronological — most recent first.
        const sorted = [...list].sort((a, b) => (b.seq ?? 0) - (a.seq ?? 0));
        setEvents(sorted);
        onCount?.(sorted.length);
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? String(err));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, type, name, refreshKey]);

  return (
    <>
      {loading && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
        </div>
      )}
      {error && (
        <div className="text-sm text-destructive border border-destructive/30 rounded p-3 bg-destructive/5">
          {error}
        </div>
      )}
      {!loading && !error && events.length === 0 && (
        <Empty>
          <EmptyTitle>No history yet</EmptyTitle>
          <EmptyDescription>
            This item has never been edited via an overlay. The first save
            will create the initial history record.
          </EmptyDescription>
        </Empty>
      )}
      {!loading && events.length > 0 && (
        <ol className="space-y-2 relative pl-6 border-l">
          {events.map((ev, i) => {
            const isOpen = expanded === i;
            return (
              <li key={`${ev.seq ?? i}-${i}`} className="relative">
                <span className="absolute -left-[27px] top-2 w-3 h-3 rounded-full bg-primary ring-4 ring-background" />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpanded(isOpen ? null : i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setExpanded(isOpen ? null : i);
                    }
                  }}
                  className="border rounded-lg p-3 hover:border-primary/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      seq {ev.seq ?? '–'}
                    </Badge>
                    {ev.kind && (
                      <Badge
                        className={
                          'text-[10px] ' +
                          (ev.kind === 'delete' || ev.kind === 'tombstone'
                            ? 'bg-red-100 text-red-800 hover:bg-red-100'
                            : ev.kind === 'create'
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                              : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100')
                        }
                      >
                        {String(ev.kind)}
                      </Badge>
                    )}
                    {ev.actor && (
                      <span className="text-xs text-muted-foreground">
                        by{' '}
                        <span className="font-mono">{String(ev.actor)}</span>
                      </span>
                    )}
                    {ev.at && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatWhen(ev.at)}
                      </span>
                    )}
                  </div>
                  {isOpen && (
                    <pre className="mt-2 text-xs font-mono bg-muted/30 rounded p-2 overflow-auto max-h-[280px]">
                      {safeStringify(ev)}
                    </pre>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

function formatWhen(at: string | number): string {
  try {
    const d = typeof at === 'number' ? new Date(at) : new Date(at);
    if (Number.isNaN(d.getTime())) return String(at);
    return d.toLocaleString();
  } catch {
    return String(at);
  }
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
