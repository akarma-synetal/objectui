// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Field-IO helpers for the form-designer canvas + inspector.
 *
 * `draft.fields` can be either an array `[{name, ...def}, …]` (the
 * legacy / objectql shape) or a record `{name: def, …}` (the spec
 * shape used in `*.object.ts`). This module reads/writes both shapes
 * transparently and preserves arbitrary unknown properties on each
 * field — the inspector only edits the keys it knows about.
 *
 * Field reorders / inserts / removes are performed on a normalized
 * ordered list and serialized back to the input shape, so round-trips
 * are non-destructive.
 */

import type { FieldTypeId } from './field-types';

export type Shape = 'array' | 'record';

export interface FieldEntry {
  /** Canonical snake_case key. */
  name: string;
  /** Raw framework field definition (label, type, options, …). */
  def: Record<string, unknown>;
}

export interface FieldsView {
  shape: Shape;
  entries: FieldEntry[];
}

/** Read draft.fields into a normalized ordered list. */
export function readFields(fieldsInput: unknown): FieldsView {
  if (Array.isArray(fieldsInput)) {
    return {
      shape: 'array',
      entries: (fieldsInput as Array<Record<string, unknown>>).map((raw, i) => {
        const { name, ...rest } = raw ?? {};
        return {
          name: typeof name === 'string' && name ? name : `field_${i + 1}`,
          def: rest as Record<string, unknown>,
        };
      }),
    };
  }
  if (fieldsInput && typeof fieldsInput === 'object') {
    return {
      shape: 'record',
      entries: Object.entries(fieldsInput as Record<string, Record<string, unknown>>).map(
        ([name, def]) => ({ name, def: { ...(def ?? {}) } }),
      ),
    };
  }
  return { shape: 'record', entries: [] };
}

/** Serialize the ordered list back to the original shape. */
export function writeFields(view: FieldsView): Record<string, unknown> | Array<Record<string, unknown>> {
  if (view.shape === 'array') {
    return view.entries.map((e) => ({ name: e.name, ...e.def }));
  }
  const out: Record<string, unknown> = {};
  for (const e of view.entries) out[e.name] = e.def;
  return out;
}

/** Find the index of a field by name. Returns -1 if not found. */
export function indexOfField(view: FieldsView, name: string): number {
  return view.entries.findIndex((e) => e.name === name);
}

/** Build a fresh field definition for the given type. */
export function newField(name: string, type: FieldTypeId, label?: string): FieldEntry {
  const def: Record<string, unknown> = { type, label: label ?? toLabel(name) };
  // Seed a single empty option so picklist editor renders a row to fill in.
  if (type === 'select' || type === 'multiselect' || type === 'radio' || type === 'checkboxes') {
    def.options = [{ value: '', label: '' }];
  }
  return { name, def };
}

/** Convert a snake_case name to a human-friendly Title Case label. */
export function toLabel(name: string): string {
  if (!name) return '';
  return name
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Normalize an arbitrary string into a valid snake_case field name. */
export function toFieldName(raw: string): string {
  const lower = raw.trim().toLowerCase();
  const sanitized = lower
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
  if (!sanitized) return 'field';
  if (!/^[a-z_]/.test(sanitized)) return `f_${sanitized}`;
  return sanitized;
}

/**
 * Group entries by their `group` property, in `fieldGroups[]` order.
 * Fields with no group (or a group not declared in fieldGroups) land
 * in a trailing "Ungrouped" bucket.
 */
export interface GroupedEntries {
  key: string | null;
  label: string;
  entries: FieldEntry[];
}

export function groupEntries(
  view: FieldsView,
  fieldGroups: Array<{ key?: string; label?: string }> | undefined,
): GroupedEntries[] {
  const declared = Array.isArray(fieldGroups) ? fieldGroups.filter((g) => typeof g?.key === 'string') : [];
  const buckets = new Map<string | null, GroupedEntries>();
  for (const g of declared) {
    buckets.set(g.key!, { key: g.key!, label: String(g.label ?? g.key), entries: [] });
  }
  const declaredKeys = new Set(declared.map((g) => g.key as string));
  for (const e of view.entries) {
    const g = typeof e.def.group === 'string' ? (e.def.group as string) : null;
    if (g && declaredKeys.has(g)) {
      buckets.get(g)!.entries.push(e);
    } else {
      if (!buckets.has(null)) buckets.set(null, { key: null, label: 'Ungrouped', entries: [] });
      buckets.get(null)!.entries.push(e);
    }
  }
  // Filter out empty declared buckets so they don't add chrome noise.
  return Array.from(buckets.values()).filter((b) => b.entries.length > 0);
}
