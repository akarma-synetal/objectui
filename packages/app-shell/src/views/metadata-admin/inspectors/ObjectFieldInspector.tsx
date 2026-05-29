// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectFieldInspector — scoped editor for the selected Object field.
 *
 * Selection shape:  { kind: 'field', id: '<field_name>' }
 *
 * The inspector edits one field at a time. Sections:
 *   • Basic     — name (rename), label, type, required, unique, description
 *   • Specific  — picklist options / lookup target / formula / numeric
 *                 precision / max length, conditional on type
 *   • Advanced  — readonly, hidden, indexed, externalId, group
 *
 * All edits are applied as immutable splices of `draft.fields` via
 * the object-fields-io helpers, preserving the original array-vs-record
 * shape AND any unknown keys on the field definition.
 *
 * Rename: changing the `name` rewrites the field's key in-place and
 * re-issues the selection so the inspector stays bound to the same
 * field. Other fields/options that reference the old name are NOT
 * auto-rewritten — callers should re-validate downstream.
 */

import * as React from 'react';
import type { MetadataInspectorProps } from '../inspector-registry';
import { MetadataClient } from '@object-ui/data-objectstack';
import { useMetadataClient } from '../useMetadata';
import {
  InspectorShell,
  InspectorReorderButtons,
  InspectorTextField,
  InspectorNumberField,
  InspectorSelectField,
  InspectorCheckboxField,
  InspectorRemoveButton,
  InspectorEmptyState,
  moveArray,
} from './_shared';
import { Button, Input, Label, Badge } from '@object-ui/components';
import { Plus, X, ArrowUp, ArrowDown } from 'lucide-react';
import {
  readFields,
  writeFields,
  toFieldName,
  indexOfField,
  type FieldsView,
  type FieldEntry,
} from '../previews/object-fields-io';
import {
  FIELD_TYPE_META,
  TYPES_BY_CATEGORY,
  CATEGORY_LABEL_EN,
  type FieldTypeId,
} from '../previews/field-types';

interface Option {
  value: string;
  label?: string;
  color?: string;
}

/* ─────────────── Helpers ─────────────── */

function readOptions(def: Record<string, unknown>): Option[] {
  const raw = def.options;
  if (!Array.isArray(raw)) return [];
  return raw.map((o: any) => ({
    value: String(o?.value ?? ''),
    label: typeof o?.label === 'string' ? o.label : undefined,
    color: typeof o?.color === 'string' ? o.color : undefined,
  }));
}

function isPicklist(type: string): boolean {
  return type === 'select' || type === 'multiselect' || type === 'radio' || type === 'checkboxes';
}

function isLookup(type: string): boolean {
  return type === 'lookup' || type === 'master_detail' || type === 'tree';
}

function isComputed(type: string): boolean {
  return type === 'formula' || type === 'summary';
}

function isNumeric(type: string): boolean {
  return type === 'number' || type === 'currency' || type === 'percent';
}

function isTexty(type: string): boolean {
  return type === 'text' || type === 'textarea' || type === 'email' || type === 'url' || type === 'phone' || type === 'password';
}

const TYPE_OPTIONS = TYPES_BY_CATEGORY.flatMap((g) =>
  g.types.map((id) => ({
    value: id,
    label: `${CATEGORY_LABEL_EN[g.category]} · ${FIELD_TYPE_META[id].label}`,
  })),
);

/* ─────────────── Inspector ─────────────── */

export function ObjectFieldInspector({
  selection,
  draft,
  onPatch,
  onClearSelection,
  onSelectionChange,
  readOnly,
}: MetadataInspectorProps) {
  const view: FieldsView = React.useMemo(() => readFields((draft as any).fields), [draft]);
  const name = String(selection.id);
  const idx = indexOfField(view, name);
  const entry = idx >= 0 ? view.entries[idx] : null;

  const fieldGroups = Array.isArray((draft as any).fieldGroups)
    ? ((draft as any).fieldGroups as Array<{ key?: string; label?: string }>)
    : [];

  const objectOptions = useObjectOptions();

  if (!entry) {
    return (
      <InspectorShell kindLabel="Field" title={name || 'Field'} onClose={onClearSelection}>
        <InspectorEmptyState message="This field no longer exists in the draft." />
      </InspectorShell>
    );
  }

  const def = entry.def;
  const type = (typeof def.type === 'string' ? def.type : 'text') as FieldTypeId;
  const typeMeta = FIELD_TYPE_META[type];

  /* ─── Patch helpers ─── */

  const writeView = (next: FieldsView) => {
    onPatch({ fields: writeFields(next) });
  };

  const patchDef = (patch: Record<string, unknown>) => {
    const nextEntries = [...view.entries];
    nextEntries[idx] = { ...entry, def: { ...def, ...patch } };
    writeView({ shape: view.shape, entries: nextEntries });
  };

  const setKey = (rawNext: string) => {
    const nextName = toFieldName(rawNext);
    if (!nextName || nextName === entry.name) return;
    // Disallow collision
    if (view.entries.some((e, i) => i !== idx && e.name === nextName)) return;
    const nextEntries = [...view.entries];
    nextEntries[idx] = { ...entry, name: nextName };
    writeView({ shape: view.shape, entries: nextEntries });
    onSelectionChange?.({ kind: 'field', id: nextName, label: String(def.label ?? nextName) });
  };

  const removeField = () => {
    const nextEntries = view.entries.filter((_, i) => i !== idx);
    writeView({ shape: view.shape, entries: nextEntries });
    onClearSelection();
  };

  const moveTo = (toIndex: number) => {
    const next = { shape: view.shape, entries: moveArray(view.entries, idx, toIndex) };
    writeView(next);
    // Keep selection on the moved field (its name is unchanged).
  };

  /* ─── Option editor ─── */

  const options = readOptions(def);
  const patchOptions = (next: Option[]) => {
    const clean = next.map((o) => {
      const out: Option = { value: o.value };
      if (o.label) out.label = o.label;
      if (o.color) out.color = o.color;
      return out;
    });
    patchDef({ options: clean });
  };

  /* ─── Render ─── */

  const headerActions = (
    <InspectorReorderButtons
      index={idx}
      total={view.entries.length}
      onMove={moveTo}
      disabled={readOnly}
    />
  );

  const footer = (
    <InspectorRemoveButton
      label={`Remove “${(typeof def.label === 'string' ? def.label : entry.name)}”`}
      onClick={removeField}
      disabled={readOnly}
    />
  );

  return (
    <InspectorShell
      kindLabel="Field"
      title={typeof def.label === 'string' && def.label ? (def.label as string) : entry.name}
      onClose={onClearSelection}
      headerActions={headerActions}
      footer={footer}
    >
      {/* Basic */}
      <Section title="Basic">
        <InspectorTextField
          label="API name"
          value={entry.name}
          onCommit={setKey}
          disabled={readOnly}
          mono
        />
        <InspectorTextField
          label="Label"
          value={typeof def.label === 'string' ? (def.label as string) : ''}
          onCommit={(v) => patchDef({ label: v })}
          disabled={readOnly}
        />
        <InspectorSelectField
          label="Type"
          value={type}
          options={TYPE_OPTIONS}
          onCommit={(v) => patchDef({ type: v })}
          disabled={readOnly}
        />
        <div className="flex items-center gap-4 pt-1">
          <InspectorCheckboxField
            label="Required"
            value={!!def.required}
            onCommit={(v) => patchDef({ required: v || undefined })}
            disabled={readOnly}
          />
          <InspectorCheckboxField
            label="Unique"
            value={!!def.unique}
            onCommit={(v) => patchDef({ unique: v || undefined })}
            disabled={readOnly}
          />
        </div>
        <TextareaField
          label="Description"
          value={typeof def.description === 'string' ? (def.description as string) : ''}
          onCommit={(v) => patchDef({ description: v || undefined })}
          disabled={readOnly}
          rows={2}
        />
      </Section>

      {/* Type-specific */}
      {(isPicklist(type) || isLookup(type) || isComputed(type) || isNumeric(type) || isTexty(type)) && (
        <Section title={`${typeMeta?.label ?? type} options`}>
          {isPicklist(type) && (
            <OptionsEditor
              options={options}
              onChange={patchOptions}
              disabled={readOnly}
            />
          )}
          {isLookup(type) && (
            <>
              <ObjectPicker
                label="Related object"
                value={typeof def.reference === 'string' ? (def.reference as string) : ''}
                options={objectOptions}
                onCommit={(v) => patchDef({ reference: v || undefined })}
                disabled={readOnly}
              />
              <InspectorTextField
                label="Relationship name"
                value={typeof def.relationshipName === 'string' ? (def.relationshipName as string) : ''}
                onCommit={(v) => patchDef({ relationshipName: v || undefined })}
                disabled={readOnly}
                placeholder="Inverse collection key on the parent"
              />
            </>
          )}
          {isComputed(type) && (
            <TextareaField
              label="Formula (CEL)"
              value={typeof def.formula === 'string' ? (def.formula as string) : ''}
              onCommit={(v) => patchDef({ formula: v || undefined })}
              disabled={readOnly}
              rows={4}
              mono
              placeholder="record.amount * 0.2"
            />
          )}
          {isNumeric(type) && (
            <div className="grid grid-cols-2 gap-2">
              <InspectorNumberField
                label="Precision"
                value={typeof def.precision === 'number' ? (def.precision as number) : undefined}
                onCommit={(v) => patchDef({ precision: v })}
                disabled={readOnly}
              />
              <InspectorNumberField
                label="Scale"
                value={typeof def.scale === 'number' ? (def.scale as number) : undefined}
                onCommit={(v) => patchDef({ scale: v })}
                disabled={readOnly}
              />
              <InspectorNumberField
                label="Min"
                value={typeof def.min === 'number' ? (def.min as number) : undefined}
                onCommit={(v) => patchDef({ min: v })}
                disabled={readOnly}
              />
              <InspectorNumberField
                label="Max"
                value={typeof def.max === 'number' ? (def.max as number) : undefined}
                onCommit={(v) => patchDef({ max: v })}
                disabled={readOnly}
              />
            </div>
          )}
          {isTexty(type) && (
            <InspectorNumberField
              label="Max length"
              value={typeof def.maxLength === 'number' ? (def.maxLength as number) : undefined}
              onCommit={(v) => patchDef({ maxLength: v })}
              disabled={readOnly}
              placeholder="255"
            />
          )}
        </Section>
      )}

      {/* Advanced */}
      <Section title="Advanced">
        <div className="grid grid-cols-2 gap-2">
          <InspectorCheckboxField
            label="Read-only"
            value={!!def.readonly}
            onCommit={(v) => patchDef({ readonly: v || undefined })}
            disabled={readOnly}
          />
          <InspectorCheckboxField
            label="Hidden"
            value={!!def.hidden}
            onCommit={(v) => patchDef({ hidden: v || undefined })}
            disabled={readOnly}
          />
          <InspectorCheckboxField
            label="Indexed"
            value={!!def.indexed}
            onCommit={(v) => patchDef({ indexed: v || undefined })}
            disabled={readOnly}
          />
          <InspectorCheckboxField
            label="External ID"
            value={!!def.externalId}
            onCommit={(v) => patchDef({ externalId: v || undefined })}
            disabled={readOnly}
          />
          <InspectorCheckboxField
            label="Track history"
            value={!!def.trackHistory}
            onCommit={(v) => patchDef({ trackHistory: v || undefined })}
            disabled={readOnly}
          />
        </div>
        <InspectorTextField
          label="Placeholder"
          value={typeof def.placeholder === 'string' ? (def.placeholder as string) : ''}
          onCommit={(v) => patchDef({ placeholder: v || undefined })}
          disabled={readOnly}
        />
        {fieldGroups.length > 0 && (
          <InspectorSelectField
            label="Group"
            value={typeof def.group === 'string' ? (def.group as string) : ''}
            options={[
              { value: '', label: '— No group —' },
              ...fieldGroups
                .filter((g) => typeof g.key === 'string')
                .map((g) => ({ value: g.key as string, label: String(g.label ?? g.key) })),
            ]}
            onCommit={(v) => patchDef({ group: v || undefined })}
            disabled={readOnly}
          />
        )}
      </Section>
    </InspectorShell>
  );
}

/* ─────────────── Sub-components ─────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onCommit,
  disabled,
  rows = 2,
  mono,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  disabled?: boolean;
  rows?: number;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <textarea
        value={value}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onCommit(e.target.value)}
        className={
          'w-full text-sm rounded-md border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary ' +
          (mono ? 'font-mono text-xs ' : '')
        }
      />
    </div>
  );
}

function ObjectPicker({
  label,
  value,
  options,
  onCommit,
  disabled,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onCommit: (v: string) => void;
  disabled?: boolean;
}) {
  // List may be empty (still loading or no objects). Allow free-text fallback.
  const listId = React.useId();
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        list={listId}
        value={value}
        onChange={(e) => onCommit(e.target.value)}
        disabled={disabled}
        className="h-8 text-sm font-mono"
        placeholder="object_name"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </datalist>
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
  disabled,
}: {
  options: Option[];
  onChange: (next: Option[]) => void;
  disabled?: boolean;
}) {
  const update = (i: number, patch: Partial<Option>) => {
    const next = [...options];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(options.filter((_, j) => j !== i));
  const move = (i: number, to: number) => onChange(moveArray(options, i, to));
  const add = () => onChange([...options, { value: '', label: '' }]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Picklist values</Label>
        <Badge variant="outline" className="text-[10px]">{options.length}</Badge>
      </div>
      {options.length === 0 ? (
        <div className="text-[11px] italic text-muted-foreground px-1">No values yet.</div>
      ) : (
        <div className="space-y-1">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                value={o.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="value"
                disabled={disabled}
                className="h-7 text-xs font-mono flex-1"
              />
              <Input
                value={o.label ?? ''}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Label"
                disabled={disabled}
                className="h-7 text-xs flex-1"
              />
              <input
                type="color"
                value={o.color ?? '#cccccc'}
                onChange={(e) => update(i, { color: e.target.value })}
                disabled={disabled}
                className="h-7 w-7 rounded border bg-background cursor-pointer p-0.5"
                title="Color"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => move(i, i - 1)}
                disabled={disabled || i === 0}
                aria-label="Move up"
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => move(i, i + 1)}
                disabled={disabled || i === options.length - 1}
                aria-label="Move down"
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive"
                onClick={() => remove(i)}
                disabled={disabled}
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {!disabled && (
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}>
          <Plus className="h-3 w-3" />
          Add value
        </Button>
      )}
    </div>
  );
}

/* ─────────────── Hook: load object list for lookup picker ─────────────── */

function useObjectOptions(): Array<{ value: string; label: string }> {
  const client: MetadataClient = useMetadataClient();
  const [opts, setOpts] = React.useState<Array<{ value: string; label: string }>>([]);

  React.useEffect(() => {
    let cancelled = false;
    client
      .list<{ name?: string; label?: string }>('object')
      .then((items) => {
        if (cancelled) return;
        const mapped = items
          .filter((i) => typeof i?.name === 'string' && i.name)
          .map((i) => ({
            value: i.name as string,
            label: i.label ? `${i.label} (${i.name})` : (i.name as string),
          }))
          .sort((a, b) => a.value.localeCompare(b.value));
        setOpts(mapped);
      })
      .catch(() => {
        // Empty list — picker falls back to free-text. No banner needed.
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return opts;
}
