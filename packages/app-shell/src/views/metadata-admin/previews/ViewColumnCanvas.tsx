// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ViewColumnCanvas — a compact column toolbar that sits ABOVE the live
 * grid preview. The preview is the real WYSIWYG canvas; this bar is a
 * thin, one-line manager (mainstream low-code / Airtable / Notion
 * pattern) so column editing never steals the design surface.
 *
 *   [list · kanban]   ≡name  ≡company  ≡status …   [+ Add field]
 *
 *   • Each column is a draggable chip — click to select (→ inspector),
 *     drag to reorder, × to remove.
 *   • "+ Add field" opens a searchable popover of the bound Object's
 *     fields; click to append a real column (no hand-typed API names).
 *   • Variant tabs appear only when a view has >1 top-level variant.
 *
 * Selecting a column still emits `{ kind:'column', id:'<variant>.columns[<i>]' }`
 * so the existing ViewColumnInspector handles per-column properties.
 * Column entries round-trip in their original shape (string vs object).
 */

import * as React from 'react';
import { Badge } from '@object-ui/components';
import { appendArray, moveArray, spliceArray } from '../inspectors/_shared';
import { useObjectFields, type ObjectFieldInfo } from './useObjectFields';
import { AddFieldPopover, ColumnChip } from './ViewColumnPanes';
import {
  colFieldName,
  colLabel,
  makeColumn,
  remapIndexAfterMove,
  remapIndexAfterRemove,
  usedFieldNames,
  type VariantInfo,
} from './view-column-io';

export interface ViewColumnCanvasProps {
  draft: Record<string, unknown>;
  variants: VariantInfo[];
  /** Draft-level fallback object name (variant binding takes priority). */
  objectName?: string;
  onPatch?: (patch: Record<string, unknown>) => void;
  selection: { kind: string; id: string } | null;
  onSelectionChange?: (sel: { kind: string; id: string; label?: string } | null) => void;
}

/** Resolve the Object a variant is bound to (variant first, then draft). */
function resolveVariantObject(
  variant: VariantInfo | undefined,
  draftObject: string | undefined,
): string | undefined {
  const s = variant?.schema as any;
  const candidates = [s?.data?.object, s?.object, s?.objectName, draftObject];
  for (const c of candidates) if (typeof c === 'string' && c) return c;
  return undefined;
}

export function ViewColumnCanvas({
  draft: _draft,
  variants,
  objectName,
  onPatch,
  selection,
  onSelectionChange,
}: ViewColumnCanvasProps) {
  const canEdit = !!onPatch;

  // Active variant — the current selection (column OR view) decides which
  // variant the toolbar manages, so clicking a tab/chip stays in sync with
  // the inspector. Falls back to the first variant.
  const selectedVariantKey =
    selection && (selection.kind === 'column' || selection.kind === 'view')
      ? selection.id.split('.')[0]
      : undefined;
  const activeKey = selectedVariantKey ?? variants[0]?.key ?? '';
  const active = variants.find((v) => v.key === activeKey) ?? variants[0];

  const activeObject = resolveVariantObject(active, objectName);
  const { fields, loading, error } = useObjectFields(activeObject);

  // Map field name → type for chip icons.
  const fieldTypeByName = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const f of fields) m.set(f.name, f.type);
    return m;
  }, [fields]);

  const selectedIndex = React.useMemo(() => {
    if (!selection || selection.kind !== 'column' || !active) return null;
    const m = new RegExp(`^${active.key}\\.columns\\[(\\d+)\\]$`).exec(selection.id);
    return m ? Number(m[1]) : null;
  }, [selection, active]);

  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  const writeColumns = React.useCallback(
    (next: unknown[]) => {
      if (!onPatch || !active) return;
      onPatch({ [active.key]: { ...active.schema, columns: next } });
    },
    [onPatch, active],
  );

  const addField = React.useCallback(
    (field: ObjectFieldInfo) => {
      if (!active) return;
      const col = makeColumn(active.allStrings, field.name, field.label);
      const next = appendArray(active.columns, col);
      writeColumns(next);
      onSelectionChange?.({
        kind: 'column',
        id: `${active.key}.columns[${next.length - 1}]`,
        label: field.label,
      });
    },
    [active, writeColumns, onSelectionChange],
  );

  const removeColumn = React.useCallback(
    (index: number) => {
      if (!active) return;
      const next = spliceArray(active.columns, index, null);
      writeColumns(next);
      if (selectedIndex != null) {
        const remapped = remapIndexAfterRemove(selectedIndex, index);
        if (remapped == null) onSelectionChange?.(null);
        else
          onSelectionChange?.({
            kind: 'column',
            id: `${active.key}.columns[${remapped}]`,
            label: colLabel(next[remapped], remapped),
          });
      }
    },
    [active, writeColumns, selectedIndex, onSelectionChange],
  );

  const moveColumn = React.useCallback(
    (from: number, to: number) => {
      if (!active || from === to) return;
      const next = moveArray(active.columns, from, to);
      writeColumns(next);
      if (selectedIndex != null) {
        const remapped = remapIndexAfterMove(selectedIndex, from, to);
        onSelectionChange?.({
          kind: 'column',
          id: `${active.key}.columns[${remapped}]`,
          label: colLabel(next[remapped], remapped),
        });
      }
    },
    [active, writeColumns, selectedIndex, onSelectionChange],
  );

  const selectColumn = React.useCallback(
    (index: number) => {
      if (!active) return;
      onSelectionChange?.({
        kind: 'column',
        id: `${active.key}.columns[${index}]`,
        label: colLabel(active.columns[index], index),
      });
    },
    [active, onSelectionChange],
  );

  if (variants.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-center text-[11px] text-muted-foreground">
        No variants yet. Add a <code>list</code> or <code>kanban</code> block in
        the Form tab to configure columns.
      </div>
    );
  }

  const columns = active?.columns ?? [];
  const usedNames = usedFieldNames(columns);

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background/80 px-2 py-1.5">
      {variants.length > 1 && (
        <>
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
                aria-selected={v.key === active?.key}
                onClick={() => onSelectionChange?.({ kind: 'view', id: v.key })}
                className={
                  'rounded px-2 py-0.5 text-xs capitalize transition-colors ' +
                  (v.key === active?.key
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground')
                }
              >
                {v.key}
              </button>
            ))}
          </div>
          <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
        </>
      )}

      <span className="mr-0.5 text-[11px] font-medium text-muted-foreground">
        Columns
      </span>
      <Badge variant="outline" className="text-[10px]">
        {columns.length}
      </Badge>

      {columns.map((c, i) => (
        <ColumnChip
          key={i}
          index={i}
          label={colLabel(c, i)}
          fieldType={fieldTypeByName.get(colFieldName(c) ?? '') ?? 'text'}
          selected={selectedIndex === i}
          canEdit={canEdit}
          dragging={dragIndex !== null}
          dropBefore={overIndex === i && dragIndex !== null && dragIndex !== i}
          onSelect={() => selectColumn(i)}
          onRemove={() => removeColumn(i)}
          onDragStart={() => setDragIndex(i)}
          onDragEnd={() => {
            setDragIndex(null);
            setOverIndex(null);
          }}
          onDragOverChip={() => setOverIndex(i)}
          onDropChip={() => {
            if (dragIndex != null && dragIndex !== i) moveColumn(dragIndex, i);
            setDragIndex(null);
            setOverIndex(null);
          }}
        />
      ))}

      {canEdit && (
        <AddFieldPopover
          fields={fields}
          usedNames={usedNames}
          loading={loading}
          error={error}
          onAdd={addField}
        />
      )}
    </div>
  );
}
