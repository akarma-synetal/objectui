/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Tests for `useReportData` and its pure helpers.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { SpecReport } from '@object-ui/types';
import {
  useReportData,
  columnKey,
  bucketDate,
  groupingValue,
  aggregateRows,
  groupAndAggregate,
  mergeFilters,
  collectFields,
} from '../useReportData';

const dataset = [
  { id: 1, region: 'East', quarter: '2024-Q1', amount: 100, owner: 'alice' },
  { id: 2, region: 'East', quarter: '2024-Q1', amount: 200, owner: 'alice' },
  { id: 3, region: 'East', quarter: '2024-Q2', amount: 150, owner: 'bob' },
  { id: 4, region: 'West', quarter: '2024-Q1', amount: 300, owner: 'alice' },
  { id: 5, region: 'West', quarter: '2024-Q2', amount: null as unknown as number, owner: 'carol' },
];

describe('columnKey', () => {
  it('returns field for passthrough columns', () => {
    expect(columnKey({ field: 'amount' })).toBe('amount');
  });
  it('returns field__aggregate for aggregated columns', () => {
    expect(columnKey({ field: 'amount', aggregate: 'sum' })).toBe('amount__sum');
  });
});

describe('bucketDate', () => {
  it('buckets year/quarter/month/day deterministically', () => {
    const d = '2024-05-17T12:34:56Z';
    expect(bucketDate(d, 'year')).toBe('2024');
    expect(bucketDate(d, 'quarter')).toBe('2024-Q2');
    expect(bucketDate(d, 'month')).toBe('2024-05');
    expect(bucketDate(d, 'day')).toBe('2024-05-17');
  });
  it('returns null for non-dates', () => {
    expect(bucketDate('not-a-date', 'year')).toBe(null);
    expect(bucketDate(null, 'year')).toBe(null);
  });
  it('returns an ISO-week string for week granularity', () => {
    expect(bucketDate('2024-01-04', 'week')).toMatch(/^2024-W\d{2}$/);
  });
});

describe('groupingValue', () => {
  it('returns the raw value as string when no granularity', () => {
    expect(groupingValue({ region: 'East' }, { field: 'region' })).toBe('East');
  });
  it('maps null/undefined/empty-string to (empty)', () => {
    expect(groupingValue({ region: null }, { field: 'region' })).toBe('(empty)');
    expect(groupingValue({ region: '' }, { field: 'region' })).toBe('(empty)');
    expect(groupingValue({}, { field: 'region' })).toBe('(empty)');
  });
  it('applies dateGranularity when set', () => {
    expect(
      groupingValue(
        { close_date: '2024-08-12' },
        { field: 'close_date', dateGranularity: 'quarter' },
      ),
    ).toBe('2024-Q3');
  });
});

describe('aggregateRows', () => {
  it('computes sum/avg/min/max/count/unique correctly', () => {
    const cols = [
      { field: 'amount', aggregate: 'sum' as const },
      { field: 'amount', aggregate: 'avg' as const },
      { field: 'amount', aggregate: 'min' as const },
      { field: 'amount', aggregate: 'max' as const },
      { field: 'id', aggregate: 'count' as const },
      { field: 'owner', aggregate: 'unique' as const },
    ];
    const out = aggregateRows(dataset, cols);
    expect(out['amount__sum']).toBe(750);
    // avg ignores null: (100+200+150+300)/4 = 187.5
    expect(out['amount__avg']).toBe(187.5);
    expect(out['amount__min']).toBe(100);
    expect(out['amount__max']).toBe(300);
    // count includes null rows
    expect(out['id__count']).toBe(5);
    // unique owners: alice, bob, carol → 3
    expect(out['owner__unique']).toBe(3);
  });

  it('passthrough columns keep the first non-null value', () => {
    const out = aggregateRows(dataset, [{ field: 'region' }]);
    expect(out['region']).toBe('East');
  });

  it('avg of all-null returns null, not NaN', () => {
    const out = aggregateRows(
      [{ amount: null }, { amount: null }],
      [{ field: 'amount', aggregate: 'avg' }],
    );
    expect(out['amount__avg']).toBe(null);
  });
});

describe('groupAndAggregate', () => {
  it('produces one row per group with aggregates', () => {
    const rows = groupAndAggregate(
      dataset,
      [{ field: 'region' }],
      [{ field: 'amount', aggregate: 'sum' }],
    );
    expect(rows).toHaveLength(2);
    const east = rows.find((r) => r.groupKey.region === 'East')!;
    const west = rows.find((r) => r.groupKey.region === 'West')!;
    expect(east.values['amount__sum']).toBe(450);
    expect(west.values['amount__sum']).toBe(300);
    expect(east.count).toBe(3);
    expect(west.count).toBe(2);
  });

  it('nests groupings (region → quarter)', () => {
    const rows = groupAndAggregate(
      dataset,
      [{ field: 'region' }, { field: 'quarter' }],
      [{ field: 'amount', aggregate: 'sum' }],
    );
    const east = rows.find((r) => r.groupKey.region === 'East')!;
    expect(east.children).toBeDefined();
    expect(east.children).toHaveLength(2);
    const eastQ1 = east.children!.find((c) => c.groupKey.quarter === '2024-Q1')!;
    expect(eastQ1.values['amount__sum']).toBe(300);
    expect(eastQ1.groupKey).toEqual({ region: 'East', quarter: '2024-Q1' });
    expect(eastQ1.groupPath).toEqual(['East', '2024-Q1']);
  });

  it('respects desc sort', () => {
    const rows = groupAndAggregate(
      dataset,
      [{ field: 'region', sort: 'desc' }],
      [{ field: 'amount', aggregate: 'sum' }],
    );
    expect(rows[0].groupKey.region).toBe('West');
    expect(rows[1].groupKey.region).toBe('East');
  });

  it('honours grouping limit', () => {
    const rows = groupAndAggregate(
      dataset,
      [{ field: 'region', limit: 1 }],
      [{ field: 'amount', aggregate: 'sum' }],
    );
    expect(rows).toHaveLength(1);
  });
});

describe('mergeFilters', () => {
  it('returns undefined for two empties', () => {
    expect(mergeFilters(undefined, undefined)).toBeUndefined();
    expect(mergeFilters({}, {})).toBeUndefined();
  });
  it('returns either side when the other is empty', () => {
    expect(mergeFilters({ a: 1 }, undefined)).toEqual({ a: 1 });
    expect(mergeFilters(undefined, { b: 2 })).toEqual({ b: 2 });
  });
  it('wraps both in $and', () => {
    expect(mergeFilters({ a: 1 }, { b: 2 })).toEqual({ $and: [{ a: 1 }, { b: 2 }] });
  });
});

describe('collectFields', () => {
  it('unions fields from groupings + columns + sort', () => {
    const r = SpecReport.create({
      name: 'demo',
      label: 'Demo',
      objectName: 'opportunity',
      type: 'summary',
      groupingsDown: [{ field: 'region' }],
      groupingsAcross: [{ field: 'quarter' }],
      columns: [{ field: 'amount', aggregate: 'sum' }, { field: 'id', aggregate: 'count' }],
      sort: [{ field: 'amount', direction: 'desc' }],
    });
    const fields = collectFields(r);
    expect(fields.sort()).toEqual(['amount', 'id', 'quarter', 'region'].sort());
  });
});

describe('useReportData', () => {
  const baseReport = SpecReport.create({
    name: 'sales_by_region',
    label: 'Sales by Region',
    objectName: 'opportunity',
    type: 'summary',
    groupingsDown: [{ field: 'region' }],
    columns: [
      { field: 'amount', aggregate: 'sum' },
      { field: 'owner', aggregate: 'unique' },
    ],
  });

  it('works with provided rows (no dataSource fetch)', async () => {
    const { result } = renderHook(() =>
      useReportData(baseReport, { rows: dataset }),
    );
    await waitFor(() => expect(result.current.rows.length).toBe(2));
    const east = result.current.rows.find((r) => r.groupKey.region === 'East')!;
    expect(east.values['amount__sum']).toBe(450);
    expect(east.values['owner__unique']).toBe(2); // alice, bob
    expect(result.current.totals['amount__sum']).toBe(750);
    expect(result.current.totals['owner__unique']).toBe(3);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('fetches via dataSource.find with the right query params', async () => {
    const find = vi.fn().mockResolvedValue({ data: dataset });
    const dataSource = { find };
    const { result } = renderHook(() =>
      useReportData(baseReport, { dataSource, runtimeFilter: { region: 'East' } }),
    );
    await waitFor(() => expect(find).toHaveBeenCalled());
    expect(find).toHaveBeenCalledWith('opportunity', expect.objectContaining({
      $top: 5000,
      $filter: { region: 'East' }, // baseReport has no filter, so runtimeFilter passes through
      $select: expect.arrayContaining(['region', 'amount', 'owner']),
    }));
    await waitFor(() => expect(result.current.rawRows.length).toBe(5));
  });

  it('merges report.filter + runtimeFilter via $and', async () => {
    const reportWithFilter = SpecReport.create({
      ...baseReport,
      filter: { stage: 'closed' },
    } as Parameters<typeof SpecReport.create>[0]);
    const find = vi.fn().mockResolvedValue({ data: [] });
    renderHook(() =>
      useReportData(reportWithFilter, { dataSource: { find }, runtimeFilter: { region: 'East' } }),
    );
    await waitFor(() => expect(find).toHaveBeenCalled());
    expect(find.mock.calls[0][1]).toMatchObject({
      $filter: { $and: [{ stage: 'closed' }, { region: 'East' }] },
    });
  });

  it('surfaces fetch errors', async () => {
    const find = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() =>
      useReportData(baseReport, { dataSource: { find } }),
    );
    await waitFor(() => expect(result.current.error).not.toBe(null));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.loading).toBe(false);
  });

  it('drillDown returns raw rows matching the group key', async () => {
    const { result } = renderHook(() =>
      useReportData(baseReport, { rows: dataset }),
    );
    await waitFor(() => expect(result.current.rows.length).toBe(2));
    const eastRaw = result.current.drillDown({ region: 'East' });
    expect(eastRaw).toHaveLength(3);
    expect(eastRaw.every((r) => r.region === 'East')).toBe(true);
  });

  it('refetch re-invokes dataSource.find', async () => {
    const find = vi.fn().mockResolvedValue([]);
    // Stabilize dataSource ref so the effect doesn't refire on every render.
    const dataSource = { find };
    const { result } = renderHook(() =>
      useReportData(baseReport, { dataSource }),
    );
    await waitFor(() => expect(find).toHaveBeenCalled());
    const before = find.mock.calls.length;
    await act(async () => { await result.current.refetch(); });
    expect(find.mock.calls.length).toBe(before + 1);
  });

  it('handles a matrix report with groupingsDown + groupingsAcross', async () => {
    const matrix = SpecReport.create({
      name: 'matrix_demo',
      label: 'Matrix',
      objectName: 'opportunity',
      type: 'matrix',
      groupingsDown: [{ field: 'region' }],
      groupingsAcross: [{ field: 'quarter' }],
      columns: [{ field: 'amount', aggregate: 'sum' }],
    });
    const { result } = renderHook(() => useReportData(matrix, { rows: dataset }));
    await waitFor(() => expect(result.current.rows.length).toBeGreaterThan(0));
    // Two regions × respective quarters in children
    const east = result.current.rows.find((r) => r.groupKey.region === 'East')!;
    expect(east.children).toBeDefined();
    expect(east.children!.length).toBe(2); // Q1, Q2
  });
});
