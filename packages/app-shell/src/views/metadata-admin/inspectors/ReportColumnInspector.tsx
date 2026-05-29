// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ReportColumnInspector — scoped editor for the selected report column.
 *
 * Selection shape:  { kind: 'column', id: 'columns[<i>]' }
 *
 * Report columns are simpler than table columns — field + label +
 * aggregate is enough for most usage.
 */

import * as React from 'react';
import type { MetadataInspectorProps } from '../inspector-registry';
import { t } from '../i18n';
import {
  InspectorShell,
  InspectorReorderButtons,
  InspectorTextField,
  InspectorSelectField,
  InspectorRemoveButton,
  InspectorEmptyState,
  spliceArray,
  moveArray,
} from './_shared';

interface ReportColumn { field?: string; label?: string; aggregate?: string; [k: string]: unknown }

const NONE = '__none__';
const AGGREGATES = [
  { value: NONE, label: '(none)' },
  { value: 'count', label: 'count' },
  { value: 'sum', label: 'sum' },
  { value: 'avg', label: 'avg' },
  { value: 'min', label: 'min' },
  { value: 'max', label: 'max' },
];

function parseId(id: string): number | null {
  const m = /^columns\[(\d+)\]$/.exec(id);
  return m ? Number(m[1]) : null;
}

export function ReportColumnInspector({ selection, draft, onPatch, onClearSelection, onSelectionChange, locale, readOnly }: MetadataInspectorProps) {
  const i = parseId(selection.id);
  const columns: ReportColumn[] = Array.isArray((draft as any).columns) ? (draft as any).columns as ReportColumn[] : [];
  const col = i != null ? columns[i] ?? null : null;

  if (i == null || !col) {
    return (
      <InspectorShell kindLabel={t('engine.inspector.reportColumn.kind', locale)} title={selection.label ?? selection.id} onClose={onClearSelection} closeLabel={t('engine.inspector.reportColumn.close', locale)}>
        <InspectorEmptyState message={selection.id} />
      </InspectorShell>
    );
  }

  const patch = (updates: Partial<ReportColumn>) => onPatch({ columns: spliceArray(columns, i, { ...col, ...updates }) });
  const remove = () => { onPatch({ columns: spliceArray(columns, i, null) }); onClearSelection(); };
  const move = (to: number) => {
    onPatch({ columns: moveArray(columns, i, to) });
    onSelectionChange?.({ kind: 'column', id: `columns[${to}]`, label: col.label || col.field || `columns[${to}]` });
  };

  return (
    <InspectorShell
      kindLabel={t('engine.inspector.reportColumn.kind', locale)}
      title={col.label || col.field || selection.id}
      onClose={onClearSelection}
      closeLabel={t('engine.inspector.reportColumn.close', locale)}
      headerActions={
        <InspectorReorderButtons
          index={i}
          total={columns.length}
          onMove={move}
          upLabel={t('engine.inspector.reorder.up', locale)}
          downLabel={t('engine.inspector.reorder.down', locale)}
          disabled={readOnly}
        />
      }
      footer={<InspectorRemoveButton label={t('engine.inspector.reportColumn.remove', locale)} onClick={remove} disabled={readOnly} />}
    >
      <InspectorTextField label={t('engine.inspector.reportColumn.field', locale)} value={col.field ?? ''} onCommit={(v) => patch({ field: v })} disabled={readOnly} mono />
      <InspectorTextField label={t('engine.inspector.reportColumn.label', locale)} value={col.label ?? ''} onCommit={(v) => patch({ label: v })} disabled={readOnly} />
      <InspectorSelectField label={t('engine.inspector.reportColumn.aggregate', locale)} value={col.aggregate ?? NONE} options={AGGREGATES} onCommit={(v) => patch({ aggregate: v === NONE ? undefined : v })} disabled={readOnly} />
    </InspectorShell>
  );
}
