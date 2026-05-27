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

export function ViewPreview({ name, draft }: MetadataPreviewProps) {
  const variants = React.useMemo(() => detectVariants(draft), [draft]);
  const objectName = React.useMemo(
    () => resolveObjectName(draft, variants[0]?.schema),
    [draft, variants],
  );

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
      <PreviewShell hint={`view · ${(schema as any).type}`}>
        <PreviewErrorBoundary fallbackHint="The view's `type` may not be registered, or required fields are missing.">
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
    <PreviewShell hint={`view · ${variantHint || 'list'}`}>
      <PreviewErrorBoundary fallbackHint="The view references an object or field that doesn't resolve.">
        <div className="min-h-[300px] max-h-[75vh] overflow-auto">
          <SchemaRenderer schema={schema as any} />
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}
