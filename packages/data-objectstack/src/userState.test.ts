/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createObjectStackUserStateAdapter } from './userState';
import type { DataSource } from '@object-ui/types';

function mockDataSource(overrides: Partial<DataSource<any>> = {}): DataSource<any> {
  return {
    find: vi.fn().mockResolvedValue({ data: [] }),
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as DataSource<any>;
}

describe('createObjectStackUserStateAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('load', () => {
    it('returns [] when no row exists for the (user, kind) pair', async () => {
      const ds = mockDataSource();
      const adapter = createObjectStackUserStateAdapter({
        dataSource: ds,
        userId: 'u1',
        kind: 'favorites',
      });

      const items = await adapter.load();

      expect(items).toEqual([]);
      expect(ds.find).toHaveBeenCalledWith('user_app_state', {
        filter: { user_id: 'u1', kind: 'favorites' },
        limit: 1,
      });
    });

    it('returns parsed payload when row exists (array payload)', async () => {
      const payload = [{ id: 'object:contact', label: 'Contact' }];
      const ds = mockDataSource({
        find: vi.fn().mockResolvedValue({
          data: [{ id: 'row-1', user_id: 'u1', kind: 'recent', payload }],
        }) as any,
      });

      const adapter = createObjectStackUserStateAdapter({
        dataSource: ds,
        userId: 'u1',
        kind: 'recent',
      });

      await expect(adapter.load()).resolves.toEqual(payload);
    });

    it('parses string-encoded JSON payloads', async () => {
      const items = [{ id: 'a' }, { id: 'b' }];
      const ds = mockDataSource({
        find: vi.fn().mockResolvedValue({
          data: [{ id: 1, payload: JSON.stringify(items) }],
        }) as any,
      });

      const adapter = createObjectStackUserStateAdapter({
        dataSource: ds,
        userId: 'u',
        kind: 'k',
      });

      await expect(adapter.load()).resolves.toEqual(items);
    });

    it('returns [] when payload is malformed JSON', async () => {
      const ds = mockDataSource({
        find: vi.fn().mockResolvedValue({
          data: [{ id: 1, payload: '{not json' }],
        }) as any,
      });
      const adapter = createObjectStackUserStateAdapter({
        dataSource: ds,
        userId: 'u',
        kind: 'k',
      });

      await expect(adapter.load()).resolves.toEqual([]);
    });

    it('swallows errors and returns [] when find() throws', async () => {
      const onError = vi.fn();
      const ds = mockDataSource({
        find: vi.fn().mockRejectedValue(new Error('boom')) as any,
      });

      const adapter = createObjectStackUserStateAdapter({
        dataSource: ds,
        userId: 'u',
        kind: 'k',
        onError,
      });

      await expect(adapter.load()).resolves.toEqual([]);
      expect(onError).toHaveBeenCalledWith('load', expect.any(Error));
    });

    it('uses a custom resource name when provided', async () => {
      const ds = mockDataSource();
      const adapter = createObjectStackUserStateAdapter({
        dataSource: ds,
        userId: 'u',
        kind: 'k',
        resource: 'my_prefs',
      });

      await adapter.load();

      expect(ds.find).toHaveBeenCalledWith('my_prefs', expect.any(Object));
    });
  });

  describe('save', () => {
    it('creates a new row when none exists', async () => {
      const created = { id: 'new-row' };
      const ds = mockDataSource({
        create: vi.fn().mockResolvedValue(created) as any,
      });

      const adapter = createObjectStackUserStateAdapter({
        dataSource: ds,
        userId: 'u1',
        kind: 'favorites',
      });

      await adapter.save([{ id: 'a' } as any]);

      expect(ds.create).toHaveBeenCalledWith('user_app_state', {
        user_id: 'u1',
        kind: 'favorites',
        payload: [{ id: 'a' }],
        updated_at: expect.any(String),
      });
    });

    it('updates the existing row when one exists', async () => {
      const ds = mockDataSource({
        find: vi.fn().mockResolvedValue({
          data: [{ id: 'row-99', user_id: 'u', kind: 'k', payload: [] }],
        }) as any,
      });

      const adapter = createObjectStackUserStateAdapter({
        dataSource: ds,
        userId: 'u',
        kind: 'k',
      });

      await adapter.save([{ id: 'x' } as any]);

      expect(ds.update).toHaveBeenCalledWith('user_app_state', 'row-99', {
        payload: [{ id: 'x' }],
        updated_at: expect.any(String),
      });
      expect(ds.create).not.toHaveBeenCalled();
    });

    it('uses the cached row id from a previous load on subsequent saves', async () => {
      const ds = mockDataSource({
        find: vi.fn().mockResolvedValue({
          data: [{ id: 'row-42', payload: [] }],
        }) as any,
      });

      const adapter = createObjectStackUserStateAdapter({
        dataSource: ds,
        userId: 'u',
        kind: 'k',
      });

      await adapter.load();
      (ds.find as any).mockClear();

      await adapter.save([{ id: 'b' } as any]);

      // No second find() — went straight to update via cached id.
      expect(ds.find).not.toHaveBeenCalled();
      expect(ds.update).toHaveBeenCalledWith('user_app_state', 'row-42', expect.any(Object));
    });

    it('falls back to insert when cached row update fails (row deleted server-side)', async () => {
      const ds = mockDataSource({
        find: vi.fn()
          .mockResolvedValueOnce({ data: [{ id: 'stale', payload: [] }] })
          .mockResolvedValueOnce({ data: [] }) as any,
        update: vi.fn().mockRejectedValue(new Error('not found')) as any,
        create: vi.fn().mockResolvedValue({ id: 'new' }) as any,
      });
      const onError = vi.fn();

      const adapter = createObjectStackUserStateAdapter({
        dataSource: ds,
        userId: 'u',
        kind: 'k',
        onError,
      });

      await adapter.load(); // primes cachedRowId = 'stale'
      await adapter.save([{ id: 'z' } as any]);

      expect(ds.update).toHaveBeenCalledTimes(1);
      expect(ds.create).toHaveBeenCalledWith('user_app_state', expect.objectContaining({
        user_id: 'u',
        kind: 'k',
        payload: [{ id: 'z' }],
      }));
    });

    it('swallows errors when save() throws', async () => {
      const onError = vi.fn();
      const ds = mockDataSource({
        find: vi.fn().mockRejectedValue(new Error('network down')) as any,
      });

      const adapter = createObjectStackUserStateAdapter({
        dataSource: ds,
        userId: 'u',
        kind: 'k',
        onError,
      });

      await expect(adapter.save([{ id: 'a' } as any])).resolves.toBeUndefined();
      expect(onError).toHaveBeenCalledWith('save', expect.any(Error));
    });
  });
});
