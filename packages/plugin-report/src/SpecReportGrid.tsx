/**
 * SpecReportGrid
 *
 * Bridge between the spec `Report` (definition) and `ObjectGrid` (renderer).
 *
 * - Drives data fetch via {@link useReportData}.
 * - For `tabular` reports, renders a flat grid with columns mapped from `report.columns`.
 * - For `summary` reports, applies `report.groupingsDown` as ObjectGrid grouping and
 *   passes per-group aggregations so collapsible group headers show subtotals.
 * - `matrix` reports fall through to a "not supported" notice (handled by M2).
 *
 * The grand total is rendered as a footer-style row above the grid; per-column
 * `summary` on the grid handles classic SQL `GRAND TOTAL` semantics.
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ObjectGrid } from '@object-ui/plugin-grid';
import { useSafeFieldLabel } from '@object-ui/i18n';
import type {
  ObjectGridSchema,
  SpecReport,
  SpecReportColumn,
  SpecReportGrouping,
  DataSource,
} from '@object-ui/types';
import type { ActionRunner } from '@object-ui/core';
import { SchemaRenderer } from '@object-ui/react';
import { useReportData, columnKey } from './hooks/useReportData';
import { buildChartData } from './buildChartData';
import { buildDrillAction, type DrillOpenIn, type DrillView } from './drill';

/** Map a spec aggregate to the ObjectGrid aggregations enum. */
function specAggregateToGrid(
  aggregate: SpecReportColumn['aggregate'],
): 'sum' | 'count' | 'avg' | 'min' | 'max' | 'count_distinct' | null {
  if (!aggregate) return null;
  if (aggregate === 'unique') return 'count_distinct';
  return aggregate;
}

/** Spec → grid grouping config. */
function buildGrouping(groupings: readonly SpecReportGrouping[] | undefined) {
  if (!groupings || groupings.length === 0) return undefined;
  return {
    fields: groupings.map((g) => ({
      field: g.field,
      order: (g.sort ?? 'asc') as 'asc' | 'desc',
      collapsed: false,
    })),
  };
}

/** Spec columns → grid columns (label/format passthrough). */
function buildColumns(report: SpecReport) {
  return (report.columns ?? []).map((col) => {
    const out: Record<string, unknown> = {
      field: col.field,
    };
    if (col.label) out.label = typeof col.label === 'string' ? col.label : String(col.label);
    if (col.format) out.format = col.format;
    if (col.width) out.width = col.width;
    return out;
  });
}

export interface SpecReportGridProps {
  report: SpecReport;
  /** Optional DataSource adapter. When omitted, `rows` must be supplied. */
  dataSource?: DataSource;
  /** Optional pre-fetched rows (skips dataSource.find). */
  rows?: Record<string, unknown>[];
  /** Optional runtime filter merged with report.filter via `$and`. */
  runtimeFilter?: Record<string, unknown>;
  /** Drill-down callback. Receives the group key for the clicked row. */
  onDrillDown?: (groupKey: Record<string, unknown>, rawRows: Record<string, unknown>[]) => void;
  /**
   * Optional `ActionRunner` used to dispatch a `type: 'drill'` action on row
   * click. When set, the grid builds the drill action via {@link buildDrillAction}
   * and runs it through the engine — the host must register a `drill` handler
   * (see {@link registerDrillHandler}) for the navigation to take effect.
   * `onDrillDown` still fires (after dispatch) so consumers can observe.
   */
  actionRunner?: ActionRunner;
  /** Drill view override (default `'list'`). */
  drillView?: DrillView;
  /** Drill open-in override (default `'current'`). */
  drillOpenIn?: DrillOpenIn;
  className?: string;
}

const NOT_SUPPORTED_BANNER: React.CSSProperties = {
  padding: '12px 16px',
  border: '1px dashed rgb(203 213 225)',
  borderRadius: 8,
  color: 'rgb(100 116 139)',
  fontSize: 14,
};

/**
 * Render a spec `Report` as an `ObjectGrid` (Summary/Tabular only).
 *
 * For `matrix`/`joined` types this returns a placeholder; M2/M3 will
 * provide dedicated renderers.
 */
export const SpecReportGrid: React.FC<SpecReportGridProps> = ({
  report,
  dataSource,
  rows: providedRows,
  runtimeFilter,
  onDrillDown,
  actionRunner,
  drillView,
  drillOpenIn,
  className,
}) => {
  const reportType = report.type ?? 'tabular';
  const { t } = useTranslation();
  const { fieldLabel, translateOptions } = useSafeFieldLabel();
  const [objectSchema, setObjectSchema] = React.useState<{ fields?: Record<string, any> } | null>(null);

  React.useEffect(() => {
    const ds = dataSource as any;
    if (!ds || typeof ds.getObjectSchema !== 'function' || !report.objectName) return;
    let cancelled = false;
    ds.getObjectSchema(report.objectName)
      .then((schema: any) => {
        if (!cancelled) setObjectSchema(schema ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dataSource, report.objectName]);

  // Build a friendly label for any column, optionally combined with its aggregate verb.
  const resolveColumnLabel = React.useCallback(
    (col: SpecReportColumn): string => {
      if (col.label) return String(col.label);
      const def = objectSchema?.fields?.[col.field];
      const baseLabel = def?.label ?? col.field;
      const translatedField = fieldLabel(report.objectName, col.field, baseLabel);
      if (col.aggregate) {
        const aggLabel = t(`report.aggregate.${col.aggregate}`, col.aggregate);
        return `${translatedField} · ${aggLabel}`;
      }
      return translatedField;
    },
    [objectSchema, report.objectName, fieldLabel, t],
  );

  // Translate a raw x-axis bucket value when the field is a discrete picklist.
  const resolveAxisValue = React.useCallback(
    (field: string, rawValue: unknown): string | undefined => {
      if (rawValue === undefined || rawValue === null) return undefined;
      const def = objectSchema?.fields?.[field];
      if (!def) return undefined;
      const isPicklist = def.type === 'select' || def.type === 'status';
      if (!isPicklist || !Array.isArray(def.options) || def.options.length === 0) return undefined;
      const translated = translateOptions(report.objectName, field, def.options);
      const raw = String(rawValue);
      for (const opt of translated) {
        if (opt && opt.value !== undefined && opt.value !== null && String(opt.value) === raw) {
          return opt.label != null ? String(opt.label) : raw;
        }
      }
      return undefined;
    },
    [objectSchema, report.objectName, translateOptions],
  );

  const { rawRows, rows: aggregatedRows, totals, serverAggregated, loading, error, drillDown } = useReportData(report, {
    dataSource: dataSource as { find?: (r: string, p?: Record<string, unknown>) => Promise<unknown> } | undefined,
    rows: providedRows,
    runtimeFilter,
  });

  if (reportType === 'matrix' || reportType === 'joined') {
    return (
      <div className={className} style={NOT_SUPPORTED_BANNER}>
        Report type <code>{reportType}</code> is not yet supported by SpecReportGrid.
        It will be rendered by a dedicated component in M2 (matrix) / M3 (joined).
      </div>
    );
  }

  // Build ObjectGrid schema dynamically from the spec.
  //
  // When the data is server-aggregated (rawRows are already buckets, e.g.
  // `{stage, amount__sum, probability__avg}`), the raw-row columns config
  // (name/account/close_date/...) does not match the row shape, so the grid
  // would render empty. Switch to a "bucket grid" schema: groupings + the
  // aliased aggregate columns. This matches what `useReportData` actually
  // emits in server-aggregated mode.
  const gridSchema: ObjectGridSchema = React.useMemo(() => {
    if (serverAggregated) {
      const groupingCols = (report.groupingsDown ?? []).map((g) => ({
        field: g.field,
        label: g.field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      }));
      const measureCols = (report.columns ?? [])
        .filter((c) => c.aggregate)
        .map((c) => {
          const alias = columnKey(c);
          const baseLabel =
            (typeof c.label === 'string' ? c.label : null) ?? c.field;
          return {
            field: alias,
            label: `${baseLabel} (${c.aggregate})`,
            ...(c.format ? { format: c.format } : {}),
          };
        });
      return {
        type: 'object-grid',
        objectName: report.objectName,
        columns: [...groupingCols, ...measureCols] as ObjectGridSchema['columns'],
      };
    }

    const grouping = reportType === 'summary' ? buildGrouping(report.groupingsDown) : undefined;
    const aggregations = (report.columns ?? [])
      .map((col) => {
        const gridType = specAggregateToGrid(col.aggregate);
        return gridType ? { field: col.field, type: gridType } : null;
      })
      .filter((x): x is { field: string; type: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'count_distinct' } => x !== null);

    return {
      type: 'object-grid',
      objectName: report.objectName,
      columns: buildColumns(report) as ObjectGridSchema['columns'],
      grouping,
      aggregations: aggregations.length > 0 ? aggregations : undefined,
    };
  }, [report, reportType, serverAggregated]);

  // Inject pre-fetched rows so ObjectGrid skips its own fetch.
  const gridData = rawRows;

  // Optional drill-down: surface group keys via row click. ObjectGrid doesn't
  // emit a "group header click" today, so the row-click handler matches the
  // grouped row back to its group key by re-reading the grouping field set.
  const handleRowClick = React.useCallback(
    (row: Record<string, unknown>) => {
      const groupings = report.groupingsDown ?? [];
      const groupKey: Record<string, unknown> = {};
      for (const g of groupings) groupKey[g.field] = row[g.field];

      if (actionRunner) {
        const action = buildDrillAction(report, groupKey, {
          runtimeFilter,
          view: drillView,
          openIn: drillOpenIn,
        });
        // Fire and forget — the runner's own error path surfaces failures.
        void actionRunner.execute(action);
      }
      if (onDrillDown) {
        onDrillDown(groupKey, drillDown(groupKey));
      }
    },
    [actionRunner, drillDown, drillOpenIn, drillView, onDrillDown, report, runtimeFilter],
  );

  const wantsRowClick = !!onDrillDown || !!actionRunner;

  // Build a compact "Totals" strip — only when the report actually has
  // aggregated measures. Tabular and summary reports both get a grand total
  // strip when aggregates are configured; this is the report identity (one
  // dataset → its grand total) and is intentionally not styled like a
  // dashboard KPI grid.
  const aggregatingCols = (report.columns ?? []).filter((c) => c.aggregate);
  const hasKpis =
    aggregatingCols.length > 0 && totals && Object.keys(totals).length > 0;

  // Build chart schema from aggregated buckets (only for summary + chart configured).
  const chartSchema = React.useMemo(() => {
    if (reportType !== 'summary') return null;
    if (!report.chart || !report.chart.type) return null;
    return buildChartData({
      report,
      rows: aggregatedRows,
      labels: {
        resolveColumnLabel,
        resolveCountLabel: (yField) => {
          const def = objectSchema?.fields?.[yField];
          const baseLabel = def?.label ?? yField;
          const translatedField = fieldLabel(report.objectName, yField, baseLabel);
          const countLabel = t('report.aggregate.count', 'Count');
          return `${translatedField} · ${countLabel}`;
        },
        resolveAxisValue,
      },
    }).schema;
  }, [report, aggregatedRows, reportType, resolveColumnLabel, resolveAxisValue, objectSchema, fieldLabel, t]);

  return (
    <div className={className} data-testid="spec-report-grid" aria-busy={loading || undefined}>
      {error ? (
        <div role="alert" style={{ ...NOT_SUPPORTED_BANNER, color: 'rgb(190 18 60)' }}>
          {error.message}
        </div>
      ) : null}
      {hasKpis ? (
        // Compact "Totals" strip — visually a single row of "label: value"
        // pairs, NOT a row of dashboard-style KPI cards. The data table below
        // is the protagonist; this strip is the grand total of the dataset.
        <div
          data-testid="spec-report-totals"
          className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-md border bg-muted/40 px-3 py-2 text-sm"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('report.totals', 'Totals')}
          </span>
          {aggregatingCols.map((c) => {
            const key = columnKey(c);
            const value = totals[key];
            const label = resolveColumnLabel(c);
            const display =
              typeof value === 'number'
                ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                : String(value ?? '—');
            return (
              <span
                key={key}
                data-testid={`spec-report-total-${key}`}
                className="inline-flex items-baseline gap-1.5"
              >
                <span className="text-muted-foreground">{label}:</span>
                <span className="font-mono font-medium tabular-nums">{display}</span>
              </span>
            );
          })}
        </div>
      ) : null}
      {chartSchema ? (
        // Chart is optional and visually subordinate to the table. The chart
        // component renders its own title (from report.chart.title), so we
        // don't add a second one here.
        <div className="mb-4" data-testid="spec-report-chart">
          <SchemaRenderer schema={chartSchema as never} />
        </div>
      ) : null}
      <ObjectGrid
        schema={gridSchema}
        data={gridData as never}
        dataSource={dataSource}
        onRowClick={wantsRowClick ? handleRowClick : undefined}
      />
    </div>
  );
};

SpecReportGrid.displayName = 'SpecReportGrid';
