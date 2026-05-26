// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * LayeredDiff — the 3-state Code / Overlay / Effective tabs (Phase 3c).
 *
 * Backed by `client.layered(type, name)` (Phase 3a `?layers=true`).
 * Shows admins exactly:
 *   • Code: what the artifact ships with by default.
 *   • Overlay: just the deltas they've saved on top.
 *   • Effective: the merged value the runtime actually sees.
 *
 * Why a tab strip instead of a side-by-side diff? Three-pane diffs
 * eat horizontal space and the deltas in metadata overlays are
 * usually a few fields, not whole-file rewrites. A diff button per
 * field row would be a follow-up enhancement once the engine is in
 * place.
 */

import * as React from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@object-ui/components';
import { Badge } from '@object-ui/components';
import type { MetadataLayered } from '@object-ui/data-objectstack';

export interface LayeredDiffProps {
  layered: MetadataLayered<Record<string, unknown>> | null;
  loading?: boolean;
}

export function LayeredDiff({ layered, loading }: LayeredDiffProps) {
  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading layers…
      </div>
    );
  }
  if (!layered) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Layered view unavailable for this item.
      </div>
    );
  }

  const hasOverlay = layered.overlay != null;

  return (
    <Tabs defaultValue="effective" className="w-full">
      <TabsList className="grid grid-cols-3 w-fit">
        <TabsTrigger value="code">
          Code
          <Badge variant="outline" className="ml-1.5 text-[10px]">
            artifact
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="overlay">
          Overlay
          {hasOverlay ? (
            <Badge className="ml-1.5 text-[10px] bg-emerald-600 text-emerald-50">
              {layered.overlayScope ?? 'set'}
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-1.5 text-[10px] text-muted-foreground">
              none
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="effective">
          Effective
          <Badge variant="outline" className="ml-1.5 text-[10px]">
            merged
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="code" className="mt-3">
        <LayerPanel
          payload={layered.code}
          emptyHint="No code-level artifact for this item. It may have been created at runtime as a pure overlay."
        />
      </TabsContent>

      <TabsContent value="overlay" className="mt-3">
        <LayerPanel
          payload={layered.overlay}
          emptyHint="No overlay set. The runtime is using the code-level value as-is."
        />
      </TabsContent>

      <TabsContent value="effective" className="mt-3">
        <LayerPanel
          payload={layered.effective}
          emptyHint="No effective value resolved."
        />
      </TabsContent>
    </Tabs>
  );
}

function LayerPanel({
  payload,
  emptyHint,
}: {
  payload: unknown;
  emptyHint: string;
}) {
  if (payload == null) {
    return (
      <div className="rounded border bg-muted/30 p-4 text-xs text-muted-foreground">
        {emptyHint}
      </div>
    );
  }
  let pretty: string;
  try {
    pretty = JSON.stringify(payload, null, 2);
  } catch {
    pretty = String(payload);
  }
  return (
    <pre className="rounded border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-[420px]">
      {pretty}
    </pre>
  );
}
