/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react';
import type { BulkActionDef } from '@object-ui/types';

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
  };
}

/**
 * Sequential executor for bulk actions. Iterates the selected records in
 * configurable batches, calling `dataSource.update`/`delete` per record. Uses
 * Promise.allSettled so a single failure never aborts the run.
 *
 * Why per-record and not the dataSource.bulk() batch endpoint:
 * - We want per-record success/failure granularity for the result drawer.
 * - The existing `dataSource.bulk()` throws on partial failure, which would
 *   require us to unpack BulkOperationError; per-record settles are simpler.
 * - Later phases can swap this for a true server-side atomic batch when the
 *   upstream `objectql.bulk()` endpoint stabilises.
 */
export function useBulkExecutor({ resource, dataSource }: BulkExecutorOptions) {
  const [progress, setProgress] = useState<BulkProgress>({
    total: 0,
    done: 0,
    failed: 0,
    inFlight: false,
  });
  const [result, setResult] = useState<BulkResult | null>(null);

  const reset = useCallback(() => {
    setProgress({ total: 0, done: 0, failed: 0, inFlight: false });
    setResult(null);
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

      // Merge declared static patch + user-supplied params for the update op.
      // params overrides patch so callers can let users tweak defaults.
      const buildPatch = (): Record<string, unknown> => ({
        ...(def.patch ?? {}),
        ...params,
      });

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
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
      setProgress({ total, done: succeeded, failed, inFlight: false });
      setResult(finalResult);
      return finalResult;
    },
    [resource, dataSource],
  );

  return { run, progress, result, reset };
}
