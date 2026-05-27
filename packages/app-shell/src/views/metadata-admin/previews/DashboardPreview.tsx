// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DashboardPreview — read-only render of a Dashboard metadata draft.
 *
 * Uses the same DashboardRenderer the runtime DashboardView uses, with
 * the adapter from app-shell's AdapterProvider so widgets can query
 * live data. `designMode` is OFF — this is preview, not edit.
 *
 * The plugin is loaded lazily to avoid pulling its dep graph into
 * every metadata-admin page load.
 */

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { useAdapter } from '../../../providers/AdapterProvider';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewErrorBoundary, PreviewMessage } from './PreviewShell';

const DashboardRenderer = React.lazy(() =>
  import('@object-ui/plugin-dashboard').then((m) => ({ default: m.DashboardRenderer })),
);

export function DashboardPreview({ draft }: MetadataPreviewProps) {
  const adapter = useAdapter();
  const widgets = Array.isArray((draft as any).widgets) ? (draft as any).widgets : [];

  if (widgets.length === 0) {
    return (
      <PreviewShell hint="dashboard">
        <PreviewMessage>Add at least one widget to see a preview.</PreviewMessage>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint={`dashboard · ${widgets.length} widget${widgets.length === 1 ? '' : 's'}`}>
      <PreviewErrorBoundary fallbackHint="A widget references an object or field that doesn't resolve.">
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
              designMode={false}
              hideHeaderText
            />
          </div>
        </React.Suspense>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}
