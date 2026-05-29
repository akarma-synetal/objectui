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
  header?: string;
  accessorKey?: string;
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

export function ViewColumnInspector({ selection, draft, onPatch, onClearSelection, onSelectionChange, locale, readOnly }: MetadataInspectorProps) {
  const parsed = parseId(selection.id);
  const variantSchema = parsed ? ((draft as any)[parsed.variant] as Record<string, unknown> | undefined) : undefined;
  const columns: ViewColumn[] = parsed && Array.isArray(variantSchema?.columns) ? (variantSchema!.columns as ViewColumn[]) : [];
  const col = parsed ? columns[parsed.index] ?? null : null;

  if (!parsed || !col) {
    return (
      <InspectorShell kindLabel={t('engine.inspector.viewColumn.kind', locale)} title={selection.label ?? selection.id} onClose={onClearSelection} closeLabel={t('engine.inspector.viewColumn.close', locale)}>
        <InspectorEmptyState message={selection.id} />
      </InspectorShell>
    );
  }

  const patch = (updates: Partial<ViewColumn>) => {
    const newCols = spliceArray(columns, parsed.index, { ...col, ...updates });
    onPatch({ [parsed.variant]: { ...variantSchema, columns: newCols } });
  };
  const remove = () => {
    const newCols = spliceArray(columns, parsed.index, null);
    onPatch({ [parsed.variant]: { ...variantSchema, columns: newCols } });
    onClearSelection();
  };
  const move = (to: number) => {
    const newCols = moveArray(columns, parsed.index, to);
    onPatch({ [parsed.variant]: { ...variantSchema, columns: newCols } });
    onSelectionChange?.({
      kind: 'column',
      id: `${parsed.variant}.columns[${to}]`,
      label: col.header || col.accessorKey || `columns[${to}]`,
    });
  };

  const widthNumber = typeof col.width === 'number' ? col.width : (typeof col.width === 'string' ? Number(col.width.replace(/[^\d.]/g, '')) || undefined : undefined);

  return (
    <InspectorShell
      kindLabel={t('engine.inspector.viewColumn.kind', locale)}
      title={col.header || col.accessorKey || selection.id}
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
      <InspectorTextField label={t('engine.inspector.viewColumn.header', locale)} value={col.header ?? ''} onCommit={(v) => patch({ header: v })} disabled={readOnly} />
      <InspectorTextField label={t('engine.inspector.viewColumn.accessorKey', locale)} value={col.accessorKey ?? ''} onCommit={(v) => patch({ accessorKey: v })} disabled={readOnly} mono />
      <InspectorNumberField label={t('engine.inspector.viewColumn.width', locale)} value={widthNumber} onCommit={(v) => patch({ width: v })} disabled={readOnly} />
      <InspectorSelectField label={t('engine.inspector.viewColumn.align', locale)} value={col.align} options={ALIGN} onCommit={(v) => patch({ align: v as ViewColumn['align'] })} disabled={readOnly} />
      <InspectorCheckboxField label={t('engine.inspector.viewColumn.sortable', locale)} value={col.sortable !== false} onCommit={(v) => patch({ sortable: v })} disabled={readOnly} />
      <InspectorCheckboxField label={t('engine.inspector.viewColumn.filterable', locale)} value={col.filterable !== false} onCommit={(v) => patch({ filterable: v })} disabled={readOnly} />
    </InspectorShell>
  );
}
