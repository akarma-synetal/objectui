/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGroupedData } from '../useGroupedData';

const sampleData = [
  { category: 'A', priority: 'High', amount: 10 },
  { category: 'A', priority: 'Low', amount: 20 },
  { category: 'B', priority: 'High', amount: 30 },
  { category: 'B', priority: 'Medium', amount: 40 },
  { category: 'C', priority: 'Low', amount: 50 },
];

describe('useGroupedData – collapsed state management', () => {
  it('returns isGrouped=false when config is undefined', () => {
    const { result } = renderHook(() => useGroupedData(undefined, sampleData));
    expect(result.current.isGrouped).toBe(false);
    expect(result.current.groups).toEqual([]);
  });

  it('returns isGrouped=false when config has empty fields', () => {
    const { result } = renderHook(() => useGroupedData({ fields: [] }, sampleData));
    expect(result.current.isGrouped).toBe(false);
    expect(result.current.groups).toEqual([]);
  });

  it('groups data correctly with single field', () => {
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: false }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    expect(result.current.isGrouped).toBe(true);
    expect(result.current.groups).toHaveLength(3);
    expect(result.current.groups[0].label).toBe('A');
    expect(result.current.groups[0].rows).toHaveLength(2);
    expect(result.current.groups[0].subgroups).toEqual([]);
    expect(result.current.groups[1].label).toBe('B');
    expect(result.current.groups[1].rows).toHaveLength(2);
    expect(result.current.groups[2].label).toBe('C');
    expect(result.current.groups[2].rows).toHaveLength(1);
  });

  it('all groups default to expanded when collapsed=false', () => {
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: false }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    result.current.groups.forEach((group) => {
      expect(group.collapsed).toBe(false);
    });
  });

  it('all groups default to collapsed when collapsed=true', () => {
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: true }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    result.current.groups.forEach((group) => {
      expect(group.collapsed).toBe(true);
    });
  });

  it('toggleGroup toggles a group from expanded to collapsed', () => {
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: false }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    // Initially all expanded
    expect(result.current.groups[0].collapsed).toBe(false);

    // Toggle group A using its composite key
    const groupAKey = result.current.groups[0].key;
    act(() => {
      result.current.toggleGroup(groupAKey);
    });

    expect(result.current.groups[0].collapsed).toBe(true);
    // Other groups remain expanded
    expect(result.current.groups[1].collapsed).toBe(false);
    expect(result.current.groups[2].collapsed).toBe(false);
  });

  it('toggleGroup toggles a group from collapsed back to expanded', () => {
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: false }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    const key = result.current.groups[0].key;
    // Toggle twice: expand -> collapse -> expand
    act(() => {
      result.current.toggleGroup(key);
    });
    expect(result.current.groups[0].collapsed).toBe(true);

    act(() => {
      result.current.toggleGroup(key);
    });
    expect(result.current.groups[0].collapsed).toBe(false);
  });

  it('toggleGroup expands a group that defaults to collapsed', () => {
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: true }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    // Initially all collapsed
    expect(result.current.groups[0].collapsed).toBe(true);

    // Toggle group A to expand
    const groupAKey = result.current.groups[0].key;
    act(() => {
      result.current.toggleGroup(groupAKey);
    });

    expect(result.current.groups[0].collapsed).toBe(false);
    // Other groups remain collapsed
    expect(result.current.groups[1].collapsed).toBe(true);
  });

  it('sorts groups in descending order when configured', () => {
    const config = { fields: [{ field: 'category', order: 'desc' as const, collapsed: false }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    expect(result.current.groups[0].label).toBe('C');
    expect(result.current.groups[1].label).toBe('B');
    expect(result.current.groups[2].label).toBe('A');
  });

  it('builds correct labels for groups', () => {
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: false }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    expect(result.current.groups[0].label).toBe('A');
    expect(result.current.groups[1].label).toBe('B');
    expect(result.current.groups[2].label).toBe('C');
  });

  it('shows (empty) label for rows with missing grouping field', () => {
    const data = [
      { category: 'A', amount: 10 },
      { amount: 20 }, // no category
      { category: '', amount: 30 }, // empty category
    ];
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: false }] };
    const { result } = renderHook(() => useGroupedData(config, data));

    const emptyGroup = result.current.groups.find((g) => g.label === '(empty)');
    expect(emptyGroup).toBeDefined();
    expect(emptyGroup!.rows).toHaveLength(2);
  });

  it('supports multi-field grouping (nested subgroups)', () => {
    const config = {
      fields: [
        { field: 'category', order: 'asc' as const, collapsed: false },
        { field: 'priority', order: 'asc' as const, collapsed: false },
      ],
    };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    expect(result.current.isGrouped).toBe(true);
    // Top-level groups: one per unique category (A, B, C)
    expect(result.current.groups).toHaveLength(3);
    expect(result.current.groups.map((g) => g.label)).toEqual(['A', 'B', 'C']);

    // Each top-level group exposes nested subgroups for the secondary field.
    const groupA = result.current.groups[0];
    expect(groupA.depth).toBe(0);
    expect(groupA.field).toBe('category');
    // Category A has rows with priorities High and Low → 2 subgroups.
    expect(groupA.subgroups).toHaveLength(2);
    expect(groupA.subgroups.map((s) => s.label).sort()).toEqual(['High', 'Low']);
    expect(groupA.subgroups[0].depth).toBe(1);
    expect(groupA.subgroups[0].field).toBe('priority');
    expect(groupA.subgroups[0].subgroups).toEqual([]);

    // Category C has only one row → exactly one nested subgroup.
    const groupC = result.current.groups[2];
    expect(groupC.subgroups).toHaveLength(1);
    expect(groupC.subgroups[0].rows).toHaveLength(1);
  });

  it('toggleGroup on a nested subgroup leaves parents untouched', () => {
    const config = {
      fields: [
        { field: 'category', order: 'asc' as const, collapsed: false },
        { field: 'priority', order: 'asc' as const, collapsed: false },
      ],
    };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    const subKey = result.current.groups[0].subgroups[0].key;
    act(() => {
      result.current.toggleGroup(subKey);
    });

    expect(result.current.groups[0].subgroups[0].collapsed).toBe(true);
    // Sibling subgroup and parent untouched
    expect(result.current.groups[0].subgroups[1].collapsed).toBe(false);
    expect(result.current.groups[0].collapsed).toBe(false);
  });

  describe('formatValue – select / boolean label resolution', () => {
    it('uses formatValue to resolve select option labels', () => {
      const data = [
        { id: 1, status: 'in_progress' },
        { id: 2, status: 'in_progress' },
        { id: 3, status: 'done' },
      ];
      const config = { fields: [{ field: 'status', order: 'asc' as const, collapsed: false }] };
      const formatter = (field: string, value: any) => {
        if (field !== 'status') return undefined;
        return ({ in_progress: 'In Progress', done: 'Done' } as Record<string, string>)[String(value)];
      };

      const { result } = renderHook(() => useGroupedData(config, data, undefined, formatter));

      // Groups are sorted by raw key — 'done' < 'in_progress'
      const labels = result.current.groups.map((g) => g.label);
      expect(labels).toEqual(['Done', 'In Progress']);
    });

    it('falls back to raw value when formatter returns undefined', () => {
      const data = [{ status: 'unknown_value' }];
      const config = { fields: [{ field: 'status', order: 'asc' as const, collapsed: false }] };
      const formatter = () => undefined;

      const { result } = renderHook(() => useGroupedData(config, data, undefined, formatter));

      expect(result.current.groups[0].label).toBe('unknown_value');
    });

    it('still renders (empty) when value is null', () => {
      const data = [{ status: null }];
      const config = { fields: [{ field: 'status', order: 'asc' as const, collapsed: false }] };
      const formatter = () => 'should-not-be-called';

      const { result } = renderHook(() => useGroupedData(config, data, undefined, formatter));

      expect(result.current.groups[0].label).toBe('(empty)');
    });

    it('formats array values (multi-select) per element', () => {
      const data = [{ tags: ['a', 'b'] }];
      const config = { fields: [{ field: 'tags', order: 'asc' as const, collapsed: false }] };
      const formatter = (_field: string, value: any) =>
        ({ a: 'Alpha', b: 'Beta' } as Record<string, string>)[String(value)];

      const { result } = renderHook(() => useGroupedData(config, data, undefined, formatter));

      expect(result.current.groups[0].label).toBe('Alpha, Beta');
    });
  });

  describe('lookup / master_detail object values', () => {
    it('groups by lookup object using id and shows display name', () => {
      const data = [
        { id: 1, account: { id: 'a1', name: 'Acme Corporation' } },
        { id: 2, account: { id: 'a1', name: 'Acme Corporation' } },
        { id: 3, account: { id: 'a2', name: 'Beta Industries' } },
      ];
      const config = { fields: [{ field: 'account', order: 'asc' as const, collapsed: false }] };

      const { result } = renderHook(() => useGroupedData(config, data));

      expect(result.current.groups).toHaveLength(2);
      expect(result.current.groups.map((g) => g.label)).toEqual([
        'Acme Corporation',
        'Beta Industries',
      ]);
      expect(result.current.groups[0].rows).toHaveLength(2);
      expect(result.current.groups[1].rows).toHaveLength(1);
      // No "[object Object]" anywhere in labels
      for (const g of result.current.groups) {
        expect(g.label).not.toContain('[object Object]');
      }
    });

    it('keeps distinct groups for same display name but different ids', () => {
      const data = [
        { account: { id: 'a1', name: 'Same Name' } },
        { account: { id: 'a2', name: 'Same Name' } },
      ];
      const config = { fields: [{ field: 'account', order: 'asc' as const, collapsed: false }] };

      const { result } = renderHook(() => useGroupedData(config, data));

      expect(result.current.groups).toHaveLength(2);
    });

    it('falls back to id when no display name field is present', () => {
      const data = [{ owner: { id: 'u1' } }];
      const config = { fields: [{ field: 'owner', order: 'asc' as const, collapsed: false }] };

      const { result } = renderHook(() => useGroupedData(config, data));

      expect(result.current.groups[0].label).toBe('u1');
    });

    it('handles null lookup values as (empty)', () => {
      const data = [{ account: null }, { account: { id: 'a1', name: 'Acme' } }];
      const config = { fields: [{ field: 'account', order: 'asc' as const, collapsed: false }] };

      const { result } = renderHook(() => useGroupedData(config, data));

      const labels = result.current.groups.map((g) => g.label);
      expect(labels).toContain('(empty)');
      expect(labels).toContain('Acme');
    });
  });
});
