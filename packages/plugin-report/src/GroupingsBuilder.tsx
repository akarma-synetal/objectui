/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { Button } from '@object-ui/components';
import { ChevronDown, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { AvailableField, Translator } from './editorTypes';
import { NONE, DATE_TYPES } from './editorTypes';
import { FieldPickerDialog } from './FieldPickerDialog';

// ---------------------------------------------------------------------------
// GroupingsBuilder — ordered list of {field, sortOrder, dateGranularity}
// Used for groupingsDown (rows) and groupingsAcross (columns).
//
// Field selection (per-row and "add") goes through `FieldPickerDialog` so
// users get a searchable list instead of a cramped <select>. `testIdPrefix`
// disambiguates the row-vs-column instances both mounted in the same panel.
// ---------------------------------------------------------------------------

type GroupingDraft = {
  field: string;
  sortOrder?: 'asc' | 'desc';
  dateGranularity?: 'day' | 'week' | 'month' | 'quarter' | 'year';
};

export function GroupingsBuilder({
  availableFields,
  value,
  onChange,
  t,
  testIdPrefix = 'grouping',
}: {
  availableFields: AvailableField[];
  value: any;
  onChange: (v: any) => void;
  t: Translator;
  testIdPrefix?: string;
}) {
  const rows: GroupingDraft[] = Array.isArray(value)
    ? value.map((g: any) => ({
        field: g.field ?? '',
        sortOrder: g.sortOrder ?? g.sort ?? 'asc',
        dateGranularity: g.dateGranularity,
      }))
    : [];

  const granularityOptions = [
    { value: NONE, label: t('report.editor.dateGranularityNone') },
    { value: 'day', label: t('report.editor.day') },
    { value: 'week', label: t('report.editor.week') },
    { value: 'month', label: t('report.editor.month') },
    { value: 'quarter', label: t('report.editor.quarter') },
    { value: 'year', label: t('report.editor.year') },
  ];

  const usedFields = rows.map((r) => r.field).filter(Boolean);

  const removeRow = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, patch: Partial<GroupingDraft>) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const moveRow = (idx: number, dir: -1 | 1) => {
    const next = [...rows];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const addRow = (fieldValues: string[]) => {
    if (fieldValues.length === 0) return;
    const additions = fieldValues.map((field) => ({
      field,
      sortOrder: 'asc' as const,
    }));
    onChange([...rows, ...additions]);
  };

  const changeRowField = (idx: number, fieldValues: string[]) => {
    const pick = fieldValues[0];
    if (!pick) return;
    // When the field changes we may lose date-granularity meaning;
    // clear it if the new field is not date-like.
    const def = availableFields.find((f) => f.value === pick);
    const isDate = def && DATE_TYPES.has(def.type ?? '');
    updateRow(idx, {
      field: pick,
      dateGranularity: isDate ? rows[idx]?.dateGranularity : undefined,
    });
  };

  return (
    <div className="space-y-1.5 py-1" data-testid={`${testIdPrefix}s-builder`}>
      {rows.map((row, idx) => {
        const def = availableFields.find((f) => f.value === row.field);
        const isDate = def && DATE_TYPES.has(def.type ?? '');
        const fieldLabel = def?.label ?? row.field ?? t('report.editor.fieldPickerEmpty', '(pick field)');
        return (
          <div
            key={idx}
            className="flex items-center gap-1.5 p-1.5 border rounded bg-muted/20 text-xs"
            data-testid={`${testIdPrefix}-row-${idx}`}
          >
            <div className="flex flex-col gap-0.5 shrink-0">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                disabled={idx === 0}
                onClick={() => moveRow(idx, -1)}
                aria-label="Move up"
                data-testid={`${testIdPrefix}-up-${idx}`}
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                disabled={idx === rows.length - 1}
                onClick={() => moveRow(idx, 1)}
                aria-label="Move down"
                data-testid={`${testIdPrefix}-down-${idx}`}
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>
            <FieldPickerDialog
              availableFields={availableFields}
              selectedValues={usedFields.filter((v) => v !== row.field)}
              onAdd={(picked) => changeRowField(idx, picked)}
              t={t}
              singleSelect
              commitOnSelect
              testIdPrefix={`${testIdPrefix}-field-picker-${idx}`}
              title={t('report.editor.fieldPickerChangeTitle', 'Change field')}
              trigger={
                <button
                  type="button"
                  className="h-7 flex-1 min-w-0 text-left text-xs border rounded px-2 bg-background hover:bg-muted/40 inline-flex items-center justify-between gap-1.5"
                  data-testid={`${testIdPrefix}-field-${idx}`}
                  title={fieldLabel}
                >
                  <span className="truncate">{fieldLabel}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              }
            />
            <select
              className="h-7 text-xs border rounded px-1.5 bg-background w-20 shrink-0"
              value={row.sortOrder ?? 'asc'}
              onChange={(e) => updateRow(idx, { sortOrder: e.target.value as 'asc' | 'desc' })}
              data-testid={`${testIdPrefix}-sort-${idx}`}
            >
              <option value="asc">{t('report.editor.sortAsc')}</option>
              <option value="desc">{t('report.editor.sortDesc')}</option>
            </select>
            {isDate && (
              <select
                className="h-7 text-xs border rounded px-1.5 bg-background w-24 shrink-0"
                value={row.dateGranularity ?? NONE}
                onChange={(e) => updateRow(idx, { dateGranularity: (e.target.value || undefined) as any })}
                data-testid={`${testIdPrefix}-granularity-${idx}`}
              >
                {granularityOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 shrink-0"
              onClick={() => removeRow(idx)}
              aria-label="Remove grouping"
              data-testid={`${testIdPrefix}-remove-${idx}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
      <FieldPickerDialog
        availableFields={availableFields}
        selectedValues={usedFields}
        onAdd={addRow}
        t={t}
        singleSelect
        commitOnSelect
        testIdPrefix={`${testIdPrefix}-add-picker`}
        triggerLabel={t('report.editor.addGrouping')}
        title={t('report.editor.fieldPickerAddGroupingTitle', 'Add grouping')}
        triggerClassName="h-8 w-full justify-center gap-1.5"
      />
    </div>
  );
}
