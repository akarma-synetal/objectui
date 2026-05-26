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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@object-ui/components';
import { evaluatePredicate } from './predicate';
import { WIDGETS, type WidgetContext } from './widgets';

type JsonSchema = Record<string, any>;

/** Widgets that don't need a custom renderer — they overlay on the
 * existing default control (textarea/input/etc) and just act as a hint. */
const KNOWN_PASSTHROUGH_WIDGETS = new Set<string>([
  'text',
  'textarea',
  'number',
  'switch',
  'select',
  'json',
]);

/**
 * Infer widget name from FormFieldSpec.type (Data.FieldType) and schema.
 * Priority: explicit widget > type-based inference > schema-based inference > default.
 */
function inferWidget(
  fieldSpec: FormFieldSpec | undefined,
  schema: JsonSchema | undefined,
): string | undefined {
  // 1. Explicit widget always wins
  if (fieldSpec?.widget) return fieldSpec.widget;

  // 2. Infer from Data.FieldType
  if (fieldSpec?.type) {
    const t = fieldSpec.type;
    // Text types
    if (t === 'text' || t === 'email' || t === 'url' || t === 'phone' || t === 'password') return 'text';
    if (t === 'textarea' || t === 'markdown' || t === 'html' || t === 'richtext') return 'textarea';
    
    // Number types
    if (t === 'number' || t === 'currency' || t === 'percent') return 'number';
    
    // Date/time
    if (t === 'date' || t === 'datetime' || t === 'time') return 'date-picker';
    
    // Boolean
    if (t === 'boolean' || t === 'toggle') return 'switch';
    
    // Selection
    if (t === 'select' || t === 'radio') return fieldSpec.multiple ? 'multiselect' : 'select';
    if (t === 'multiselect' || t === 'checkboxes' || t === 'tags') return 'string-tags';
    
    // Relational
    if (t === 'lookup' || t === 'master_detail') return 'ref-object';
    if (t === 'tree') return 'ref-object';
    
    // Media
    if (t === 'image' || t === 'file' || t === 'avatar' || t === 'video' || t === 'audio') return 'file-upload';
    
    // Code/JSON
    if (t === 'code' || t === 'json') return 'json';
    
    // Enhanced
    if (t === 'location' || t === 'address') return 'json';
    if (t === 'color') return 'color-picker';
    if (t === 'rating') return 'number';
    if (t === 'slider') return 'slider';
    if (t === 'signature') return 'signature';
    if (t === 'qrcode') return 'qrcode';
    if (t === 'progress') return 'number';
    
    // Calculated
    if (t === 'formula' || t === 'summary' || t === 'autonumber') return 'text';
    
    // Vector
    if (t === 'vector') return 'json';
  }

  // 3. Infer from JSON Schema
  if (schema) {
    const type = schema.type;
    
    // Array of strings → string-tags
    if (type === 'array' && schema.items?.type === 'string') return 'string-tags';
    
    // Array of objects → master-detail
    if (type === 'array' && schema.items?.type === 'object') return 'master-detail';
    
    // Object → object-fields
    if (type === 'object') return 'object-fields';
    
    // Boolean → switch
    if (type === 'boolean') return 'switch';
    
    // Number → number
    if (type === 'number' || type === 'integer') return 'number';
    
    // Enum → select
    if (Array.isArray(schema.enum)) return 'select';
    
    // String with format
    if (type === 'string') {
      if (schema.format === 'date' || schema.format === 'date-time') return 'date-picker';
      if (schema.format === 'email' || schema.format === 'uri' || schema.format === 'uri-reference') return 'text';
      if (schema.format === 'multiline') return 'textarea';
    }
  }

  // 4. Default fallback
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* FormView spec (subset)                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Lightweight shape of the spec `FormView` we consume. We deliberately
 * accept `any` for forward compatibility — the spec evolves faster than
 * we want this admin engine to break.
 */
export interface FormViewSpec {
  type?: 'simple' | 'tabbed' | 'wizard' | 'split' | 'drawer' | 'modal';
  sections?: FormSectionSpec[];
}

export interface FormSectionSpec {
  label?: string;
  description?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  columns?: 1 | 2 | 3 | 4;
  visibleOn?: string | { dialect?: string; source: string };
  fields: Array<string | FormFieldSpec>;
}

export interface FormFieldSpec {
  field: string;
  
  // 🆕 Field type from Data.FieldType (auto-infers widget)
  type?: string;
  
  // 🆕 Field config from Data.Field
  options?: Array<{ label: string; value: string; color?: string }>;
  reference?: string;
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;
  precision?: number;
  scale?: number;
  multiple?: boolean;
  
  // UI overrides
  label?: string;
  placeholder?: string;
  helpText?: string;
  readonly?: boolean;
  required?: boolean;
  hidden?: boolean;
  colSpan?: 1 | 2 | 3 | 4;
  widget?: string;
  visibleOn?: string | { dialect?: string; source: string };
}

export interface SchemaFormIssue {
  path: string;
  message: string;
}

export interface SchemaFormProps {
  /** JSONSchema for the root object. */
  schema: JsonSchema | undefined;
  /**
   * Optional FormView layout (sections, tabs, widget hints, visibleOn)
   * shipped by the framework alongside `schema`. When present, fields
   * are grouped into sections and visibility predicates are honoured.
   */
  form?: FormViewSpec;
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
  /** Out-of-band data widgets need (object list, etc). */
  widgetContext?: WidgetContext;
}

export function SchemaForm({
  schema,
  form,
  value,
  onChange,
  issues = [],
  hiddenFields = [],
  fieldOrder = [],
  readOnly = false,
  widgetContext,
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

  // If the framework provided a FormView layout, render sections (tabbed
  // or simple). Otherwise fall through to the flat property list.
  if (form?.sections?.length) {
    return (
      <SectionedSchemaForm
        form={form}
        props={props}
        required={required}
        hiddenFields={hiddenFields}
        issuesByPath={issuesByPath}
        value={v as Record<string, unknown>}
        readOnly={readOnly}
        widgetContext={widgetContext}
        onChange={setField}
      />
    );
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
          widgetContext={widgetContext}
          onChange={(val) => setField(key, val)}
        />
      ))}
    </div>
  );
}

/* ----- sectioned layout (FormView spec) ---------------------------------- */

function normaliseField(f: string | FormFieldSpec): FormFieldSpec {
  return typeof f === 'string' ? { field: f } : f;
}

function SectionedSchemaForm({
  form,
  props,
  required,
  hiddenFields,
  issuesByPath,
  value,
  readOnly,
  widgetContext,
  onChange,
}: {
  form: FormViewSpec;
  props: Record<string, JsonSchema>;
  required: string[];
  hiddenFields: string[];
  issuesByPath: Record<string, string[]>;
  value: Record<string, unknown>;
  readOnly?: boolean;
  widgetContext?: WidgetContext;
  onChange: (key: string, val: unknown) => void;
}) {
  const sections = (form.sections ?? []).filter(
    (s) => !s.visibleOn || evaluatePredicate(s.visibleOn, { data: value }),
  );

  // Decide whether to render as tabs or stacked sections.
  const isTabbed = form.type === 'tabbed' && sections.length > 1;

  const renderSection = (s: FormSectionSpec, idx: number) => {
    const fields = s.fields
      .map(normaliseField)
      .filter((f) => {
        if (f.hidden) return false;
        if (hiddenFields.includes(f.field)) return false;
        if (f.visibleOn && !evaluatePredicate(f.visibleOn, { data: value })) {
          return false;
        }
        return true;
      });
    if (fields.length === 0) return null;
    const cols = s.columns ?? 1;
    return (
      <section
        key={idx}
        className="space-y-3 rounded-md border border-border/40 bg-card/30 p-4"
      >
        {s.label && (
          <header>
            <h3 className="text-sm font-semibold text-foreground/90">
              {s.label}
            </h3>
            {s.description && (
              <p className="text-xs text-muted-foreground">{s.description}</p>
            )}
          </header>
        )}
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
          {fields.map((f) => {
            const propSchema = props[f.field];
            if (!propSchema) {
              return (
                <div
                  key={f.field}
                  className="rounded border border-dashed border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300"
                  style={{ gridColumn: `span ${f.colSpan ?? 1}` }}
                >
                  ⚠️ Field <code>{f.field}</code> declared in form layout but
                  missing from schema. Skipping.
                </div>
              );
            }
            return (
              <div
                key={f.field}
                style={{ gridColumn: `span ${f.colSpan ?? 1}` }}
              >
                <FieldRow
                  name={f.field}
                  schema={{
                    ...propSchema,
                    ...(f.label ? { title: f.label } : {}),
                    ...(f.helpText ? { description: f.helpText } : {}),
                    ...(f.placeholder ? { placeholder: f.placeholder } : {}),
                  }}
                  value={value[f.field]}
                  required={f.required ?? required.includes(f.field)}
                  issues={issuesByPath[f.field]}
                  readOnly={readOnly || f.readonly}
                  fieldSpec={f}
                  widgetContext={widgetContext}
                  onChange={(val) => onChange(f.field, val)}
                />
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  if (isTabbed) {
    const tabSections = sections.filter(
      (s) =>
        s.fields
          .map(normaliseField)
          .some(
            (f) =>
              !f.hidden &&
              !hiddenFields.includes(f.field) &&
              (!f.visibleOn ||
                evaluatePredicate(f.visibleOn, { data: value })),
          ),
    );
    if (tabSections.length === 0) return null;
    const defaultTab = (tabSections[0].label ?? 'section-0').toLowerCase();
    return (
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="flex flex-wrap gap-1">
          {tabSections.map((s, i) => (
            <TabsTrigger
              key={i}
              value={(s.label ?? `section-${i}`).toLowerCase()}
            >
              {s.label ?? `Section ${i + 1}`}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabSections.map((s, i) => (
          <TabsContent
            key={i}
            value={(s.label ?? `section-${i}`).toLowerCase()}
            className="mt-4"
          >
            {renderSection(s, i)}
          </TabsContent>
        ))}
      </Tabs>
    );
  }

  return <div className="space-y-4">{sections.map(renderSection)}</div>;
}

/* ----- inner field row ---------------------------------------------------- */

function FieldRow({
  name,
  schema,
  value,
  required,
  issues,
  readOnly,
  fieldSpec,
  widgetContext,
  onChange,
}: {
  name: string;
  schema: JsonSchema;
  value: unknown;
  required: boolean;
  issues?: string[];
  readOnly?: boolean;
  fieldSpec?: FormFieldSpec;
  widgetContext?: WidgetContext;
  onChange: (v: unknown) => void;
}) {
  const label = (schema?.title as string) || prettify(name);
  const description = schema?.description as string | undefined;
  const id = `mdf-${name}`;
  
  // Auto-infer widget from fieldSpec.type or schema
  const widget = inferWidget(fieldSpec, schema);
  
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
        {(widget || fieldSpec?.type || schema?.type) && (
          <Badge variant="outline" className="text-[10px] font-mono">
            {widget ?? fieldSpec?.type ?? schemaTypeLabel(schema)}
          </Badge>
        )}
      </div>
      <FieldControl
        id={id}
        schema={schema}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        widget={widget}
        fieldSpec={fieldSpec}
        widgetContext={widgetContext}
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
  widget,
  fieldSpec, // TODO: pass to widgets when they support options/reference/constraints
  widgetContext,
}: {
  id: string;
  schema: JsonSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
  widget?: string;
  fieldSpec?: FormFieldSpec;
  widgetContext?: WidgetContext;
}) {
  // Silence TS unused warning — will be used when widgets are extended
  void fieldSpec;
  
  // Widget hint takes precedence: try the registry first, then the
  // passthrough hint list, then fall back to JSON with an inline hint.
  if (widget) {
    const Renderer = WIDGETS[widget];
    if (Renderer) {
      return (
        <Renderer
          id={id}
          schema={schema}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          context={widgetContext}
          fieldSpec={fieldSpec}
        />
      );
    }
    if (!KNOWN_PASSTHROUGH_WIDGETS.has(widget)) {
      return (
        <div className="space-y-1">
          <RawJsonEditor
            value={value as any}
            onChange={(v) => onChange(v)}
            readOnly={readOnly}
          />
          <div className="text-[10px] text-muted-foreground">
            widget <code className="font-mono">{widget}</code> — falling back
            to JSON until a custom renderer is registered.
          </div>
        </div>
      );
    }
  }
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
