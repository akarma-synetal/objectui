// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ReportPreview — runs the live Report draft through the dataset query path
 * (ADR-0021 single-form).
 *
 * A 9.0 report binds a semantic-layer `dataset` and selects its measures
 * (`values`) grouped by dimensions (`rows`); the preview executes that
 * selection through `adapter.queryDataset`, so the numbers match every other
 * surface on the same dataset. A draft without a dataset binding (e.g. stored
 * pre-9.0 query-form JSON) gets an actionable empty state pointing at the
 * inspector's Dataset control instead of the retired legacy renderer.
 *
 * Uses the app-shell AdapterProvider's data source so previews see actual
 * rows.
 */

import * as React from 'react';
import { Database, Loader2, Table2, AlertTriangle } from 'lucide-react';
import { useAdapter } from '../../../providers/AdapterProvider';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewEmptyState } from './PreviewShell';

/**
 * DatasetBoundReport — renders a report that binds to a semantic-layer
 * `dataset` (ADR-0021 single-form). The report
 * picks dimensions (`rows`) and measures (`values`) by NAME from the dataset;
 * we run them through the same `adapter.queryDataset` path the dataset preview
 * uses, so the numbers match every other surface on that dataset.
 */
function DatasetBoundReport({ draft }: { draft: Record<string, unknown> }) {
  const adapter = useAdapter();
  const datasetName = String((draft as any).dataset);
  const rows = React.useMemo(
    () => (Array.isArray((draft as any).rows) ? ((draft as any).rows as string[]).filter(Boolean) : []),
    [draft],
  );
  const values = React.useMemo(
    () => (Array.isArray((draft as any).values) ? ((draft as any).values as string[]).filter(Boolean) : []),
    [draft],
  );
  const runtimeFilter = (draft as any).runtimeFilter;

  const [state, setState] = React.useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; rows: Array<Record<string, unknown>>; error?: string }>({ status: 'idle', rows: [] });

  const signature = `${datasetName}|${rows.join(',')}|${values.join(',')}`;
  React.useEffect(() => {
    if (values.length === 0) { setState({ status: 'idle', rows: [] }); return; }
    let cancelled = false;
    setState({ status: 'loading', rows: [] });
    (adapter as unknown as { queryDataset: (d: string, s: unknown) => Promise<{ rows: Array<Record<string, unknown>> }> })
      .queryDataset(datasetName, { dimensions: rows, measures: values, runtimeFilter })
      .then((res) => { if (!cancelled) setState({ status: 'ok', rows: Array.isArray(res?.rows) ? res.rows : [] }); })
      .catch((e) => { if (!cancelled) setState({ status: 'error', rows: [], error: String((e as Error)?.message ?? e) }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (values.length === 0) {
    return (
      <PreviewShell>
        <PreviewEmptyState
          icon={<Table2 className="h-8 w-8" />}
          title="Pick measures to show"
          description={`This report binds the "${datasetName}" dataset — choose at least one measure (values) to render.`}
        />
      </PreviewShell>
    );
  }

  const columns = [...rows, ...values];
  return (
    <PreviewShell hint={`report · dataset "${datasetName}"${rows.length ? ' · by ' + rows.join(', ') : ''}`}>
      <div className="p-3">
        {state.status === 'loading' && (
          <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Running report…</div>
        )}
        {state.status === 'error' && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span className="break-words">{state.error}</span>
          </div>
        )}
        {state.status === 'ok' && state.rows.length === 0 && (
          <PreviewEmptyState icon={<Table2 className="h-8 w-8" />} title="No rows" description="The dataset returned no rows for this report's scope." />
        )}
        {state.rows.length > 0 && (
          <div className="overflow-auto max-h-[70vh] rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>{columns.map((c) => <th key={c} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{c}</th>)}</tr>
              </thead>
              <tbody>
                {state.rows.map((row, i) => (
                  <tr key={i} className="border-t">
                    {columns.map((c) => {
                      const v = row[c];
                      const text = v == null ? '—' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toLocaleString(undefined, { maximumFractionDigits: 2 })) : String(v);
                      return <td key={c} className="px-2 py-1 tabular-nums whitespace-nowrap">{text}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PreviewShell>
  );
}

export function ReportPreview({ draft }: MetadataPreviewProps) {
  // ADR-0021 single-form: a report binds a semantic-layer dataset.
  if (typeof (draft as any).dataset === 'string' && (draft as any).dataset) {
    return <DatasetBoundReport draft={draft as Record<string, unknown>} />;
  }

  // No dataset bound — either a fresh draft or stored pre-9.0 query-form
  // JSON (objectName/columns), whose inline-query renderer was retired with
  // the 9.0 cutover. Point the author at the dataset binding.
  return (
    <PreviewShell>
      <PreviewEmptyState
        icon={<Database className="h-8 w-8" />}
        title="Bind a dataset to preview this report"
        description="Since the 9.0 single-form cutover a report renders its dataset's measures (values) grouped by dimensions (rows). Choose a Dataset in the right panel to start designing."
      />
    </PreviewShell>
  );
}
