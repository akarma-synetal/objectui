// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ReportPreview — runs the live Report draft through the same
 * ReportRenderer the runtime ReportView uses.
 *
 * Uses the app-shell AdapterProvider's data source so previews see
 * actual rows. Lazy-loaded to keep the metadata-admin bundle small.
 */

import * as React from 'react';
import { Loader2, Database, Columns3, Plus, Table2, AlertTriangle } from 'lucide-react';
import { useAdapter } from '../../../providers/AdapterProvider';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewErrorBoundary, PreviewEmptyState } from './PreviewShell';
import { OutlineStrip } from './OutlineStrip';
import { t as tr } from '../i18n';

const ReportRenderer = React.lazy(() =>
  import('@object-ui/plugin-report').then((m) => ({ default: m.ReportRenderer })),
);

/**
 * DatasetBoundReport — renders a report that binds to a semantic-layer
 * `dataset` (ADR-0021 dual-form) instead of an inline object query. The report
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

export function ReportPreview({ draft, editing, selection, onSelectionChange, onPatch, locale }: MetadataPreviewProps) {
  const adapter = useAdapter();
  // ADR-0021 dual-form: a report bound to a semantic-layer dataset renders
  // through the dataset query path rather than the inline-object ReportRenderer.
  if (typeof (draft as any).dataset === 'string' && (draft as any).dataset) {
    return <DatasetBoundReport draft={draft as Record<string, unknown>} />;
  }
  // Different fixture sets use different keys for the source object:
  //   • new schema: `object`
  //   • legacy: `objectName`
  //   • some reports embed it under `data.object`
  const objectName =
    (draft as any).object ?? (draft as any).objectName ?? (draft as any).data?.object;
  const visualization = (draft as any).visualization?.type ?? (draft as any).type;

  const designMode = !!(editing && onSelectionChange);
  const canEdit = designMode && !!onPatch;
  const selectedId = selection && selection.kind === 'column' ? selection.id : null;
  const columnEntries = React.useMemo(() => {
    const cols = Array.isArray((draft as any).columns) ? (draft as any).columns as Array<Record<string, unknown>> : [];
    return cols.map((c, i) => ({ id: `columns[${i}]`, label: String(c.label ?? c.field ?? `col ${i + 1}`) }));
  }, [draft]);

  const handleAdd = React.useCallback(() => {
    if (!canEdit) return;
    const cols = Array.isArray((draft as any).columns) ? (draft as any).columns as Array<Record<string, unknown>> : [];
    const newCol = { field: '', label: 'New column' };
    const next = [...cols, newCol];
    onPatch!({ columns: next });
    onSelectionChange?.({ kind: 'column', id: `columns[${next.length - 1}]`, label: newCol.label });
  }, [canEdit, draft, onPatch, onSelectionChange]);

  // ReportRenderer routes through `isSpecReport`, which requires `columns`
  // to be an array. Ensure that shape unconditionally so an empty draft
  // doesn't silently fall through to the legacy empty-Card path.
  const normalizedDraft = React.useMemo(
    () => ({ columns: [], ...(draft as Record<string, unknown>) }),
    [draft],
  );

  if (!objectName) {
    return (
      <PreviewShell>
        <PreviewEmptyState
          icon={<Database className="h-8 w-8" />}
          title="Pick a source object to preview the report"
          description="Reports need a source object — choose one in the Object Name field on the right panel to start designing."
        />
      </PreviewShell>
    );
  }

  // Without columns, the spec renderer has nothing to draw — show an
  // actionable empty state instead of an empty card.
  const hasColumns = Array.isArray((draft as any).columns) && (draft as any).columns.length > 0;
  if (!hasColumns) {
    return (
      <PreviewShell>
        {designMode && (
          <OutlineStrip
            title={tr('engine.inspector.reportColumn.outlineLabel', locale)}
            entries={columnEntries}
            selectedId={selectedId}
            onSelect={(e) => onSelectionChange?.({ kind: 'column', id: e.id, label: e.label })}
            onAdd={canEdit ? handleAdd : undefined}
            addLabel={tr('engine.inspector.add.column', locale)}
          />
        )}
        <PreviewEmptyState
          icon={<Columns3 className="h-8 w-8" />}
          title="No columns yet"
          description={
            canEdit
              ? 'Add at least one column to preview the report against live data.'
              : 'Define columns in the Properties tab to see a preview.'
          }
          action={
            canEdit ? (
              <button
                type="button"
                onClick={handleAdd}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add first column
              </button>
            ) : undefined
          }
        />
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint={`report · ${visualization ?? 'table'}${designMode ? ' · design' : ''}`}>
      <PreviewErrorBoundary fallbackHint="The Report references an object/field that doesn't resolve, or its visualization config is incomplete.">
        {designMode && (
          <OutlineStrip
            title={tr('engine.inspector.reportColumn.outlineLabel', locale)}
            entries={columnEntries}
            selectedId={selectedId}
            onSelect={(e) => onSelectionChange?.({ kind: 'column', id: e.id, label: e.label })}
            onAdd={canEdit ? handleAdd : undefined}
            addLabel={tr('engine.inspector.add.column', locale)}
          />
        )}
        <React.Suspense
          fallback={
            <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading report renderer…
            </div>
          }
        >
          <div className="p-3 min-h-[300px] max-h-[70vh] overflow-auto">
            <ReportRenderer schema={normalizedDraft as any} dataSource={adapter as any} />
          </div>
        </React.Suspense>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}
