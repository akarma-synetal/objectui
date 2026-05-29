// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DashboardPreview — interactive design surface for a Dashboard
 * metadata draft. Clicking a widget emits a {@link MetadataSelection}
 * so the host swaps the right-side inspector to that widget's form.
 *
 * Uses the same DashboardRenderer the runtime DashboardView uses, with
 * the adapter from app-shell's AdapterProvider so widgets can query
 * live data. `designMode` is ON whenever the host is editing —
 * read-only / view mode falls back to a plain runtime preview so the
 * canvas looks identical to what end users see.
 *
 * The plugin is loaded lazily to avoid pulling its dep graph into
 * every metadata-admin page load.
 */

import * as React from 'react';
import { Loader2, Pencil, X } from 'lucide-react';
import type { DashboardWidgetSchema } from '@object-ui/types';
import { useAdapter } from '../../../providers/AdapterProvider';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewErrorBoundary, PreviewMessage } from './PreviewShell';
import { uniqueId, appendArray } from '../inspectors/_shared';
import { t as tr } from '../i18n';
import { AddWidgetPicker } from './AddWidgetPicker';
import { WIDGET_TYPE_META } from './widget-types';

const DashboardRenderer = React.lazy(() =>
  import('@object-ui/plugin-dashboard').then((m) => ({ default: m.DashboardRenderer })),
);

export function DashboardPreview({
  draft,
  editing,
  onPatch,
  selection,
  onSelectionChange,
  locale,
}: MetadataPreviewProps) {
  const adapter = useAdapter();
  const widgets: DashboardWidgetSchema[] = Array.isArray((draft as any).widgets)
    ? (draft as any).widgets
    : [];

  // Design mode is opt-in: only active while the host edits AND the
  // host supplied a selection channel. In read-only / drawer-preview
  // contexts we render the runtime presentation untouched.
  const designMode = !!(editing && onSelectionChange);
  const canEdit = designMode && !!onPatch;
  const selectedWidgetId =
    selection && selection.kind === 'widget' ? selection.id : null;

  const handleWidgetClick = React.useCallback(
    (widgetId: string | null) => {
      if (!onSelectionChange) return;
      if (!widgetId) {
        onSelectionChange(null);
        return;
      }
      const w = widgets.find((wi) => wi?.id === widgetId);
      onSelectionChange({
        kind: 'widget',
        id: widgetId,
        label: w?.title || widgetId,
      });
    },
    [onSelectionChange, widgets],
  );

  const handleReorder = React.useCallback(
    (next: DashboardWidgetSchema[]) => {
      if (!onPatch) return;
      onPatch({ widgets: next });
    },
    [onPatch],
  );

  const handleAddWidget = React.useCallback(
    (type: string) => {
      if (!canEdit) return;
      const existingIds = widgets.map((w) => w?.id).filter(Boolean) as string[];
      const id = uniqueId('widget', existingIds);
      const meta = WIDGET_TYPE_META[type];
      const title = meta ? `New ${meta.label.toLowerCase()}` : 'New widget';
      const newWidget = { id, type, title, ...(meta?.defaults ?? {}) } as unknown as DashboardWidgetSchema;
      const next = appendArray(widgets, newWidget);
      onPatch!({ widgets: next });
      onSelectionChange?.({ kind: 'widget', id, label: title });
    },
    [canEdit, widgets, onPatch, onSelectionChange],
  );

  const handleRenameWidget = React.useCallback(
    (widgetId: string, nextTitle: string) => {
      if (!canEdit) return;
      const next = widgets.map((w) =>
        w?.id === widgetId ? ({ ...w, title: nextTitle } as DashboardWidgetSchema) : w,
      );
      onPatch!({ widgets: next });
      if (selection && selection.kind === 'widget' && selection.id === widgetId) {
        onSelectionChange?.({ kind: 'widget', id: widgetId, label: nextTitle });
      }
    },
    [canEdit, widgets, onPatch, selection, onSelectionChange],
  );

  const selectedWidget = selectedWidgetId
    ? widgets.find((w) => w?.id === selectedWidgetId)
    : null;

  const addButton = canEdit ? (
    <AddWidgetPicker onAdd={handleAddWidget} label={tr('engine.inspector.add.widget', locale)} />
  ) : null;

  if (widgets.length === 0) {
    return (
      <PreviewShell hint={`dashboard${designMode ? ' · design' : ''}`} toolbar={addButton}>
        <PreviewMessage>Add at least one widget to see a preview.</PreviewMessage>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell
      hint={`dashboard · ${widgets.length} widget${widgets.length === 1 ? '' : 's'}${
        designMode ? ' · design' : ''
      }`}
      toolbar={addButton}
    >
      <PreviewErrorBoundary fallbackHint="A widget references an object or field that doesn't resolve.">
        {canEdit && selectedWidget && (
          <SelectedWidgetStrip
            widget={selectedWidget}
            onRename={(t) => handleRenameWidget(selectedWidget.id!, t)}
            onClose={() => onSelectionChange?.(null)}
          />
        )}
        <React.Suspense
          fallback={
            <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard renderer…
            </div>
          }
        >
          <div className="p-3 max-h-[70vh] overflow-auto">
            <DashboardRenderer
              schema={draft as any}
              dataSource={adapter as any}
              designMode={designMode}
              selectedWidgetId={selectedWidgetId}
              onWidgetClick={designMode ? handleWidgetClick : undefined}
              onWidgetsReorder={designMode && onPatch ? handleReorder : undefined}
              hideHeaderText
            />
          </div>
        </React.Suspense>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

/**
 * Floating strip that appears above the dashboard whenever a widget
 * is selected in design mode. Lets the author rename the widget
 * inline (Enter commits, Esc cancels) without diving into the right-
 * side inspector for a single text edit.
 */
function SelectedWidgetStrip({
  widget,
  onRename,
  onClose,
}: {
  widget: DashboardWidgetSchema;
  onRename: (nextTitle: string) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(widget.title ?? '');
  const meta = WIDGET_TYPE_META[(widget as any).type ?? ''];
  const Icon = meta?.icon;

  React.useEffect(() => {
    if (!editing) setDraft(widget.title ?? '');
  }, [widget.title, editing]);

  return (
    <div className="sticky top-0 z-10 mx-3 mt-3 mb-1 flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs">
      {Icon && <Icon className="h-3.5 w-3.5 text-primary/70 shrink-0" />}
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Selected
      </span>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            const v = draft.trim();
            if (v && v !== (widget.title ?? '')) onRename(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(widget.title ?? '');
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded border border-input bg-background px-1.5 py-0.5 outline-none focus:border-primary"
        />
      ) : (
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left font-medium text-foreground hover:underline"
          onClick={() => setEditing(true)}
          title="Click to rename"
        >
          {widget.title || <span className="text-muted-foreground">Untitled widget</span>}
        </button>
      )}
      {!editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Rename"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Clear selection"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
