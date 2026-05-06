/**
 * Tests for the PWA offline-sync stack:
 *   - MemoryOfflineQueue ordering & CRUD
 *   - createOfflineDataSource: pass-through when online, queue on offline,
 *     queue on network error, replay on reconnect.
 *   - getServiceWorkerSource: emits a runnable SW string.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MemoryOfflineQueue,
  generateOpId,
  type OfflineOperation,
} from '../offlineQueue';
import { createOfflineDataSource, type QueueableDataSource } from '../createOfflineDataSource';
import { getServiceWorkerSource } from '../serviceWorkerSource';

describe('MemoryOfflineQueue', () => {
  it('preserves enqueue order via enqueuedAt', async () => {
    const q = new MemoryOfflineQueue();
    const ops: OfflineOperation[] = [
      { id: generateOpId(), op: 'create', object: 'task', enqueuedAt: 100, attempts: 0, payload: {} },
      { id: generateOpId(), op: 'update', object: 'task', enqueuedAt: 50, attempts: 0, payload: {} },
      { id: generateOpId(), op: 'delete', object: 'task', enqueuedAt: 200, attempts: 0 },
    ];
    for (const o of ops) await q.enqueue(o);
    const list = await q.list();
    expect(list.map((o) => o.enqueuedAt)).toEqual([50, 100, 200]);
  });

  it('supports update / remove / clear', async () => {
    const q = new MemoryOfflineQueue();
    const op: OfflineOperation = { id: 'x', op: 'create', object: 'a', enqueuedAt: 1, attempts: 0 };
    await q.enqueue(op);
    await q.update({ ...op, attempts: 5 });
    expect((await q.list())[0].attempts).toBe(5);
    await q.remove('x');
    expect(await q.list()).toEqual([]);
    await q.enqueue(op);
    await q.clear();
    expect(await q.list()).toEqual([]);
  });
});

describe('createOfflineDataSource', () => {
  let inner: Required<Pick<QueueableDataSource, 'create' | 'update' | 'delete'>>;
  let queue: MemoryOfflineQueue;

  beforeEach(() => {
    queue = new MemoryOfflineQueue();
    inner = {
      create: vi.fn().mockResolvedValue({ ok: true }),
      update: vi.fn().mockResolvedValue({ ok: true }),
      delete: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('passes through to the inner source when online', async () => {
    const ds = createOfflineDataSource(inner, { queue, isOnline: () => true });
    const res = await ds.create!('task', { title: 'A' });
    expect(res).toEqual({ ok: true });
    expect(inner.create).toHaveBeenCalledWith('task', { title: 'A' });
    expect(await ds.pendingCount()).toBe(0);
  });

  it('queues mutations when offline without calling the inner source', async () => {
    const ds = createOfflineDataSource(inner, { queue, isOnline: () => false });
    const res: any = await ds.create!('task', { title: 'B' });
    expect(res.queued).toBe(true);
    expect(res.op.op).toBe('create');
    expect(inner.create).not.toHaveBeenCalled();
    expect(await ds.pendingCount()).toBe(1);
  });

  it('queues when the inner source throws a network-style error', async () => {
    inner.create = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const ds = createOfflineDataSource(inner, { queue, isOnline: () => true });
    const res: any = await ds.create!('task', { title: 'C' });
    expect(res.queued).toBe(true);
    expect(await ds.pendingCount()).toBe(1);
  });

  it('does NOT queue on a non-network error (re-throws)', async () => {
    inner.update = vi.fn().mockRejectedValue(Object.assign(new Error('Bad request'), { status: 400 }));
    const ds = createOfflineDataSource(inner, { queue, isOnline: () => true });
    await expect(ds.update!('task', 1, {})).rejects.toThrow('Bad request');
    expect(await ds.pendingCount()).toBe(0);
  });

  it('replay() drains the queue in order on reconnect', async () => {
    const ds = createOfflineDataSource(inner, { queue, isOnline: () => false });
    await ds.create!('task', { title: '1' });
    await ds.update!('task', 7, { title: '2' });
    await ds.delete!('task', 9);
    expect(await ds.pendingCount()).toBe(3);

    // Now we're online — replay
    const result = await ds.replay();
    expect(result).toEqual({ succeeded: 3, failed: 0, remaining: 0 });
    expect(inner.create).toHaveBeenCalledWith('task', { title: '1' });
    expect(inner.update).toHaveBeenCalledWith('task', 7, { title: '2' });
    expect(inner.delete).toHaveBeenCalledWith('task', 9);
  });

  it('replay() stops on network error and bumps attempts/lastError', async () => {
    inner.create = vi.fn().mockRejectedValue(new TypeError('offline'));
    const ds = createOfflineDataSource(inner, { queue, isOnline: () => false });
    await ds.create!('task', { title: 'X' });
    const res = await ds.replay();
    expect(res.failed).toBe(1);
    expect(res.remaining).toBe(1);
    const ops = await ds.pending();
    expect(ops[0].attempts).toBe(1);
    expect(ops[0].lastError).toMatch(/offline/i);
  });

  it('resolveConflict can drop or override a conflicting payload', async () => {
    inner.update = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('Conflict'), { status: 409 }))
      .mockResolvedValueOnce({ ok: true });
    const ds = createOfflineDataSource(inner, {
      queue,
      isOnline: () => false,
      resolveConflict: async () => ({ payload: { merged: true } }),
    });
    await ds.update!('task', 1, { foo: 1 });
    await ds.replay();
    let ops = await ds.pending();
    expect(ops[0].payload).toEqual({ merged: true });
    expect(ops[0].attempts).toBe(1);
    // Second replay should now succeed
    const res = await ds.replay();
    expect(res.succeeded).toBe(1);
    ops = await ds.pending();
    expect(ops).toEqual([]);
  });

  it('drop() and clear() remove ops without replaying', async () => {
    const ds = createOfflineDataSource(inner, { queue, isOnline: () => false });
    const a: any = await ds.create!('task', { t: 1 });
    await ds.create!('task', { t: 2 });
    expect(await ds.pendingCount()).toBe(2);
    await ds.drop(a.op.id);
    expect(await ds.pendingCount()).toBe(1);
    await ds.clear();
    expect(await ds.pendingCount()).toBe(0);
  });

  it('fires onChange whenever the queue mutates', async () => {
    const onChange = vi.fn();
    const ds = createOfflineDataSource(inner, { queue, isOnline: () => false, onChange });
    await ds.create!('task', { t: 1 });
    await ds.create!('task', { t: 2 });
    await ds.clear();
    // Each enqueue + clear should have notified
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange.mock.calls[0][0]).toHaveLength(1);
    expect(onChange.mock.calls[1][0]).toHaveLength(2);
    expect(onChange.mock.calls[2][0]).toHaveLength(0);
  });
});

describe('getServiceWorkerSource', () => {
  it('emits a parseable JS string with the configured cache + tag', () => {
    const src = getServiceWorkerSource({
      cacheName: 'my-app-v3',
      precache: ['/', '/app.js'],
      apiPrefix: '/v1/',
      syncTag: 'tasks-sync',
    });
    expect(src).toContain('"my-app-v3"');
    expect(src).toContain('"/v1/"');
    expect(src).toContain('"tasks-sync"');
    expect(src).toContain('addEventListener(\'install\'');
    expect(src).toContain('addEventListener(\'sync\'');
    // Sanity: must be syntactically valid JS
    expect(() => new Function('self', src)).not.toThrow();
  });
});
