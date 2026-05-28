// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FieldsTable — Airtable-style schema-as-table editor.
 *
 * Renders each field of an object as a TABLE COLUMN, with sample rows
 * underneath. When the host enables edit mode, authors can:
 *
 *   • Click a column header to rename / change type / toggle required.
 *   • Drag a column header (HTML5 DnD) to reorder fields.
 *   • Click "+" at the trailing column to add a new field.
 *   • Open the column menu (chevron) to delete a field.
 *
 * Edits are emitted as a `{ fields: ... }` patch on `onPatch`. The host
 * (`ResourceEditPage`) folds the patch into the draft, so the Form tab
 * and FieldsTable stay in sync.
 *
 * Read-only mode hides every editing affordance — what authors see is
 * the same column layout they'll get in a runtime grid view, plus a few
 * sample rows so the column widths feel real.
 */

import * as React from 'react';
import {
  ChevronDown,
  GripVertical,
  KeyRound,
  Lock,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Switch,
  LazyIcon,
} from '@object-ui/components';
import { fieldTypeMeta, FIELD_GROUPS, FIELD_TYPES, type FieldGroup } from './field-meta';

/** Minimum width per column to keep the grid usable. */
const MIN_COL = 140;
const DEFAULT_COL = 180;

interface FieldDef {
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  unique?: boolean;
  description?: string;
  defaultValue?: unknown;
  [k: string]: unknown;
}

export interface FieldsTableProps {
  /** Ordered list of fields parsed from the draft. */
  fields: Array<{ name: string; def: FieldDef }>;
  /** Optional sample/live rows to render under the header. */
  sampleRows: Record<string, unknown>[];
  /** Whether editing affordances are enabled. */
  editing: boolean;
  /** Emit a new ordered fields record (key → def) to the host. */
  onFieldsChange?: (next: Record<string, FieldDef>) => void;
}

export function FieldsTable({
  fields,
  sampleRows,
  editing,
  onFieldsChange,
}: FieldsTableProps) {
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);
  const [overIdx, setOverIdx] = React.useState<number | null>(null);
  const [openIdx, setOpenIdx] = React.useState<number | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  function emit(next: Array<{ name: string; def: FieldDef }>) {
    if (!onFieldsChange) return;
    const out: Record<string, FieldDef> = {};
    for (const f of next) {
      if (!f.name) continue;
      out[f.name] = { ...f.def, name: f.name };
    }
    onFieldsChange(out);
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= fields.length || to >= fields.length) return;
    const next = fields.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    emit(next);
  }

  function updateField(idx: number, patch: Partial<FieldDef> & { name?: string }) {
    const next = fields.slice();
    const cur = next[idx];
    const renamed = patch.name && patch.name !== cur.name ? patch.name : cur.name;
    next[idx] = { name: renamed, def: { ...cur.def, ...patch, name: renamed } };
    emit(next);
  }

  function removeField(idx: number) {
    const next = fields.slice();
    next.splice(idx, 1);
    emit(next);
  }

  function addField(def: FieldDef & { name: string }) {
    const next = fields.slice();
    next.push({ name: def.name, def });
    emit(next);
  }

  // Build the body rows — sample rows or synthetic placeholders so the
  // table doesn't collapse to a header-only sliver.
  const bodyRows = React.useMemo(() => {
    if (sampleRows.length > 0) return sampleRows.slice(0, 5);
    return [{}, {}, {}];
  }, [sampleRows]);

  return (
    <div className="overflow-auto rounded-md border bg-background">
      <table className="border-collapse text-xs" style={{ minWidth: 'max-content' }}>
        <thead>
          <tr>
            {/* Row-number gutter */}
            <th
              className="sticky left-0 z-10 bg-muted/60 border-b border-r text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-1.5"
              style={{ width: 36, minWidth: 36 }}
            >
              #
            </th>
            {fields.map((f, idx) => (
              <ColumnHeader
                key={f.name + idx}
                idx={idx}
                field={f}
                editing={editing}
                isDragOver={overIdx === idx && dragIdx !== null && dragIdx !== idx}
                isDragging={dragIdx === idx}
                open={openIdx === idx}
                setOpen={(o) => setOpenIdx(o ? idx : null)}
                onDragStart={() => setDragIdx(idx)}
                onDragEnter={() => setOverIdx(idx)}
                onDragEnd={() => {
                  if (dragIdx != null && overIdx != null) reorder(dragIdx, overIdx);
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                onUpdate={(p) => updateField(idx, p)}
                onRemove={() => removeField(idx)}
              />
            ))}
            {/* Trailing "+" add column */}
            {editing && onFieldsChange && (
              <th
                className="border-b border-l-0 bg-muted/20 px-1 py-1"
                style={{ width: 44, minWidth: 44 }}
              >
                <AddFieldButton
                  open={addOpen}
                  setOpen={setAddOpen}
                  existingNames={new Set(fields.map((f) => f.name))}
                  onAdd={(def) => {
                    addField(def);
                    setAddOpen(false);
                  }}
                />
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rIdx) => (
            <tr key={rIdx} className="odd:bg-background even:bg-muted/10 hover:bg-muted/30">
              <td
                className="sticky left-0 z-10 odd:bg-background even:bg-muted/10 hover:bg-muted/30 border-b border-r text-center text-[10px] text-muted-foreground px-2 py-1.5"
                style={{ width: 36, minWidth: 36 }}
              >
                {rIdx + 1}
              </td>
              {fields.map((f) => (
                <SampleCell
                  key={f.name}
                  field={f}
                  value={(row as Record<string, unknown>)[f.name]}
                />
              ))}
              {editing && onFieldsChange && (
                <td className="border-b border-l-0 bg-muted/5" style={{ width: 44 }} />
              )}
            </tr>
          ))}
          {/* Add-row sentinel (visual only — Airtable parity) */}
          <tr>
            <td
              className="sticky left-0 z-10 bg-muted/30 border-r text-center text-muted-foreground px-2 py-1"
              style={{ width: 36, minWidth: 36 }}
            >
              <Plus className="inline h-3 w-3" />
            </td>
            <td
              colSpan={fields.length + (editing && onFieldsChange ? 1 : 0)}
              className="bg-muted/10 text-[10px] text-muted-foreground italic px-2 py-1"
            >
              + Add record (preview — runtime rows are managed in the Data view)
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================== */
/*  Column header                                                  */
/* ============================================================== */

interface ColumnHeaderProps {
  idx: number;
  field: { name: string; def: FieldDef };
  editing: boolean;
  isDragOver: boolean;
  isDragging: boolean;
  open: boolean;
  setOpen: (o: boolean) => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onUpdate: (p: Partial<FieldDef> & { name?: string }) => void;
  onRemove: () => void;
}

function ColumnHeader({
  field,
  editing,
  isDragOver,
  isDragging,
  open,
  setOpen,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onUpdate,
  onRemove,
}: ColumnHeaderProps) {
  const meta = fieldTypeMeta(field.def.type);
  const label = field.def.label || field.name;
  const isPk = field.name === 'id' || field.def.type === 'autonumber';

  return (
    <th
      className={[
        'group relative border-b border-r bg-muted/40 px-0 py-0 text-left align-bottom',
        isDragOver ? 'ring-2 ring-inset ring-sky-400' : '',
        isDragging ? 'opacity-40' : '',
      ].join(' ')}
      style={{ width: DEFAULT_COL, minWidth: MIN_COL }}
      draggable={editing && !isPk}
      onDragStart={(e) => {
        if (!editing || isPk) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', field.name);
        onDragStart();
      }}
      onDragOver={(e) => {
        if (!editing) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragEnter={onDragEnter}
      onDrop={(e) => {
        if (!editing) return;
        e.preventDefault();
        onDragEnd();
      }}
      onDragEnd={onDragEnd}
    >
      <Popover open={editing && open} onOpenChange={(o) => setOpen(o)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left disabled:cursor-default hover:bg-muted/60 transition-colors"
            disabled={!editing}
          >
            {editing && !isPk && (
              <GripVertical
                className="h-3 w-3 text-muted-foreground/60 cursor-grab active:cursor-grabbing shrink-0"
                aria-hidden
              />
            )}
            <LazyIcon
              name={meta.icon as any}
              className="h-3.5 w-3.5 text-muted-foreground shrink-0"
            />
            <span className="font-medium truncate flex-1">{label}</span>
            {field.def.required && (
              <span className="text-rose-500 text-[10px]" title="Required">*</span>
            )}
            {isPk && <KeyRound className="h-3 w-3 text-amber-600 shrink-0" />}
            {!editing && field.name === 'id' && <Lock className="h-3 w-3 text-muted-foreground" />}
            {editing && <ChevronDown className="h-3 w-3 text-muted-foreground/60 shrink-0" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <FieldEditor
            field={field}
            onUpdate={(p) => onUpdate(p)}
            onRemove={() => {
              setOpen(false);
              onRemove();
            }}
            onClose={() => setOpen(false)}
            isPk={isPk}
          />
        </PopoverContent>
      </Popover>
      {/* Type/name sub-line */}
      <div className="border-t border-border/60 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground flex items-center gap-1.5">
        <span className="uppercase tracking-wider">{meta.label}</span>
        <span className="font-mono opacity-70 truncate">{field.name}</span>
      </div>
    </th>
  );
}

/* ============================================================== */
/*  Field editor popover                                           */
/* ============================================================== */

function FieldEditor({
  field,
  onUpdate,
  onRemove,
  onClose,
  isPk,
}: {
  field: { name: string; def: FieldDef };
  onUpdate: (p: Partial<FieldDef> & { name?: string }) => void;
  onRemove: () => void;
  onClose: () => void;
  isPk: boolean;
}) {
  const [name, setName] = React.useState(field.name);
  const [label, setLabel] = React.useState(field.def.label ?? '');
  const [type, setType] = React.useState(field.def.type ?? 'text');
  const [required, setRequired] = React.useState(!!field.def.required);
  const [description, setDescription] = React.useState(field.def.description ?? '');
  const validName = /^[a-z_][a-z0-9_]*$/.test(name);

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="font-medium">Edit field</div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Display label
          </Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-7 text-xs"
            placeholder={field.name}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Machine name (snake_case)
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-xs font-mono"
            disabled={isPk}
          />
          {!validName && (
            <div className="text-[10px] text-rose-600">Must match /^[a-z_][a-z0-9_]*$/</div>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Type
          </Label>
          <FieldTypeSelect value={type} onChange={setType} disabled={isPk} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Description (help text)
          </Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Label htmlFor="fld-required" className="text-xs">Required</Label>
          <Switch
            id="fld-required"
            checked={required}
            onCheckedChange={setRequired}
            disabled={isPk}
          />
        </div>
      </div>
      <div className="flex items-center justify-between border-t px-3 py-2 bg-muted/20">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
          onClick={onRemove}
          disabled={isPk}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!validName}
            onClick={() => {
              onUpdate({ name, label, type, required, description });
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================== */
/*  Add field button                                               */
/* ============================================================== */

function AddFieldButton({
  open,
  setOpen,
  existingNames,
  onAdd,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
  existingNames: Set<string>;
  onAdd: (def: FieldDef & { name: string }) => void;
}) {
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 w-full items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Add field"
          title="Add field"
        >
          <Plus className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <AddFieldForm existingNames={existingNames} onAdd={onAdd} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function AddFieldForm({
  existingNames,
  onAdd,
  onClose,
}: {
  existingNames: Set<string>;
  onAdd: (def: FieldDef & { name: string }) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = React.useState('');
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('text');
  const [required, setRequired] = React.useState(false);
  const [touchedName, setTouchedName] = React.useState(false);

  // Auto-derive snake_case name from label until the user edits the
  // name manually.
  const derivedName = React.useMemo(() => slugify(label), [label]);
  const effectiveName = touchedName ? name : derivedName;
  const validName = /^[a-z_][a-z0-9_]*$/.test(effectiveName);
  const conflict = existingNames.has(effectiveName);
  const canSave = validName && !conflict && label.trim().length > 0;

  return (
    <div className="text-xs">
      <div className="border-b px-3 py-2 font-medium">Add field</div>
      <div className="p-3 space-y-2.5">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Display label
          </Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-7 text-xs"
            placeholder="e.g. Customer Name"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Machine name
          </Label>
          <Input
            value={effectiveName}
            onChange={(e) => {
              setTouchedName(true);
              setName(e.target.value);
            }}
            className="h-7 text-xs font-mono"
            placeholder="customer_name"
          />
          {effectiveName && !validName && (
            <div className="text-[10px] text-rose-600">Must match /^[a-z_][a-z0-9_]*$/</div>
          )}
          {conflict && (
            <div className="text-[10px] text-rose-600">A field named "{effectiveName}" already exists.</div>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Type
          </Label>
          <FieldTypeSelect value={type} onChange={setType} />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Label htmlFor="new-fld-required" className="text-xs">Required</Label>
          <Switch id="new-fld-required" checked={required} onCheckedChange={setRequired} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t px-3 py-2 bg-muted/20">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSave}
          onClick={() => {
            onAdd({ name: effectiveName, label: label.trim(), type, required });
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

/* ============================================================== */
/*  Field-type select grouped by category                          */
/* ============================================================== */

function FieldTypeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-7 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {FIELD_GROUPS.map((g) => {
          const items = FIELD_TYPES.filter((t) => t.group === g.id);
          if (items.length === 0) return null;
          return (
            <SelectGroup key={g.id}>
              <SelectLabel className="text-[10px] uppercase tracking-wider">{g.label}</SelectLabel>
              {items.map((t) => (
                <SelectItem key={t.type} value={t.type} className="text-xs">
                  <span className="inline-flex items-center gap-2">
                    <LazyIcon name={t.icon as any} className="h-3 w-3" />
                    {t.label}
                    <span className="font-mono opacity-50">{t.type}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/* ============================================================== */
/*  Cell renderer                                                  */
/* ============================================================== */

function SampleCell({
  field,
  value,
}: {
  field: { name: string; def: FieldDef };
  value: unknown;
}) {
  const meta = fieldTypeMeta(field.def.type);
  const display = renderValue(value, field.def.type) ?? (
    <span className="text-muted-foreground/40 italic">{meta.sample}</span>
  );
  return (
    <td
      className="border-b border-r px-2 py-1.5 align-top"
      style={{ width: DEFAULT_COL, minWidth: MIN_COL, maxWidth: 360 }}
    >
      <div className="truncate">{display}</div>
    </td>
  );
}

function renderValue(value: unknown, type?: string): React.ReactNode | null {
  if (value === undefined || value === null || value === '') return null;
  if (type === 'boolean' || type === 'toggle') {
    return value ? <span className="text-emerald-700">✓</span> : <span className="text-muted-foreground">○</span>;
  }
  if (type === 'url' && typeof value === 'string') {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="text-sky-600 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {value}
      </a>
    );
  }
  if (type === 'color' && typeof value === 'string') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-3 rounded border"
          style={{ backgroundColor: value }}
          aria-hidden
        />
        <span className="font-mono text-[11px]">{value}</span>
      </span>
    );
  }
  if (type === 'tags' && Array.isArray(value)) {
    return (
      <span className="inline-flex flex-wrap gap-1">
        {value.slice(0, 4).map((t, i) => (
          <span
            key={i}
            className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px]"
          >
            {String(t)}
          </span>
        ))}
      </span>
    );
  }
  if (type === 'select' && typeof value === 'string') {
    return (
      <span className="inline-block rounded bg-sky-100 px-1.5 py-0.5 text-[11px] text-sky-700">
        {value}
      </span>
    );
  }
  if (typeof value === 'object') {
    try {
      return <code className="font-mono text-[10px]">{JSON.stringify(value)}</code>;
    } catch {
      return String(value);
    }
  }
  return String(value);
}
