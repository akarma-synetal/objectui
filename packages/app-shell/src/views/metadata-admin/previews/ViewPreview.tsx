// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ViewPreview — renders a View metadata draft using the same
 * `object-view` SchemaRenderer the runtime ObjectView route uses,
 * with the current draft's variants injected as `listViews` so the
 * draft drives what authors see (not the saved version).
 *
 * If the draft is a "single-schema legacy" view (no list/form/kanban
 * wrappers, just one top-level `type`), we pass the schema straight
 * to SchemaRenderer.
 */

import * as React from 'react';
import { SchemaRenderer } from '@object-ui/react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewErrorBoundary, PreviewMessage } from './PreviewShell';
import { OutlineStrip } from './OutlineStrip';
import { t as tr } from '../i18n';

const VIEW_VARIANT_KEYS = [
  'list',
  'form',
  'kanban',
  'calendar',
  'gantt',
  'map',
  'gallery',
  'timeline',
  'feed',
  'detail',
] as const;

type VariantKey = (typeof VIEW_VARIANT_KEYS)[number];

function detectVariants(draft: Record<string, unknown>): Array<{ key: VariantKey; schema: Record<string, unknown> }> {
  const out: Array<{ key: VariantKey; schema: Record<string, unknown> }> = [];
  for (const k of VIEW_VARIANT_KEYS) {
    const v = (draft as any)[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push({ key: k, schema: v as Record<string, unknown> });
    }
  }
  return out;
}

function resolveObjectName(draft: Record<string, unknown>, variantSchema?: Record<string, unknown>): string | undefined {
  const candidates: any[] = [
    variantSchema?.object,
    (variantSchema as any)?.data?.object,
    (variantSchema as any)?.objectName,
    (draft as any).object,
    (draft as any).objectName,
    (draft as any).data?.object,
    (draft as any).list?.data?.object,
    (draft as any).list?.object,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c) return c;
  }
  return undefined;
}

export function ViewPreview({ name, draft, editing, selection, onSelectionChange, onPatch, locale }: MetadataPreviewProps) {
  const variants = React.useMemo(() => detectVariants(draft), [draft]);
  const objectName = React.useMemo(
    () => resolveObjectName(draft, variants[0]?.schema),
    [draft, variants],
  );

  const designMode = !!(editing && onSelectionChange);
  const canEdit = designMode && !!onPatch;
  const selectedId = selection && selection.kind === 'column' ? selection.id : null;

  const handleAddColumn = React.useCallback(
    (variantKey: string) => {
      if (!canEdit) return;
      const variant = (draft as any)[variantKey] as Record<string, unknown> | undefined;
      if (!variant) return;
      const cols = Array.isArray((variant as any).columns) ? (variant as any).columns as Array<unknown> : [];
      // Use ObjectStack canonical column shape `{ field, label }`. If the
      // existing array is all-strings (kanban style), append a string so
      // the column stays serializable in the same shape.
      const allStrings = cols.length > 0 && cols.every((c) => typeof c === 'string');
      const newCol: unknown = allStrings ? '' : { field: '', label: 'New column' };
      const next = [...cols, newCol];
      onPatch!({ [variantKey]: { ...variant, columns: next } });
      onSelectionChange?.({ kind: 'column', id: `${variantKey}.columns[${next.length - 1}]`, label: 'New column' });
    },
    [canEdit, draft, onPatch, onSelectionChange],
  );

  // Render one OutlineStrip per variant — each gets its own Add button
  // so users know exactly which variant they are appending to.
  const outlineNode = designMode ? (
    <>
      {variants.map((v) => {
        const cols = Array.isArray((v.schema as any).columns) ? (v.schema as any).columns as Array<unknown> : [];
        const entries = cols.map((c, i) => {
          // Columns may be `{ field, label }`, `{ accessorKey, header }`,
          // or raw string field-names (kanban). Resolve a friendly label.
          let lbl: string;
          if (typeof c === 'string') lbl = c;
          else if (c && typeof c === 'object') {
            const o = c as Record<string, unknown>;
            lbl = String(o.label ?? o.header ?? o.field ?? o.accessorKey ?? `col ${i + 1}`);
          } else lbl = `col ${i + 1}`;
          return { id: `${v.key}.columns[${i}]`, label: variants.length > 1 ? `${v.key}.${lbl}` : lbl };
        });
        if (entries.length === 0 && !canEdit) return null;
        return (
          <OutlineStrip
            key={v.key}
            title={variants.length > 1
              ? `${v.key} · ${tr('engine.inspector.viewColumn.outlineLabel', locale)}`
              : tr('engine.inspector.viewColumn.outlineLabel', locale)}
            entries={entries}
            selectedId={selectedId}
            onSelect={(e) => onSelectionChange?.({ kind: 'column', id: e.id, label: e.label })}
            onAdd={canEdit ? () => handleAddColumn(v.key) : undefined}
            addLabel={tr('engine.inspector.add.column', locale)}
          />
        );
      })}
    </>
  ) : null;

  // Compose the listViews map: the draft IS the "default" — surface it as a
  // primary named view FIRST so the view switcher picks it as default. Then
  // append any saved sibling named listViews.
  const { listViews, defaultViewId } = React.useMemo<{
    listViews: Record<string, unknown>;
    defaultViewId: string | undefined;
  }>(() => {
    const out: Record<string, unknown> = {};
    const primaryVariant = variants.find((v) => v.key === 'list') ?? variants[0];
    const primaryId = String(name) || primaryVariant?.key || 'default';
    if (primaryVariant) {
      out[primaryId] = {
        ...primaryVariant.schema,
        label: (primaryVariant.schema as any).label ?? (draft as any).label ?? name,
      };
    }
    const saved = (draft as any).listViews;
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [k, v] of Object.entries(saved)) {
        if (v && typeof v === 'object' && k !== primaryId) out[k] = v;
      }
    }
    return { listViews: out, defaultViewId: primaryVariant ? primaryId : undefined };
  }, [draft, variants, name]);

  // -------------------------------------------------------------------------
  // Path A — single-schema legacy view: render directly.
  // -------------------------------------------------------------------------
  if (!variants.length && (draft as any).type) {
    const schema = { ...(draft as Record<string, unknown>) };
    return (
      <PreviewShell hint={`view · ${(schema as any).type}${designMode ? ' · design' : ''}`}>
        <PreviewErrorBoundary fallbackHint="The view's `type` may not be registered, or required fields are missing.">
          {outlineNode}
          <div className="min-h-[300px] max-h-[75vh] overflow-auto">
            <SchemaRenderer schema={schema as any} />
          </div>
        </PreviewErrorBoundary>
      </PreviewShell>
    );
  }

  if (!objectName) {
    return (
      <PreviewShell hint="view">
        <PreviewMessage tone="warn">
          This view has no object binding yet. Set <code>list.data.object</code> in the Form tab to fetch live data.
        </PreviewMessage>
      </PreviewShell>
    );
  }

  // -------------------------------------------------------------------------
  // Path B — multi-variant view: delegate to `object-view`, which is what
  // the runtime route uses. Inject the draft's listViews so the preview
  // reflects unsaved edits.
  // -------------------------------------------------------------------------
  const defaultViewType =
    ((variants[0]?.schema as any)?.type as string) ?? 'grid';

  const schema = React.useMemo(
    () => ({
      type: 'object-view',
      objectName,
      defaultViewType,
      defaultListView: defaultViewId,
      listViews,
      showSearch: true,
      showFilters: true,
      showCreate: false,
      showRefresh: true,
      showViewSwitcher: true,
    }),
    [objectName, defaultViewType, defaultViewId, listViews],
  );

  const variantHint = variants
    .map((v) => v.key)
    .slice(0, 3)
    .join(' · ');

  return (
    <PreviewShell hint={`view · ${variantHint || 'list'}${designMode ? ' · design' : ''}`}>
      <PreviewErrorBoundary fallbackHint="The view references an object or field that doesn't resolve.">
        {outlineNode}
        <div className="min-h-[300px] max-h-[75vh] overflow-auto">
          <SchemaRenderer schema={schema as any} />
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}
