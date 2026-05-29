// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PagePreview — renders a Page metadata record using the runtime
 * SchemaRenderer so authors see exactly what end-users would see.
 *
 * Reads the live draft (not the server-saved record) so edits in the
 * Form tab preview instantly. URL query params are intentionally not
 * threaded in: previews run in a sandbox with no params context.
 */

import * as React from 'react';
import { SchemaRenderer } from '@object-ui/react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewErrorBoundary, PreviewMessage } from './PreviewShell';
import { OutlineStrip } from './OutlineStrip';
import { t as tr } from '../i18n';

interface Block { type?: string; id?: string; children?: Block[]; [k: string]: unknown }

export function PagePreview({ draft, editing, selection, onSelectionChange, locale }: MetadataPreviewProps) {
  const schema = React.useMemo(() => {
    // SchemaRenderer needs a `type` discriminator. Page schemas may
    // omit it (Page is the implicit type at this metadata level), so
    // we inject it if missing while preserving any explicit override.
    const t = (draft as { type?: string }).type ?? 'page';
    return { ...(draft as Record<string, unknown>), type: t };
  }, [draft]);

  const designMode = !!(editing && onSelectionChange);
  const selectedId = selection && selection.kind === 'block' ? selection.id : null;

  const blockEntries = React.useMemo(() => {
    const children = Array.isArray((draft as any).children) ? (draft as any).children as Block[] : [];
    return children.map((b, i) => ({ id: `children[${i}]`, label: b.id || b.type || `block ${i + 1}` }));
  }, [draft]);

  if (!schema || Object.keys(schema).length <= 1) {
    return (
      <PreviewShell hint="page">
        <PreviewMessage>Add components to the page to see a preview.</PreviewMessage>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint={`page${designMode ? ' · design' : ''}`}>
      <PreviewErrorBoundary fallbackHint="The Page schema is incomplete or references a component that hasn't been registered yet.">
        {designMode && (
          <OutlineStrip
            title={tr('engine.inspector.pageBlock.outlineLabel', locale)}
            entries={blockEntries}
            selectedId={selectedId}
            onSelect={(e) => onSelectionChange?.({ kind: 'block', id: e.id, label: e.label })}
          />
        )}
        <div className="min-h-[200px] max-h-[70vh] overflow-auto p-4">
          <SchemaRenderer schema={schema as any} />
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}
