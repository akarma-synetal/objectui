/**
 * buildChartData — adapter that turns aggregated `useReportData()` rows
 * into the `{ data, xAxisKey, series }` shape expected by `@object-ui/plugin-charts`.
 *
 * Pipeline:
 *   1. Decide which grouping field drives the x axis (default: chart.xAxis,
 *      else first `groupingsDown`).
 *   2. Decide the measure:
 *      - If `chart.yAxis` matches an aggregating column, use `${field}__${agg}`.
 *      - Else fall back to row `count` (implicit `count(*)`).
 *   3. Walk the (possibly nested) `ReportRow[]` tree, collecting every leaf
 *      whose `groupKey` exposes the xAxis field. Same xAxis value across
 *      different branches is summed.
 *   4. Optional: sort buckets descending by measure for `pie` / `funnel`.
 *
 * This module is pure (no React) so it is fully covered by unit tests.
 */

import type { ReportRow } from './hooks/useReportData';
import type { SpecReport, SpecReportColumn } from '@object-ui/types';

export interface ChartAdapterLabelResolvers {
  /** Resolve a friendly label for a measure column. Used for the chart's y-axis legend. */
  resolveColumnLabel?: (col: SpecReportColumn) => string | undefined;
  /** Resolve a friendly label for an implicit `count` measure given the yAxis field. */
  resolveCountLabel?: (yField: string) => string | undefined;
  /** Resolve a friendly display label for an x-axis bucket value (e.g. translate picklist values). */
  resolveAxisValue?: (field: string, rawValue: unknown) => string | undefined;
}

export interface ChartAdapterInput {
  report: SpecReport;
  rows: ReportRow[];
  labels?: ChartAdapterLabelResolvers;
}

export interface ChartAdapterOutput {
  /** `{ data, xAxisKey, series, chartType }` ready for `<SchemaRenderer type="chart">`. */
  schema: ChartSchema | null;
  /** Human-readable diagnostic when we can't build a chart (missing xAxis, etc.). */
  diagnostic?: string;
}

type ChartType = 'bar' | 'column' | 'horizontal-bar' | 'line' | 'area' | 'pie' | 'donut' | 'funnel' | 'radar' | 'scatter';

export interface ChartSchema {
  type: 'chart';
  chartType: ChartType;
  data: Array<Record<string, unknown>>;
  xAxisKey: string;
  series: Array<{ dataKey: string; label?: string }>;
  title?: string;
  showLegend?: boolean;
  showDataLabels?: boolean;
  className?: string;
}

/** Stable key for a column's aggregated output: `field__aggregate` (or just `field`). */
function columnKey(col: SpecReportColumn): string {
  return col.aggregate ? `${col.field}__${col.aggregate}` : col.field;
}

/** Walk the (possibly nested) row tree and yield every leaf row. */
function flattenLeaves(rows: ReportRow[]): ReportRow[] {
  const out: ReportRow[] = [];
  const walk = (r: ReportRow) => {
    if (r.children && r.children.length > 0) r.children.forEach(walk);
    else out.push(r);
  };
  rows.forEach(walk);
  return out;
}

export function buildChartData({ report, rows, labels }: ChartAdapterInput): ChartAdapterOutput {
  const chart = report.chart;
  if (!chart || !chart.type) return { schema: null };

  const groupings = report.groupingsDown ?? [];
  const xField =
    chart.xAxis ||
    (groupings.length > 0 ? groupings[0]?.field : undefined);

  if (!xField) {
    return { schema: null, diagnostic: 'chart.xAxis missing and no groupingsDown[0] to default to.' };
  }

  // Resolve measure (yAxis).
  const cols = report.columns ?? [];
  const yField = chart.yAxis;
  let measureKey = 'count';
  let measureLabel = 'Count';
  let useCountFallback = true;

  if (yField) {
    const matchingAggCol = cols.find((c) => c.field === yField && c.aggregate);
    if (matchingAggCol) {
      measureKey = columnKey(matchingAggCol);
      measureLabel =
        labels?.resolveColumnLabel?.(matchingAggCol) ??
        (typeof matchingAggCol.label === 'string'
          ? matchingAggCol.label
          : `${matchingAggCol.aggregate}(${matchingAggCol.field})`);
      useCountFallback = false;
    } else {
      // yAxis points to a non-aggregating column (or doesn't exist at all):
      // treat as implicit count(*). The label uses the yAxis field name
      // so users still get a recognisable axis title.
      measureKey = 'count';
      measureLabel = labels?.resolveCountLabel?.(yField) ?? `Count of ${yField}`;
    }
  }

  // Collect leaves, then bucket by xField. Same xValue across branches sums.
  const leaves = flattenLeaves(rows);
  const buckets = new Map<string, { x: unknown; measure: number }>();
  for (const leaf of leaves) {
    const xVal = leaf.groupKey[xField];
    if (xVal === undefined) continue; // grouping doesn't expose xField — skip
    const bucketKey = String(xVal ?? '');
    const v = useCountFallback
      ? leaf.count
      : Number(leaf.values[measureKey] ?? 0);
    const cur = buckets.get(bucketKey);
    if (cur) cur.measure += Number.isFinite(v) ? v : 0;
    else buckets.set(bucketKey, { x: xVal, measure: Number.isFinite(v) ? v : 0 });
  }

  let data = Array.from(buckets.values()).map((b) => {
    const translatedX = labels?.resolveAxisValue?.(xField, b.x);
    const displayX = translatedX ?? (b.x ?? '(null)');
    return {
      [xField]: displayX,
      [measureKey]: b.measure,
    };
  });

  // Pie / funnel auto-sort desc by measure (descending makes the funnel a
  // funnel and the pie's largest slice render first).
  if (chart.type === 'pie' || chart.type === 'donut' || chart.type === 'funnel') {
    data = [...data].sort(
      (a, b) => Number(b[measureKey] ?? 0) - Number(a[measureKey] ?? 0),
    );
  }

  return {
    schema: {
      type: 'chart',
      chartType: chart.type as ChartType,
      data,
      xAxisKey: xField,
      series: [{ dataKey: measureKey, label: measureLabel }],
      title: chart.title,
      showLegend: chart.showLegend ?? true,
      showDataLabels: chart.showDataLabels ?? false,
      className: 'w-full h-[320px]',
    },
  };
}
