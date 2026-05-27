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

const ReportRenderer = React.lazy(() =>
  import('@object-ui/plugin-report').then((m) => ({ default: m.ReportRenderer })),
);

export function ReportPreview({ draft }: MetadataPreviewProps) {
  const adapter = useAdapter();
  // Different fixture sets use different keys for the source object:
  //   • new schema: `object`
  //   • legacy: `objectName`
  //   • some reports embed it under `data.object`
  const objectName =
    (draft as any).object ?? (draft as any).objectName ?? (draft as any).data?.object;
  const visualization = (draft as any).visualization?.type ?? (draft as any).type;

  if (!objectName) {
    return (
      <PreviewShell hint="report">
        <PreviewMessage tone="warn">
          Pick an Object in the Form tab — Reports need a source object before they can render.
        </PreviewMessage>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint={`report · ${visualization ?? 'table'}`}>
      <PreviewErrorBoundary fallbackHint="The Report references an object/field that doesn't resolve, or its visualization config is incomplete.">
        <React.Suspense
          fallback={
            <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading report renderer…
            </div>
          }
        >
          <div className="p-3 min-h-[300px] max-h-[70vh] overflow-auto">
            <ReportRenderer schema={draft as any} dataSource={adapter as any} />
          </div>
        </React.Suspense>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}
