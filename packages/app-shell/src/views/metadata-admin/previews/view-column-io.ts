// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Column-IO helpers for the View column configurator.
 *
 * A View variant's `columns` array holds entries in one of two
 * canonical shapes:
 *   • `string`                       — bare field name (kanban-style)
 *   • `{ field, label, ... }`        — ObjectStack canonical shape
 *   • `{ accessorKey, header, ... }` — legacy/imported TanStack shape
 *
 * These helpers read either shape without mutating it and build new
 * entries that respect a variant's all-strings invariant so round-trips
 * stay lossless.
 */

export interface VariantInfo {
  key: string;
  schema: Record<string, unknown>;
  columns: unknown[];
  allStrings: boolean;
}

/** Human label for a column entry (falls back to a positional label). */
export function colLabel(c: unknown, i: number): string {
  if (typeof c === 'string') return c || `col ${i + 1}`;
  if (c && typeof c === 'object') {
    const o = c as Record<string, unknown>;
    return String(o.label ?? o.header ?? o.field ?? o.accessorKey ?? `col ${i + 1}`);
  }
  return `col ${i + 1}`;
}

/** Bound field name for a column entry, if any. */
export function colFieldName(c: unknown): string | undefined {
  if (typeof c === 'string') return c || undefined;
  if (c && typeof c === 'object') {
    const o = c as Record<string, unknown>;
    const v = o.field ?? o.accessorKey;
    return typeof v === 'string' && v ? v : undefined;
  }
  return undefined;
}

/** Set of field names already used as columns in a variant. */
export function usedFieldNames(columns: unknown[]): Set<string> {
  const out = new Set<string>();
  for (const c of columns) {
    const f = colFieldName(c);
    if (f) out.add(f);
  }
  return out;
}

/**
 * Build a fresh column entry for `fieldName`. Honors the variant's
 * all-strings invariant: string variants get a bare field name, object
 * variants get `{ field, label }`.
 */
export function makeColumn(
  allStrings: boolean,
  fieldName: string,
  label?: string,
): unknown {
  if (allStrings) return fieldName;
  const col: Record<string, unknown> = { field: fieldName };
  if (label && label !== fieldName) col.label = label;
  return col;
}

/**
 * Remap a selected column index after a remove at `removedIndex`.
 * Returns the new index, or `null` when the selected column itself was
 * removed (caller should clear the selection).
 */
export function remapIndexAfterRemove(
  selectedIndex: number,
  removedIndex: number,
): number | null {
  if (selectedIndex === removedIndex) return null;
  if (selectedIndex > removedIndex) return selectedIndex - 1;
  return selectedIndex;
}

/**
 * Remap a selected column index after a move from `from` to `to`.
 * Mirrors `moveArray` semantics (remove-then-insert on the same list).
 */
export function remapIndexAfterMove(
  selectedIndex: number,
  from: number,
  to: number,
): number {
  if (selectedIndex === from) return to;
  // The moved item left `from` and was inserted at `to`; indices between
  // shift by one in the appropriate direction.
  let idx = selectedIndex;
  if (from < idx) idx -= 1;
  if (to <= idx) idx += 1;
  return idx;
}
