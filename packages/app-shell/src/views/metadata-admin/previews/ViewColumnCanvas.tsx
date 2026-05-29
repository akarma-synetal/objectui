// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ViewColumnCanvas — form-canvas-style editor for the columns of a
 * View metadata draft. Each detected variant (list / kanban / …)
 * becomes a labelled section; columns inside it are clickable cards
 * with a drag handle, type icon (heuristic), inline-rename label,
 * and a "remove" affordance on hover. Drag-drop reorders within and
 * across variants of the same draft (the dropped column adopts the
 * target variant).
 *
 * Selection IDs match ViewColumnInspector's `parsePath` regex:
 *   { kind: 'column', id: `${variantKey}.columns[${i}]` }
 *
 * Column entries support two canonical shapes:
 *   • `string` — bare field name (kanban-style)
 *   • `{ field, label, ... }` or `{ accessorKey, header, ... }`
 *
 * When a section's column array is all-strings we keep new entries as
 * strings to avoid breaking the consumer's expectations.
 */

import * as React from 'react';
import { Columns3, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@object-ui/components';
import { appendArray, moveArray, spliceArray } from '../inspectors/_shared';

const DND_MIME = 'text/x-objectui-viewcol';

interface VariantInfo {
  key: string;
  schema: Record<string, unknown>;
  columns: unknown[];
  allStrings: boolean;
}

function colLabel(c: unknown, i: number): string {
  if (typeof c === 'string') return c || `col ${i + 1}`;
  if (c && typeof c === 'object') {
    const o = c as Record<string, unknown>;
    return String(o.label ?? o.header ?? o.field ?? o.accessorKey ?? `col ${i + 1}`);
  }
  return `col ${i + 1}`;
}

function colFieldName(c: unknown): string | undefined {
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object') {
    const o = c as Record<string, unknown>;
    const v = o.field ?? o.accessorKey;
    return typeof v === 'string' ? v : undefined;
  }
  return undefined;
}

export interface ViewColumnCanvasProps {
  draft: Record<string, unknown>;
  variants: VariantInfo[];
  onPatch?: (patch: Record<string, unknown>) => void;
  selection: { kind: string; id: string } | null;
  onSelectionChange?: (sel: { kind: string; id: string; label?: string } | null) => void;
}

export function ViewColumnCanvas({
  draft,
  variants,
  onPatch,
  selection,
  onSelectionChange,
}: ViewColumnCanvasProps) {
  const [drag, setDrag] = React.useState<{ variant: string; index: number } | null>(null);

  const selectedId = selection && selection.kind === 'column' ? selection.id : null;

  const setVariantColumns = React.useCallback(
    (variantKey: string, next: unknown[]) => {
      if (!onPatch) return;
      const variant = (draft as any)[variantKey] as Record<string, unknown> | undefined;
      if (!variant) return;
      onPatch({ [variantKey]: { ...variant, columns: next } });
    },
    [draft, onPatch],
  );

  const addColumn = React.useCallback(
    (variant: VariantInfo) => {
      if (!onPatch) return;
      const newCol: unknown = variant.allStrings
        ? ''
        : { field: '', label: 'New column' };
      const next = appendArray(variant.columns, newCol);
      setVariantColumns(variant.key, next);
      onSelectionChange?.({
        kind: 'column',
        id: `${variant.key}.columns[${next.length - 1}]`,
        label: 'New column',
      });
    },
    [onPatch, setVariantColumns, onSelectionChange],
  );

  const removeColumn = React.useCallback(
    (variant: VariantInfo, index: number) => {
      if (!onPatch) return;
      const next = spliceArray(variant.columns, index, null);
      setVariantColumns(variant.key, next);
      if (selectedId === `${variant.key}.columns[${index}]`) onSelectionChange?.(null);
    },
    [onPatch, setVariantColumns, selectedId, onSelectionChange],
  );

  const renameColumn = React.useCallback(
    (variant: VariantInfo, index: number, nextLabel: string) => {
      if (!onPatch) return;
      const cur = variant.columns[index];
      let updated: unknown;
      if (typeof cur === 'string') {
        // For string columns, the "label" is the field name itself —
        // rename mutates the field, not a label property. We keep
        // string shape to honour the variant's all-strings invariant.
        updated = nextLabel;
      } else if (cur && typeof cur === 'object') {
        const o = cur as Record<string, unknown>;
        // Prefer existing label key; fall back to `label`.
        if ('header' in o) updated = { ...o, header: nextLabel };
        else updated = { ...o, label: nextLabel };
      } else {
        updated = { label: nextLabel };
      }
      const next = spliceArray(variant.columns, index, updated);
      setVariantColumns(variant.key, next);
      if (selectedId === `${variant.key}.columns[${index}]`) {
        onSelectionChange?.({
          kind: 'column',
          id: `${variant.key}.columns[${index}]`,
          label: nextLabel,
        });
      }
    },
    [onPatch, setVariantColumns, selectedId, onSelectionChange],
  );

  const moveColumn = React.useCallback(
    (src: { variant: string; index: number }, dst: { variant: string; index: number }) => {
      if (!onPatch) return;
      const srcVariant = variants.find((v) => v.key === src.variant);
      const dstVariant = variants.find((v) => v.key === dst.variant);
      if (!srcVariant || !dstVariant) return;

      if (src.variant === dst.variant) {
        let to = dst.index;
        if (src.index < dst.index) to = dst.index - 1;
        if (to === src.index) return;
        const next = moveArray(srcVariant.columns, src.index, to);
        setVariantColumns(src.variant, next);
        onSelectionChange?.({
          kind: 'column',
          id: `${src.variant}.columns[${to}]`,
          label: colLabel(next[to], to),
        });
        return;
      }

      // Cross-variant: remove from source, insert into target. Coerce
      // shape to match destination's allStrings invariant.
      const item = srcVariant.columns[src.index];
      let coerced: unknown = item;
      if (dstVariant.allStrings && typeof item !== 'string') {
        coerced = colFieldName(item) ?? colLabel(item, src.index);
      } else if (!dstVariant.allStrings && typeof item === 'string') {
        coerced = { field: item, label: item };
      }

      const srcNext = spliceArray(srcVariant.columns, src.index, null);
      const dstNext = [...dstVariant.columns];
      dstNext.splice(dst.index, 0, coerced);

      onPatch({
        [src.variant]: { ...srcVariant.schema, columns: srcNext },
        [dst.variant]: { ...dstVariant.schema, columns: dstNext },
      });
      onSelectionChange?.({
        kind: 'column',
        id: `${dst.variant}.columns[${dst.index}]`,
        label: colLabel(coerced, dst.index),
      });
    },
    [variants, onPatch, setVariantColumns, onSelectionChange],
  );

  return (
    <div className="space-y-3 p-3">
      {variants.length === 0 && onPatch && (
        <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
          No variants on this view yet. Add a <code>list</code> or <code>kanban</code> block in the Form tab to start.
        </div>
      )}
      {variants.map((v) => (
        <VariantSection
          key={v.key}
          variant={v}
          canEdit={!!onPatch}
          selectedId={selectedId}
          drag={drag}
          onDragChange={setDrag}
          onAdd={() => addColumn(v)}
          onRemove={(i) => removeColumn(v, i)}
          onRename={(i, lbl) => renameColumn(v, i, lbl)}
          onMove={moveColumn}
          onSelectionChange={onSelectionChange}
        />
      ))}
    </div>
  );
}

function VariantSection({
  variant,
  canEdit,
  selectedId,
  drag,
  onDragChange,
  onAdd,
  onRemove,
  onRename,
  onMove,
  onSelectionChange,
}: {
  variant: VariantInfo;
  canEdit: boolean;
  selectedId: string | null;
  drag: { variant: string; index: number } | null;
  onDragChange: (d: { variant: string; index: number } | null) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onRename: (index: number, label: string) => void;
  onMove: (
    src: { variant: string; index: number },
    dst: { variant: string; index: number },
  ) => void;
  onSelectionChange?: (sel: { kind: string; id: string; label?: string } | null) => void;
}) {
  const [over, setOver] = React.useState(false);

  return (
    <div
      className="rounded-md border bg-card/40"
      onDragOver={(e) => {
        if (!canEdit) return;
        if (e.dataTransfer.types.includes(DND_MIME)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!canEdit) return;
        if (!e.dataTransfer.types.includes(DND_MIME)) return;
        e.preventDefault();
        setOver(false);
        if (!drag) return;
        // Empty/end drop: append to this variant
        onMove(drag, { variant: variant.key, index: variant.columns.length });
        onDragChange(null);
      }}
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono uppercase tracking-wide text-muted-foreground">
            {variant.key}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {variant.columns.length} {variant.columns.length === 1 ? 'column' : 'columns'}
          </Badge>
        </div>
        {canEdit && (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-dashed px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            onClick={onAdd}
          >
            <Plus className="h-3 w-3" /> Add column
          </button>
        )}
      </div>
      <div className={`space-y-1.5 p-2 ${over ? 'bg-primary/5' : ''}`}>
        {variant.columns.length === 0 ? (
          <div
            className={`rounded border-2 border-dashed px-3 py-6 text-center text-[11px] transition ${
              over
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground'
            }`}
          >
            {over
              ? 'Drop to add to this variant'
              : canEdit
              ? 'Empty — drop a column here or use Add column'
              : 'no columns yet'}
          </div>
        ) : (
          variant.columns.map((c, i) => (
            <ColumnRow
              key={i}
              column={c}
              index={i}
              variantKey={variant.key}
              path={`${variant.key}.columns[${i}]`}
              isSelected={selectedId === `${variant.key}.columns[${i}]`}
              canEdit={canEdit}
              onClick={() =>
                onSelectionChange?.({
                  kind: 'column',
                  id: `${variant.key}.columns[${i}]`,
                  label: colLabel(c, i),
                })
              }
              onRename={(lbl) => onRename(i, lbl)}
              onRemove={() => onRemove(i)}
              onDragStart={() => onDragChange({ variant: variant.key, index: i })}
              onDragEnd={() => onDragChange(null)}
              onDropBefore={() => {
                if (!drag) return;
                onMove(drag, { variant: variant.key, index: i });
                onDragChange(null);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ColumnRow({
  column,
  index,
  path,
  isSelected,
  canEdit,
  onClick,
  onRename,
  onRemove,
  onDragStart,
  onDragEnd,
  onDropBefore,
}: {
  column: unknown;
  index: number;
  variantKey: string;
  path: string;
  isSelected: boolean;
  canEdit: boolean;
  onClick: () => void;
  onRename: (label: string) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropBefore: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(colLabel(column, index));
  const [hover, setHover] = React.useState(false);
  const [dropPos, setDropPos] = React.useState<'before' | null>(null);

  React.useEffect(() => {
    if (!editing) setDraft(colLabel(column, index));
  }, [column, index, editing]);

  const field = colFieldName(column);

  return (
    <div className="relative">
      {dropPos === 'before' && (
        <div className="pointer-events-none absolute inset-x-0 -top-0.5 h-0.5 rounded bg-primary" />
      )}
      <button
        type="button"
        draggable={canEdit && !editing}
        onDragStart={(e) => {
          if (!canEdit) return;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData(DND_MIME, path);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          if (!canEdit) return;
          if (!e.dataTransfer.types.includes(DND_MIME)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropPos('before');
        }}
        onDragLeave={() => setDropPos(null)}
        onDrop={(e) => {
          if (!canEdit) return;
          if (!e.dataTransfer.types.includes(DND_MIME)) return;
          e.preventDefault();
          e.stopPropagation();
          setDropPos(null);
          onDropBefore();
        }}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-pressed={isSelected}
        className={`group flex w-full items-center gap-2 rounded-md border bg-card px-2.5 py-2 text-left text-xs transition-colors hover:border-primary/40 ${
          isSelected ? 'border-primary ring-1 ring-primary' : 'border-border'
        } ${canEdit && !editing ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
        <Columns3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => {
              setEditing(false);
              const v = draft.trim();
              if (v && v !== colLabel(column, index)) onRename(v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setDraft(colLabel(column, index));
                setEditing(false);
              }
            }}
            className="flex-1 min-w-0 rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none focus:border-primary"
          />
        ) : (
          <span
            className="flex-1 min-w-0 truncate font-medium"
            onDoubleClick={(e) => {
              if (!canEdit) return;
              e.stopPropagation();
              setEditing(true);
            }}
          >
            {colLabel(column, index)}
          </span>
        )}
        {field && field !== colLabel(column, index) && (
          <code className="text-[10px] text-muted-foreground truncate max-w-[8rem]">{field}</code>
        )}
        {canEdit && hover && !editing && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remove column"
          >
            <Trash2 className="h-3 w-3" />
          </span>
        )}
      </button>
    </div>
  );
}
