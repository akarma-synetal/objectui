/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Local copy of the display-name resolver used by app-shell. Kept in
 * `@object-ui/react` so hooks can derive a record's visible label without
 * pulling in the shell. Mirrors `app-shell/src/utils#getRecordDisplayName`;
 * the two should stay in sync.
 */
function defaultDisplayName(objectDef: any, record: any): string {
  const fmt: string | undefined = objectDef?.titleFormat;
  if (fmt && typeof fmt === 'string') {
    const rendered = fmt.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path) => {
      const v = path.split('.').reduce((acc: any, k: string) => (acc == null ? acc : acc[k]), record);
      return v == null ? '' : String(v);
    }).trim();
    if (rendered.length > 0) return rendered;
  }
  return (
    record?.name ||
    record?.full_name ||
    record?.fullName ||
    record?.title ||
    record?.label ||
    record?.subject ||
    record?.id ||
    record?._id ||
    'Untitled'
  );
}

export interface RecordSearchHit {
  /** Object name the record belongs to. */
  objectName: string;
  /** Human-readable object label (uses `objectDef.label`, falls back to name). */
  objectLabel: string;
  /** Stable record identifier (record.id ?? record._id). */
  recordId: string;
  /** Resolved display name (via objectDef.titleFormat or fallback chain). */
  display: string;
  /** Optional secondary line (e.g. status or email). Always falsy by default. */
  subtitle?: string;
  /** Pass-through icon hint from the object def. */
  icon?: string;
  /** Raw record payload, for callers that want extra context. */
  raw: any;
}

export interface UseRecordSearchOptions {
  /** Current query string from the input. The hook debounces internally. */
  query: string;
  /** All known object definitions; the hook picks candidates from this list. */
  objects: any[];
  /**
   * The data source to query. When null/undefined the hook returns empty
   * results without firing any requests.
   */
  dataSource: any;
  /**
   * Optional whitelist of object names to search (typically derived from the
   * current app's nav). When non-empty, only these objects are queried — in
   * the order provided. When omitted, the hook falls back to every object
   * where `searchable !== false`, capped at `maxObjectsQueried`.
   */
  objectNames?: string[];
  /**
   * Hard cap on parallel object queries. Defaults to 8. Lower this on
   * slow backends.
   */
  maxObjectsQueried?: number;
  /** Per-object result cap. Defaults to 3. */
  topPerObject?: number;
  /** Min query length before any request fires. Defaults to 2. */
  minLength?: number;
  /** Debounce in ms. Defaults to 250. */
  debounceMs?: number;
  /** Set to false to disable the hook entirely (returns empty, no requests). */
  enabled?: boolean;
  /**
   * Optional display-name resolver. Defaults to the same `titleFormat`
   * fallback chain used by app-shell. Pass `getRecordDisplayName` from
   * `@object-ui/app-shell` to share that implementation exactly.
   */
  getDisplayName?: (objectDef: any, record: any) => string;
}

export interface UseRecordSearchResult {
  results: RecordSearchHit[];
  isSearching: boolean;
  error?: Error;
}

/**
 * Search records across multiple objects in parallel, fanning out to
 * `dataSource.find(name, { $search, $top })`. Designed for the Cmd-K
 * command palette and similar global-search affordances.
 *
 * The hook:
 *
 *  - Debounces `query` so fast typing doesn't generate one request per
 *    keystroke.
 *  - Skips requests when the trimmed query is shorter than `minLength`,
 *    when `enabled` is false, when `dataSource` is null, or when there are
 *    no candidate objects.
 *  - Uses a monotonically-increasing `runId` to discard stale results — if
 *    the user keeps typing while requests are still in flight, only the
 *    newest run mutates state.
 *  - Tolerates per-object failures (404, etc) via `Promise.allSettled`; a
 *    backend that doesn't know about one object doesn't poison the rest of
 *    the result set.
 *
 * The hook trusts `$search` — backends that silently ignore it would
 * return top-N records unrelated to the query. The ObjectStack mock + REST
 * adapters both honor `$search`; if you need to integrate with a backend
 * that doesn't, set `enabled` to false or wrap the data source to add
 * `$filter` translation.
 */
export function useRecordSearch(opts: UseRecordSearchOptions): UseRecordSearchResult {
  const {
    query,
    objects,
    dataSource,
    objectNames,
    maxObjectsQueried = 8,
    topPerObject = 3,
    minLength = 2,
    debounceMs = 250,
    enabled = true,
    getDisplayName = defaultDisplayName,
  } = opts;

  const [results, setResults] = useState<RecordSearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Stable signature derived from the object metadata fields we actually
  // touch. Prevents pointless re-runs when the parent re-renders with a
  // new array reference but identical content.
  const candidates = useMemo(() => {
    if (!Array.isArray(objects) || objects.length === 0) return [];
    let pool = objects;
    if (Array.isArray(objectNames) && objectNames.length > 0) {
      const byName = new Map<string, any>();
      for (const obj of objects) {
        const name = obj?.name;
        if (typeof name === 'string') byName.set(name, obj);
      }
      pool = objectNames
        .map((n) => byName.get(n))
        .filter((obj): obj is any => obj != null);
    } else {
      pool = objects.filter((o) => o?.searchable !== false);
    }
    return pool.slice(0, maxObjectsQueried);
  }, [objects, objectNames, maxObjectsQueried]);

  const candidateSignature = useMemo(() => {
    return candidates.map((o) => `${o?.name}:${o?.titleField ?? ''}`).join('|');
  }, [candidates]);

  // Run ID for racing-request guarding. Stable across renders.
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!enabled || !dataSource || candidates.length === 0) {
      setResults([]);
      setIsSearching(false);
      setError(undefined);
      return;
    }

    const trimmed = (query ?? '').trim();
    if (trimmed.length < minLength) {
      setResults([]);
      setIsSearching(false);
      setError(undefined);
      return;
    }

    const myRunId = ++runIdRef.current;
    setIsSearching(true);
    setError(undefined);

    const timer = setTimeout(() => {
      // Skip if a newer run started during the debounce window.
      if (runIdRef.current !== myRunId) return;

      const requests = candidates.map((obj) =>
        Promise.resolve()
          .then(() =>
            dataSource.find(obj.name, {
              $search: trimmed,
              $top: topPerObject,
            }),
          )
          .then((res: any) => ({ obj, res, err: null as any }))
          .catch((err: any) => ({ obj, res: null, err })),
      );

      Promise.allSettled(requests).then((settled) => {
        // Discard if a newer run started while we were waiting.
        if (runIdRef.current !== myRunId) return;

        const hits: RecordSearchHit[] = [];
        let lastError: Error | undefined;
        for (const s of settled) {
          if (s.status !== 'fulfilled') continue;
          const { obj, res, err } = s.value;
          if (err) {
            // Tolerate 404 / object_not_found / similar; only surface the
            // last real error so the UI can show a non-blocking hint.
            const status = err?.httpStatus ?? err?.status;
            const code = err?.code;
            if (status === 404 || code === 'object_not_found') continue;
            lastError = err instanceof Error ? err : new Error(String(err));
            continue;
          }
          const rows: any[] = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
              ? res
              : [];
          for (const record of rows.slice(0, topPerObject)) {
            const recordId = record?.id ?? record?._id;
            if (recordId == null) continue;
            hits.push({
              objectName: obj.name,
              objectLabel:
                typeof obj.label === 'string' && obj.label.length > 0
                  ? obj.label
                  : obj.name,
              recordId: String(recordId),
              display: getDisplayName(obj, record),
              icon: obj?.icon,
              raw: record,
            });
          }
        }

        setResults(hits);
        setIsSearching(false);
        setError(lastError);
      });
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [
    query,
    enabled,
    dataSource,
    candidateSignature,
    topPerObject,
    minLength,
    debounceMs,
    getDisplayName,
  ]);

  return { results, isSearching, error };
}
