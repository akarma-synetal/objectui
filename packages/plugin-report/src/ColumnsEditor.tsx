/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { Button, Checkbox } from '@object-ui/components';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { AvailableField, Translator } from './editorTypes';
import { NONE } from './editorTypes';

// ---------------------------------------------------------------------------
// ColumnsEditor — ordered list of report columns with per-column metadata
// ---------------------------------------------------------------------------

type ColumnDraft = {
  field: string;
  label?: string;
  type?: string;
  aggregate?: string;
  format?: string;
};

function buildAggregateOptions(t: Translator) {
  return [
    { value: NONE, label: t('report.editor.noneOption') },
    { value: 'sum', label: t('report.aggregate.sum') },
    { value: 'count', label: t('report.aggregate.count') },
    { value: 'unique', label: t('report.aggregate.countDistinct') },
    { value: 'avg', label: t('report.aggregate.avg') },
    { value: 'min', label: t('report.aggregate.min') },
    { value: 'max', label: t('report.aggregate.max') },
  ];
}

function buildFormatOptions(t: Translator) {
  return [
    { value: NONE, label: t('report.editor.formatAuto', 'Auto') },
    { value: 'currency', label: t('report.editor.formatCurrency', 'Currency') },
    { value: 'percent', label: t('report.editor.formatPercent', 'Percent') },
    { value: 'integer', label: t('report.editor.formatInteger', 'Integer') },
    { value: 'date', label: t('report.editor.formatDate', 'Date') },
    { value: 'datetime', label: t('report.editor.formatDatetime', 'Date & time') },
  ];
}

export function normalizeColumns(value: unknown): ColumnDraft[] {
  if (!Array.isArray(value)) return [];
  return value.map((f: any) =>
    typeof f === 'string'
      ? { field: f, label: f, type: 'string' }
      : {
          field: f.field || f.name || f.value,
          label: f.label,
          type: f.type || 'string',
          aggregate: f.aggregate ?? f.aggregation,
          format: f.format,
        },
  );
}

export function ColumnsEditor({
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
  const selected = normalizeColumns(value);
  const selectedFields = new Set(selected.map((c) => c.field));
  const aggregateOptions = buildAggregateOptions(t);
  const formatOptions = buildFormatOptions(t);
  const [search, setSearch] = React.useState('');

  const toggleField = (fieldValue: string) => {
    if (selectedFields.has(fieldValue)) {
      onChange(selected.filter((c) => c.field !== fieldValue));
    } else {
      const def = availableFields.find((af) => af.value === fieldValue);
      onChange([...selected, { field: fieldValue, label: def?.label, type: def?.type || 'string' }]);
    }
  };

  const updateCol = (field: string, patch: Partial<ColumnDraft>) => {
    onChange(selected.map((c) => (c.field === field ? { ...c, ...patch } : c)));
  };

  const moveCol = (idx: number, dir: -1 | 1) => {
    const next = [...selected];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  if (availableFields.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-2" data-testid="columns-editor-empty">
        {t('report.editor.noFields', 'No fields available — pick a data source first.')}
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const remaining = availableFields.filter((f) => !selectedFields.has(f.value));
  const filtered = q
    ? remaining.filter(
        (f) => f.label.toLowerCase().includes(q) || f.value.toLowerCase().includes(q),
      )
    : remaining;

  return (
    <div className="space-y-2 py-1" data-testid="columns-editor">
      {selected.length > 0 && (
        <div className="space-y-1.5" data-testid="columns-selected">
          {selected.map((col, idx) => {
            const def = availableFields.find((af) => af.value === col.field);
            return (
              <div
                key={col.field}
                className="grid grid-cols-[auto_1fr_auto] gap-1.5 p-1.5 border rounded bg-muted/30 text-xs"
                data-testid={`column-row-${col.field}`}
              >
                <div className="row-span-2 flex flex-col items-center justify-center gap-0.5">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={idx === 0}
                    onClick={() => moveCol(idx, -1)}
                    aria-label="Move up"
                    data-testid={`column-up-${col.field}`}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={idx === selected.length - 1}
                    onClick={() => moveCol(idx, 1)}
                    aria-label="Move down"
                    data-testid={`column-down-${col.field}`}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
                <input
                  className="h-7 text-xs border rounded px-2 bg-background min-w-0 w-full"
                  value={col.label ?? ''}
                  placeholder={def?.label ?? col.field}
                  onChange={(e) => updateCol(col.field, { label: e.target.value || undefined })}
                  data-testid={`column-label-${col.field}`}
                  title={def?.label ?? col.field}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="row-span-2 h-7 w-7 p-0 shrink-0 self-start"
                  onClick={() => toggleField(col.field)}
                  data-testid={`column-remove-${col.field}`}
                  aria-label="Remove column"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {t('report.editor.aggregateColumn', 'Aggregate')}
                    </span>
                    <select
                      className="h-7 text-xs border rounded px-1 bg-background w-full min-w-0"
                      value={col.aggregate ?? NONE}
                      onChange={(e) =>
                        updateCol(col.field, { aggregate: e.target.value === NONE ? undefined : e.target.value })
                      }
                      data-testid={`column-agg-${col.field}`}
                    >
                      {aggregateOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {t('report.editor.formatColumn', 'Format')}
                    </span>
                    <select
                      className="h-7 text-xs border rounded px-1 bg-background w-full min-w-0"
                      value={col.format ?? NONE}
                      onChange={(e) =>
                        updateCol(col.field, { format: e.target.value === NONE ? undefined : e.target.value })
                      }
                      data-testid={`column-fmt-${col.field}`}
                    >
                      {formatOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="border-t pt-2">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="text-xs text-muted-foreground">
            {t('report.editor.addColumns', 'Add columns')}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {filtered.length}/{remaining.length}
          </span>
        </div>
        <input
          type="text"
          className="h-7 w-full text-xs border rounded px-2 bg-background mb-1.5"
          placeholder={t('report.editor.searchFields', 'Search fields…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="columns-search"
        />
        <div className="space-y-0.5 max-h-56 overflow-auto border rounded bg-background/50 p-1">
          {filtered.length === 0 ? (
            <div className="text-[11px] text-muted-foreground px-1.5 py-2 text-center">
              {q
                ? t('report.editor.noMatchingFields', 'No fields match your search.')
                : t('report.editor.noFieldsAvailable', 'All fields already added.')}
            </div>
          ) : (
            filtered.map((f) => (
              <label
                key={f.value}
                className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/50 text-xs cursor-pointer"
              >
                <Checkbox
                  checked={false}
                  onCheckedChange={() => toggleField(f.value)}
                  data-testid={`column-add-${f.value}`}
                />
                <span className="flex-1 truncate" title={f.label}>{f.label}</span>
                {f.type && (
                  <span className="text-[10px] text-muted-foreground shrink-0">{f.type}</span>
                )}
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
