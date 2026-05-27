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

export function PagePreview({ draft }: MetadataPreviewProps) {
  const schema = React.useMemo(() => {
    // SchemaRenderer needs a `type` discriminator. Page schemas may
    // omit it (Page is the implicit type at this metadata level), so
    // we inject it if missing while preserving any explicit override.
    const t = (draft as { type?: string }).type ?? 'page';
    return { ...(draft as Record<string, unknown>), type: t };
  }, [draft]);

  if (!schema || Object.keys(schema).length <= 1) {
    return (
      <PreviewShell hint="page">
        <PreviewMessage>Add components to the page to see a preview.</PreviewMessage>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint="page">
      <PreviewErrorBoundary fallbackHint="The Page schema is incomplete or references a component that hasn't been registered yet.">
        <div className="min-h-[200px] max-h-[70vh] overflow-auto p-4">
          <SchemaRenderer schema={schema as any} />
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}
