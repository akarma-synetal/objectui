/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * useExportJob — drives an asynchronous, server-driven export job.
 *
 * Wraps the optional `DataSource.createExportJob` / `getExportJobProgress` /
 * `cancelExportJob` / `getExportJobDownloadUrl` methods (spec v4 export contract)
 * so any view component can offer a "streaming" export with a progress bar.
 *
 * Polls every `pollIntervalMs` (default 1500ms) while the job is `pending` or
 * `processing`. Stops on any terminal state (`completed`, `failed`,
 * `cancelled`, `expired`). The hook owns no DOM; pair it with the
 * `ExportProgressDialog` UI component for the user-facing UX.
 *
 * @example
 * ```tsx
 * const job = useExportJob({ dataSource });
 * <button onClick={() => job.start('account', { format: 'csv' })}>Export</button>
 * <ExportProgressDialog job={job} />
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DataSource,
  CreateExportJobRequest,
  ExportJobProgressInfo,
  ExportJobStatus,
} from '@object-ui/types';

export interface UseExportJobOptions {
  /** Data source providing the optional export-job methods. Required. */
  dataSource?: DataSource;
  /** Polling cadence while the job is in flight. Default 1500ms. */
  pollIntervalMs?: number;
  /** Maximum poll attempts before giving up (safety net). Default 600. */
  maxAttempts?: number;
  /** Called once the job reaches a terminal state. */
  onComplete?: (info: ExportJobProgressInfo) => void;
  /** Called when the job fails (any non-completed terminal state). */
  onError?: (error: Error, info?: ExportJobProgressInfo) => void;
}

export interface UseExportJobReturn {
  /** True when a job is in flight (pending/processing). */
  isRunning: boolean;
  /** Latest progress payload from the server. */
  progress: ExportJobProgressInfo | null;
  /** Latest terminal error (if any). */
  error: Error | null;
  /** Whether the data source supports async export (createExportJob present). */
  isSupported: boolean;
  /** Start a new export job. Returns the job id (or null when unsupported). */
  start: (
    resource: string,
    request: CreateExportJobRequest,
  ) => Promise<string | null>;
  /** Cancel the in-flight job (no-op when unsupported). */
  cancel: () => Promise<void>;
  /** Fetch a fresh download URL for the completed job. */
  getDownloadUrl: () => Promise<string | null>;
  /** Manually trigger a browser download for the completed job. */
  download: (filename?: string) => Promise<boolean>;
  /** Reset the local job state (clears progress + error). */
  reset: () => void;
}

const TERMINAL_STATUSES: ExportJobStatus[] = [
  'completed',
  'failed',
  'cancelled',
  'expired',
];

function isTerminal(status?: ExportJobStatus): boolean {
  return !!status && TERMINAL_STATUSES.includes(status);
}

export function useExportJob(opts: UseExportJobOptions = {}): UseExportJobReturn {
  const {
    dataSource,
    pollIntervalMs = 1500,
    maxAttempts = 600,
    onComplete,
    onError,
  } = opts;

  const [progress, setProgress] = useState<ExportJobProgressInfo | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const jobIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const cancelledRef = useRef(false);
  const callbacksRef = useRef({ onComplete, onError });
  callbacksRef.current = { onComplete, onError };

  const isSupported = !!dataSource?.createExportJob && !!dataSource?.getExportJobProgress;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    jobIdRef.current = null;
    cancelledRef.current = false;
    attemptsRef.current = 0;
    setProgress(null);
    setError(null);
    setIsRunning(false);
  }, [clearTimer]);

  // Tear down on unmount.
  useEffect(() => () => clearTimer(), [clearTimer]);

  const poll = useCallback(async () => {
    if (!dataSource?.getExportJobProgress) return;
    if (!jobIdRef.current || cancelledRef.current) return;
    attemptsRef.current += 1;
    if (attemptsRef.current > maxAttempts) {
      const err = new Error('Export job timed out (max attempts exceeded)');
      setError(err);
      setIsRunning(false);
      callbacksRef.current.onError?.(err, progress ?? undefined);
      return;
    }
    try {
      const next = await dataSource.getExportJobProgress(jobIdRef.current);
      if (cancelledRef.current) return;
      setProgress(next);
      if (isTerminal(next.status)) {
        setIsRunning(false);
        if (next.status === 'completed') {
          callbacksRef.current.onComplete?.(next);
        } else {
          const msg = next.error?.message ?? `Export ${next.status}`;
          const err = new Error(msg);
          setError(err);
          callbacksRef.current.onError?.(err, next);
        }
        return;
      }
      timerRef.current = setTimeout(poll, pollIntervalMs);
    } catch (e: any) {
      if (cancelledRef.current) return;
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      setIsRunning(false);
      callbacksRef.current.onError?.(err, progress ?? undefined);
    }
  }, [dataSource, maxAttempts, pollIntervalMs, progress]);

  const start = useCallback(
    async (resource: string, request: CreateExportJobRequest): Promise<string | null> => {
      if (!dataSource?.createExportJob) {
        const err = new Error(
          'DataSource does not implement createExportJob — cannot start async export.',
        );
        setError(err);
        callbacksRef.current.onError?.(err);
        return null;
      }
      // Reset previous state but keep cancelledRef false going forward.
      clearTimer();
      cancelledRef.current = false;
      attemptsRef.current = 0;
      setError(null);
      setProgress(null);
      setIsRunning(true);
      try {
        const created = await dataSource.createExportJob(resource, request);
        jobIdRef.current = created.jobId;
        setProgress({
          jobId: created.jobId,
          status: created.status,
          processedRecords: 0,
          totalRecords: created.estimatedRecords,
          percentComplete: 0,
        });
        if (isTerminal(created.status)) {
          // Server returned an instantly-finished job (e.g. cached export).
          setIsRunning(false);
          if (created.status === 'completed' && dataSource.getExportJobProgress) {
            // Fetch full payload so downloadUrl is populated.
            try {
              const full = await dataSource.getExportJobProgress(created.jobId);
              setProgress(full);
              callbacksRef.current.onComplete?.(full);
            } catch {
              // ignore — leave the minimal progress
            }
          }
          return created.jobId;
        }
        timerRef.current = setTimeout(poll, pollIntervalMs);
        return created.jobId;
      } catch (e: any) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        setIsRunning(false);
        callbacksRef.current.onError?.(err);
        return null;
      }
    },
    [dataSource, clearTimer, poll, pollIntervalMs],
  );

  const cancel = useCallback(async () => {
    if (!jobIdRef.current) return;
    cancelledRef.current = true;
    clearTimer();
    setIsRunning(false);
    if (dataSource?.cancelExportJob) {
      try {
        await dataSource.cancelExportJob(jobIdRef.current);
      } catch {
        // best-effort; UI reflects cancelled state regardless
      }
    }
    setProgress(prev => (prev ? { ...prev, status: 'cancelled' } : prev));
  }, [dataSource, clearTimer]);

  const getDownloadUrl = useCallback(async (): Promise<string | null> => {
    if (!jobIdRef.current) return null;
    if (dataSource?.getExportJobDownloadUrl) {
      try {
        return await dataSource.getExportJobDownloadUrl(jobIdRef.current);
      } catch {
        // fall through to progress.downloadUrl
      }
    }
    return progress?.downloadUrl ?? null;
  }, [dataSource, progress]);

  const download = useCallback(
    async (filename?: string): Promise<boolean> => {
      const url = await getDownloadUrl();
      if (!url) return false;
      const a = document.createElement('a');
      a.href = url;
      if (filename) a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    },
    [getDownloadUrl],
  );

  return {
    isRunning,
    progress,
    error,
    isSupported,
    start,
    cancel,
    getDownloadUrl,
    download,
    reset,
  };
}
