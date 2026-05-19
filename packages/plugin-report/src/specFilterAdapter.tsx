/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { Button } from '@object-ui/components';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import type { AvailableField, Translator } from './editorTypes';

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

export function SpecFilterAdapter({
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
