// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ViewColumnInspector — scoped editor for the selected View column.
 *
 * Selection shape:  { kind: 'column', id: '<variant>.columns[<i>]' }
 *
 * SPEC-DRIVEN: the column's detail properties (width / align / pinned /
 * summary / sortable / …) are rendered from the spec's `ListColumn`
 * JSONSchema via the generic {@link SchemaForm}, NOT a hardcoded field
 * list. New ListColumn props in `@objectstack/spec` appear automatically.
 *
 * A thin curated layer stays on top for the column IDENTITY (field key +
 * label) because those round-trip through two shapes: the ObjectStack
 * canonical `{ field, label }` and the legacy TanStack `{ accessorKey,
 * header }`. A column that is a bare string (e.g. a kanban card field) is
 * kept as a string until the author edits a detail prop.
 */

import * as React from 'react';
import type { MetadataInspectorProps } from '../inspector-registry';
import { t } from '../i18n';
import {
  InspectorShell,
  InspectorReorderButtons,
  InspectorTextField,
  InspectorRemoveButton,
  InspectorEmptyState,
  spliceArray,
  moveArray,
} from './_shared';
import { SchemaForm } from '../SchemaForm';
import { getListColumnSchema } from '../view-schema';

interface ViewColumn {
  // ObjectStack canonical shape
  field?: string;
  label?: string;
  // TanStack-style shape (legacy/imported tables)
  accessorKey?: string;
  header?: string;
  [k: string]: unknown;
}

/** Identity keys owned by the curated layer — hidden from the spec form. */
const IDENTITY_KEYS = ['field', 'label', 'accessorKey', 'header'];

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

/** Does the object carry any detail prop beyond its identity keys? */
function hasDetailProps(c: ViewColumn): boolean {
  return Object.keys(c).some((k) => !IDENTITY_KEYS.includes(k));
}

export function ViewColumnInspector({
  selection,
  draft,
  onPatch,
  onClearSelection,
  onSelectionChange,
  locale,
  readOnly,
}: MetadataInspectorProps) {
  const parsed = parseId(selection.id);
  const variantSchema = parsed
    ? ((draft as any)[parsed.variant] as Record<string, unknown> | undefined)
    : undefined;
  const rawColumns: unknown[] =
    parsed && Array.isArray(variantSchema?.columns)
      ? (variantSchema!.columns as unknown[])
      : [];
  const columns: ViewColumn[] = rawColumns.map(readColumn);
  const col = parsed ? columns[parsed.index] ?? null : null;
  const isStringColumn = parsed
    ? typeof rawColumns[parsed.index] === 'string'
    : false;

  const columnSchema = React.useMemo(() => getListColumnSchema(), []);

  if (!parsed || !col) {
    return (
      <InspectorShell
        kindLabel={t('engine.inspector.viewColumn.kind', locale)}
        title={selection.label ?? selection.id}
        onClose={onClearSelection}
        closeLabel={t('engine.inspector.viewColumn.close', locale)}
      >
        <InspectorEmptyState message={selection.id} />
      </InspectorShell>
    );
  }

  /** Write the column array back, preserving string shape when lossless. */
  const writeColumns = (next: ViewColumn[]) => {
    const serialized = next.map((c, i) => {
      const wasString = typeof rawColumns[i] === 'string';
      const fieldKey = colFieldKey(c);
      if (wasString && !hasDetailProps(c) && !c.label && !c.header && fieldKey) {
        return fieldKey;
      }
      return c;
    });
    onPatch({ [parsed.variant]: { ...variantSchema, columns: serialized } });
  };

  /** Patch identity (field/label) honouring whichever shape is in use. */
  const patchIdentity = (updates: Partial<ViewColumn>) => {
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
    writeColumns(spliceArray(columns, parsed.index, { ...col, ...remapped }));
  };

  /** Whole-column write from the spec detail form. */
  const writeDetail = (next: Record<string, unknown>) => {
    writeColumns(spliceArray(columns, parsed.index, next as ViewColumn));
  };

  const remove = () => {
    writeColumns(spliceArray(columns, parsed.index, null));
    onClearSelection();
  };

  const move = (to: number) => {
    writeColumns(moveArray(columns, parsed.index, to));
    onSelectionChange?.({
      kind: 'column',
      id: `${parsed.variant}.columns[${to}]`,
      label: colDisplayLabel(col) || `columns[${to}]`,
    });
  };

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
      footer={
        <InspectorRemoveButton
          label={t('engine.inspector.viewColumn.remove', locale)}
          onClick={remove}
          disabled={readOnly}
        />
      }
    >
      <InspectorTextField
        label={t('engine.inspector.viewColumn.accessorKey', locale)}
        value={colFieldKey(col)}
        onCommit={(v) => patchIdentity({ field: v })}
        disabled={readOnly}
        mono
      />
      <InspectorTextField
        label={t('engine.inspector.viewColumn.header', locale)}
        value={colDisplayLabel(col) === colFieldKey(col) ? '' : colDisplayLabel(col)}
        onCommit={(v) => patchIdentity({ label: v })}
        disabled={readOnly}
      />

      {!isStringColumn && columnSchema ? (
        <div className="border-t pt-3">
          <SchemaForm
            schema={columnSchema}
            value={col as Record<string, unknown>}
            hiddenFields={IDENTITY_KEYS}
            readOnly={readOnly}
            onChange={writeDetail}
          />
        </div>
      ) : null}
    </InspectorShell>
  );
}
