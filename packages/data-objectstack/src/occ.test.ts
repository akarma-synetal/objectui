/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  ConcurrentUpdateError,
  isConcurrentUpdateError,
  normaliseClientError,
} from './index';

describe('Optimistic Concurrency Control errors', () => {
  describe('ConcurrentUpdateError', () => {
    it('carries currentVersion + currentRecord and a stable shape', () => {
      const e = new ConcurrentUpdateError({
        currentVersion: '2026-05-22T07:14:00.000Z',
        currentRecord: { id: 'rec_1', name: 'Acme', updated_at: '2026-05-22T07:14:00.000Z' },
        message: 'stale write',
      });
      expect(e).toBeInstanceOf(Error);
      expect(e.name).toBe('ConcurrentUpdateError');
      expect(e.code).toBe('CONCURRENT_UPDATE');
      expect(e.httpStatus).toBe(409);
      expect(e.currentVersion).toBe('2026-05-22T07:14:00.000Z');
      expect((e.currentRecord as any).name).toBe('Acme');
      expect(e.message).toBe('stale write');
    });

    it('defaults to a generic message when none is supplied', () => {
      const e = new ConcurrentUpdateError({ currentVersion: null, currentRecord: null });
      expect(e.message).toMatch(/modified/i);
    });
  });

  describe('isConcurrentUpdateError', () => {
    it('returns true for our typed instances', () => {
      const e = new ConcurrentUpdateError({ currentVersion: null, currentRecord: null });
      expect(isConcurrentUpdateError(e)).toBe(true);
    });

    it('returns true for plain objects with the canonical code', () => {
      expect(isConcurrentUpdateError({ code: 'CONCURRENT_UPDATE' })).toBe(true);
    });

    it('returns false for unrelated errors', () => {
      expect(isConcurrentUpdateError(new Error('boom'))).toBe(false);
      expect(isConcurrentUpdateError({ code: 'NOT_FOUND' })).toBe(false);
      expect(isConcurrentUpdateError(null)).toBe(false);
      expect(isConcurrentUpdateError(undefined)).toBe(false);
      expect(isConcurrentUpdateError('CONCURRENT_UPDATE')).toBe(false);
    });
  });

  describe('normaliseClientError', () => {
    it('returns the original error when it is not a 409 CONCURRENT_UPDATE', () => {
      const generic = Object.assign(new Error('not found'), {
        code: 'NOT_FOUND',
        httpStatus: 404,
      });
      expect(normaliseClientError(generic)).toBe(generic);
    });

    it('returns the original error for non-object inputs', () => {
      expect(normaliseClientError(null)).toBe(null);
      expect(normaliseClientError(undefined)).toBe(undefined);
      expect(normaliseClientError('boom')).toBe('boom');
    });

    it('wraps an upstream 409 CONCURRENT_UPDATE into a typed ConcurrentUpdateError', () => {
      const upstream = Object.assign(new Error('Record was modified by another user'), {
        code: 'CONCURRENT_UPDATE',
        httpStatus: 409,
        details: {
          currentVersion: '2026-05-22T07:14:00.000Z',
          currentRecord: { id: 'rec_1', name: 'Acme' },
        },
      });
      const normalised = normaliseClientError(upstream);
      expect(isConcurrentUpdateError(normalised)).toBe(true);
      const typed = normalised as ConcurrentUpdateError;
      expect(typed.currentVersion).toBe('2026-05-22T07:14:00.000Z');
      expect((typed.currentRecord as any).name).toBe('Acme');
      expect(typed.message).toBe('Record was modified by another user');
    });

    it('tolerates a missing details payload', () => {
      const upstream = Object.assign(new Error('stale'), {
        code: 'CONCURRENT_UPDATE',
        httpStatus: 409,
      });
      const normalised = normaliseClientError(upstream) as ConcurrentUpdateError;
      expect(isConcurrentUpdateError(normalised)).toBe(true);
      expect(normalised.currentVersion).toBeNull();
      expect(normalised.currentRecord).toBeNull();
    });
  });
});
