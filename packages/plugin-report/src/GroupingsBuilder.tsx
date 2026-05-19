/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { Button } from '@object-ui/components';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { AvailableField, Translator } from './editorTypes';
import { NONE, DATE_TYPES } from './editorTypes';

// ---------------------------------------------------------------------------
// GroupingsBuilder — ordered list of {field, sortOrder, dateGranularity}
// Used for groupingsDown (rows) and groupingsAcross (columns).
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
}: {
  availableFields: AvailableField[];
  value: any;
  onChange: (v: any) => void;
  t: Translator;
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

  const addRow = () => {
    const first = availableFields[0];
    if (!first) return;
    onChange([...rows, { field: first.value, sortOrder: 'asc' }]);
  };

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

  return (
    <div className="space-y-1 py-1" data-testid="groupings-builder">
      {rows.map((row, idx) => {
        const def = availableFields.find((f) => f.value === row.field);
        const isDate = def && DATE_TYPES.has(def.type ?? '');
        return (
          <div key={idx} className="flex items-center gap-1 p-1 border rounded bg-muted/20 text-[10px]">
            <div className="flex flex-col gap-0.5 shrink-0">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                disabled={idx === 0}
                onClick={() => moveRow(idx, -1)}
                aria-label="Move up"
              >
                <ArrowUp className="h-2.5 w-2.5" />
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                disabled={idx === rows.length - 1}
                onClick={() => moveRow(idx, 1)}
                aria-label="Move down"
              >
                <ArrowDown className="h-2.5 w-2.5" />
              </button>
            </div>
            <select
              className="h-5 text-[10px] border rounded px-1 bg-background flex-1 min-w-0"
              value={row.field}
              onChange={(e) => updateRow(idx, { field: e.target.value })}
              data-testid={`grouping-field-${idx}`}
            >
              {availableFields.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <select
              className="h-5 text-[10px] border rounded px-1 bg-background w-14 shrink-0"
              value={row.sortOrder ?? 'asc'}
              onChange={(e) => updateRow(idx, { sortOrder: e.target.value as 'asc' | 'desc' })}
              data-testid={`grouping-sort-${idx}`}
            >
              <option value="asc">{t('report.editor.sortAsc')}</option>
              <option value="desc">{t('report.editor.sortDesc')}</option>
            </select>
            {isDate && (
              <select
                className="h-5 text-[10px] border rounded px-1 bg-background w-20 shrink-0"
                value={row.dateGranularity ?? NONE}
                onChange={(e) => updateRow(idx, { dateGranularity: (e.target.value || undefined) as any })}
                data-testid={`grouping-granularity-${idx}`}
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
              className="h-5 w-5 p-0 shrink-0"
              onClick={() => removeRow(idx)}
              aria-label="Remove grouping"
              data-testid={`grouping-remove-${idx}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-6 text-[10px] w-full"
        onClick={addRow}
        disabled={availableFields.length === 0}
        data-testid="grouping-add"
      >
        <Plus className="h-3 w-3 mr-1" />
        {t('report.editor.addGrouping')}
      </Button>
    </div>
  );
}
