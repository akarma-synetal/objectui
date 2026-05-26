// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Shared hooks + types for the metadata-admin engine (Phase 3c).
 *
 * Centralises the MetadataClient creation and the rich `/meta/types`
 * row shape so every page reads from the same source of truth.
 *
 * Why a tiny barrel?
 *   • DirectoryPage, ListPage, EditPage, HistoryPage and QuickFind
 *     all need (client, typesRegistry). Letting each page re-fetch
 *     would be wasteful and produce flickering badges.
 *   • The hook caches the client per `baseUrl + environmentId` pair
 *     so `client.withEnvironment(...)` swaps without remounting
 *     consumers.
 */

import { useEffect, useMemo, useState } from 'react';
import { MetadataClient } from '@object-ui/data-objectstack';

export interface RichMetadataTypeEntry {
  type: string;
  label?: string;
  description?: string;
  domain?: string;
  allowOrgOverride?: boolean;
  /** 'registry' = ADR opt-in; 'env' = unlocked via OBJECTSTACK_METADATA_WRITABLE. */
  overrideSource?: 'registry' | 'env';
  supportsOverlay?: boolean;
  loadOrder?: number;
  /** JSONSchema for the type's item shape (Phase 3a addition). */
  schema?: Record<string, unknown>;
  /** UI hints (icon, color, etc.) the framework may include. */
  ui?: Record<string, unknown>;
}

/** Use a single MetadataClient for the whole admin engine. */
export function useMetadataClient(environmentId?: string): MetadataClient {
  return useMemo(() => {
    const c = new MetadataClient({ baseUrl: '' });
    return environmentId ? c.withEnvironment(environmentId) : c;
  }, [environmentId]);
}

/**
 * Fetch and cache the rich `/meta/types` registry response. Most pages
 * only need it once per session, so we memoise per (client) instance.
 */
export function useMetadataTypes(client: MetadataClient): {
  loading: boolean;
  error: string | null;
  entries: RichMetadataTypeEntry[];
} {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<RichMetadataTypeEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const result = await client.listTypes();
        let list: RichMetadataTypeEntry[];
        if (Array.isArray(result)) {
          list = (result as any[]).map((t) =>
            typeof t === 'string' ? { type: t } : (t as RichMetadataTypeEntry),
          );
        } else {
          const rich = (result as any)?.entries;
          if (Array.isArray(rich) && rich.length > 0) {
            list = rich;
          } else {
            const names = (result as any)?.types ?? [];
            list = names.map((t: string) => ({ type: t }));
          }
        }
        if (!cancelled) {
          setEntries(list);
          setLoading(false);
        }
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
  }, [client]);

  return { loading, error, entries };
}

/**
 * Build a stable lookup map by type id from the entries array. Most
 * pages need O(1) access to "what's the label / writable status for
 * type X?".
 */
export function useTypesIndex(entries: RichMetadataTypeEntry[]): Record<string, RichMetadataTypeEntry> {
  return useMemo(() => {
    const idx: Record<string, RichMetadataTypeEntry> = {};
    for (const e of entries) idx[e.type] = e;
    return idx;
  }, [entries]);
}

/** Free-text filter helper used by list pages + QuickFind. */
export function matchesQuery(
  item: Record<string, unknown>,
  query: string,
  fields: string[] = ['name', 'label', 'description'],
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  for (const f of fields) {
    const v = item[f];
    if (typeof v === 'string' && v.toLowerCase().includes(q)) return true;
  }
  return false;
}
