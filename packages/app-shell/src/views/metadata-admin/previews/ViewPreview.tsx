// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ViewPreview — renders a View metadata draft using the same `object-view`
 * SchemaRenderer the runtime ObjectView route uses, with the draft's own
 * `config` body injected as a named `listView` so the preview reflects the
 * unsaved edit (not the last saved version).
 *
 * A view is the canonical first-class **ViewItem** ({ viewKind, config }):
 * one view, one `config` body — there are no in-document variant tabs. An
 * object's *other* views are independent ViewItems surfaced by the view
 * switcher (a query), not nested here.
 *
 * A raw single-schema draft (a bare `{ type, … }` with no `config` wrapper,
 * e.g. an ad-hoc preview) is rendered straight through SchemaRenderer.
 */

import * as React from 'react';
import { SchemaRenderer } from '@object-ui/react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewErrorBoundary, PreviewMessage } from './PreviewShell';
import { primaryVariantBinding } from '../view-variant-model';

function resolveObjectName(
  draft: Record<string, unknown>,
  body?: Record<string, unknown>,
): string | undefined {
  const candidates: any[] = [
    body?.object,
    (body as any)?.data?.object,
    (body as any)?.objectName,
    (draft as any).object,
    (draft as any).objectName,
    (draft as any).data?.object,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c) return c;
  }
  return undefined;
}

export function ViewPreview({ name, draft, editing }: MetadataPreviewProps) {
  // The single ViewItem body (`draft.config`), or undefined for a raw schema.
  const body = React.useMemo(
    () => primaryVariantBinding(draft)?.schema,
    [draft],
  );
  const objectName = React.useMemo(
    () => resolveObjectName(draft, body),
    [draft, body],
  );

  const designMode = !!editing;

  // Surface the draft body as a named listView so the preview renders THIS
  // view (with unsaved edits) rather than the object's saved default.
  const { listViews, defaultViewId, defaultViewType } = React.useMemo(() => {
    if (!body) {
      return { listViews: {}, defaultViewId: undefined, defaultViewType: 'grid' };
    }
    const id = String(name) || 'default';
    return {
      listViews: {
        [id]: {
          ...body,
          label: (body as any).label ?? (draft as any).label ?? name,
        },
      },
      defaultViewId: id,
      defaultViewType: ((body as any).type as string) ?? 'grid',
    };
  }, [body, draft, name]);

  // -------------------------------------------------------------------------
  // Raw single-schema draft (no ViewItem `config` wrapper): render directly.
  // -------------------------------------------------------------------------
  if (!body && (draft as any).type) {
    const schema = { ...(draft as Record<string, unknown>) };
    return (
      <PreviewShell hint={`view · ${(schema as any).type}${designMode ? ' · design' : ''}`}>
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
      <PreviewShell hint={`view${designMode ? ' · design' : ''}`}>
        <PreviewMessage tone="warn">
          This view has no object binding yet. Set the bound <code>Object</code> in
          the right panel to fetch live data and field options.
        </PreviewMessage>
      </PreviewShell>
    );
  }

  // -------------------------------------------------------------------------
  // Delegate to `object-view` — the same renderer the runtime route uses —
  // with the draft body injected so the preview reflects unsaved edits.
  // -------------------------------------------------------------------------
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

  return (
    <PreviewShell hint={`view · ${defaultViewType}${designMode ? ' · design' : ''}`}>
      <PreviewErrorBoundary fallbackHint="The view references an object or field that doesn't resolve.">
        <div className="min-h-[300px] max-h-[75vh] overflow-auto">
          <SchemaRenderer schema={schema as any} />
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}
