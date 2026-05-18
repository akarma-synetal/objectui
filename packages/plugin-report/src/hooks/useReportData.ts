/**
 * useReportData
 *
 * Spec-native report execution hook.
 *
 * Translates a `SpecReport` (definition from `@objectstack/spec`) into a
 * data-fetch + aggregation pipeline that works against any `DataSource`
 * adapter exposing `find(resource, params)`.
 *
 * Pipeline:
 *   1. Merge `report.filter` with optional `runtimeFilter` via `$and`.
 *   2. Collect referenced fields → request a narrow `$select`.
 *   3. Fetch raw rows.
 *   4. Group by `groupingsDown` then `groupingsAcross` (honouring
 *      `dateGranularity` for time-bucketed groupings).
 *   5. Compute per-column aggregates (`sum`/`avg`/`min`/`max`/`count`/`unique`)
 *      using spec semantics — `unique` = count of distinct non-null values.
 *   6. Compute grand totals (aggregate over the whole result set).
 *   7. Expose a `drillDown(groupKey)` helper that returns the raw rows
 *      matching every key/value pair in `groupKey`.
 *
 * Aggregations run client-side. Server-side execution will be plugged in
 * by a later milestone (M2: dateGranularity in QueryAST + `/aggregate`
 * dispatcher) without changing this hook's public contract.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SpecReport,
  SpecReportColumn,
  SpecReportGrouping,
  SpecReportDateGranularity,
} from '@object-ui/types';

/* -------------------------------------------------------------------------- */
/*  Public types                                                              */
/* -------------------------------------------------------------------------- */

export interface ReportRow {
  /** Group key path, e.g. `{ region: 'East', quarter: '2024-Q1' }`. Empty `{}` for the grand-total row. */
  groupKey: Record<string, unknown>;
  /** Display labels for the key path, in `[down..., across...]` order. */
  groupPath: string[];
  /** Aggregated values, keyed as `${field}__${aggregate}` (or just `${field}` for passthrough columns). */
  values: Record<string, unknown>;
  /** Number of underlying raw rows in this group. */
  count: number;
  /** Child rows for nested groupings. Undefined at the leaf level. */
  children?: ReportRow[];
}

export interface UseReportDataResult {
  rows: ReportRow[];
  rawRows: Record<string, unknown>[];
  totals: Record<string, unknown>;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  drillDown: (groupKey: Record<string, unknown>) => Record<string, unknown>[];
}

export interface UseReportDataOptions {
  /** Adapter exposing `find(resource, params)`. If absent, the hook stays idle. */
  dataSource?: { find?: (resource: string, params?: Record<string, unknown>) => Promise<unknown> };
  /** Filter merged on top of `report.filter` via `$and` (e.g., URL params, user selections). */
  runtimeFilter?: Record<string, unknown>;
  /** Optional `$top` cap for the raw fetch. Defaults to 5000. */
  maxRows?: number;
  /** When `false`, skips fetching. Defaults to `true`. */
  enabled?: boolean;
  /** Pre-fetched rows. When provided, bypasses `dataSource.find()` entirely. */
  rows?: Record<string, unknown>[];
}

/* -------------------------------------------------------------------------- */
/*  Helpers (exported for tests)                                              */
/* -------------------------------------------------------------------------- */

/** Stable key for a column's aggregated output: `field__aggregate` (or just `field`). */
export function columnKey(col: SpecReportColumn): string {
  return col.aggregate ? `${col.field}__${col.aggregate}` : col.field;
}

/** Format a Date into a string bucket according to a date granularity. */
export function bucketDate(value: unknown, granularity: SpecReportDateGranularity): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0-11
  const day = d.getUTCDate();
  switch (granularity) {
    case 'year':
      return String(y);
    case 'quarter':
      return `${y}-Q${Math.floor(m / 3) + 1}`;
    case 'month':
      return `${y}-${String(m + 1).padStart(2, '0')}`;
    case 'week': {
      // ISO week (Mon-based). Anchor on Thursday for week-of-year stability.
      const tmp = new Date(Date.UTC(y, m, day));
      const dayOfWeek = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayOfWeek);
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
      const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
    }
    case 'day':
      return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    default:
      return String(value);
  }
}

/** Extract the group value for a single grouping, applying dateGranularity if set. */
export function groupingValue(row: Record<string, unknown>, grouping: SpecReportGrouping): string {
  const raw = row[grouping.field];
  if (grouping.dateGranularity) {
    const b = bucketDate(raw, grouping.dateGranularity);
    return b ?? '(empty)';
  }
  if (raw == null || raw === '') return '(empty)';
  return String(raw);
}

/**
 * Compute aggregates for an array of rows against a list of columns.
 * `unique` returns the count of distinct non-null values; `count` includes nulls.
 */
export function aggregateRows(
  rows: Record<string, unknown>[],
  columns: readonly SpecReportColumn[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of columns) {
    if (!col.aggregate) {
      // Passthrough: pick the first non-null value (typical for dimension columns).
      const first = rows.find((r) => r[col.field] != null);
      out[columnKey(col)] = first ? first[col.field] : null;
      continue;
    }
    const values = rows.map((r) => r[col.field]);
    switch (col.aggregate) {
      case 'count':
        out[columnKey(col)] = values.length;
        break;
      case 'unique': {
        const set = new Set<unknown>();
        for (const v of values) {
          if (v != null) set.add(v);
        }
        out[columnKey(col)] = set.size;
        break;
      }
      case 'sum': {
        let s = 0;
        for (const v of values) s += Number(v) || 0;
        out[columnKey(col)] = s;
        break;
      }
      case 'avg': {
        let s = 0;
        let n = 0;
        for (const v of values) {
          if (v == null || v === '') continue;
          const num = Number(v);
          if (Number.isNaN(num)) continue;
          s += num;
          n += 1;
        }
        out[columnKey(col)] = n === 0 ? null : s / n;
        break;
      }
      case 'min': {
        let m: number | null = null;
        for (const v of values) {
          if (v == null) continue;
          const num = Number(v);
          if (Number.isNaN(num)) continue;
          if (m === null || num < m) m = num;
        }
        out[columnKey(col)] = m;
        break;
      }
      case 'max': {
        let m: number | null = null;
        for (const v of values) {
          if (v == null) continue;
          const num = Number(v);
          if (Number.isNaN(num)) continue;
          if (m === null || num > m) m = num;
        }
        out[columnKey(col)] = m;
        break;
      }
      default:
        out[columnKey(col)] = null;
    }
  }
  return out;
}

/**
 * Recursive grouping. Each grouping level produces a nested `ReportRow[]`.
 * The final leaf level still aggregates over the bucket so callers always have
 * `values` available without re-walking children.
 */
export function groupAndAggregate(
  rows: Record<string, unknown>[],
  groupings: readonly SpecReportGrouping[],
  columns: readonly SpecReportColumn[],
  parentKey: Record<string, unknown> = {},
  parentPath: string[] = [],
): ReportRow[] {
  if (groupings.length === 0) return [];

  const [head, ...rest] = groupings;
  const buckets = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = groupingValue(row, head);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(row);
  }

  const result: ReportRow[] = [];
  for (const [key, bucketRows] of buckets) {
    const groupKey = { ...parentKey, [head.field]: key };
    const groupPath = [...parentPath, key];
    const values = aggregateRows(bucketRows, columns);
    const children = rest.length > 0
      ? groupAndAggregate(bucketRows, rest, columns, groupKey, groupPath)
      : undefined;
    result.push({ groupKey, groupPath, values, count: bucketRows.length, children });
  }

  // Sort: respect head.sort if set; default to ascending key.
  const dir = head.sort === 'desc' ? -1 : 1;
  result.sort((a, b) => {
    const av = String(a.groupPath[a.groupPath.length - 1]);
    const bv = String(b.groupPath[b.groupPath.length - 1]);
    return av.localeCompare(bv) * dir;
  });

  // Honour `limit` if present on the head grouping (mirrors the spec).
  if (typeof head.limit === 'number' && head.limit > 0) {
    return result.slice(0, head.limit);
  }
  return result;
}

/** Combine two FilterCondition objects via `$and`, dropping empty ones. */
export function mergeFilters(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const hasA = a && Object.keys(a).length > 0;
  const hasB = b && Object.keys(b).length > 0;
  if (hasA && hasB) return { $and: [a, b] };
  if (hasA) return a;
  if (hasB) return b;
  return undefined;
}

/** Collect all fields referenced by groupings + columns + sort + filter (for $select). */
export function collectFields(report: SpecReport): string[] {
  const set = new Set<string>();
  for (const g of report.groupingsDown ?? []) set.add(g.field);
  for (const g of report.groupingsAcross ?? []) set.add(g.field);
  for (const c of report.columns ?? []) set.add(c.field);
  for (const s of report.sort ?? []) set.add(s.field);
  return Array.from(set);
}

/** Test whether a raw row matches every key/value pair in a group key. */
function matchesGroupKey(
  row: Record<string, unknown>,
  groupKey: Record<string, unknown>,
  groupings: readonly SpecReportGrouping[],
): boolean {
  for (const [field, expected] of Object.entries(groupKey)) {
    const grouping = groupings.find((g) => g.field === field);
    const actual = grouping ? groupingValue(row, grouping) : String(row[field] ?? '(empty)');
    if (actual !== String(expected)) return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/*  Hook                                                                      */
/* -------------------------------------------------------------------------- */

const EMPTY_ROWS: Record<string, unknown>[] = [];

/**
 * Run a spec `Report` and return its rows, totals, and a drill-down helper.
 */
export function useReportData(
  report: SpecReport | undefined,
  options: UseReportDataOptions = {},
): UseReportDataResult {
  const { dataSource, runtimeFilter, maxRows = 5000, enabled = true, rows: providedRows } = options;
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>(providedRows ?? EMPTY_ROWS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchSeq = useRef(0);

  const fetchOnce = useCallback(async (): Promise<void> => {
    if (!report || !enabled) return;
    if (providedRows) {
      setRawRows(providedRows);
      return;
    }
    if (!dataSource || typeof dataSource.find !== 'function') {
      setRawRows(EMPTY_ROWS);
      return;
    }
    const seq = ++fetchSeq.current;
    setLoading(true);
    setError(null);
    try {
      const filter = mergeFilters(
        report.filter as Record<string, unknown> | undefined,
        runtimeFilter,
      );
      const $select = collectFields(report);
      const params: Record<string, unknown> = { $top: maxRows };
      if (filter) params.$filter = filter;
      if ($select.length > 0) params.$select = $select;
      if (report.sort && report.sort.length > 0) {
        params.$orderBy = report.sort.map((s) => `${s.field} ${s.direction ?? 'asc'}`).join(',');
      }

      const raw = await dataSource.find(report.objectName, params);
      const extracted = extractRecords(raw);
      if (seq !== fetchSeq.current) return; // a newer fetch superseded us
      setRawRows(extracted);
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
      setRawRows(EMPTY_ROWS);
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [report, enabled, providedRows, dataSource, runtimeFilter, maxRows]);

  useEffect(() => {
    void fetchOnce();
  }, [fetchOnce]);

  // Derive grouped + aggregated output.
  const { rows, totals } = useMemo(() => {
    if (!report) return { rows: [] as ReportRow[], totals: {} as Record<string, unknown> };
    const groupings = [
      ...(report.groupingsDown ?? []),
      ...(report.groupingsAcross ?? []),
    ];
    const cols = report.columns ?? [];
    const grouped = groupings.length > 0
      ? groupAndAggregate(rawRows, groupings, cols)
      : rawRows.map((r) => ({
          groupKey: {},
          groupPath: [],
          values: cols.length > 0 ? aggregateRows([r], cols) : { ...r },
          count: 1,
        }));
    const grandTotals = aggregateRows(rawRows, cols);
    return { rows: grouped, totals: grandTotals };
  }, [report, rawRows]);

  const drillDown = useCallback(
    (groupKey: Record<string, unknown>): Record<string, unknown>[] => {
      if (!report) return [];
      const groupings = [
        ...(report.groupingsDown ?? []),
        ...(report.groupingsAcross ?? []),
      ];
      return rawRows.filter((r) => matchesGroupKey(r, groupKey, groupings));
    },
    [report, rawRows],
  );

  return { rows, rawRows, totals, loading, error, refetch: fetchOnce, drillDown };
}

/* -------------------------------------------------------------------------- */
/*  Internal: tolerate diverse adapter response shapes                        */
/* -------------------------------------------------------------------------- */

function extractRecords(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (Array.isArray(obj.records)) return obj.records as Record<string, unknown>[];
    if (Array.isArray(obj.results)) return obj.results as Record<string, unknown>[];
    if (Array.isArray(obj.value)) return obj.value as Record<string, unknown>[];
  }
  return EMPTY_ROWS;
}
