/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  specFilterToUIGroup,
  uiGroupToSpecFilter,
} from '../ReportConfigPanel';

describe('specFilterToUIGroup', () => {
  it('parses an undefined / empty filter into an empty AND group', () => {
    const a = specFilterToUIGroup(undefined);
    expect(a.complex).toBe(false);
    expect(a.group.logic).toBe('and');
    expect(a.group.conditions).toEqual([]);

    const b = specFilterToUIGroup({});
    expect(b.group.conditions).toEqual([]);
  });

  it('treats scalar field shorthand as equality', () => {
    const { group, complex } = specFilterToUIGroup({ is_active: true });
    expect(complex).toBe(false);
    expect(group.conditions).toHaveLength(1);
    expect(group.conditions[0]).toMatchObject({
      field: 'is_active',
      operator: 'equals',
      value: true,
    });
  });

  it('maps $eq / $ne / $gt / $gte / $lt / $lte', () => {
    const { group } = specFilterToUIGroup({
      a: { $eq: 1 },
      b: { $ne: 2 },
      c: { $gt: 3 },
      d: { $gte: 4 },
      e: { $lt: 5 },
      f: { $lte: 6 },
    });
    const ops = group.conditions.map((c) => [c.field, c.operator, c.value]);
    expect(ops).toEqual([
      ['a', 'equals', 1],
      ['b', 'notEquals', 2],
      ['c', 'greaterThan', 3],
      ['d', 'greaterOrEqual', 4],
      ['e', 'lessThan', 5],
      ['f', 'lessOrEqual', 6],
    ]);
  });

  it('maps $in / $nin to in / notIn with array values', () => {
    const { group } = specFilterToUIGroup({ status: { $in: ['open', 'pending'] } });
    expect(group.conditions[0].operator).toBe('in');
    expect(group.conditions[0].value).toEqual(['open', 'pending']);
  });

  it('maps $exists to isEmpty / isNotEmpty', () => {
    const a = specFilterToUIGroup({ a: { $exists: true } });
    expect(a.group.conditions[0].operator).toBe('isNotEmpty');
    const b = specFilterToUIGroup({ b: { $exists: false } });
    expect(b.group.conditions[0].operator).toBe('isEmpty');
  });

  it('handles top-level $and as a flat AND group', () => {
    const { group, complex } = specFilterToUIGroup({
      $and: [{ a: 1 }, { b: { $gt: 2 } }],
    });
    expect(complex).toBe(false);
    expect(group.logic).toBe('and');
    expect(group.conditions).toHaveLength(2);
  });

  it('handles top-level $or as a flat OR group', () => {
    const { group, complex } = specFilterToUIGroup({
      $or: [{ a: 1 }, { b: 2 }],
    });
    expect(complex).toBe(false);
    expect(group.logic).toBe('or');
    expect(group.conditions).toHaveLength(2);
  });

  it('flags nested $and / $or as complex (read-only fallback)', () => {
    const { complex } = specFilterToUIGroup({
      $and: [{ $or: [{ a: 1 }, { b: 2 }] }, { c: 3 }],
    });
    expect(complex).toBe(true);
  });

  it('flags unsupported operators ($not, $regex, $field) as complex', () => {
    expect(specFilterToUIGroup({ a: { $regex: 'x' } }).complex).toBe(true);
    expect(specFilterToUIGroup({ $not: { a: 1 } }).complex).toBe(true);
    expect(specFilterToUIGroup({ a: { $field: 'b' } }).complex).toBe(true);
  });
});

describe('uiGroupToSpecFilter', () => {
  it('returns undefined for empty groups', () => {
    expect(uiGroupToSpecFilter(undefined)).toBeUndefined();
    expect(
      uiGroupToSpecFilter({ id: 'r', logic: 'and', conditions: [] }),
    ).toBeUndefined();
  });

  it('writes a single equality condition as scalar shorthand', () => {
    const spec = uiGroupToSpecFilter({
      id: 'r',
      logic: 'and',
      conditions: [{ id: 'c1', field: 'is_active', operator: 'equals', value: true }],
    });
    expect(spec).toEqual({ is_active: true });
  });

  it('writes a single non-equality condition as { field: { $op: value } }', () => {
    const spec = uiGroupToSpecFilter({
      id: 'r',
      logic: 'and',
      conditions: [{ id: 'c1', field: 'age', operator: 'greaterThan', value: 18 }],
    });
    expect(spec).toEqual({ age: { $gt: 18 } });
  });

  it('writes multiple AND conditions as $and array', () => {
    const spec = uiGroupToSpecFilter({
      id: 'r',
      logic: 'and',
      conditions: [
        { id: 'c1', field: 'a', operator: 'equals', value: 1 },
        { id: 'c2', field: 'b', operator: 'greaterThan', value: 2 },
      ],
    });
    expect(spec).toEqual({ $and: [{ a: 1 }, { b: { $gt: 2 } }] });
  });

  it('writes multiple OR conditions as $or array', () => {
    const spec = uiGroupToSpecFilter({
      id: 'r',
      logic: 'or',
      conditions: [
        { id: 'c1', field: 'a', operator: 'equals', value: 1 },
        { id: 'c2', field: 'b', operator: 'equals', value: 2 },
      ],
    });
    expect(spec).toEqual({ $or: [{ a: 1 }, { b: 2 }] });
  });

  it('writes isEmpty / isNotEmpty as $exists', () => {
    expect(
      uiGroupToSpecFilter({
        id: 'r',
        logic: 'and',
        conditions: [{ id: 'c1', field: 'a', operator: 'isEmpty', value: '' }],
      }),
    ).toEqual({ a: { $exists: false } });
    expect(
      uiGroupToSpecFilter({
        id: 'r',
        logic: 'and',
        conditions: [{ id: 'c1', field: 'a', operator: 'isNotEmpty', value: '' }],
      }),
    ).toEqual({ a: { $exists: true } });
  });
});

describe('round-trip', () => {
  it('preserves a scalar equality filter', () => {
    const original = { is_active: true };
    const { group } = specFilterToUIGroup(original);
    expect(uiGroupToSpecFilter(group)).toEqual(original);
  });

  it('preserves an AND of mixed operators', () => {
    const original = { $and: [{ a: 1 }, { b: { $gt: 2 } }, { c: { $in: ['x', 'y'] } }] };
    const { group } = specFilterToUIGroup(original);
    expect(uiGroupToSpecFilter(group)).toEqual(original);
  });

  it('preserves an OR group', () => {
    const original = { $or: [{ a: 1 }, { b: 2 }] };
    const { group } = specFilterToUIGroup(original);
    expect(uiGroupToSpecFilter(group)).toEqual(original);
  });
});
