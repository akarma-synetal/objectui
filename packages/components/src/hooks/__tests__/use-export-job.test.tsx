/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Tests for `useExportJob` and `ExportProgressDialog` (async streaming export).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act, screen, waitFor, fireEvent } from '@testing-library/react';
import type { DataSource } from '@object-ui/types';

import { useExportJob } from '../use-export-job';
import { ExportProgressDialog } from '../../custom/export-progress-dialog';

function makeDataSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn(),
    ...overrides,
  } as DataSource;
}

describe('useExportJob', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('isSupported is false when DataSource lacks export methods', () => {
    const ds = makeDataSource();
    const { result } = renderHook(() => useExportJob({ dataSource: ds }));
    expect(result.current.isSupported).toBe(false);
  });

  it('isSupported is true when both create + getProgress are present', () => {
    const ds = makeDataSource({
      createExportJob: vi.fn(),
      getExportJobProgress: vi.fn(),
    } as any);
    const { result } = renderHook(() => useExportJob({ dataSource: ds }));
    expect(result.current.isSupported).toBe(true);
  });

  it('start polls until completion and fires onComplete', async () => {
    const createExportJob = vi.fn().mockResolvedValue({
      jobId: 'j-1',
      status: 'pending',
      estimatedRecords: 100,
      createdAt: '2026-01-01T00:00:00Z',
    });
    const responses = [
      { jobId: 'j-1', status: 'processing', processedRecords: 25, totalRecords: 100, percentComplete: 25 },
      { jobId: 'j-1', status: 'processing', processedRecords: 75, totalRecords: 100, percentComplete: 75 },
      { jobId: 'j-1', status: 'completed', processedRecords: 100, totalRecords: 100, percentComplete: 100, downloadUrl: 'https://example.com/file.csv', fileSize: 2048 },
    ];
    const getExportJobProgress = vi.fn(() => Promise.resolve(responses.shift()!));
    const ds = makeDataSource({ createExportJob, getExportJobProgress } as any);
    const onComplete = vi.fn();
    const { result } = renderHook(() => useExportJob({ dataSource: ds, pollIntervalMs: 100, onComplete }));

    await act(async () => {
      await result.current.start('account', { format: 'csv' });
    });
    expect(createExportJob).toHaveBeenCalledWith('account', { format: 'csv' });
    expect(result.current.isRunning).toBe(true);

    for (let i = 0; i < 4; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(110); });
    }

    expect(result.current.isRunning).toBe(false);
    expect(result.current.progress?.status).toBe('completed');
    expect(result.current.progress?.downloadUrl).toBe('https://example.com/file.csv');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('cancel sets status to cancelled and stops polling', async () => {
    const createExportJob = vi.fn().mockResolvedValue({ jobId: 'j-2', status: 'pending' });
    const cancelExportJob = vi.fn().mockResolvedValue(undefined);
    const getExportJobProgress = vi.fn().mockResolvedValue({
      jobId: 'j-2', status: 'processing', processedRecords: 10, totalRecords: 100, percentComplete: 10,
    });
    const ds = makeDataSource({ createExportJob, getExportJobProgress, cancelExportJob } as any);
    const { result } = renderHook(() => useExportJob({ dataSource: ds, pollIntervalMs: 50 }));

    await act(async () => { await result.current.start('account', { format: 'csv' }); });
    await act(async () => { await result.current.cancel(); });
    expect(cancelExportJob).toHaveBeenCalledWith('j-2');
    expect(result.current.isRunning).toBe(false);
    expect(result.current.progress?.status).toBe('cancelled');
  });

  it('start surfaces an error when DataSource is unsupported', async () => {
    const ds = makeDataSource();
    const onError = vi.fn();
    const { result } = renderHook(() => useExportJob({ dataSource: ds, onError }));
    let id: string | null = 'placeholder' as any;
    await act(async () => { id = await result.current.start('x', { format: 'csv' }); });
    expect(id).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(onError).toHaveBeenCalled();
  });

  it('handles a failed terminal status by setting error', async () => {
    const createExportJob = vi.fn().mockResolvedValue({ jobId: 'j-3', status: 'pending' });
    const getExportJobProgress = vi.fn().mockResolvedValueOnce({
      jobId: 'j-3', status: 'failed', error: { code: 'OOM', message: 'Out of memory' },
    });
    const ds = makeDataSource({ createExportJob, getExportJobProgress } as any);
    const onError = vi.fn();
    const { result } = renderHook(() => useExportJob({ dataSource: ds, pollIntervalMs: 10, onError }));
    await act(async () => { await result.current.start('x', { format: 'csv' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(20); });
    expect(result.current.progress?.status).toBe('failed');
    expect(result.current.error?.message).toMatch(/out of memory/i);
    expect(onError).toHaveBeenCalled();
  });
});

describe('ExportProgressDialog', () => {
  it('shows progress UI while running, then a Download button on completion', async () => {
    const createExportJob = vi.fn().mockResolvedValue({ jobId: 'j-5', status: 'pending' });
    const responses = [
      { jobId: 'j-5', status: 'processing', processedRecords: 5, totalRecords: 10, percentComplete: 50 },
      { jobId: 'j-5', status: 'completed', processedRecords: 10, totalRecords: 10, percentComplete: 100, downloadUrl: 'https://example.com/x.csv' },
    ];
    const getExportJobProgress = vi.fn(() => Promise.resolve(responses.shift()!));
    const ds = makeDataSource({ createExportJob, getExportJobProgress } as any);

    function Harness() {
      const job = useExportJob({ dataSource: ds, pollIntervalMs: 5 });
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button
            data-testid="harness-start"
            onClick={() => {
              setOpen(true);
              void job.start('account', { format: 'csv' });
            }}
          >
            Start
          </button>
          <ExportProgressDialog open={open} onOpenChange={setOpen} job={job} />
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByTestId('harness-start'));
    await waitFor(() => {
      expect(screen.getByTestId('export-progress-dialog')).toBeDefined();
    });
    expect(screen.getByTestId('export-progress-cancel')).toBeDefined();

    await waitFor(
      () => {
        expect(screen.getByTestId('export-progress-download')).toBeDefined();
      },
      { timeout: 3000 },
    );
    expect(screen.getByText('100%')).toBeDefined();
  });
});
