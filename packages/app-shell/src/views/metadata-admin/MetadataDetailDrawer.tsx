// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MetadataDetailDrawer — slide-over editor for a related metadata item.
 *
 * Opens from the parent's Related tab without taking the user away
 * from the parent's context. Internally we mount the same
 * `MetadataResourceEditPage` used by the full-page route, so all the
 * Save / Reset / Validate behaviour is shared. The drawer just frames
 * it and adds a "Open full page ↗" affordance.
 *
 * Width is wide enough for forms (max 1100px) but capped at 92vw to
 * leave a thin strip of the parent visible behind, reinforcing the
 * "still in the same object" feel.
 */

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Button,
  Badge,
  cn,
} from '@object-ui/components';
import { MetadataResourceEditPage } from './ResourceEditPage';
import type { RelatedTarget } from './RelatedPanel';

export interface MetadataDetailDrawerProps {
  /** When non-null, drawer is open and shows this target. */
  target: RelatedTarget | null;
  /** Called when the drawer requests close (overlay click, esc, close btn). */
  onClose: () => void;
  /** Optional context: parent's type / name, shown in the title. */
  parentContext?: { type: string; name: string };
}

export function MetadataDetailDrawer({
  target,
  onClose,
  parentContext,
}: MetadataDetailDrawerProps) {
  const navigate = useNavigate();

  const isMetadata = target?.kind === 'metadata';
  const isEmbedded = target?.kind === 'embedded';
  const headerType = isMetadata
    ? target.type
    : isEmbedded
      ? target.groupLabel
      : '';
  const headerName = isMetadata
    ? target.name
    : isEmbedded
      ? target.itemName
      : '';

  return (
    <Sheet
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className={cn(
          'w-[92vw] sm:max-w-[1100px] p-0 flex flex-col gap-0',
        )}
      >
        <SheetHeader className="px-4 py-3 border-b space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">
              {headerType}
            </Badge>
            <SheetTitle className="font-mono text-base truncate">
              {headerName}
            </SheetTitle>
            <div className="ml-auto flex items-center gap-1">
              {isMetadata && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigate(
                      `../../${encodeURIComponent(target.type)}/${encodeURIComponent(target.name)}`,
                    );
                    onClose();
                  }}
                  title="Open in full page"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Open full page
                </Button>
              )}
            </div>
          </div>
          {parentContext && (
            <SheetDescription className="text-xs">
              {isEmbedded ? 'Embedded in ' : 'Related to '}
              <span className="font-mono">
                {parentContext.type}/{parentContext.name}
              </span>
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          {isMetadata && (
            <MetadataResourceEditPage
              key={`${target.type}/${target.name}`}
              type={target.type}
              name={target.name}
              embedded
            />
          )}
          {isEmbedded && <EmbeddedItemView raw={target.raw} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Read-only JSON preview for embedded items (fields, indexes, embedded
 * validations). Editing happens via the parent's Form tab; jumping
 * straight to that field is a future enhancement — for now the user
 * can inspect the spec here and click "Edit in Form tab" in the panel.
 */
function EmbeddedItemView({ raw }: { raw: Record<string, unknown> }) {
  const json = React.useMemo(() => JSON.stringify(raw, null, 2), [raw]);
  return (
    <div className="p-4 space-y-3">
      <div className="text-xs text-muted-foreground">
        This item lives inside its parent's body. Edit it in the parent's{' '}
        <span className="font-medium">Form</span> tab.
      </div>
      <pre className="text-xs font-mono bg-muted/40 border rounded p-3 overflow-auto whitespace-pre-wrap break-all">
        {json}
      </pre>
    </div>
  );
}
