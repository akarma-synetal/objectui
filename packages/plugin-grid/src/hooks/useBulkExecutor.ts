/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useCallback, useRef, useState } from 'react';
import type { BulkActionDef } from '@object-ui/types';
import { RelatedCountStore } from '@object-ui/components';

export interface BulkRowError {
  id: string;
  error: string;
}

export interface BulkProgress {
  total: number;
  done: number;
  failed: number;
  inFlight: boolean;
}

export interface BulkResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: BulkRowError[];
}

/**
 * Per-row snapshot of pre-mutation field values, captured so an `update`
 * batch can be reversed. Captures only the keys the patch touched (we cannot
 * faithfully undo a `delete` without a soft-delete provider, so the executor
 * skips snapshotting for non-update operations).
 */
export interface BulkSnapshotEntry {
  id: string;
  prev: Record<string, unknown>;
}

export interface BulkExecutorOptions {
  /** ObjectQL resource name (e.g. 'account'). */
  resource: string;
  /**
   * Minimal data-source surface required by the executor. Matches the public
   * shape of `@object-ui/data-objectstack`'s DataSource without importing it,
   * so consumers can inject any compatible adapter.
   */
  dataSource: {
    update: (resource: string, id: string, patch: Record<string, unknown>) => Promise<unknown>;
    delete: (resource: string, id: string) => Promise<unknown>;
    /**
     * Optional server-side bulk-update primitive. When present, the executor
     * collapses an entire `update` batch into a single HTTP request — turning
     * "mark 500 notifications read" from 500 PATCH calls into 1. Adapters
     * without bulk support keep working via the per-row fallback below.
     */
    bulkUpdate?: (
      resource: string,
      ids: ReadonlyArray<string | number>,
      patch: Record<string, unknown>,
    ) => Promise<number>;
  };
}

/**
 * Sequential executor for bulk actions. Iterates the selected records in
 * configurable batches. For `update` operations the hook prefers the
 * adapter's `bulkUpdate` primitive (one HTTP request per batch); when it's
 * absent or throws, it falls back to per-row `dataSource.update`/`delete`
 * via `Promise.allSettled` so a single failure never aborts the run.
 *
 * In addition to running, the hook also exposes:
 *   - `undo()`   — replay the prior values captured during the last update run
 *   - `retry(id)`— re-attempt a single failed row using the last run's params
 *
 * Bulk vs per-row tradeoff:
 * - Bulk halves network round-trips and lets the server enforce atomicity
 *   inside a single transaction (typical "mark all read" use case).
 * - Per-row preserves exact (id, error) attribution for the result CSV.
 * - The hook automatically falls back from bulk to per-row when bulkUpdate
 *   throws, so users still get actionable error detail on hard failures.
 *   Soft (`succeeded < total`) shortfalls surface as a single aggregate
 *   error entry per batch — see comments inline.
 */
export function useBulkExecutor({ resource, dataSource }: BulkExecutorOptions) {
  const [progress, setProgress] = useState<BulkProgress>({
    total: 0,
    done: 0,
    failed: 0,
    inFlight: false,
  });
  const [result, setResult] = useState<BulkResult | null>(null);
  // Captured pre-mutation state for the most recent successful update run.
  // We intentionally keep this in a ref so it survives re-renders without
  // forcing the dialog to re-mount its result UI.
  const snapshotRef = useRef<BulkSnapshotEntry[]>([]);
  const lastRunRef = useRef<{
    def: BulkActionDef;
    rows: Array<Record<string, unknown>>;
    params: Record<string, unknown>;
  } | null>(null);

  const reset = useCallback(() => {
    setProgress({ total: 0, done: 0, failed: 0, inFlight: false });
    setResult(null);
    snapshotRef.current = [];
    lastRunRef.current = null;
  }, []);

  const run = useCallback(
    async (
      def: BulkActionDef,
      rows: Array<Record<string, unknown>>,
      params: Record<string, unknown>,
    ): Promise<BulkResult> => {
      const total = rows.length;
      const batchSize = Math.max(1, def.batchSize ?? 200);
      const errors: BulkRowError[] = [];
      let succeeded = 0;
      let failed = 0;

      setResult(null);
      setProgress({ total, done: 0, failed: 0, inFlight: true });

      const buildPatch = (): Record<string, unknown> => ({
        ...(def.patch ?? {}),
        ...params,
      });

      // Capture pre-mutation values for keys touched by the patch — only
      // for `update` operations. `delete` is irreversible from the client,
      // and `custom` actions don't necessarily mutate the record itself.
      const snapshot: BulkSnapshotEntry[] = [];
      if (def.operation === 'update') {
        const patchKeys = Object.keys(buildPatch());
        for (const row of rows) {
          const id = String(row.id ?? '');
          if (!id) continue;
          const prev: Record<string, unknown> = {};
          for (const k of patchKeys) {
            prev[k] = (row as Record<string, unknown>)[k];
          }
          snapshot.push({ id, prev });
        }
      }

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        // Fast path: when the operation is `update`, the adapter exposes a
        // bulk-update primitive, and we have at least 2 rows in the batch,
        // collapse to a single HTTP request. The per-row snapshot captured
        // above still powers granular undo; we only lose per-row error
        // detail when the server reports a partial failure (rare for the
        // "same patch to N rows" shape this hook supports).
        const canBulkUpdate =
          def.operation === 'update'
          && typeof dataSource.bulkUpdate === 'function'
          && batch.length >= 2;

        if (canBulkUpdate) {
          const ids = batch
            .map(r => (r.id != null ? String(r.id) : ''))
            .filter(s => s.length > 0);

          const missing = batch.length - ids.length;
          if (missing > 0) {
            // Surface ids-less rows as failures up-front so the bulk call
            // operates on a clean id list.
            for (let k = 0; k < batch.length; k += 1) {
              if (batch[k].id == null) {
                failed += 1;
                errors.push({
                  id: `index_${i + k}`,
                  error: 'Missing record id',
                });
              }
            }
          }

          try {
            const patch = buildPatch();
            const n = await dataSource.bulkUpdate!(resource, ids, patch);
            const bulkSucceeded = Math.max(0, Math.min(n, ids.length));
            succeeded += bulkSucceeded;
            const bulkFailed = ids.length - bulkSucceeded;
            if (bulkFailed > 0) {
              // No per-id breakdown from the bulk endpoint; collapse the
              // shortfall into a single aggregate entry rather than
              // fabricating row attribution.
              failed += bulkFailed;
              errors.push({
                id: `batch_${i}`,
                error: `${bulkFailed} record${bulkFailed === 1 ? '' : 's'} failed in bulk update`,
              });
            }
          } catch (err) {
            // Fall back to per-row updates for this batch so the user gets
            // actionable per-id error rows in the result CSV.
            const settled = await Promise.allSettled(
              batch.map(row => {
                const id = String(row.id ?? '');
                if (!id) return Promise.reject(new Error('Missing record id'));
                return dataSource.update(resource, id, buildPatch());
              }),
            );
            settled.forEach((res, batchIdx) => {
              const row = batch[batchIdx];
              if (res.status === 'fulfilled') {
                succeeded += 1;
              } else {
                failed += 1;
                errors.push({
                  id: String(row.id ?? `index_${i + batchIdx}`),
                  error: res.reason instanceof Error ? res.reason.message : String(res.reason),
                });
              }
            });
            // Swallow `err` after fallback — its message would duplicate
            // the per-row entries we just appended.
            void err;
          }
          setProgress({ total, done: succeeded, failed, inFlight: true });
          continue;
        }

        const settled = await Promise.allSettled(
          batch.map(row => {
            const id = String(row.id ?? '');
            if (!id) {
              return Promise.reject(new Error('Missing record id'));
            }
            switch (def.operation) {
              case 'delete':
                return dataSource.delete(resource, id);
              case 'update':
                return dataSource.update(resource, id, buildPatch());
              case 'custom':
                // No mutation — caller wires onComplete events for callouts.
                return Promise.resolve();
              default:
                return Promise.reject(new Error(`Unknown operation: ${def.operation}`));
            }
          }),
        );
        settled.forEach((res, batchIdx) => {
          const row = batch[batchIdx];
          if (res.status === 'fulfilled') {
            succeeded += 1;
          } else {
            failed += 1;
            errors.push({
              id: String(row.id ?? `index_${i + batchIdx}`),
              error: res.reason instanceof Error ? res.reason.message : String(res.reason),
            });
          }
        });
        setProgress({ total, done: succeeded, failed, inFlight: true });
      }

      const finalResult: BulkResult = { total, succeeded, failed, errors };
      // Only retain the snapshot for rows that actually succeeded — there's
      // no point trying to "undo" a row whose mutation never landed.
      const failedIds = new Set(errors.map(e => e.id));
      snapshotRef.current = snapshot.filter(s => !failedIds.has(s.id));
      lastRunRef.current = { def, rows, params };
      setProgress({ total, done: succeeded, failed, inFlight: false });
      setResult(finalResult);
      // Mutating any row in `resource` may have changed how many records
      // belong to a parent (e.g. deleting Contacts under an Account). Drop
      // every cached count for this resource so the next page render
      // re-probes. Cheap — counts are 1-int values.
      if (succeeded > 0) {
        RelatedCountStore.invalidate(resource);
      }
      return finalResult;
    },
    [resource, dataSource],
  );

  /**
   * Reverse the most recent `update` run by replaying each captured snapshot
   * back through `dataSource.update`. No-op (returns null) when the last run
   * was a delete/custom operation or when no successful rows were recorded.
   */
  const undo = useCallback(async (): Promise<BulkResult | null> => {
    const snapshot = snapshotRef.current;
    if (!snapshot.length) return null;
    const total = snapshot.length;
    const errors: BulkRowError[] = [];
    let succeeded = 0;
    let failed = 0;

    setResult(null);
    setProgress({ total, done: 0, failed: 0, inFlight: true });

    const settled = await Promise.allSettled(
      snapshot.map(entry => dataSource.update(resource, entry.id, entry.prev)),
    );
    settled.forEach((res, idx) => {
      if (res.status === 'fulfilled') succeeded += 1;
      else {
        failed += 1;
        errors.push({
          id: snapshot[idx].id,
          error: res.reason instanceof Error ? res.reason.message : String(res.reason),
        });
      }
    });

    const undoResult: BulkResult = { total, succeeded, failed, errors };
    // Clear the snapshot — undoing twice would re-apply the old values
    // against rows that have already been reverted, which is rarely useful
    // and easy to do by accident from a sticky toast.
    snapshotRef.current = [];
    setProgress({ total, done: succeeded, failed, inFlight: false });
    setResult(undoResult);
    return undoResult;
  }, [resource, dataSource]);

  /**
   * Re-attempt a single previously-failed row using the same operation +
   * params as the original run. Returns true on success.
   */
  const retry = useCallback(
    async (rowId: string): Promise<boolean> => {
      const last = lastRunRef.current;
      if (!last) return false;
      const row = last.rows.find(r => String(r.id ?? '') === rowId);
      if (!row) return false;
      const patch = { ...(last.def.patch ?? {}), ...last.params };
      try {
        switch (last.def.operation) {
          case 'delete':
            await dataSource.delete(resource, rowId);
            break;
          case 'update':
            await dataSource.update(resource, rowId, patch);
            break;
          case 'custom':
            return true;
          default:
            return false;
        }
        // Drop this row from the result's errors list — caller updates the
        // outer result so the UI reflects the new state.
        setResult(prev => {
          if (!prev) return prev;
          const errors = prev.errors.filter(e => e.id !== rowId);
          return {
            ...prev,
            errors,
            succeeded: prev.succeeded + 1,
            failed: Math.max(0, prev.failed - 1),
          };
        });
        return true;
      } catch {
        return false;
      }
    },
    [resource, dataSource],
  );

  return { run, undo, retry, progress, result, reset };
}
