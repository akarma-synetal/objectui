/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkExecutor } from '../hooks/useBulkExecutor';
import type { BulkActionDef } from '@object-ui/types';

const upd = (op: Partial<BulkActionDef> = {}): BulkActionDef => ({
  name: 'set_priority',
  operation: 'update',
  patch: { priority: 'high' },
  ...op,
} as BulkActionDef);

describe('useBulkExecutor', () => {
  it('runs update across rows and reports succeeded/failed', async () => {
    const update = vi.fn(async (_, id) => {
      if (id === '2') throw new Error('boom');
      return { id };
    });
    const ds = { update, delete: vi.fn() };
    const { result } = renderHook(() => useBulkExecutor({ resource: 'task', dataSource: ds }));

    await act(async () => {
      await result.current.run(upd(), [{ id: '1' }, { id: '2' }, { id: '3' }], {});
    });

    expect(result.current.result?.succeeded).toBe(2);
    expect(result.current.result?.failed).toBe(1);
    expect(result.current.result?.errors).toHaveLength(1);
    expect(result.current.result?.errors[0]).toMatchObject({ id: '2', error: 'boom' });
  });

  it('captures pre-mutation snapshot and undo replays the prior values', async () => {
    const update = vi.fn(async () => ({}));
    const ds = { update, delete: vi.fn() };
    const rows = [
      { id: '1', priority: 'low', name: 'a' },
      { id: '2', priority: 'medium', name: 'b' },
    ];
    const { result } = renderHook(() => useBulkExecutor({ resource: 'task', dataSource: ds }));

    await act(async () => {
      await result.current.run(upd(), rows, {});
    });

    // run() called update twice with the patch
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(1, 'task', '1', { priority: 'high' });

    update.mockClear();

    await act(async () => {
      await result.current.undo();
    });

    // undo() restored the captured prior values for the touched key only
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith('task', '1', { priority: 'low' });
    expect(update).toHaveBeenCalledWith('task', '2', { priority: 'medium' });
  });

  it('snapshot excludes rows whose mutation failed', async () => {
    const update = vi.fn(async (_, id) => {
      if (id === '2') throw new Error('nope');
      return {};
    });
    const ds = { update, delete: vi.fn() };
    const rows = [
      { id: '1', priority: 'low' },
      { id: '2', priority: 'low' },
    ];
    const { result } = renderHook(() => useBulkExecutor({ resource: 'task', dataSource: ds }));

    await act(async () => {
      await result.current.run(upd(), rows, {});
    });

    update.mockClear();
    update.mockImplementation(async () => ({}));

    await act(async () => {
      await result.current.undo();
    });

    // Only id '1' should be reverted — id '2' never landed in the first place.
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith('task', '1', { priority: 'low' });
  });

  it('undo is a no-op for delete operations', async () => {
    const deleteFn = vi.fn(async () => ({}));
    const ds = { update: vi.fn(), delete: deleteFn };
    const { result } = renderHook(() => useBulkExecutor({ resource: 'task', dataSource: ds }));

    await act(async () => {
      await result.current.run(
        { name: 'rm', operation: 'delete' } as BulkActionDef,
        [{ id: '1' }],
        {},
      );
    });
    let undoResult: unknown;
    await act(async () => {
      undoResult = await result.current.undo();
    });
    expect(undoResult).toBeNull();
  });

  it('retry re-runs the original op for one failed row and drops it from errors', async () => {
    let fail = true;
    const update = vi.fn(async () => {
      if (fail) {
        fail = false;
        throw new Error('first attempt fails');
      }
      return {};
    });
    const ds = { update, delete: vi.fn() };
    const { result } = renderHook(() => useBulkExecutor({ resource: 'task', dataSource: ds }));

    await act(async () => {
      await result.current.run(upd(), [{ id: '1', priority: 'low' }], {});
    });
    expect(result.current.result?.failed).toBe(1);

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.retry('1');
    });
    expect(ok).toBe(true);
    expect(result.current.result?.errors).toHaveLength(0);
    expect(result.current.result?.succeeded).toBe(1);
    expect(result.current.result?.failed).toBe(0);
  });

  describe('bulkUpdate fast-path', () => {
    it('collapses an update batch into a single bulkUpdate call when the adapter supports it', async () => {
      const update = vi.fn(async () => ({}));
      const bulkUpdate = vi.fn(async () => 3);
      const ds = { update, delete: vi.fn(), bulkUpdate };
      const { result } = renderHook(() => useBulkExecutor({ resource: 'task', dataSource: ds }));

      await act(async () => {
        await result.current.run(
          upd(),
          [{ id: '1' }, { id: '2' }, { id: '3' }],
          {},
        );
      });

      expect(bulkUpdate).toHaveBeenCalledTimes(1);
      expect(bulkUpdate).toHaveBeenCalledWith('task', ['1', '2', '3'], { priority: 'high' });
      // Per-row update must NOT fire when bulk succeeds.
      expect(update).not.toHaveBeenCalled();
      expect(result.current.result?.succeeded).toBe(3);
      expect(result.current.result?.failed).toBe(0);
    });

    it('skips the bulk path for single-row batches (no win, just overhead)', async () => {
      const update = vi.fn(async () => ({}));
      const bulkUpdate = vi.fn(async () => 1);
      const ds = { update, delete: vi.fn(), bulkUpdate };
      const { result } = renderHook(() => useBulkExecutor({ resource: 'task', dataSource: ds }));

      await act(async () => {
        await result.current.run(upd(), [{ id: '1' }], {});
      });

      expect(bulkUpdate).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledTimes(1);
      expect(result.current.result?.succeeded).toBe(1);
    });

    it('reports the shortfall as an aggregate failure when bulkUpdate returns a partial count', async () => {
      const bulkUpdate = vi.fn(async () => 2); // server only updated 2 of 3
      const ds = { update: vi.fn(), delete: vi.fn(), bulkUpdate };
      const { result } = renderHook(() => useBulkExecutor({ resource: 'task', dataSource: ds }));

      await act(async () => {
        await result.current.run(
          upd(),
          [{ id: '1' }, { id: '2' }, { id: '3' }],
          {},
        );
      });

      expect(result.current.result?.succeeded).toBe(2);
      expect(result.current.result?.failed).toBe(1);
      expect(result.current.result?.errors).toHaveLength(1);
      expect(result.current.result?.errors[0]).toMatchObject({
        id: 'batch_0',
        error: expect.stringContaining('failed in bulk update'),
      });
    });

    it('falls back to per-row updates when bulkUpdate throws, preserving id-level error detail', async () => {
      const bulkUpdate = vi.fn(async () => {
        throw new Error('server unavailable');
      });
      const update = vi.fn(async (_: string, id: string) => {
        if (id === '2') throw new Error('row 2 RLS rejected');
        return {};
      });
      const ds = { update, delete: vi.fn(), bulkUpdate };
      const { result } = renderHook(() => useBulkExecutor({ resource: 'task', dataSource: ds }));

      await act(async () => {
        await result.current.run(
          upd(),
          [{ id: '1' }, { id: '2' }, { id: '3' }],
          {},
        );
      });

      // Bulk was tried then fell back to N updates so the user gets per-row errors.
      expect(bulkUpdate).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledTimes(3);
      expect(result.current.result?.succeeded).toBe(2);
      expect(result.current.result?.failed).toBe(1);
      expect(result.current.result?.errors[0]).toMatchObject({ id: '2', error: 'row 2 RLS rejected' });
    });

    it('keeps using per-row updates for delete and custom operations', async () => {
      const bulkUpdate = vi.fn(async () => 99);
      const deleteFn = vi.fn(async () => ({}));
      const ds = { update: vi.fn(), delete: deleteFn, bulkUpdate };
      const { result } = renderHook(() => useBulkExecutor({ resource: 'task', dataSource: ds }));

      await act(async () => {
        await result.current.run(
          { name: 'rm', operation: 'delete' } as BulkActionDef,
          [{ id: '1' }, { id: '2' }],
          {},
        );
      });

      expect(bulkUpdate).not.toHaveBeenCalled();
      expect(deleteFn).toHaveBeenCalledTimes(2);
    });

    it('still captures pre-mutation snapshot so undo works even when bulk succeeded', async () => {
      const bulkUpdate = vi.fn(async () => 2);
      const update = vi.fn(async () => ({}));
      const ds = { update, delete: vi.fn(), bulkUpdate };
      const rows = [
        { id: '1', priority: 'low' },
        { id: '2', priority: 'medium' },
      ];
      const { result } = renderHook(() => useBulkExecutor({ resource: 'task', dataSource: ds }));

      await act(async () => {
        await result.current.run(upd(), rows, {});
      });

      expect(bulkUpdate).toHaveBeenCalledTimes(1);
      expect(update).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.undo();
      });

      // Undo replays per-row prev values because each row has its own snapshot.
      expect(update).toHaveBeenCalledTimes(2);
      expect(update).toHaveBeenCalledWith('task', '1', { priority: 'low' });
      expect(update).toHaveBeenCalledWith('task', '2', { priority: 'medium' });
    });
  });
});
