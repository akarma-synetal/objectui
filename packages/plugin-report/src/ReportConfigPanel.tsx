/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ConfigPanelRenderer,
  useConfigDraft,
  Checkbox,
  Button,
} from '@object-ui/components';
import type { ConfigPanelSchema, ConfigSection } from '@object-ui/components';
import { Plus, Trash2, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Field definition for filter / sort / grouping / chart sub-editors
// ---------------------------------------------------------------------------

export type AvailableField = {
  value: string;
  label: string;
  type?: string;
  options?: Array<{ value: string; label: string }>;
};

type Translator = (key: string, defaultValue?: string, options?: any) => string;

const DATE_TYPES = new Set(['date', 'datetime', 'time']);
const NUMERIC_TYPES = new Set(['number', 'currency', 'percent', 'rating', 'integer']);
const NONE = '' as const;

// ---------------------------------------------------------------------------
// Spec FilterCondition ↔ FilterGroup adapter
// ---------------------------------------------------------------------------
// Spec (FilterCondition):  { is_active: true }   |   { age: { $gt: 18 } }   |
//                          { $and: [...] }       |   { $or: [...] }
//
// FilterGroup (UI):        { id, logic: 'and'|'or', conditions: [{id,field,operator,value}] }
//
// Reversible only for flat structures. Nested $and/$or, $not, $field references
// and other unsupported shapes mark the filter as "complex" — the UI falls back
// to a read-only banner and the original filter is preserved verbatim on save.

const OP_SPEC_TO_UI: Record<string, string> = {
  $eq: 'equals',
  $ne: 'notEquals',
  $gt: 'greaterThan',
  $gte: 'greaterOrEqual',
  $lt: 'lessThan',
  $lte: 'lessOrEqual',
  $in: 'in',
  $nin: 'notIn',
  $contains: 'contains',
  $notContains: 'notContains',
  $exists: 'isNotEmpty',
};

const OP_UI_TO_SPEC: Record<string, string> = {
  equals: '$eq',
  notEquals: '$ne',
  greaterThan: '$gt',
  greaterOrEqual: '$gte',
  lessThan: '$lt',
  lessOrEqual: '$lte',
  in: '$in',
  notIn: '$nin',
  contains: '$contains',
  notContains: '$notContains',
};

type UICondition = {
  id: string;
  field: string;
  operator: string;
  value: any;
};

type UIGroup = {
  id: string;
  logic: 'and' | 'or';
  conditions: UICondition[];
};

const EMPTY_UI_GROUP = (): UIGroup => ({ id: 'root', logic: 'and', conditions: [] });

function isPlainObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function newCid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Try to convert a single field-level spec entry into one or more UI conditions.
 * Returns null if the entry uses unsupported features (nested groups, $field
 * references, $not, $between, etc.) — caller should mark the filter complex.
 */
function fieldEntryToConditions(field: string, raw: any): UICondition[] | null {
  // Scalar / array → equality / in
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return [{ id: newCid(), field, operator: Array.isArray(raw) ? 'in' : 'equals', value: raw }];
  }

  // Operator object — collect every supported operator key as a separate condition.
  const out: UICondition[] = [];
  for (const [op, val] of Object.entries(raw)) {
    if (op === '$exists') {
      out.push({ id: newCid(), field, operator: val === false ? 'isEmpty' : 'isNotEmpty', value: '' });
      continue;
    }
    if (op === '$null') {
      out.push({ id: newCid(), field, operator: val === false ? 'isNotEmpty' : 'isEmpty', value: '' });
      continue;
    }
    const uiOp = OP_SPEC_TO_UI[op];
    if (!uiOp) return null; // unsupported (e.g. $between, $startsWith, $regex)
    // Reject $field references — they're spec-level dynamic references the
    // UI editor can't faithfully represent yet.
    if (isPlainObject(val) && '$field' in val) return null;
    out.push({ id: newCid(), field, operator: uiOp, value: val as any });
  }
  return out.length > 0 ? out : null;
}

export interface SpecFilterParseResult {
  group: UIGroup;
  /** When true the spec filter could not be fully represented in the UI. */
  complex: boolean;
}

/**
 * Convert a spec `FilterCondition` into a UI `FilterGroup`.
 * Falsy / non-object input yields an empty AND group.
 * Nested `$and` / `$or`, `$not`, or any unrecognized shape sets `complex: true`.
 */
export function specFilterToUIGroup(spec: unknown): SpecFilterParseResult {
  if (spec === undefined || spec === null) {
    return { group: EMPTY_UI_GROUP(), complex: false };
  }
  if (!isPlainObject(spec)) {
    return { group: EMPTY_UI_GROUP(), complex: true };
  }

  const keys = Object.keys(spec);

  // Logical combinator at top level.
  if (keys.length === 1 && (keys[0] === '$and' || keys[0] === '$or')) {
    const logic: 'and' | 'or' = keys[0] === '$or' ? 'or' : 'and';
    const arr = (spec as any)[keys[0]];
    if (!Array.isArray(arr)) return { group: EMPTY_UI_GROUP(), complex: true };
    const conditions: UICondition[] = [];
    let complex = false;
    for (const item of arr) {
      if (!isPlainObject(item)) { complex = true; continue; }
      const itemKeys = Object.keys(item);
      // Nested logical → complex.
      if (itemKeys.some((k) => k === '$and' || k === '$or' || k === '$not')) {
        complex = true; continue;
      }
      // Each item should be a single-field entry. Multi-field items get flattened.
      for (const [field, raw] of Object.entries(item)) {
        const parts = fieldEntryToConditions(field, raw);
        if (parts) conditions.push(...parts);
        else complex = true;
      }
    }
    return { group: { id: 'root', logic, conditions }, complex };
  }

  if (keys.includes('$not') || keys.includes('$and') || keys.includes('$or')) {
    return { group: EMPTY_UI_GROUP(), complex: true };
  }

  // Flat field map → AND group.
  const conditions: UICondition[] = [];
  let complex = false;
  for (const [field, raw] of Object.entries(spec)) {
    const parts = fieldEntryToConditions(field, raw);
    if (parts) conditions.push(...parts);
    else complex = true;
  }
  return { group: { id: 'root', logic: 'and', conditions }, complex };
}

/**
 * Convert a UI `FilterGroup` back into a spec `FilterCondition`.
 * - Empty group → `undefined` (drop the key).
 * - Single condition (equals + simple value) → `{field: value}` shorthand.
 * - Single condition (other operator)        → `{field: {$op: value}}`.
 * - Multiple conditions → `{$and: [...]}` or `{$or: [...]}`.
 */
export function uiGroupToSpecFilter(group: UIGroup | undefined): any {
  if (!group || !Array.isArray(group.conditions) || group.conditions.length === 0) {
    return undefined;
  }
  const entries = group.conditions
    .filter((c) => c.field)
    .map((c) => uiConditionToEntry(c));
  if (entries.length === 0) return undefined;
  if (entries.length === 1) return entries[0];
  const combinator = group.logic === 'or' ? '$or' : '$and';
  return { [combinator]: entries };
}

function uiConditionToEntry(c: UICondition): Record<string, any> {
  const { field, operator, value } = c;
  if (operator === 'isEmpty') return { [field]: { $exists: false } };
  if (operator === 'isNotEmpty') return { [field]: { $exists: true } };
  if (operator === 'equals') return { [field]: value };
  const specOp = OP_UI_TO_SPEC[operator];
  if (!specOp) return { [field]: value };
  return { [field]: { [specOp]: value } };
}

// ---------------------------------------------------------------------------
// SpecFilterAdapter — visual editor that round-trips spec FilterCondition
// ---------------------------------------------------------------------------

function SpecFilterAdapter({
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
  // Parse incoming spec → UI on every render. Memoize on a JSON key so we
  // don't churn while editing; user edits go through `handleChange` below
  // and bypass this parse path.
  const incomingKey = React.useMemo(() => JSON.stringify(value ?? null), [value]);
  const parsed = React.useMemo(() => specFilterToUIGroup(value), [incomingKey]);

  const [group, setGroup] = React.useState<UIGroup>(parsed.group);
  const lastSpec = React.useRef<string>(incomingKey);

  React.useEffect(() => {
    if (lastSpec.current !== incomingKey) {
      setGroup(parsed.group);
      lastSpec.current = incomingKey;
    }
  }, [incomingKey, parsed.group]);

  const update = (next: UIGroup) => {
    setGroup(next);
    const spec = uiGroupToSpecFilter(next);
    lastSpec.current = JSON.stringify(spec ?? null);
    onChange(spec);
  };

  if (parsed.complex) {
    return (
      <div className="flex items-start gap-2 p-2 rounded border border-amber-300 bg-amber-50 text-amber-900 text-[11px]">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>{t('report.editor.filtersComplex')}</span>
      </div>
    );
  }

  const addCondition = () => {
    update({
      ...group,
      conditions: [
        ...group.conditions,
        { id: newCid(), field: availableFields[0]?.value ?? '', operator: 'equals', value: '' },
      ],
    });
  };

  const removeCondition = (id: string) => {
    update({ ...group, conditions: group.conditions.filter((c) => c.id !== id) });
  };

  const updateCondition = (id: string, patch: Partial<UICondition>) => {
    update({
      ...group,
      conditions: group.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const operatorOptions = [
    { value: 'equals', label: '=' },
    { value: 'notEquals', label: '≠' },
    { value: 'greaterThan', label: '>' },
    { value: 'greaterOrEqual', label: '≥' },
    { value: 'lessThan', label: '<' },
    { value: 'lessOrEqual', label: '≤' },
    { value: 'contains', label: t('report.editor.opContains', 'contains') },
    { value: 'in', label: 'in' },
    { value: 'notIn', label: 'not in' },
    { value: 'isEmpty', label: t('report.editor.opIsEmpty', 'is empty') },
    { value: 'isNotEmpty', label: t('report.editor.opIsNotEmpty', 'is not empty') },
  ];

  return (
    <div className="space-y-1.5 py-1" data-testid="spec-filter-adapter">
      {group.conditions.length > 1 && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{t('report.editor.combineLogic', 'Combine with')}</span>
          <select
            className="h-5 text-[10px] border rounded px-1 bg-background"
            value={group.logic}
            onChange={(e) => update({ ...group, logic: e.target.value as 'and' | 'or' })}
            data-testid="filter-logic-select"
          >
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
        </div>
      )}
      {group.conditions.map((c) => (
        <div key={c.id} className="flex items-center gap-1 text-[10px] p-1 border rounded bg-muted/20">
          <select
            className="h-5 text-[10px] border rounded px-1 bg-background flex-1 min-w-0"
            value={c.field}
            onChange={(e) => updateCondition(c.id, { field: e.target.value })}
            data-testid={`filter-field-${c.id}`}
          >
            {availableFields.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            className="h-5 text-[10px] border rounded px-1 bg-background w-20 shrink-0"
            value={c.operator}
            onChange={(e) => updateCondition(c.id, { operator: e.target.value })}
            data-testid={`filter-op-${c.id}`}
          >
            {operatorOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {c.operator !== 'isEmpty' && c.operator !== 'isNotEmpty' && (
            <input
              className="h-5 text-[10px] border rounded px-1 bg-background w-24 shrink-0"
              value={Array.isArray(c.value) ? c.value.join(',') : (c.value ?? '').toString()}
              placeholder="value"
              onChange={(e) => {
                const raw = e.target.value;
                const next = (c.operator === 'in' || c.operator === 'notIn')
                  ? raw.split(',').map((s) => s.trim()).filter(Boolean)
                  : raw;
                updateCondition(c.id, { value: next });
              }}
              data-testid={`filter-value-${c.id}`}
            />
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0 shrink-0"
            onClick={() => removeCondition(c.id)}
            data-testid={`filter-remove-${c.id}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-6 text-[10px] w-full"
        onClick={addCondition}
        disabled={availableFields.length === 0}
        data-testid="filter-add"
      >
        <Plus className="h-3 w-3 mr-1" />
        {t('report.editor.addCondition', 'Add condition')}
      </Button>
    </div>
  );
}

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

function normalizeColumns(value: unknown): ColumnDraft[] {
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

function ColumnsEditor({
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

  return (
    <div className="space-y-2 py-1" data-testid="columns-editor">
      {selected.length > 0 && (
        <div className="space-y-1" data-testid="columns-selected">
          {selected.map((col, idx) => {
            const def = availableFields.find((af) => af.value === col.field);
            return (
              <div
                key={col.field}
                className="flex items-center gap-1 p-1 border rounded bg-muted/30 text-[10px]"
                data-testid={`column-row-${col.field}`}
              >
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={idx === 0}
                    onClick={() => moveCol(idx, -1)}
                    aria-label="Move up"
                    data-testid={`column-up-${col.field}`}
                  >
                    <ArrowUp className="h-2.5 w-2.5" />
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={idx === selected.length - 1}
                    onClick={() => moveCol(idx, 1)}
                    aria-label="Move down"
                    data-testid={`column-down-${col.field}`}
                  >
                    <ArrowDown className="h-2.5 w-2.5" />
                  </button>
                </div>
                <input
                  className="h-5 text-[10px] border rounded px-1 bg-background flex-1 min-w-0"
                  value={col.label ?? ''}
                  placeholder={def?.label ?? col.field}
                  onChange={(e) => updateCol(col.field, { label: e.target.value || undefined })}
                  data-testid={`column-label-${col.field}`}
                />
                <select
                  className="h-5 text-[10px] border rounded px-1 bg-background w-16 shrink-0"
                  value={col.aggregate ?? NONE}
                  onChange={(e) => updateCol(col.field, { aggregate: e.target.value || undefined })}
                  data-testid={`column-agg-${col.field}`}
                >
                  {aggregateOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  className="h-5 text-[10px] border rounded px-1 bg-background w-16 shrink-0"
                  value={col.format ?? NONE}
                  onChange={(e) => updateCol(col.field, { format: e.target.value || undefined })}
                  data-testid={`column-fmt-${col.field}`}
                >
                  {formatOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0 shrink-0"
                  onClick={() => toggleField(col.field)}
                  data-testid={`column-remove-${col.field}`}
                  aria-label="Remove column"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <div className="border-t pt-1.5">
        <div className="text-[10px] text-muted-foreground mb-1">
          {t('report.editor.addColumns', 'Add columns')}
        </div>
        <div className="space-y-0.5 max-h-48 overflow-auto">
          {availableFields
            .filter((f) => !selectedFields.has(f.value))
            .map((f) => (
              <label
                key={f.value}
                className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/50 text-[10px] cursor-pointer"
              >
                <Checkbox
                  checked={false}
                  onCheckedChange={() => toggleField(f.value)}
                  data-testid={`column-add-${f.value}`}
                />
                <span className="flex-1">{f.label}</span>
                {f.type && (
                  <span className="text-[9px] text-muted-foreground">{f.type}</span>
                )}
              </label>
            ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupingsBuilder — ordered list of {field, sortOrder, dateGranularity}
// Used for groupingsDown (rows) and groupingsAcross (columns).
// ---------------------------------------------------------------------------

type GroupingDraft = {
  field: string;
  sortOrder?: 'asc' | 'desc';
  dateGranularity?: 'day' | 'week' | 'month' | 'quarter' | 'year';
};

function GroupingsBuilder({
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

// ---------------------------------------------------------------------------
// ChartConfig — chart subset (type / title / axes / legend / data labels)
// ---------------------------------------------------------------------------

function ChartConfig({
  availableFields,
  columns,
  value,
  onChange,
  t,
}: {
  availableFields: AvailableField[];
  columns: ColumnDraft[];
  value: any;
  onChange: (v: any) => void;
  t: Translator;
}) {
  const chart = value || {};
  const chartType = chart.type ?? chart.chartType ?? '';
  const xAxis = chart.xAxis ?? chart.xAxisField ?? '';
  const yAxis = chart.yAxis ?? chart.yAxisFields?.[0] ?? '';

  const updateChart = (updates: any) => {
    const next: any = { ...chart, ...updates };
    if ('type' in updates) delete next.chartType;
    if ('xAxis' in updates) delete next.xAxisField;
    if ('yAxis' in updates) delete next.yAxisFields;
    if (!updates.type && updates.type === '') return onChange(undefined);
    onChange(next);
  };

  const clearChart = () => onChange(undefined);

  const chartTypeOptions = [
    { value: NONE, label: t('report.editor.chartNone') },
    { value: 'bar', label: t('report.editor.chartBar') },
    { value: 'line', label: t('report.editor.chartLine') },
    { value: 'area', label: t('report.editor.chartArea') },
    { value: 'pie', label: t('report.editor.chartPie') },
    { value: 'donut', label: t('report.editor.chartDonut') },
    { value: 'funnel', label: t('report.editor.chartFunnel') },
  ];

  // Y-axis candidates: aggregated columns first, then numeric raw fields.
  const aggregatedFields = columns.filter((c) => c.aggregate).map((c) => c.field);
  const numericFields = availableFields
    .filter((f) => NUMERIC_TYPES.has(f.type ?? ''))
    .map((f) => f.value);
  const ySet = new Set<string>([...aggregatedFields, ...numericFields]);
  const yOptions = availableFields.filter((f) => ySet.has(f.value));

  return (
    <div className="space-y-2 py-1" data-testid="chart-config">
      <div>
        <label className="text-[10px] text-muted-foreground">{t('report.editor.chartType')}</label>
        <select
          className="w-full h-7 text-xs border rounded px-2 bg-background"
          value={chartType}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) clearChart();
            else updateChart({ type: v });
          }}
          data-testid="chart-type-select"
        >
          {chartTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {chartType && (
        <>
          <div>
            <label className="text-[10px] text-muted-foreground">{t('report.editor.chartTitle')}</label>
            <input
              className="w-full h-7 text-xs border rounded px-2 bg-background"
              value={chart.title ?? ''}
              placeholder={t('report.editor.chartTitlePlaceholder')}
              onChange={(e) => updateChart({ title: e.target.value || undefined })}
              data-testid="chart-title"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">{t('report.editor.chartXAxis')}</label>
            <select
              className="w-full h-7 text-xs border rounded px-2 bg-background"
              value={xAxis}
              onChange={(e) => updateChart({ xAxis: e.target.value || undefined })}
              data-testid="chart-x-field"
            >
              <option value="">—</option>
              {availableFields.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">{t('report.editor.chartYAxis')}</label>
            <select
              className="w-full h-7 text-xs border rounded px-2 bg-background"
              value={yAxis}
              onChange={(e) => updateChart({ yAxis: e.target.value || undefined })}
              data-testid="chart-y-field"
            >
              <option value="">—</option>
              {(yOptions.length > 0 ? yOptions : availableFields).map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[10px]">
            <Checkbox
              checked={chart.showLegend !== false}
              onCheckedChange={(v) => updateChart({ showLegend: v === true })}
              data-testid="chart-show-legend"
            />
            <span>{t('report.editor.chartShowLegend')}</span>
          </label>
          <label className="flex items-center gap-2 text-[10px]">
            <Checkbox
              checked={!!chart.showDataLabels}
              onCheckedChange={(v) => updateChart({ showDataLabels: v === true })}
              data-testid="chart-show-data-labels"
            />
            <span>{t('report.editor.chartShowDataLabels')}</span>
          </label>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schema builder — type-driven sections
// ---------------------------------------------------------------------------

function buildReportSchema(
  availableFields: AvailableField[],
  t: Translator,
): ConfigPanelSchema {
  const isSummary = (d: Record<string, any>) => d.type === 'summary';
  const isMatrix = (d: Record<string, any>) => d.type === 'matrix';
  const supportsChart = (d: Record<string, any>) => d.type === 'summary' || d.type === 'matrix';

  const sections: ConfigSection[] = [
    {
      key: 'basic',
      title: t('report.editor.basic'),
      fields: [
        {
          key: 'label',
          label: t('report.editor.title'),
          type: 'input',
          placeholder: t('report.editor.titlePlaceholder'),
        },
        {
          key: 'description',
          label: t('report.editor.description'),
          type: 'textarea',
          placeholder: t('report.editor.descriptionPlaceholder'),
        },
        {
          key: 'type',
          label: t('report.editor.type'),
          type: 'select',
          defaultValue: 'tabular',
          options: [
            { value: 'tabular', label: t('report.editor.typeTabular') },
            { value: 'summary', label: t('report.editor.typeSummary') },
            { value: 'matrix', label: t('report.editor.typeMatrix') },
            { value: 'joined', label: t('report.editor.typeJoined') },
          ],
          helpText: t('report.editor.typeHelp'),
        },
      ],
    },
    {
      key: 'data',
      title: t('report.editor.data'),
      collapsible: true,
      fields: [
        {
          key: 'objectName',
          label: t('report.editor.objectName'),
          type: 'input',
          placeholder: t('report.editor.objectNamePlaceholder'),
          helpText: t('report.editor.objectNameHelp'),
        },
        {
          key: 'limit',
          label: t('report.editor.limit'),
          type: 'input',
          placeholder: t('report.editor.limitPlaceholder'),
        },
      ],
    },
    {
      key: 'columns',
      title: t('report.editor.columns'),
      collapsible: true,
      hint: t('report.editor.columnsHint'),
      fields: [
        {
          key: 'columns',
          label: t('report.editor.columns'),
          type: 'custom',
          render: (value: any, onChange: (v: any) => void) => (
            <ColumnsEditor availableFields={availableFields} value={value} onChange={onChange} t={t} />
          ),
        },
      ],
    },
    {
      key: 'rows',
      title: t('report.editor.rows'),
      collapsible: true,
      hint: t('report.editor.rowsHint'),
      visibleWhen: (d) => isSummary(d) || isMatrix(d),
      fields: [
        {
          key: 'groupingsDown',
          label: t('report.editor.grouping'),
          type: 'custom',
          render: (value: any, onChange: (v: any) => void) => (
            <GroupingsBuilder availableFields={availableFields} value={value} onChange={onChange} t={t} />
          ),
        },
      ],
    },
    {
      key: 'columnsAxis',
      title: t('report.editor.columnsAxis'),
      collapsible: true,
      hint: t('report.editor.columnsAxisHint'),
      visibleWhen: (d) => isMatrix(d),
      fields: [
        {
          key: 'groupingsAcross',
          label: t('report.editor.grouping'),
          type: 'custom',
          render: (value: any, onChange: (v: any) => void) => (
            <GroupingsBuilder availableFields={availableFields} value={value} onChange={onChange} t={t} />
          ),
        },
      ],
    },
    {
      key: 'filters',
      title: t('report.editor.filters'),
      collapsible: true,
      hint: t('report.editor.filtersHint'),
      fields: [
        {
          key: 'filter',
          label: t('report.editor.filters'),
          type: 'custom',
          render: (value: any, onChange: (v: any) => void) => (
            <SpecFilterAdapter availableFields={availableFields} value={value} onChange={onChange} t={t} />
          ),
        },
      ],
    },
    {
      key: 'chart',
      title: t('report.editor.chart'),
      collapsible: true,
      defaultCollapsed: true,
      hint: t('report.editor.chartHint'),
      visibleWhen: (d) => supportsChart(d),
      fields: [
        {
          key: 'chart',
          label: t('report.editor.chart'),
          type: 'custom',
          render: (value: any, onChange: (v: any) => void, draft: Record<string, any>) => (
            <ChartConfig
              availableFields={availableFields}
              columns={normalizeColumns(draft.columns)}
              value={value}
              onChange={onChange}
              t={t}
            />
          ),
        },
      ],
    },
  ];

  return {
    breadcrumb: [t('report.editor.breadcrumb', 'Configuration')],
    sections,
  };
}

// ---------------------------------------------------------------------------
// ValidationBanner — surfaces missing-required-spec issues at the top
// ---------------------------------------------------------------------------

type ValidationProblem = { level: 'error' | 'warning'; message: string };

function collectValidationProblems(draft: Record<string, any>, t: Translator): ValidationProblem[] {
  const problems: ValidationProblem[] = [];
  const type = draft.type ?? 'tabular';
  const downCount = Array.isArray(draft.groupingsDown) ? draft.groupingsDown.length : 0;
  const acrossCount = Array.isArray(draft.groupingsAcross) ? draft.groupingsAcross.length : 0;
  const cols = Array.isArray(draft.columns) ? draft.columns.length : 0;

  if (!draft.objectName) {
    problems.push({
      level: cols > 0 ? 'error' : 'warning',
      message: t('report.editor.validationNeedsObject'),
    });
  }
  if (type === 'matrix' && (downCount === 0 || acrossCount === 0)) {
    problems.push({ level: 'error', message: t('report.editor.validationMatrixNeedsRowsCols') });
  }
  if (type === 'summary' && downCount === 0) {
    problems.push({ level: 'error', message: t('report.editor.validationSummaryNeedsRows') });
  }
  return problems;
}

function ValidationBanner({ problems }: { problems: ValidationProblem[] }) {
  if (problems.length === 0) return null;
  return (
    <div className="space-y-1 p-2 border-b" data-testid="report-validation-banner">
      {problems.map((p, i) => (
        <div
          key={i}
          className={
            'flex items-start gap-2 text-[11px] rounded px-2 py-1 ' +
            (p.level === 'error'
              ? 'bg-red-50 border border-red-200 text-red-900'
              : 'bg-amber-50 border border-amber-200 text-amber-900')
          }
        >
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{p.message}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReportConfigPanel — public entry consumed by ReportView
// ---------------------------------------------------------------------------

export interface ReportConfigPanelProps {
  open: boolean;
  onClose: () => void;
  config: Record<string, any> | null;
  onSave: (config: Record<string, any>) => void;
  onFieldChange?: (key: string, value: any, draft: Record<string, any>) => void;
  availableFields?: AvailableField[];
}

export function ReportConfigPanel({
  open,
  onClose,
  config,
  onSave,
  onFieldChange,
  availableFields,
}: ReportConfigPanelProps) {
  const { t } = useTranslation();
  const tt: Translator = React.useCallback(
    (key, defaultValue, options) => {
      if (defaultValue !== undefined) return t(key, { defaultValue, ...(options || {}) }) as string;
      return t(key, options) as string;
    },
    [t],
  );

  const fields: AvailableField[] = availableFields ?? [];
  const schema = React.useMemo(() => buildReportSchema(fields, tt), [fields, tt]);

  const source = React.useMemo(() => config ?? {}, [config]);
  const { draft, isDirty, updateField, discard } = useConfigDraft<Record<string, any>>(source);

  const handleFieldChange = React.useCallback(
    (key: string, value: any) => {
      updateField(key, value);
      onFieldChange?.(key, value, { ...draft, [key]: value });
    },
    [updateField, onFieldChange, draft],
  );

  const handleSave = React.useCallback(() => {
    onSave(draft);
    onClose();
  }, [draft, onSave, onClose]);

  const problems = React.useMemo(() => collectValidationProblems(draft, tt), [draft, tt]);

  if (!open) return null;

  return (
    <ConfigPanelRenderer
      open={open}
      onClose={onClose}
      schema={schema}
      draft={draft}
      isDirty={isDirty}
      onFieldChange={handleFieldChange}
      onSave={handleSave}
      onDiscard={discard}
      headerExtra={<ValidationBanner problems={problems} />}
    />
  );
}

export default ReportConfigPanel;
