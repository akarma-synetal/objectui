// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ReportPreview — runs the live Report draft through the same
 * ReportRenderer the runtime ReportView uses.
 *
 * Uses the app-shell AdapterProvider's data source so previews see
 * actual rows. Lazy-loaded to keep the metadata-admin bundle small.
 */

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { useAdapter } from '../../../providers/AdapterProvider';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewErrorBoundary, PreviewMessage } from './PreviewShell';
import { OutlineStrip } from './OutlineStrip';
import { t as tr } from '../i18n';

const ReportRenderer = React.lazy(() =>
  import('@object-ui/plugin-report').then((m) => ({ default: m.ReportRenderer })),
);

export function ReportPreview({ draft, editing, selection, onSelectionChange, onPatch, locale }: MetadataPreviewProps) {
  const adapter = useAdapter();
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
      <PreviewShell hint="report">
        <PreviewMessage tone="warn">
          Pick an Object in the Form tab — Reports need a source object before they can render.
        </PreviewMessage>
      </PreviewShell>
    );
  }

  // Without columns, the spec renderer has nothing to draw — show an
  // actionable empty state instead of an empty card.
  const hasColumns = Array.isArray((draft as any).columns) && (draft as any).columns.length > 0;
  if (!hasColumns) {
    return (
      <PreviewShell hint={`report · ${visualization ?? 'table'}${designMode ? ' · design' : ''}`}>
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
        <PreviewMessage tone="info">
          {canEdit
            ? 'Add at least one column to preview the report. Use “Add column” above, or fill the Columns field in the Properties tab.'
            : 'This report has no columns yet — define some in the Properties tab to see a preview.'}
        </PreviewMessage>
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
