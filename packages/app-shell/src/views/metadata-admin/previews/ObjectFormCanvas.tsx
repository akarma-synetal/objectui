// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectFormCanvas — form-designer-style preview for an Object
 * metadata draft. Replaces the legacy CRUD grid in DesignerMode.
 *
 * Each field renders as the labeled input it will become at runtime
 * (via {@link FieldStub}). Clicking a row selects it and the host
 * swaps the inspector to {@link ObjectFieldInspector}. The trailing
 * "+ Add field" button opens a categorized type picker — picking a
 * type appends a fresh field and immediately selects it so authors
 * can fill in name/label in the inspector.
 *
 * All edits go through the host's `onPatch` callback. Read-only
 * surfaces (legacy tier objects, builtin objects) still render the
 * preview but suppress selection chrome + the add button.
 */

import * as React from 'react';
import {
  Badge,
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@object-ui/components';
import { Plus } from 'lucide-react';
import type { MetadataSelection } from '../preview-registry';
import {
  readFields,
  writeFields,
  newField,
  toFieldName,
  groupEntries,
  type FieldEntry,
} from './object-fields-io';
import {
  FIELD_TYPE_META,
  TYPES_BY_CATEGORY,
  CATEGORY_LABEL_EN,
  type FieldTypeId,
} from './field-types';
import { FieldStub } from './FieldStub';

export interface ObjectFormCanvasProps {
  objectName: string;
  draft: Record<string, unknown>;
  onPatch?: (patch: Record<string, unknown>) => void;
  selection?: MetadataSelection | null;
  onSelectionChange?: (next: MetadataSelection | null) => void;
}

export function ObjectFormCanvas({
  objectName,
  draft,
  onPatch,
  selection,
  onSelectionChange,
}: ObjectFormCanvasProps) {
  const readOnly = !onPatch;

  const view = React.useMemo(() => readFields((draft as any).fields), [draft]);
  const fieldGroups = Array.isArray((draft as any).fieldGroups)
    ? ((draft as any).fieldGroups as Array<{ key?: string; label?: string }>)
    : undefined;
  const groups = React.useMemo(() => groupEntries(view, fieldGroups), [view, fieldGroups]);

  const selectedName = selection?.kind === 'field' ? String(selection.id) : null;

  const selectField = React.useCallback(
    (entry: FieldEntry) => {
      if (!onSelectionChange) return;
      onSelectionChange({
        kind: 'field',
        id: entry.name,
        label: typeof entry.def.label === 'string' ? (entry.def.label as string) : entry.name,
      });
    },
    [onSelectionChange],
  );

  const addField = React.useCallback(
    (type: FieldTypeId) => {
      if (!onPatch) return;
      const existing = view.entries.map((e) => e.name);
      const base = type === 'select' ? 'status' : type;
      let i = 1;
      let name = base;
      while (existing.includes(name)) {
        i += 1;
        name = `${base}_${i}`;
      }
      const entry = newField(name, type);
      const next = { shape: view.shape, entries: [...view.entries, entry] };
      onPatch({ fields: writeFields(next) });
      onSelectionChange?.({
        kind: 'field',
        id: name,
        label: String(entry.def.label ?? name),
      });
    },
    [onPatch, onSelectionChange, view],
  );

  // Click anywhere on the empty canvas background to clear selection.
  const handleBgClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && selectedName) {
        onSelectionChange?.(null);
      }
    },
    [onSelectionChange, selectedName],
  );

  const emptyState = view.entries.length === 0;

  return (
    <div
      className="h-full overflow-auto bg-muted/20"
      onClick={handleBgClick}
      data-object-name={objectName}
    >
      <div className="mx-auto max-w-3xl px-6 py-6 space-y-6" onClick={handleBgClick}>
        {emptyState ? (
          <EmptyCanvas onAdd={readOnly ? undefined : addField} />
        ) : (
          groups.map((g) => (
            <GroupSection key={g.key ?? '__ungrouped__'} label={g.label} showHeader={groups.length > 1}>
              {g.entries.map((entry) => (
                <FieldRow
                  key={entry.name}
                  entry={entry}
                  selected={entry.name === selectedName}
                  readOnly={readOnly}
                  onClick={() => selectField(entry)}
                />
              ))}
            </GroupSection>
          ))
        )}

        {!emptyState && !readOnly && (
          <div className="pt-1">
            <AddFieldButton onPick={addField} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Building blocks ─────────────── */

function GroupSection({
  label,
  showHeader,
  children,
}: {
  label: string;
  showHeader: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      {showHeader && (
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground pl-1">
          {label}
        </div>
      )}
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function FieldRow({
  entry,
  selected,
  readOnly,
  onClick,
}: {
  entry: FieldEntry;
  selected: boolean;
  readOnly: boolean;
  onClick: () => void;
}) {
  const def = entry.def;
  const typeStr = typeof def.type === 'string' ? (def.type as string) : 'text';
  const meta = FIELD_TYPE_META[typeStr as FieldTypeId];
  const Icon = meta?.Icon;
  const label = typeof def.label === 'string' ? (def.label as string) : entry.name;
  const required = !!def.required;
  const description = typeof def.description === 'string' ? (def.description as string) : null;
  const options = Array.isArray(def.options)
    ? (def.options as Array<{ value?: unknown; label?: unknown }>).map((o) => ({
        value: String(o.value ?? ''),
        label: typeof o.label === 'string' ? o.label : undefined,
      }))
    : undefined;
  const referenceTo = typeof def.reference === 'string' ? (def.reference as string) : undefined;
  const formula = typeof def.formula === 'string' ? (def.formula as string) : undefined;
  const placeholder = typeof def.placeholder === 'string' ? (def.placeholder as string) : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full text-left rounded-md border bg-card px-3.5 py-2.5 transition-colors',
        'hover:border-primary/40 hover:bg-card',
        selected ? 'border-primary ring-2 ring-primary/30 shadow-sm' : 'border-border',
        readOnly && 'cursor-default',
      )}
      aria-pressed={selected}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <span className="text-sm font-medium truncate">{label}</span>
          {required && <span className="text-destructive text-sm">*</span>}
          <code className="text-[10px] text-muted-foreground/70 font-mono truncate">{entry.name}</code>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {meta?.label ?? typeStr}
        </Badge>
      </div>
      {description && (
        <div className="text-[11px] text-muted-foreground mb-1.5 line-clamp-1">{description}</div>
      )}
      <FieldStub
        type={typeStr}
        label={label}
        placeholder={placeholder}
        options={options}
        referenceTo={referenceTo}
        formula={formula}
      />
    </button>
  );
}

function EmptyCanvas({ onAdd }: { onAdd?: (type: FieldTypeId) => void }) {
  return (
    <div className="rounded-lg border-2 border-dashed bg-background py-16 px-6 text-center space-y-3">
      <div className="text-sm font-medium">No fields yet</div>
      <div className="text-xs text-muted-foreground">
        Add a field to start designing the form. Click any field to edit its properties on the right.
      </div>
      {onAdd && (
        <div className="pt-2">
          <AddFieldButton onPick={onAdd} />
        </div>
      )}
    </div>
  );
}

function AddFieldButton({ onPick }: { onPick: (type: FieldTypeId) => void }) {
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState('');
  const q = filter.trim().toLowerCase();

  const groups = React.useMemo(() => {
    if (!q) return TYPES_BY_CATEGORY;
    return TYPES_BY_CATEGORY
      .map((g) => ({
        category: g.category,
        types: g.types.filter((id) => {
          const m = FIELD_TYPE_META[id];
          return id.includes(q) || m.label.toLowerCase().includes(q) || m.labelZh.includes(filter.trim());
        }),
      }))
      .filter((g) => g.types.length > 0);
  }, [q, filter]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setFilter('');
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-dashed">
          <Plus className="h-3.5 w-3.5" />
          Add field
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0 max-h-[480px] overflow-hidden flex flex-col">
        <div className="p-2 border-b">
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search field type…"
            className="h-7 w-full px-2 text-sm border rounded bg-background outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex-1 overflow-auto p-1">
          {groups.length === 0 ? (
            <div className="text-xs text-muted-foreground p-4 text-center">No matching types.</div>
          ) : (
            groups.map((g) => (
              <div key={g.category} className="mb-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-2 pb-1">
                  {CATEGORY_LABEL_EN[g.category]}
                </div>
                <div className="grid grid-cols-2 gap-0.5">
                  {g.types.map((id) => {
                    const m = FIELD_TYPE_META[id];
                    const Icon = m.Icon;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          onPick(id);
                          setOpen(false);
                          setFilter('');
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs hover:bg-accent"
                      >
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Internal helper for callers that want to normalize a name in their own UI.
export { toFieldName };
