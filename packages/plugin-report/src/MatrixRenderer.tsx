/**
 * MatrixRenderer
 *
 * Renders a spec `Report` of type `'matrix'` as a 2D pivot table.
 *
 * - Drives data via {@link useReportData}, which returns a {@link PivotMatrix}
 *   when `report.groupingsAcross` is non-empty.
 * - Headers: row headers down the left, column headers across the top.
 *   Multi-level groupings are shown as concatenated path segments.
 * - Body cells display one row per column-definition (e.g. `amount sum`).
 *   When `report.columns` has more than one entry, each cell shows the
 *   values stacked vertically with their labels.
 * - Totals: row total column on the right, column total row at the bottom,
 *   and grand-total in the bottom-right corner.
 * - Drill-down: clicking a body cell fires `onCellClick` with both the row
 *   key and column key; if an `actionRunner` is supplied, it also dispatches
 *   a {@link buildDrillAction} carrying both keys merged.
 *
 * We intentionally don't use ObjectGrid here — its tree model is single-axis
 * and bolting a 2D matrix onto AG-Grid header groups would be heavier than a
 * direct table. The pivot dataset is already small (rows × cols are
 * dimensions, not raw records).
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionRunner } from '@object-ui/core';
import { useSafeFieldLabel } from '@object-ui/i18n';
import type {
  SpecReport,
  SpecReportColumn,
  SpecReportGrouping,
  DataSource,
} from '@object-ui/types';
import { useReportData, columnKey, type PivotHeader } from './hooks/useReportData';
import { buildDrillAction, type DrillOpenIn, type DrillView } from './drill';

export interface MatrixCellClickArgs {
  rowKey: Record<string, unknown>;
  colKey: Record<string, unknown>;
  /** Pre-merged key combining row + col — convenient for drill construction. */
  combinedKey: Record<string, unknown>;
  /** Pre-aggregated values for the clicked cell (may be undefined for empty cells). */
  values?: Record<string, unknown>;
}

export interface MatrixRendererProps {
  report: SpecReport;
  dataSource?: DataSource;
  rows?: Array<Record<string, unknown>>;
  runtimeFilter?: Record<string, unknown>;
  /** Imperative drill callback. */
  onCellClick?: (args: MatrixCellClickArgs) => void;
  /** Declarative drill: dispatch a `type: 'drill'` action when a cell is clicked. */
  actionRunner?: ActionRunner;
  drillView?: DrillView;
  drillOpenIn?: DrillOpenIn;
  className?: string;
  /** Render text for an empty cell. Defaults to "—". */
  emptyCellText?: string;
}

const FALLBACK_LABEL = '\u2014'; // em-dash

function formatCellValue(v: unknown): string {
  if (v == null) return FALLBACK_LABEL;
  if (typeof v === 'number') return v.toLocaleString();
  return String(v);
}

/**
 * Per-grouping-field metadata used to translate raw values (e.g. `'best_case'`)
 * to display labels (e.g. `'Best Case'`) — i18n-aware.
 */
interface GroupingMeta {
  /** Translated field label (used in the matrix corner cell). */
  fieldLabel: string;
  /** value → translated label map; only present for `select` / `status` fields. */
  options?: Map<string, string>;
}

function formatPathSegment(rawValue: string | undefined, meta: GroupingMeta | undefined, emptyLabel: string): string {
  if (rawValue === undefined || rawValue === null || rawValue === '' || rawValue === '(null)') {
    return emptyLabel;
  }
  const options = meta?.options;
  if (options) {
    const label = options.get(rawValue);
    if (label !== undefined && label !== '') return label;
  }
  return rawValue;
}

function HeaderLabel({
  header,
  groupings,
  metaByField,
  fallback,
  emptyLabel,
}: {
  header: PivotHeader;
  groupings: readonly SpecReportGrouping[];
  metaByField: Map<string, GroupingMeta>;
  fallback: string;
  emptyLabel: string;
}) {
  if (header.path.length === 0) return <>{fallback}</>;
  const segments = header.path.map((seg, i) => {
    const field = groupings[i]?.field;
    return formatPathSegment(seg, field ? metaByField.get(field) : undefined, emptyLabel);
  });
  return <>{segments.join(' / ')}</>;
}

export const MatrixRenderer: React.FC<MatrixRendererProps> = ({
  report,
  dataSource,
  rows: providedRows,
  runtimeFilter,
  onCellClick,
  actionRunner,
  drillView,
  drillOpenIn,
  className,
  emptyCellText = FALLBACK_LABEL,
}) => {
  const { pivot, loading, error } = useReportData(report, {
    dataSource: dataSource as { find?: (r: string, p?: Record<string, unknown>) => Promise<unknown> } | undefined,
    rows: providedRows,
    runtimeFilter,
  });

  const columns = report.columns ?? [];
  const showMultipleValuesPerCell = columns.length > 1;

  // ---- I18n-aware label resolution ---------------------------------------
  // Matrix headers and row/column segments must show *labels* (e.g. "Best Case"),
  // not raw select values (e.g. "best_case"). We fetch the object schema once,
  // then build a per-grouping-field translation table using the same `useObjectLabel`
  // wiring the rest of the framework uses.
  const { fieldLabel, translateOptions } = useSafeFieldLabel();
  const { t } = useTranslation();
  const emptyLabel = t('report.emptyLabel', '(Empty)');
  const allFallback = t('report.allLabel', '(All)');
  const [objectSchema, setObjectSchema] = React.useState<{ fields?: Record<string, any> } | null>(null);

  React.useEffect(() => {
    const ds = dataSource as any;
    if (!ds || typeof ds.getObjectSchema !== 'function' || !report.objectName) return;
    let cancelled = false;
    ds.getObjectSchema(report.objectName)
      .then((schema: any) => {
        if (!cancelled) setObjectSchema(schema ?? null);
      })
      .catch(() => {
        // Schema is best-effort — without it we fall back to raw values.
      });
    return () => {
      cancelled = true;
    };
  }, [dataSource, report.objectName]);

  const downGroupings = report.groupingsDown ?? [];
  const acrossGroupings = report.groupingsAcross ?? [];

  const metaByField = React.useMemo(() => {
    const map = new Map<string, GroupingMeta>();
    const fields = objectSchema?.fields ?? {};
    const all = [...downGroupings, ...acrossGroupings];
    for (const g of all) {
      const def = fields[g.field];
      const baseLabel = def?.label ?? g.field;
      const translatedLabel = fieldLabel(report.objectName, g.field, baseLabel);

      // Only translate values when the underlying field is a discrete picklist.
      // Date-granularity buckets ("2026-Q1"), numbers, ids, etc. should pass
      // through untouched.
      const isPicklist = def?.type === 'select' || def?.type === 'status';
      let options: Map<string, string> | undefined;
      if (isPicklist && Array.isArray(def?.options) && def.options.length > 0) {
        const translated = translateOptions(report.objectName, g.field, def.options);
        options = new Map();
        for (const opt of translated) {
          if (opt && opt.value !== undefined && opt.value !== null) {
            options.set(String(opt.value), opt.label != null ? String(opt.label) : String(opt.value));
          }
        }
      }
      map.set(g.field, { fieldLabel: translatedLabel, options });
    }
    return map;
  }, [objectSchema, downGroupings, acrossGroupings, report.objectName, fieldLabel, translateOptions]);

  // Resolve a human-friendly label for each measure column. Falls back to:
  //   1. col.label (explicitly set by the report author)
  //   2. <translated field label> + ' · ' + <translated aggregate verb>  (e.g. "Annual Revenue · Sum")
  //   3. <translated field label>  (when no aggregate is set)
  //   4. the raw columnKey  (e.g. "annual_revenue__sum") as last-resort
  const columnLabels = React.useMemo(() => {
    const map = new Map<string, string>();
    const fields = objectSchema?.fields ?? {};
    for (const col of columns) {
      const key = columnKey(col);
      if (col.label) {
        map.set(key, String(col.label));
        continue;
      }
      const def = fields[col.field];
      const baseLabel = def?.label ?? col.field;
      const translatedField = fieldLabel(report.objectName, col.field, baseLabel);
      if (col.aggregate) {
        const aggLabel = t(`report.aggregate.${col.aggregate}`, col.aggregate);
        map.set(key, `${translatedField} · ${aggLabel}`);
      } else {
        map.set(key, translatedField);
      }
    }
    return map;
  }, [columns, objectSchema, report.objectName, fieldLabel, t]);

  const handleCellClick = React.useCallback(
    (rowHeader: PivotHeader, colHeader: PivotHeader, values?: Record<string, unknown>) => {
      const combinedKey = { ...rowHeader.key, ...colHeader.key };
      if (actionRunner) {
        const action = buildDrillAction(report, combinedKey, {
          runtimeFilter,
          view: drillView,
          openIn: drillOpenIn,
        });
        void actionRunner.execute(action);
      }
      if (onCellClick) {
        onCellClick({ rowKey: rowHeader.key, colKey: colHeader.key, combinedKey, values });
      }
    },
    [actionRunner, drillOpenIn, drillView, onCellClick, report, runtimeFilter],
  );

  if (error) {
    return (
      <div className={className} role="alert" data-testid="matrix-error">
        {t('report.failedToLoad', 'Failed to load matrix: {{message}}', { message: error.message })}
      </div>
    );
  }

  if (!pivot) {
    return (
      <div className={className} aria-busy={loading || undefined} data-testid="matrix-empty">
        {loading
          ? t('report.loading', 'Loading…')
          : t('report.needsAcross', 'Matrix report requires at least one `groupingsAcross` field.')}
      </div>
    );
  }

  const cellInteractive = !!onCellClick || !!actionRunner;
  const rowLabel =
    downGroupings.map((g) => metaByField.get(g.field)?.fieldLabel ?? g.field).join(' / ') ||
    t('report.rowsLabel', 'Row');
  const colLabel =
    acrossGroupings.map((g) => metaByField.get(g.field)?.fieldLabel ?? g.field).join(' / ') ||
    t('report.columnsLabel', 'Column');

  return (
    <div
      className={className}
      data-testid="matrix-renderer"
      aria-busy={loading || undefined}
      style={{ overflow: 'auto' }}
    >
      <table
        role="table"
        style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 13 }}
      >
        <thead>
          <tr>
            <th
              scope="col"
              style={cellStyle({ header: true, bold: true })}
              aria-label={`${rowLabel} \u2192 ${colLabel}`}
            >
              {rowLabel} \ {colLabel}
            </th>
            {pivot.colHeaders.map((ch) => (
              <th key={`col-${ch.id}`} scope="col" style={cellStyle({ header: true })}>
                <HeaderLabel
                  header={ch}
                  groupings={acrossGroupings}
                  metaByField={metaByField}
                  fallback={allFallback}
                  emptyLabel={emptyLabel}
                />
              </th>
            ))}
            <th scope="col" style={cellStyle({ header: true, total: true })}>
              {t('report.rowTotal', 'Row Total')}
            </th>
          </tr>
        </thead>
        <tbody>
          {pivot.rowHeaders.map((rh) => (
            <tr key={`row-${rh.id}`}>
              <th scope="row" style={cellStyle({ header: true })}>
                <HeaderLabel
                  header={rh}
                  groupings={downGroupings}
                  metaByField={metaByField}
                  fallback={allFallback}
                  emptyLabel={emptyLabel}
                />
              </th>
              {pivot.colHeaders.map((ch) => {
                const cellValues = pivot.cells[rh.id]?.[ch.id];
                const isEmpty = !cellValues;
                return (
                  <td
                    key={`cell-${rh.id}-${ch.id}`}
                    style={cellStyle({
                      interactive: cellInteractive && !isEmpty,
                      empty: isEmpty,
                    })}
                    onClick={
                      cellInteractive && !isEmpty
                        ? () => handleCellClick(rh, ch, cellValues)
                        : undefined
                    }
                    data-row={rh.id}
                    data-col={ch.id}
                  >
                    {isEmpty
                      ? emptyCellText
                      : renderCellValues(columns, cellValues!, showMultipleValuesPerCell, columnLabels)}
                  </td>
                );
              })}
              <td style={cellStyle({ total: true })}>
                {renderCellValues(columns, pivot.rowTotals[rh.id] ?? {}, showMultipleValuesPerCell, columnLabels)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" style={cellStyle({ header: true, total: true })}>
              {t('report.columnTotal', 'Column Total')}
            </th>
            {pivot.colHeaders.map((ch) => (
              <td key={`coltotal-${ch.id}`} style={cellStyle({ total: true })}>
                {renderCellValues(columns, pivot.colTotals[ch.id] ?? {}, showMultipleValuesPerCell, columnLabels)}
              </td>
            ))}
            <td style={cellStyle({ total: true, grand: true })}>
              {renderCellValues(columns, pivot.grandTotal, showMultipleValuesPerCell, columnLabels)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

function renderCellValues(
  columns: readonly SpecReportColumn[],
  values: Record<string, unknown>,
  multi: boolean,
  columnLabels?: Map<string, string>,
): React.ReactNode {
  if (!columns.length) return FALLBACK_LABEL;
  if (!multi) {
    return formatCellValue(values[columnKey(columns[0])]);
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {columns.map((col) => {
        const key = columnKey(col);
        const label = columnLabels?.get(key) ?? col.label ?? key;
        return (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ color: 'var(--color-muted-foreground, #71717a)' }}>{label}</span>
            <span>{formatCellValue(values[key])}</span>
          </div>
        );
      })}
    </div>
  );
}

function cellStyle(opts: {
  header?: boolean;
  total?: boolean;
  grand?: boolean;
  bold?: boolean;
  interactive?: boolean;
  empty?: boolean;
}): React.CSSProperties {
  return {
    border: '1px solid var(--color-border, #e4e4e7)',
    padding: '6px 10px',
    textAlign: opts.header ? 'left' : 'right',
    fontWeight: opts.bold || opts.grand ? 700 : opts.header || opts.total ? 600 : 400,
    background: opts.grand
      ? 'var(--color-muted, #f4f4f5)'
      : opts.total
      ? 'var(--color-muted, #fafafa)'
      : opts.header
      ? 'var(--color-muted, #f9fafb)'
      : opts.empty
      ? 'transparent'
      : 'var(--color-background, #ffffff)',
    color: opts.empty ? 'var(--color-muted-foreground, #a1a1aa)' : undefined,
    cursor: opts.interactive ? 'pointer' : undefined,
    whiteSpace: 'nowrap',
  };
}
