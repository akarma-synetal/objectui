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
import type { ActionRunner } from '@object-ui/core';
import type {
  SpecReport,
  SpecReportColumn,
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

function HeaderLabel({ path, fallback }: { path: string[]; fallback: string }) {
  if (path.length === 0) return <>{fallback}</>;
  return <>{path.join(' / ')}</>;
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
        Failed to load matrix: {error.message}
      </div>
    );
  }

  if (!pivot) {
    // Either still loading the first time, or the report has no groupingsAcross.
    return (
      <div className={className} aria-busy={loading || undefined} data-testid="matrix-empty">
        {loading
          ? 'Loading…'
          : 'Matrix report requires at least one `groupingsAcross` field.'}
      </div>
    );
  }

  const cellInteractive = !!onCellClick || !!actionRunner;
  const rowLabel = (report.groupingsDown ?? []).map((g) => g.field).join(' / ') || 'Row';
  const colLabel = (report.groupingsAcross ?? []).map((g) => g.field).join(' / ') || 'Column';

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
                <HeaderLabel path={ch.path} fallback="(All)" />
              </th>
            ))}
            <th scope="col" style={cellStyle({ header: true, total: true })}>
              Row Total
            </th>
          </tr>
        </thead>
        <tbody>
          {pivot.rowHeaders.map((rh) => (
            <tr key={`row-${rh.id}`}>
              <th scope="row" style={cellStyle({ header: true })}>
                <HeaderLabel path={rh.path} fallback="(All)" />
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
                      : renderCellValues(columns, cellValues!, showMultipleValuesPerCell)}
                  </td>
                );
              })}
              <td style={cellStyle({ total: true })}>
                {renderCellValues(columns, pivot.rowTotals[rh.id] ?? {}, showMultipleValuesPerCell)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" style={cellStyle({ header: true, total: true })}>
              Column Total
            </th>
            {pivot.colHeaders.map((ch) => (
              <td key={`coltotal-${ch.id}`} style={cellStyle({ total: true })}>
                {renderCellValues(columns, pivot.colTotals[ch.id] ?? {}, showMultipleValuesPerCell)}
              </td>
            ))}
            <td style={cellStyle({ total: true, grand: true })}>
              {renderCellValues(columns, pivot.grandTotal, showMultipleValuesPerCell)}
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
): React.ReactNode {
  if (!columns.length) return FALLBACK_LABEL;
  if (!multi) {
    return formatCellValue(values[columnKey(columns[0])]);
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {columns.map((col) => {
        const key = columnKey(col);
        const label = col.label ?? key;
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
