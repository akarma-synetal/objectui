/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  defineView,
  deepFreeze,
  isSystemView,
  cloneAsOverride,
  SYSTEM_VIEW_MARKER,
} from '../freeze-schema.js';

describe('freeze-schema', () => {
  describe('defineView', () => {
    it('freezes the root object', () => {
      const view = defineView({ type: 'list', columns: [{ name: 'id' }] });
      expect(Object.isFrozen(view)).toBe(true);
    });

    it('freezes nested objects and arrays (deep)', () => {
      const view = defineView({
        type: 'list',
        columns: [{ name: 'id', meta: { sortable: true } }],
      });
      expect(Object.isFrozen(view.columns)).toBe(true);
      expect(Object.isFrozen(view.columns[0])).toBe(true);
      expect(Object.isFrozen(view.columns[0].meta)).toBe(true);
    });

    it('throws (strict mode) when mutation is attempted on a frozen property', () => {
      'use strict';
      const view = defineView({ type: 'list', title: 'Users' });
      expect(() => {
        (view as any).title = 'Mutated';
      }).toThrow(TypeError);
    });

    it('throws when pushing to a frozen array', () => {
      const view = defineView({ type: 'list', columns: [{ name: 'id' }] });
      expect(() => {
        (view.columns as any).push({ name: 'name' });
      }).toThrow(TypeError);
    });

    it('throws when assigning to a nested frozen object', () => {
      const view = defineView({ type: 'list', meta: { sortable: true } });
      expect(() => {
        (view.meta as any).sortable = false;
      }).toThrow(TypeError);
    });

    it('marks the schema as a System View (non-enumerably)', () => {
      const view = defineView({ type: 'list' });
      expect(isSystemView(view)).toBe(true);
      // Marker must not leak into JSON / Object.keys / spread.
      expect(JSON.stringify(view)).toBe('{"type":"list"}');
      expect(Object.keys(view)).toEqual(['type']);
    });

    it('rejects null and non-object input', () => {
      expect(() => defineView(null as any)).toThrow(TypeError);
      expect(() => defineView('string' as any)).toThrow(TypeError);
    });

    it('is idempotent — calling twice does not throw', () => {
      const v1 = defineView({ type: 'list' });
      const v2 = defineView(v1 as any);
      expect(v2).toBe(v1);
      expect(isSystemView(v2)).toBe(true);
    });
  });

  describe('deepFreeze', () => {
    it('handles cycles without infinite recursion', () => {
      const a: any = { name: 'a' };
      const b: any = { name: 'b', a };
      a.b = b;
      expect(() => deepFreeze(a)).not.toThrow();
      expect(Object.isFrozen(a)).toBe(true);
      expect(Object.isFrozen(b)).toBe(true);
    });

    it('does not freeze Date / RegExp / Map / Set instances', () => {
      const date = new Date();
      const re = /x/;
      const map = new Map<string, number>();
      const set = new Set<number>();
      const view = deepFreeze({ date, re, map, set });
      expect(Object.isFrozen(view)).toBe(true);
      // Infrastructure objects must remain mutable for normal operation.
      expect(Object.isFrozen(date)).toBe(false);
      expect(Object.isFrozen(re)).toBe(false);
      expect(Object.isFrozen(map)).toBe(false);
      expect(Object.isFrozen(set)).toBe(false);
      expect(() => map.set('k', 1)).not.toThrow();
      expect(() => set.add(1)).not.toThrow();
    });

    it('does not freeze class instances passed via props', () => {
      class Service {
        value = 1;
      }
      const svc = new Service();
      const view = deepFreeze({ props: { svc } });
      expect(Object.isFrozen(svc)).toBe(false);
      expect(() => {
        svc.value = 2;
      }).not.toThrow();
      expect(svc.value).toBe(2);
      // The wrapping schema itself is still frozen.
      expect(Object.isFrozen(view)).toBe(true);
      expect(Object.isFrozen(view.props)).toBe(true);
    });

    it('returns primitives unchanged', () => {
      expect(deepFreeze(42 as any)).toBe(42);
      expect(deepFreeze('s' as any)).toBe('s');
      expect(deepFreeze(null as any)).toBe(null);
      expect(deepFreeze(undefined as any)).toBe(undefined);
    });
  });

  describe('cloneAsOverride', () => {
    it('produces a mutable, independent copy', () => {
      const view = defineView({ type: 'list', columns: [{ name: 'id' }] });
      const draft = cloneAsOverride(view) as any;

      expect(Object.isFrozen(draft)).toBe(false);
      expect(Object.isFrozen(draft.columns)).toBe(false);
      expect(Object.isFrozen(draft.columns[0])).toBe(false);

      draft.columns.push({ name: 'name' });
      draft.columns[0].name = 'uuid';

      // Source schema is untouched.
      expect(view.columns).toHaveLength(1);
      expect(view.columns[0].name).toBe('id');
    });

    it('strips the SYSTEM_VIEW_MARKER (clone is no longer a System View)', () => {
      const view = defineView({ type: 'list' });
      const draft = cloneAsOverride(view);
      expect(isSystemView(view)).toBe(true);
      expect(isSystemView(draft)).toBe(false);
    });

    it('passes through primitives and null', () => {
      expect(cloneAsOverride(null)).toBe(null);
      expect(cloneAsOverride(undefined)).toBe(undefined);
      expect(cloneAsOverride(7 as any)).toBe(7);
    });
  });

  describe('SYSTEM_VIEW_MARKER', () => {
    it('is a Symbol.for() so it crosses realm/bundle boundaries', () => {
      expect(SYSTEM_VIEW_MARKER).toBe(Symbol.for('@object-ui/core/system-view'));
    });
  });
});
