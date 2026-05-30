// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ViewVariantTabs — a thin tab strip above the live grid preview for
 * switching which top-level View variant (list / kanban / form / …) is being
 * edited. It renders ONLY when a view has more than one variant; column
 * management now lives in the right-panel {@link FieldsListEditor}, keeping the
 * preview a pure WYSIWYG surface (mainstream low-code pattern).
 *
 * Selecting a tab emits `{ kind:'view', id:'<variant>' }` so the inspector
 * swaps to that variant's home panel.
 */

import * as React from 'react';

export interface ViewVariantTabsProps {
  variants: Array<{ key: string }>;
  selection: { kind: string; id: string } | null;
  onSelectionChange?: (sel: { kind: string; id: string } | null) => void;
}

export function ViewVariantTabs({
  variants,
  selection,
  onSelectionChange,
}: ViewVariantTabsProps) {
  if (variants.length <= 1) return null;

  const selectedVariantKey =
    selection && (selection.kind === 'column' || selection.kind === 'view')
      ? selection.id.split('.')[0]
      : undefined;
  const activeKey = selectedVariantKey ?? variants[0]?.key ?? '';

  return (
    <div
      role="tablist"
      aria-label="View variants"
      className="inline-flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5"
    >
      {variants.map((v) => (
        <button
          key={v.key}
          type="button"
          role="tab"
          aria-selected={v.key === activeKey}
          onClick={() => onSelectionChange?.({ kind: 'view', id: v.key })}
          className={
            'rounded px-2 py-0.5 text-xs capitalize transition-colors ' +
            (v.key === activeKey
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground')
          }
        >
          {v.key}
        </button>
      ))}
    </div>
  );
}
