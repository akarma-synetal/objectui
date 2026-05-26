// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * SchemaForm — minimal JSONSchema-driven form (Phase 3c).
 *
 * The framework's `/meta/types` endpoint returns a `schema` field per
 * type, generated from Zod via `zod-to-json-schema`. We render that
 * schema as a form so admins can edit *any* metadata type without
 * the platform having to write a bespoke editor for each.
 *
 * Scope (MVP):
 *   • string  → Input (or Textarea if `format: 'multiline'`)
 *   • number  → Input type="number"
 *   • boolean → Switch
 *   • enum    → Select
 *   • array of strings → tag editor (comma-separated for MVP)
 *   • object  → recursive collapsed section
 *   • anyOf / oneOf / unknown → JSON textarea fallback
 *
 * NOT covered (yet) — those types use bespoke editors registered via
 * `registerMetadataResource()`:
 *   • Permission matrix (rows × columns × actions)
 *   • Object/Field designers
 *   • View / dashboard / page canvas designers
 *
 * Error display:
 *   • Pass `issues` in the shape `[{ path: 'a.b', message: '...' }, ...]`
 *     to render inline error chips next to the offending fields.
 *   • Matches the framework's `error.issues` envelope from `sendError`.
 */

import * as React from 'react';
import { Input } from '@object-ui/components';
import { Textarea } from '@object-ui/components';
import { Label } from '@object-ui/components';
import { Switch } from '@object-ui/components';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@object-ui/components';
import { Badge } from '@object-ui/components';

type JsonSchema = Record<string, any>;

export interface SchemaFormIssue {
  path: string;
  message: string;
}

export interface SchemaFormProps {
  /** JSONSchema for the root object. */
  schema: JsonSchema | undefined;
  /** Current form value. */
  value: Record<string, unknown> | undefined;
  /** Called with the next full value on every change. */
  onChange: (next: Record<string, unknown>) => void;
  /** Inline validation errors, keyed by JSON path. */
  issues?: SchemaFormIssue[];
  /** Field keys to hide (still preserved on save). */
  hiddenFields?: string[];
  /** Preferred top-level field order. */
  fieldOrder?: string[];
  /** Disable all inputs (e.g. when env-var write lock is off). */
  readOnly?: boolean;
}

export function SchemaForm({
  schema,
  value,
  onChange,
  issues = [],
  hiddenFields = [],
  fieldOrder = [],
  readOnly = false,
}: SchemaFormProps) {
  // No schema → escape hatch: raw JSON textarea so admins still get
  // SOMETHING. Better to expose a "JSON view" than a blank screen.
  if (!schema || typeof schema !== 'object') {
    return (
      <RawJsonEditor value={value} onChange={onChange} readOnly={readOnly} />
    );
  }

  // Resolve top-level object properties.
  const props = (schema.properties ?? {}) as Record<string, JsonSchema>;
  const required: string[] = Array.isArray(schema.required) ? schema.required : [];
  const keys = orderKeys(Object.keys(props), fieldOrder).filter(
    (k) => !hiddenFields.includes(k),
  );

  const issuesByPath = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const i of issues) {
      (map[i.path] ??= []).push(i.message);
    }
    return map;
  }, [issues]);

  const v = value ?? {};

  function setField(key: string, fieldValue: unknown) {
    const next = { ...v, [key]: fieldValue };
    if (fieldValue === undefined || fieldValue === '') {
      delete (next as Record<string, unknown>)[key];
    }
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {keys.map((key) => (
        <FieldRow
          key={key}
          name={key}
          schema={props[key]}
          value={(v as Record<string, unknown>)[key]}
          required={required.includes(key)}
          issues={issuesByPath[key]}
          readOnly={readOnly}
          onChange={(val) => setField(key, val)}
        />
      ))}
    </div>
  );
}

/* ----- inner field row ---------------------------------------------------- */

function FieldRow({
  name,
  schema,
  value,
  required,
  issues,
  readOnly,
  onChange,
}: {
  name: string;
  schema: JsonSchema;
  value: unknown;
  required: boolean;
  issues?: string[];
  readOnly?: boolean;
  onChange: (v: unknown) => void;
}) {
  const label = (schema?.title as string) || prettify(name);
  const description = schema?.description as string | undefined;
  const id = `mdf-${name}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
          <code className="ml-2 text-[10px] font-mono text-muted-foreground">
            {name}
          </code>
        </Label>
        {schema?.type && (
          <Badge variant="outline" className="text-[10px] font-mono">
            {schemaTypeLabel(schema)}
          </Badge>
        )}
      </div>
      <FieldControl
        id={id}
        schema={schema}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
      />
      {description && (
        <div className="text-xs text-muted-foreground">{description}</div>
      )}
      {issues?.map((m, i) => (
        <div key={i} className="text-xs text-destructive">
          {m}
        </div>
      ))}
    </div>
  );
}

function FieldControl({
  id,
  schema,
  value,
  onChange,
  readOnly,
}: {
  id: string;
  schema: JsonSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
}) {
  // Enum → Select.
  const enumValues = (schema?.enum as unknown[] | undefined) ?? undefined;
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    return (
      <Select
        value={value == null ? '' : String(value)}
        onValueChange={(v) => onChange(v)}
        disabled={readOnly}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {enumValues.map((opt) => (
            <SelectItem key={String(opt)} value={String(opt)}>
              {String(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Boolean → Switch.
  if (schema?.type === 'boolean') {
    return (
      <div className="flex items-center">
        <Switch
          id={id}
          checked={!!value}
          onCheckedChange={(c) => onChange(c)}
          disabled={readOnly}
        />
        <span className="ml-2 text-xs text-muted-foreground">
          {value ? 'true' : 'false'}
        </span>
      </div>
    );
  }

  // Number / integer → numeric input.
  if (schema?.type === 'number' || schema?.type === 'integer') {
    return (
      <Input
        id={id}
        type="number"
        value={value == null ? '' : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(undefined);
          const n = schema.type === 'integer' ? parseInt(raw, 10) : Number(raw);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        readOnly={readOnly}
      />
    );
  }

  // String → Input (or Textarea if it looks long).
  if (schema?.type === 'string') {
    const long =
      schema?.format === 'multiline' ||
      schema?.contentMediaType === 'text/markdown' ||
      (typeof value === 'string' && value.length > 80);
    if (long) {
      return (
        <Textarea
          id={id}
          rows={4}
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          readOnly={readOnly}
        />
      );
    }
    return (
      <Input
        id={id}
        value={(value as string | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        readOnly={readOnly}
      />
    );
  }

  // Array of primitives → comma-separated tag editor (MVP).
  if (schema?.type === 'array') {
    const itemsSchema = (schema?.items as JsonSchema | undefined) ?? {};
    const isPrimitive =
      itemsSchema.type === 'string' ||
      itemsSchema.type === 'number' ||
      itemsSchema.type === 'integer';
    if (isPrimitive) {
      const arr = Array.isArray(value) ? (value as unknown[]) : [];
      return (
        <Input
          id={id}
          value={arr.map(String).join(', ')}
          placeholder="comma, separated, values"
          onChange={(e) => {
            const raw = e.target.value;
            const parts = raw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            if (itemsSchema.type === 'number' || itemsSchema.type === 'integer') {
              onChange(parts.map((p) => Number(p)).filter((n) => Number.isFinite(n)));
            } else {
              onChange(parts);
            }
          }}
          readOnly={readOnly}
        />
      );
    }
  }

  // Object / complex → JSON fallback so admins can still edit.
  return <RawJsonEditor value={value} onChange={onChange} readOnly={readOnly} small />;
}

/* ----- raw JSON fallback -------------------------------------------------- */

function RawJsonEditor({
  value,
  onChange,
  readOnly,
  small,
}: {
  value: unknown;
  onChange: (v: any) => void;
  readOnly?: boolean;
  small?: boolean;
}) {
  const [text, setText] = React.useState<string>(() =>
    safeStringify(value),
  );
  const [error, setError] = React.useState<string | null>(null);

  // Re-sync when external value changes (e.g. Reset Overlay).
  React.useEffect(() => {
    setText(safeStringify(value));
    setError(null);
  }, [JSON.stringify(value)]); // intentional: stringify-deep-equal

  return (
    <div className="space-y-1">
      <Textarea
        rows={small ? 4 : 12}
        className="font-mono text-xs"
        value={text}
        readOnly={readOnly}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (!next.trim()) {
            setError(null);
            onChange(undefined);
            return;
          }
          try {
            const parsed = JSON.parse(next);
            setError(null);
            onChange(parsed);
          } catch (err: any) {
            setError(err?.message ?? 'Invalid JSON');
          }
        }}
      />
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}

/* ----- helpers ------------------------------------------------------------ */

function safeStringify(v: unknown): string {
  if (v === undefined) return '';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function prettify(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function schemaTypeLabel(schema: JsonSchema): string {
  if (schema?.enum) return 'enum';
  if (Array.isArray(schema?.type)) return schema.type.join('|');
  if (schema?.type === 'array') {
    const inner = (schema?.items as JsonSchema | undefined)?.type;
    return inner ? `${inner}[]` : 'array';
  }
  return (schema?.type as string) || 'any';
}

function orderKeys(keys: string[], preferred: string[]): string[] {
  if (!preferred.length) return keys;
  const set = new Set(keys);
  const head = preferred.filter((k) => set.has(k));
  const tail = keys.filter((k) => !preferred.includes(k));
  return [...head, ...tail];
}
