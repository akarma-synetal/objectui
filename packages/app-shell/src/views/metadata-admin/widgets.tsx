// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in widget renderers for SchemaForm.
 *
 * These cover the common widget hints declared in spec `*.form.ts`
 * files (e.g. `widget: 'ref:object'`, `widget: 'master-detail'`).
 *
 * Each widget receives `WidgetProps`:
 *   - schema     — the JSONSchema fragment for THIS field (so widgets
 *                  for nested arrays can read items.properties)
 *   - value      — the current value
 *   - onChange   — write-back callback
 *   - readOnly   — disable
 *   - context    — out-of-band data (object list, ObjectQL fields, …)
 *
 * To register a new widget, add an entry to `WIDGETS` below. To wire
 * extra context (e.g. a fields list), extend `WidgetContext` in
 * SchemaForm.tsx and prefetch it in ResourceEditPage.
 */

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Button,
  Label,
} from '@object-ui/components';
import { Plus, Trash2 } from 'lucide-react';

export interface WidgetContext {
  /** Names of all object metadata records (for `ref:object`). */
  objectNames?: string[];
  /** Loading flag for the object list. */
  objectsLoading?: boolean;
}

export interface WidgetProps {
  id?: string;
  schema: Record<string, any>;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
  context?: WidgetContext;
  /** Optional FormFieldSpec with type/options/reference/constraints */
  fieldSpec?: {
    field: string;
    type?: string;
    options?: Array<{ label: string; value: string; color?: string }>;
    reference?: string;
    maxLength?: number;
    minLength?: number;
    min?: number;
    max?: number;
    multiple?: boolean;
    dependsOn?: string | string[];  // NEW: field name(s) this widget depends on
  };
  /** All form data (for reading dependency values) */
  formData?: Record<string, unknown>;
}

export type WidgetRenderer = (props: WidgetProps) => React.ReactElement;

/* -------------------------------------------------------------------------- */
/* ref:object — pick an object by name                                        */
/* -------------------------------------------------------------------------- */

function RefObjectWidget({
  id,
  value,
  onChange,
  readOnly,
  context,
}: WidgetProps) {
  const names = context?.objectNames ?? [];
  const v = value == null ? '' : String(value);
  if (context?.objectsLoading) {
    return (
      <Input
        id={id}
        value={v}
        disabled
        placeholder="Loading objects…"
      />
    );
  }
  // If list is empty (e.g. no objects defined yet), fall back to a
  // freeform text input so the user can still type a value.
  if (names.length === 0) {
    return (
      <Input
        id={id}
        value={v}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder="object_name (no objects detected)"
      />
    );
  }
  return (
    <Select
      value={v}
      onValueChange={(next) => onChange(next || undefined)}
      disabled={readOnly}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder="Select object…" />
      </SelectTrigger>
      <SelectContent>
        {names.map((n) => (
          <SelectItem key={n} value={n}>
            {n}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* -------------------------------------------------------------------------- */
/* object-selector — multi-select object picker                               */
/* -------------------------------------------------------------------------- */

function ObjectSelectorWidget({
  id,
  value,
  onChange,
  readOnly,
  context,
  fieldSpec,
}: WidgetProps) {
  const names = context?.objectNames ?? [];
  const multiple = fieldSpec?.multiple ?? false;
  
  // Parse value: string[], string (comma-separated), or empty
  const selectedValues = React.useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    return String(value).split(',').map(s => s.trim()).filter(Boolean);
  }, [value]);

  const handleToggle = (objName: string) => {
    if (readOnly) return;
    
    if (!multiple) {
      onChange(objName);
      return;
    }

    const newSelection = selectedValues.includes(objName)
      ? selectedValues.filter(v => v !== objName)
      : [...selectedValues, objName];
    
    onChange(newSelection);
  };

  const handleRemove = (objName: string) => {
    if (readOnly) return;
    const newSelection = selectedValues.filter(v => v !== objName);
    onChange(multiple ? newSelection : '');
  };

  if (context?.objectsLoading) {
    return <Input id={id} value="Loading objects..." readOnly disabled />;
  }

  return (
    <div className="space-y-2">
      {/* Selected items */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedValues.map(obj => (
            <div
              key={obj}
              className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-sm"
            >
              <span>{obj}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemove(obj)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Object picker */}
      <Select
        value=""
        onValueChange={handleToggle}
        disabled={readOnly || names.length === 0}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={multiple ? "Add objects..." : "Select object..."} />
        </SelectTrigger>
        <SelectContent>
          {names.map(name => (
            <SelectItem key={name} value={name} disabled={!multiple && selectedValues.includes(name)}>
              {name}
              {selectedValues.includes(name) && ' ✓'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* field-selector — smart field picker (depends on selected object)          */
/* -------------------------------------------------------------------------- */

function FieldSelectorWidget({
  id,
  value,
  onChange,
  readOnly,
  context,
  fieldSpec,
  formData,
}: WidgetProps) {
  const [fields, setFields] = React.useState<Array<{ name: string; label: string; type: string }>>([]);
  const [loading, setLoading] = React.useState(false);
  
  // Resolve dependency: fieldSpec.dependsOn or fieldSpec.reference or 'objectName'
  const dependsOnField = fieldSpec?.dependsOn || fieldSpec?.reference || 'objectName';
  const objectName = formData?.[dependsOnField] as string | undefined;

  // Load fields when objectName changes
  React.useEffect(() => {
    if (!objectName) {
      setFields([]);
      return;
    }

    setLoading(true);
    fetch(`/api/v1/objects/${objectName}/fields`)
      .then(r => r.json())
      .then(data => {
        setFields(data.fields || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load fields:', err);
        setFields([]);
        setLoading(false);
      });
  }, [objectName]);

  const multiple = fieldSpec?.multiple ?? false;
  
  // Parse value
  const selectedValues = React.useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    return String(value).split(',').map(s => s.trim()).filter(Boolean);
  }, [value]);

  const handleToggle = (fieldName: string) => {
    if (readOnly) return;
    
    if (!multiple) {
      onChange(fieldName);
      return;
    }

    const newSelection = selectedValues.includes(fieldName)
      ? selectedValues.filter(v => v !== fieldName)
      : [...selectedValues, fieldName];
    
    onChange(newSelection);
  };

  const handleRemove = (fieldName: string) => {
    if (readOnly) return;
    const newSelection = selectedValues.filter(v => v !== fieldName);
    onChange(multiple ? newSelection : '');
  };

  if (!objectName) {
    return <Input id={id} value="(Select an object first)" readOnly disabled />;
  }

  if (loading) {
    return <Input id={id} value="Loading fields..." readOnly disabled />;
  }

  return (
    <div className="space-y-2">
      {/* Selected fields */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedValues.map(field => {
            const fieldMeta = fields.find(f => f.name === field);
            return (
              <div
                key={field}
                className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-sm"
              >
                <span>{fieldMeta?.label || field}</span>
                <code className="text-xs text-muted-foreground">{fieldMeta?.type}</code>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemove(field)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Field picker */}
      <Select
        value=""
        onValueChange={handleToggle}
        disabled={readOnly || fields.length === 0}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={multiple ? "Add fields..." : "Select field..."} />
        </SelectTrigger>
        <SelectContent>
          {fields.map(f => (
            <SelectItem key={f.name} value={f.name} disabled={!multiple && selectedValues.includes(f.name)}>
              <div className="flex items-center gap-2">
                <span>{f.label || f.name}</span>
                <code className="text-xs text-muted-foreground">{f.type}</code>
                {selectedValues.includes(f.name) && ' ✓'}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* master-detail — inline row editor for array-of-object fields               */
/* -------------------------------------------------------------------------- */

function MasterDetailWidget({
  schema,
  value,
  onChange,
  readOnly,
  context,
}: WidgetProps) {
  // Unwrap anyOf/oneOf: pick the first array-of-object branch.
  let resolved = schema as Record<string, any> | undefined;
  if (resolved?.anyOf || resolved?.oneOf) {
    const branches = (resolved.anyOf ?? resolved.oneOf) as any[];
    const objBranch = branches.find(
      (b) => b?.type === 'array' && b?.items?.type === 'object',
    );
    if (objBranch) resolved = { ...resolved, ...objBranch };
  }
  const items = (resolved?.items ?? {}) as Record<string, any>;
  const itemProps = (items.properties ?? {}) as Record<string, any>;
  const required = new Set<string>(
    Array.isArray(items.required) ? items.required : [],
  );
  const rows = Array.isArray(value) ? (value as any[]) : [];
  const cols = Object.keys(itemProps);

  if (cols.length === 0) {
    // Falls back to JSON if the array items aren't a typed object.
    return (
      <div className="rounded border border-dashed border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
        master-detail widget requires <code>items.properties</code> on the
        JSON schema (or an <code>anyOf</code> branch that has them).
      </div>
    );
  }

  function updateRow(idx: number, patch: Record<string, unknown>) {
    const next = rows.slice();
    next[idx] = { ...(next[idx] ?? {}), ...patch };
    onChange(next);
  }
  function addRow() {
    onChange([...rows, {}]);
  }
  function removeRow(idx: number) {
    const next = rows.slice();
    next.splice(idx, 1);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded border border-border/40">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground"
                >
                  {(itemProps[c]?.title as string) ?? c}
                  {required.has(c) && (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={cols.length + 1}
                  className="px-2 py-3 text-center text-xs text-muted-foreground"
                >
                  No rows. Click + to add.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={idx} className="border-t border-border/30">
                {cols.map((c) => (
                  <td key={c} className="p-1">
                    <RowCell
                      schema={itemProps[c]}
                      value={(row ?? {})[c]}
                      readOnly={readOnly}
                      context={context}
                      onChange={(v) => updateRow(idx, { [c]: v })}
                    />
                  </td>
                ))}
                <td className="p-1 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(idx)}
                    disabled={readOnly}
                    className="h-7 w-7 p-0"
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        disabled={readOnly}
      >
        <Plus className="h-3.5 w-3.5 mr-1" /> Add row
      </Button>
    </div>
  );
}

function RowCell({
  schema,
  value,
  readOnly,
  context,
  onChange,
}: {
  schema: Record<string, any>;
  value: unknown;
  readOnly?: boolean;
  context?: WidgetContext;
  onChange: (v: unknown) => void;
}) {
  // ref:object hint inside a row cell
  if (schema?.widget === 'ref:object') {
    return (
      <RefObjectWidget
        schema={schema}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        context={context}
      />
    );
  }
  // enum → dropdown
  const enumVals = schema?.enum as unknown[] | undefined;
  if (Array.isArray(enumVals) && enumVals.length > 0) {
    return (
      <Select
        value={value == null ? '' : String(value)}
        onValueChange={(v) => onChange(v || undefined)}
        disabled={readOnly}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {enumVals.map((o) => (
            <SelectItem key={String(o)} value={String(o)}>
              {String(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  // boolean → checkbox-ish
  if (schema?.type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    );
  }
  // number
  if (schema?.type === 'number' || schema?.type === 'integer') {
    return (
      <Input
        type="number"
        value={value == null ? '' : String(value)}
        disabled={readOnly}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        className="h-8 text-xs"
      />
    );
  }
  // default: text
  return (
    <Input
      value={value == null ? '' : String(value)}
      disabled={readOnly}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="h-8 text-xs"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* string-tags — chip input for string[] (e.g. searchableFields)              */
/* -------------------------------------------------------------------------- */

function StringTagsWidget({
  id,
  value,
  onChange,
  readOnly,
}: WidgetProps) {
  const tags = Array.isArray(value) ? (value as string[]) : [];
  const [draft, setDraft] = React.useState('');

  function add(raw: string) {
    const parts = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...tags];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setDraft('');
  }
  function remove(idx: number) {
    const next = tags.slice();
    next.splice(idx, 1);
    onChange(next);
  }

  return (
    <div className="rounded border border-input bg-background p-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {tags.map((t, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
          >
            <span className="font-mono">{t}</span>
            {!readOnly && (
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            )}
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          disabled={readOnly}
          placeholder={tags.length === 0 ? 'Type and press Enter…' : ''}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
              remove(tags.length - 1);
            }
          }}
          onBlur={() => draft && add(draft)}
          className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none"
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* object-fields — render each property of a nested object as a labeled input */
/* -------------------------------------------------------------------------- */

function ObjectFieldsWidget({
  schema,
  value,
  onChange,
  readOnly,
  context,
}: WidgetProps) {
  const props = (schema?.properties ?? {}) as Record<string, any>;
  const required = new Set<string>(
    Array.isArray(schema?.required) ? (schema!.required as string[]) : [],
  );
  const keys = Object.keys(props);
  const obj = (value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  if (keys.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        (no properties declared)
      </div>
    );
  }

  function set(k: string, v: unknown) {
    const next = { ...obj };
    if (v === undefined || v === '' || v === null) {
      delete next[k];
    } else {
      next[k] = v;
    }
    onChange(Object.keys(next).length === 0 ? undefined : next);
  }

  return (
    <div className="grid grid-cols-2 gap-3 rounded border border-border/40 bg-card/30 p-3">
      {keys.map((k) => {
        const sub = props[k] ?? {};
        const title = (sub.title as string) ?? k;
        const desc = sub.description as string | undefined;
        const isReq = required.has(k);
        return (
          <div key={k} className="space-y-1">
            <Label className="text-xs font-medium">
              {title}
              {isReq && <span className="text-destructive ml-0.5">*</span>}
              <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                {k}
              </span>
            </Label>
            <RowCell
              schema={sub}
              value={obj[k]}
              readOnly={readOnly}
              context={context}
              onChange={(v) => set(k, v)}
            />
            {desc && (
              <p className="text-[11px] text-muted-foreground">{desc}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* registry                                                                   */
/* -------------------------------------------------------------------------- */

export const WIDGETS: Record<string, WidgetRenderer> = {
  'ref:object': RefObjectWidget,
  'object-selector': ObjectSelectorWidget,
  'field-selector': FieldSelectorWidget,
  'master-detail': MasterDetailWidget,
  'string-tags': StringTagsWidget,
  'object-fields': ObjectFieldsWidget,
  // Reasonable fallbacks until dedicated builders ship:
  'filter-builder': MasterDetailWidget,
};
