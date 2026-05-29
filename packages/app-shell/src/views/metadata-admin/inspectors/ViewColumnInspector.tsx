// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ViewColumnInspector — scoped editor for the selected View column.
 *
 * Selection shape:  { kind: 'column', id: '<variant>.columns[<i>]' }
 *
 * Example: `list.columns[2]`. The `variant` key is one of the known
 * View variant keys (list/form/kanban/…). Patches splice
 * `draft[variant].columns[i]` immutably.
 */

import * as React from 'react';
import type { MetadataInspectorProps } from '../inspector-registry';
import { t } from '../i18n';
import {
  InspectorShell,
  InspectorReorderButtons,
  InspectorTextField,
  InspectorNumberField,
  InspectorSelectField,
  InspectorCheckboxField,
  InspectorRemoveButton,
  InspectorEmptyState,
  spliceArray,
  moveArray,
} from './_shared';

interface ViewColumn {
  // ObjectStack canonical shape
  field?: string;
  label?: string;
  // TanStack-style shape (legacy/imported tables)
  accessorKey?: string;
  header?: string;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  [k: string]: unknown;
}

const ALIGN = [
  { value: 'left', label: 'left' },
  { value: 'center', label: 'center' },
  { value: 'right', label: 'right' },
];

function parseId(id: string): { variant: string; index: number } | null {
  const m = /^([a-zA-Z_][\w]*)\.columns\[(\d+)\]$/.exec(id);
  if (!m) return null;
  return { variant: m[1], index: Number(m[2]) };
}

/** Read a column entry — handles object shape AND raw string shape (kanban). */
function readColumn(raw: unknown): ViewColumn {
  if (typeof raw === 'string') return { field: raw };
  if (raw && typeof raw === 'object') return raw as ViewColumn;
  return {};
}

function colFieldKey(c: ViewColumn): string {
  return c.field ?? c.accessorKey ?? '';
}

function colDisplayLabel(c: ViewColumn): string {
  return c.label ?? c.header ?? colFieldKey(c);
}

export function ViewColumnInspector({ selection, draft, onPatch, onClearSelection, onSelectionChange, locale, readOnly }: MetadataInspectorProps) {
  const parsed = parseId(selection.id);
  const variantSchema = parsed ? ((draft as any)[parsed.variant] as Record<string, unknown> | undefined) : undefined;
  const rawColumns: unknown[] = parsed && Array.isArray(variantSchema?.columns) ? (variantSchema!.columns as unknown[]) : [];
  const columns: ViewColumn[] = rawColumns.map(readColumn);
  const col = parsed ? columns[parsed.index] ?? null : null;
  // Track whether the source array stored a string at this position, so
  // edits round-trip in the same shape rather than silently upgrading it.
  const isStringColumn = parsed ? typeof rawColumns[parsed.index] === 'string' : false;

  if (!parsed || !col) {
    return (
      <InspectorShell kindLabel={t('engine.inspector.viewColumn.kind', locale)} title={selection.label ?? selection.id} onClose={onClearSelection} closeLabel={t('engine.inspector.viewColumn.close', locale)}>
        <InspectorEmptyState message={selection.id} />
      </InspectorShell>
    );
  }

  const writeColumns = (next: ViewColumn[]) => {
    // Preserve string-shape entries: a column that was originally a
    // string stays a string if only its field key changed (lossless),
    // otherwise it gets promoted to an object.
    const serialized = next.map((c, i) => {
      const wasString = typeof rawColumns[i] === 'string';
      const fieldKey = colFieldKey(c);
      const onlyHasField =
        !c.label && !c.header && c.width == null && c.align == null && c.sortable == null && c.filterable == null;
      if (wasString && onlyHasField && fieldKey) return fieldKey;
      return c;
    });
    onPatch({ [parsed.variant]: { ...variantSchema, columns: serialized } });
  };

  const patch = (updates: Partial<ViewColumn>) => {
    // Write back to whichever shape the original column used so we don't
    // create duplicate keys (header AND label, accessorKey AND field).
    const targetField = 'field' in col || !('accessorKey' in col) ? 'field' : 'accessorKey';
    const targetLabel = 'label' in col || !('header' in col) ? 'label' : 'header';
    const remapped: Partial<ViewColumn> = { ...updates };
    if ('field' in updates) {
      remapped[targetField] = updates.field;
      if (targetField !== 'field') delete remapped.field;
    }
    if ('label' in updates) {
      remapped[targetLabel] = updates.label;
      if (targetLabel !== 'label') delete remapped.label;
    }
    const newCols = spliceArray(columns, parsed.index, { ...col, ...remapped });
    writeColumns(newCols);
  };
  const remove = () => {
    const newCols = spliceArray(columns, parsed.index, null);
    writeColumns(newCols);
    onClearSelection();
  };
  const move = (to: number) => {
    const newCols = moveArray(columns, parsed.index, to);
    writeColumns(newCols);
    onSelectionChange?.({
      kind: 'column',
      id: `${parsed.variant}.columns[${to}]`,
      label: colDisplayLabel(col) || `columns[${to}]`,
    });
  };

  const widthNumber = typeof col.width === 'number' ? col.width : (typeof col.width === 'string' ? Number(col.width.replace(/[^\d.]/g, '')) || undefined : undefined);

  return (
    <InspectorShell
      kindLabel={t('engine.inspector.viewColumn.kind', locale)}
      title={colDisplayLabel(col) || selection.id}
      onClose={onClearSelection}
      closeLabel={t('engine.inspector.viewColumn.close', locale)}
      headerActions={
        <InspectorReorderButtons
          index={parsed.index}
          total={columns.length}
          onMove={move}
          upLabel={t('engine.inspector.reorder.up', locale)}
          downLabel={t('engine.inspector.reorder.down', locale)}
          disabled={readOnly}
        />
      }
      footer={<InspectorRemoveButton label={t('engine.inspector.viewColumn.remove', locale)} onClick={remove} disabled={readOnly} />}
    >
      <InspectorTextField label={t('engine.inspector.viewColumn.accessorKey', locale)} value={colFieldKey(col)} onCommit={(v) => patch({ field: v })} disabled={readOnly} mono />
      <InspectorTextField label={t('engine.inspector.viewColumn.header', locale)} value={colDisplayLabel(col) === colFieldKey(col) ? '' : colDisplayLabel(col)} onCommit={(v) => patch({ label: v })} disabled={readOnly} />
      {!isStringColumn && (
        <>
          <InspectorNumberField label={t('engine.inspector.viewColumn.width', locale)} value={widthNumber} onCommit={(v) => patch({ width: v })} disabled={readOnly} />
          <InspectorSelectField label={t('engine.inspector.viewColumn.align', locale)} value={col.align} options={ALIGN} onCommit={(v) => patch({ align: v as ViewColumn['align'] })} disabled={readOnly} />
          <InspectorCheckboxField label={t('engine.inspector.viewColumn.sortable', locale)} value={col.sortable !== false} onCommit={(v) => patch({ sortable: v })} disabled={readOnly} />
          <InspectorCheckboxField label={t('engine.inspector.viewColumn.filterable', locale)} value={col.filterable !== false} onCommit={(v) => patch({ filterable: v })} disabled={readOnly} />
        </>
      )}
    </InspectorShell>
  );
}
