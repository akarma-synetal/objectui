// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectPreview — render the object exactly the way the console does it:
 * via the same `object-view` SchemaRenderer the runtime route uses, with
 * the live adapter behind it. Authors see real records, real localized
 * column labels, real type-aware cell formatters (booleans → checkbox,
 * dates → locale string, refs → links), real search / filter chrome.
 *
 * This is a deliberate change from the earlier hand-rolled table: keeping
 * two implementations in sync was bound to drift, and the user explicitly
 * asked for preview parity with the console.
 */

import * as React from 'react';
import { SchemaRenderer } from '@object-ui/react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';

export function ObjectPreview({ name, draft }: MetadataPreviewProps) {
  const objectName = String((draft as any).name ?? name ?? '');

  if (!objectName) {
    return (
      <PreviewShell hint="object">
        <PreviewMessage>Give the object a name to enable preview.</PreviewMessage>
      </PreviewShell>
    );
  }

  // Reuse the exact same SDUI component the runtime route renders, so the
  // preview inherits localized headers, type-aware cell formatters, view
  // switcher, search, filter, sort and pagination chrome out of the box.
  const schema = React.useMemo(
    () => ({
      type: 'object-view',
      objectName,
      defaultViewType: 'grid',
      showSearch: true,
      showFilters: true,
      showCreate: false,
      showRefresh: true,
      showViewSwitcher: true,
    }),
    [objectName],
  );

  return (
    <PreviewShell hint="object · live data">
      <PreviewErrorBoundary fallbackHint="The object metadata couldn't be rendered. Save the draft and reload to retry.">
        <div className="max-h-[75vh] overflow-auto">
          <SchemaRenderer schema={schema as any} />
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}
