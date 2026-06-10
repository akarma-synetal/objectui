// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DatasetReportRenderer
 *
 * Renders a spec `Report` that binds to a semantic-layer `dataset` (ADR-0021
 * single-form) instead of an inline `objectName` + `columns` query. The report
 * selects dimensions (`rows`) and measures (`values`) BY NAME and runs them
 * through `dataSource.queryDataset` — the same governed path dataset-bound
 * dashboard widgets and the dataset preview use, so the numbers (and the
 * server-resolved dimension display labels) match everywhere.
 *
 * - `summary` / `matrix` / `tabular` → one grouped table (`rows` + `values`).
 * - `joined` → a vertical stack of blocks, each its own dataset-bound table,
 *   with the report-level `runtimeFilter` merged into every block.
 *
 * This is the report-side counterpart to plugin-dashboard's `DatasetWidget`;
 * it replaces the legacy `useReportData` (objectName + client aggregation) path
 * for reports authored against a dataset.
 */

import * as React from 'react';
import { Loader2, AlertTriangle, Table2 } from 'lucide-react';
import { mergeFilters } from './hooks/useReportData';

type Row = Record<string, unknown>;

interface DatasetCapableSource {
  queryDataset?: (dataset: string, selection: unknown) => Promise<{ rows: Row[] }>;
}

/** A report (or joined block) bound to a dataset. Field access is permissive — */
/** the bundled spec types lag the runtime schema across the repo boundary.     */
interface DatasetReportLike {
  name?: string;
  type?: string;
  dataset?: string;
  rows?: string[];
  values?: string[];
  runtimeFilter?: Record<string, unknown>;
  filter?: Record<string, unknown>;
  label?: unknown;
  description?: unknown;
  blocks?: DatasetReportLike[];
}

export interface DatasetReportRendererProps {
  report: DatasetReportLike;
  dataSource?: unknown;
  /** Filter merged into the report (and every joined block) as `runtimeFilter`. */
  runtimeFilter?: Record<string, unknown>;
  className?: string;
}

/** `true` when this report should render through the dataset path. */
export function isDatasetReport(value: unknown): value is DatasetReportLike {
  if (!value || typeof value !== 'object') return false;
  const v = value as DatasetReportLike;
  if (typeof v.dataset === 'string' && v.dataset.length > 0) return true;
  // A joined report whose blocks are dataset-bound.
  return v.type === 'joined' && Array.isArray(v.blocks) && v.blocks.some((b) => typeof b?.dataset === 'string');
}

function resolveText(label: unknown, fallback: string): string {
  if (!label) return fallback;
  if (typeof label === 'string') return label;
  if (typeof label === 'object' && typeof (label as { default?: unknown }).default === 'string') {
    return (label as { default: string }).default;
  }
  return fallback;
}

function formatCell(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? String(v) : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(v);
}

/** One dataset-bound table: fetch via `queryDataset`, render `rows` + `values`. */
function DatasetReportTable({
  dataset,
  rows,
  values,
  runtimeFilter,
  dataSource,
}: {
  dataset: string;
  rows: string[];
  values: string[];
  runtimeFilter?: Record<string, unknown>;
  dataSource?: unknown;
}) {
  const [state, setState] = React.useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; rows: Row[]; error?: string }>({
    status: 'idle',
    rows: [],
  });

  const rfKey = JSON.stringify(runtimeFilter ?? null);
  const signature = `${dataset}|${rows.join(',')}|${values.join(',')}|${rfKey}`;
  React.useEffect(() => {
    const src = dataSource as DatasetCapableSource | undefined;
    if (!src || typeof src.queryDataset !== 'function') {
      setState({ status: 'error', rows: [], error: 'This data source does not support dataset queries.' });
      return;
    }
    if (!dataset || values.length === 0) {
      setState({ status: 'idle', rows: [] });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading', rows: [] });
    src
      .queryDataset(dataset, {
        dimensions: rows,
        measures: values,
        ...(runtimeFilter && Object.keys(runtimeFilter).length > 0 ? { runtimeFilter } : {}),
      })
      .then((res) => {
        if (!cancelled) setState({ status: 'ok', rows: Array.isArray(res?.rows) ? res.rows : [] });
      })
      .catch((e) => {
        if (!cancelled) setState({ status: 'error', rows: [], error: String((e as Error)?.message ?? e) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (values.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
        This report binds the “{dataset}” dataset — choose at least one measure (values) to render.
      </div>
    );
  }
  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Running report…
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span className="break-words">{state.error}</span>
      </div>
    );
  }
  if (state.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/20 p-6 text-xs text-muted-foreground">
        <Table2 className="h-6 w-6" /> The dataset returned no rows for this report’s scope.
      </div>
    );
  }

  const columns = [...rows, ...values];
  return (
    <div className="overflow-auto max-h-[70vh] rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/40">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.rows.map((row, i) => (
            <tr key={i} className="border-t">
              {columns.map((c) => (
                <td key={c} className="px-2 py-1 tabular-nums whitespace-nowrap">
                  {formatCell(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const DatasetReportRenderer: React.FC<DatasetReportRendererProps> = ({
  report,
  dataSource,
  runtimeFilter,
  className,
}) => {
  const outerFilter = mergeFilters(
    (report.runtimeFilter ?? report.filter) as Record<string, unknown> | undefined,
    runtimeFilter,
  );

  // Joined → a vertical stack of dataset-bound blocks.
  if (report.type === 'joined' && Array.isArray(report.blocks)) {
    return (
      <div
        className={className}
        data-testid="dataset-joined-report"
        data-report-name={report.name}
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        {report.blocks.map((block, index) => {
          const blockFilter = mergeFilters(outerFilter, (block.runtimeFilter ?? block.filter) as Record<string, unknown> | undefined);
          return (
            <section
              key={block.name ?? `block-${index}`}
              data-testid="dataset-report-block"
              data-block-id={block.name ?? `block-${index}`}
              className="flex flex-col gap-2 rounded-lg border bg-card p-4"
            >
              <header className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold">{resolveText(block.label, block.name ?? `Block ${index + 1}`)}</h3>
                {block.description ? (
                  <p className="text-xs text-muted-foreground">{resolveText(block.description, '')}</p>
                ) : null}
              </header>
              <DatasetReportTable
                dataset={String(block.dataset ?? '')}
                rows={Array.isArray(block.rows) ? block.rows.filter(Boolean) : []}
                values={Array.isArray(block.values) ? block.values.filter(Boolean) : []}
                runtimeFilter={blockFilter}
                dataSource={dataSource}
              />
            </section>
          );
        })}
      </div>
    );
  }

  // summary / matrix / tabular → a single dataset-bound table.
  return (
    <div className={className} data-testid="dataset-report" data-report-name={report.name}>
      <DatasetReportTable
        dataset={String(report.dataset ?? '')}
        rows={Array.isArray(report.rows) ? report.rows.filter(Boolean) : []}
        values={Array.isArray(report.values) ? report.values.filter(Boolean) : []}
        runtimeFilter={outerFilter}
        dataSource={dataSource}
      />
    </div>
  );
};
