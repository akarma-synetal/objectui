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
  /** Pivoted matrix shape — populated when `report.groupingsAcross` is non-empty. */
  pivot: PivotMatrix | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  drillDown: (groupKey: Record<string, unknown>) => Record<string, unknown>[];
}

/**
 * 2D pivot output. `rowHeaders` × `colHeaders` form the matrix; `cells[rowId][colId]`
 * holds the per-cell aggregated values keyed by `columnKey()`. Totals are
 * pre-computed so the renderer doesn't need to re-aggregate.
 */
export interface PivotHeader {
  /** Group key path, e.g. `{ region: 'EMEA' }` (row) or `{ closeQuarter: '2024-Q1' }` (col). */
  key: Record<string, unknown>;
  /** Display labels in nesting order. */
  path: string[];
  /** Stable id derived from `path` — use as React key + lookup key into `cells`. */
  id: string;
}

export interface PivotMatrix {
  rowHeaders: PivotHeader[];
  colHeaders: PivotHeader[];
  /** `cells[rowId][colId] = { 'amount__sum': 1200, ... }`. Missing cells are absent (renderer fills with 0/—). */
  cells: Record<string, Record<string, Record<string, unknown>>>;
  /** Row totals across all columns, keyed by `rowId`. */
  rowTotals: Record<string, Record<string, unknown>>;
  /** Column totals across all rows, keyed by `colId`. */
  colTotals: Record<string, Record<string, unknown>>;
  /** Grand total across the entire matrix. */
  grandTotal: Record<string, unknown>;
  columns: readonly SpecReportColumn[];
  downGroupings: readonly SpecReportGrouping[];
  acrossGroupings: readonly SpecReportGrouping[];
}

export interface UseReportDataOptions {
  /**
   * Adapter exposing `find(resource, params)` and optionally `aggregate(resource, query)`.
   * - When `.aggregate` is present, the hook prefers it for reports with date
   *   bucketing or pure aggregations — the server then runs DATE_TRUNC + GROUP
   *   BY natively and returns one row per bucket.
   * - When only `.find` is present, the hook falls back to raw rows + client
   *   bucketing (see `bucketDate` / `groupingValue`).
   * If the hook stays idle, no fetch happens.
   */
  dataSource?: {
    find?: (resource: string, params?: Record<string, unknown>) => Promise<unknown>;
    aggregate?: (resource: string, query: Record<string, unknown>) => Promise<unknown>;
  };
  /** Filter merged on top of `report.filter` via `$and` (e.g., URL params, user selections). */
  runtimeFilter?: Record<string, unknown>;
  /** Optional `$top` cap for the raw fetch. Defaults to 5000. */
  maxRows?: number;
  /** When `false`, skips fetching. Defaults to `true`. */
  enabled?: boolean;
  /** Pre-fetched rows. When provided, bypasses `dataSource` entirely. */
  rows?: Record<string, unknown>[];
  /**
   * When true (default), prefer `dataSource.aggregate()` for reports that
   * carry date granularity or any aggregating column. Set false to force the
   * client-side path (useful for tests / debugging).
   */
  preferServerAggregation?: boolean;
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

/**
 * Build a 2D pivot matrix from raw rows. Rows are bucketed by every
 * `downGroupings` field path; columns by every `acrossGroupings` field path.
 * Each cell is then aggregated independently with the report's columns.
 *
 * - When either dimension is empty, the matrix degenerates: a single header
 *   with empty path is emitted so the renderer can still display a 1×N or
 *   N×1 strip without special-casing.
 * - Header ordering honours each grouping's `sort` ('asc' default, 'desc' opt-in).
 * - `limit` on the *head* grouping of each dimension is respected (matches
 *   `groupAndAggregate`); deeper limits are ignored to preserve totals.
 */
export function pivotRows(
  rows: Record<string, unknown>[],
  columns: readonly SpecReportColumn[],
  downGroupings: readonly SpecReportGrouping[],
  acrossGroupings: readonly SpecReportGrouping[],
): PivotMatrix {
  const rowHeaders = collectHeaders(rows, downGroupings);
  const colHeaders = collectHeaders(rows, acrossGroupings);
  const cells: Record<string, Record<string, Record<string, unknown>>> = {};
  const rowTotals: Record<string, Record<string, unknown>> = {};
  const colTotals: Record<string, Record<string, unknown>> = {};

  for (const rh of rowHeaders) {
    cells[rh.id] = {};
    const rowSubset = filterByKey(rows, rh.key, downGroupings);
    rowTotals[rh.id] = aggregateRows(rowSubset, columns);

    for (const ch of colHeaders) {
      const cellSubset = filterByKey(rowSubset, ch.key, acrossGroupings);
      if (cellSubset.length === 0) continue;
      cells[rh.id][ch.id] = aggregateRows(cellSubset, columns);
    }
  }
  for (const ch of colHeaders) {
    const colSubset = filterByKey(rows, ch.key, acrossGroupings);
    colTotals[ch.id] = aggregateRows(colSubset, columns);
  }

  return {
    rowHeaders,
    colHeaders,
    cells,
    rowTotals,
    colTotals,
    grandTotal: aggregateRows(rows, columns),
    columns,
    downGroupings,
    acrossGroupings,
  };
}

/**
 * Walk all grouping fields and enumerate every distinct combination present
 * in `rows`. Returns headers ordered by each grouping's `sort` direction,
 * trimmed by the head grouping's `limit` (matching `groupAndAggregate`).
 */
function collectHeaders(
  rows: Record<string, unknown>[],
  groupings: readonly SpecReportGrouping[],
): PivotHeader[] {
  if (groupings.length === 0) {
    return [{ key: {}, path: [], id: '' }];
  }
  // Build distinct path tuples by walking rows once per level.
  const seen = new Map<string, PivotHeader>();
  for (const row of rows) {
    const path: string[] = [];
    const key: Record<string, unknown> = {};
    for (const g of groupings) {
      const v = groupingValue(row, g);
      path.push(v);
      key[g.field] = v;
    }
    const id = path.join('\u0001');
    if (!seen.has(id)) seen.set(id, { key, path, id });
  }
  const headers = Array.from(seen.values());

  // Multi-level sort: honour each grouping's sort direction.
  headers.sort((a, b) => {
    for (let i = 0; i < groupings.length; i++) {
      const dir = groupings[i].sort === 'desc' ? -1 : 1;
      const cmp = a.path[i].localeCompare(b.path[i]) * dir;
      if (cmp !== 0) return cmp;
    }
    return 0;
  });

  const headLimit = groupings[0].limit;
  if (typeof headLimit === 'number' && headLimit > 0) {
    // Limit applies to the *top-level* distinct values, keeping all their descendants.
    const allowedTops = new Set<string>();
    for (const h of headers) {
      if (allowedTops.size >= headLimit && !allowedTops.has(h.path[0])) continue;
      allowedTops.add(h.path[0]);
    }
    return headers.filter((h) => allowedTops.has(h.path[0]));
  }
  return headers;
}

function filterByKey(
  rows: Record<string, unknown>[],
  key: Record<string, unknown>,
  groupings: readonly SpecReportGrouping[],
): Record<string, unknown>[] {
  const entries = Object.entries(key);
  if (entries.length === 0) return rows;
  // Build a projection map so we use the same bucketed value (incl. date trunc).
  const projectors = new Map<string, SpecReportGrouping>();
  for (const g of groupings) projectors.set(g.field, g);
  return rows.filter((row) => {
    for (const [field, expected] of entries) {
      const g = projectors.get(field);
      const actual = g ? groupingValue(row, g) : (row[field] == null ? '(null)' : String(row[field]));
      if (actual !== String(expected)) return false;
    }
    return true;
  });
}

/**
 * Sum the per-column aggregate fields across already-bucketed rows. Used to
 * recompute grand totals from server-aggregated output. For `sum`/`count`
 * columns the result is exact; for `avg`/`min`/`max`/`unique` it is a useful
 * approximation only — for strict accuracy on those, the caller should issue
 * a second aggregate query without `groupBy`.
 */
function sumPreAggregated(
  rows: Record<string, unknown>[],
  columns: readonly SpecReportColumn[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of columns) {
    if (!col.aggregate) continue;
    const key = columnKey(col);
    let acc = 0;
    let n = 0;
    let min: number | null = null;
    let max: number | null = null;
    for (const row of rows) {
      const v = row[key];
      if (typeof v !== 'number') continue;
      acc += v;
      n += 1;
      if (min == null || v < min) min = v;
      if (max == null || v > max) max = v;
    }
    if (col.aggregate === 'min') out[key] = min;
    else if (col.aggregate === 'max') out[key] = max;
    else if (col.aggregate === 'avg') out[key] = n === 0 ? null : acc / n;
    else out[key] = acc;
  }
  return out;
}

/**
 * Reshape already-bucketed rows (e.g. from server-side `aggregate`) into a
 * pivot matrix. Each input row is expected to carry one entry per group field
 * plus the per-column aggregate values keyed by `columnKey(col)`. Totals are
 * recomputed via `sumPreAggregated` (see caveat there).
 */
function pivotPreAggregated(
  rows: Record<string, unknown>[],
  columns: readonly SpecReportColumn[],
  downGroupings: readonly SpecReportGrouping[],
  acrossGroupings: readonly SpecReportGrouping[],
): PivotMatrix {
  // Build distinct header sets directly from bucketed rows.
  const rowHeaders = collectHeadersFromBucketed(rows, downGroupings);
  const colHeaders = collectHeadersFromBucketed(rows, acrossGroupings);
  const cells: Record<string, Record<string, Record<string, unknown>>> = {};
  const rowTotals: Record<string, Record<string, unknown>> = {};
  const colTotals: Record<string, Record<string, unknown>> = {};

  for (const rh of rowHeaders) {
    cells[rh.id] = {};
    const rowSubset = rows.filter((r) => matchesBucketedKey(r, rh.key));
    rowTotals[rh.id] = sumPreAggregated(rowSubset, columns);
    for (const ch of colHeaders) {
      const cellSubset = rowSubset.filter((r) => matchesBucketedKey(r, ch.key));
      if (cellSubset.length === 0) continue;
      // For pivot we expect at most one bucketed row per (down × across).
      const values: Record<string, unknown> = {};
      for (const col of columns) {
        if (!col.aggregate) continue;
        const key = columnKey(col);
        values[key] = cellSubset[0][key];
      }
      cells[rh.id][ch.id] = values;
    }
  }
  for (const ch of colHeaders) {
    const colSubset = rows.filter((r) => matchesBucketedKey(r, ch.key));
    colTotals[ch.id] = sumPreAggregated(colSubset, columns);
  }
  return {
    rowHeaders,
    colHeaders,
    cells,
    rowTotals,
    colTotals,
    grandTotal: sumPreAggregated(rows, columns),
    columns,
    downGroupings,
    acrossGroupings,
  };
}

function collectHeadersFromBucketed(
  rows: Record<string, unknown>[],
  groupings: readonly SpecReportGrouping[],
): PivotHeader[] {
  if (groupings.length === 0) return [{ key: {}, path: [], id: '' }];
  const seen = new Map<string, PivotHeader>();
  for (const row of rows) {
    const path: string[] = [];
    const key: Record<string, unknown> = {};
    for (const g of groupings) {
      const v = row[g.field];
      const s = v == null ? '(null)' : String(v);
      path.push(s);
      key[g.field] = s;
    }
    const id = path.join('\u0001');
    if (!seen.has(id)) seen.set(id, { key, path, id });
  }
  const headers = Array.from(seen.values());
  headers.sort((a, b) => {
    for (let i = 0; i < groupings.length; i++) {
      const dir = groupings[i].sort === 'desc' ? -1 : 1;
      const cmp = a.path[i].localeCompare(b.path[i]) * dir;
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
  return headers;
}

function matchesBucketedKey(
  row: Record<string, unknown>,
  key: Record<string, unknown>,
): boolean {
  for (const [field, expected] of Object.entries(key)) {
    const actual = row[field] == null ? '(null)' : String(row[field]);
    if (actual !== String(expected)) return false;
  }
  return true;
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

/**
 * Build a `QueryAST`-style payload for `dataSource.aggregate()`. Groupings
 * with `dateGranularity` are emitted as structured objects so spec-aware
 * backends can do server-side DATE_TRUNC; backends that don't recognise the
 * field gracefully treat them as the bare field name (the engine's
 * in-memory fallback handles the rest).
 *
 * Returns `null` when the report has no groupings *and* no aggregating
 * columns — in that case there's no work for `aggregate()` to do and the
 * hook should stick with `find()`.
 */
export function buildAggregateQuery(
  report: SpecReport,
  runtimeFilter: Record<string, unknown> | undefined,
  maxRows: number,
): Record<string, unknown> | null {
  const groupings = [...(report.groupingsDown ?? []), ...(report.groupingsAcross ?? [])];
  const aggregatingCols = (report.columns ?? []).filter((c) => !!c.aggregate);
  if (groupings.length === 0 && aggregatingCols.length === 0) return null;

  const groupBy = groupings.map((g) =>
    g.dateGranularity ? { field: g.field, dateGranularity: g.dateGranularity } : g.field,
  );
  const aggregations = aggregatingCols.map((c) => ({
    function: c.aggregate === 'unique' ? 'count_distinct' : c.aggregate!,
    field: c.field,
    alias: columnKey(c),
  }));
  const where = mergeFilters(
    report.filter as Record<string, unknown> | undefined,
    runtimeFilter,
  );
  const out: Record<string, unknown> = { object: report.objectName, limit: maxRows };
  if (groupBy.length > 0) out.groupBy = groupBy;
  if (aggregations.length > 0) out.aggregations = aggregations;
  if (where) out.where = where;
  return out;
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
  const {
    dataSource,
    runtimeFilter,
    maxRows = 5000,
    enabled = true,
    rows: providedRows,
    preferServerAggregation = true,
  } = options;
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>(providedRows ?? EMPTY_ROWS);
  /**
   * When the server already aggregated, we cache the bucketed rows here and
   * the post-fetch grouping is a no-op (the rows already have one entry per
   * bucket with `${field}__${aggregate}` columns).
   */
  const [serverAggregated, setServerAggregated] = useState(false);
  // Start in loading state when we expect to fetch (have a report + enabled +
  // dataSource and no inline rows). This prevents the report viewer from
  // flashing an empty/"no data" state on slow networks before fetchOnce runs.
  const [loading, setLoading] = useState<boolean>(() => {
    if (providedRows) return false;
    return !!(report && enabled && dataSource);
  });
  const [error, setError] = useState<Error | null>(null);
  const fetchSeq = useRef(0);

  const fetchOnce = useCallback(async (): Promise<void> => {
    if (!report || !enabled) return;
    if (providedRows) {
      setRawRows(providedRows);
      setServerAggregated(false);
      return;
    }
    if (!dataSource) {
      setRawRows(EMPTY_ROWS);
      return;
    }
    const seq = ++fetchSeq.current;
    setLoading(true);
    setError(null);
    try {
      // Prefer server-side aggregation when the adapter supports it AND the
      // report actually needs aggregating. Falls back to find() otherwise.
      const aggregateQuery = preferServerAggregation
        ? buildAggregateQuery(report, runtimeFilter, maxRows)
        : null;
      if (aggregateQuery && typeof dataSource.aggregate === 'function') {
        try {
          const raw = await dataSource.aggregate(report.objectName, aggregateQuery);
          const extracted = extractRecords(raw);
          if (seq !== fetchSeq.current) return;
          setRawRows(extracted);
          setServerAggregated(true);
          return;
        } catch (aggErr) {
          // Adapter may not yet support spec-shape aggregate (e.g. older
          // data-objectstack with single-field signature). Fall through to
          // client-side aggregation via find().
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(
              '[useReportData] dataSource.aggregate() failed, falling back to find():',
              aggErr,
            );
          }
        }
      }

      if (typeof dataSource.find !== 'function') {
        setRawRows(EMPTY_ROWS);
        setServerAggregated(false);
        return;
      }

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
      setServerAggregated(false);
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
      setRawRows(EMPTY_ROWS);
      setServerAggregated(false);
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [report, enabled, providedRows, dataSource, runtimeFilter, maxRows, preferServerAggregation]);

  useEffect(() => {
    void fetchOnce();
  }, [fetchOnce]);

  // Derive grouped + aggregated output.
  const { rows, totals, pivot } = useMemo(() => {
    if (!report) return { rows: [] as ReportRow[], totals: {} as Record<string, unknown>, pivot: null };
    const down = report.groupingsDown ?? [];
    const across = report.groupingsAcross ?? [];
    const cols = report.columns ?? [];
    const hasPivot = across.length > 0;

    if (serverAggregated) {
      // Rows are already bucketed: one input row per group. Synthesize the
      // ReportRow shape without re-aggregating. For pivot reports we reshape
      // the bucketed rows into a matrix in-place.
      const allGroupings = [...down, ...across];
      const synthesised: ReportRow[] = rawRows.map((r) => {
        const groupKey: Record<string, unknown> = {};
        const groupPath: string[] = [];
        for (const g of allGroupings) {
          const v = r[g.field];
          groupKey[g.field] = v;
          groupPath.push(v == null ? '(null)' : String(v));
        }
        const values: Record<string, unknown> = { ...r };
        for (const g of allGroupings) delete values[g.field];
        return { groupKey, groupPath, values, count: 1 };
      });
      const grandTotals = sumPreAggregated(rawRows, cols);
      const pivotMatrix = hasPivot
        ? pivotPreAggregated(rawRows, cols, down, across)
        : null;
      // For pivot, expose the down-only row totals as the flat `rows` view
      // (mirrors the client-side branch's down-only nesting). Without down
      // groupings, fall through to a single grand-total row.
      const flatRows = hasPivot
        ? (pivotMatrix
            ? pivotMatrix.rowHeaders.map((rh) => ({
                groupKey: rh.key,
                groupPath: rh.path,
                values: pivotMatrix.rowTotals[rh.id] ?? {},
                count: 1,
              }))
            : synthesised)
        : synthesised;
      return { rows: flatRows, totals: grandTotals, pivot: pivotMatrix };
    }

    // Client-side aggregation path (raw rows from find()).
    // For pivot reports, `rows` still reflects the nested down-only view so
    // tabular/summary fallback rendering keeps working; the pivot matrix is
    // the canonical shape for matrix renderers.
    const groupings = hasPivot ? down : [...down, ...across];
    const grouped = groupings.length > 0
      ? groupAndAggregate(rawRows, groupings, cols)
      : rawRows.map((r) => ({
          groupKey: {},
          groupPath: [],
          values: cols.length > 0 ? aggregateRows([r], cols) : { ...r },
          count: 1,
        }));
    const grandTotals = aggregateRows(rawRows, cols);
    const pivotMatrix = hasPivot ? pivotRows(rawRows, cols, down, across) : null;
    return { rows: grouped, totals: grandTotals, pivot: pivotMatrix };
  }, [report, rawRows, serverAggregated]);

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

  return { rows, rawRows, totals, pivot, serverAggregated, loading, error, refetch: fetchOnce, drillDown };
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
