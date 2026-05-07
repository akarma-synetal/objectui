/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react"
import { X, Plus, ArrowUp, ArrowDown } from "lucide-react"

import { cn } from "../lib/utils"

export interface GroupingFieldEntry {
  field: string;
  order: 'asc' | 'desc';
  collapsed: boolean;
}

export interface GroupingConfigValue {
  fields: GroupingFieldEntry[];
}

export interface GroupingEditorProps {
  /** Current grouping configuration. `undefined` when no grouping is active. */
  value?: GroupingConfigValue;
  /** Called whenever the user mutates the grouping. Pass `undefined` when the
   *  list is cleared so the consumer can detect "no grouping". */
  onChange: (next: GroupingConfigValue | undefined) => void;
  /** Available fields to group by. */
  fieldOptions: Array<{ value: string; label: string }>;
  /** Maximum nesting depth. Airtable defaults to 3. */
  maxLevels?: number;
  className?: string;
  /** Optional i18n labels — fall back to English. */
  labels?: {
    addGroup?: string;
    collapseTitle?: string;
    removeTitle?: string;
    ascendingTitle?: string;
    descendingTitle?: string;
  };
}

const DEFAULT_LABELS = {
  addGroup: 'Add group field',
  collapseTitle: 'Collapsed by default',
  removeTitle: 'Remove',
  ascendingTitle: 'Ascending',
  descendingTitle: 'Descending',
};

/**
 * Airtable-style multi-level grouping editor.
 *
 * Each level is a row with: field selector, order toggle (↑/↓),
 * "default collapsed" checkbox, and a remove button. A "+ Add group field"
 * button appends a new level up to `maxLevels` (default 3).
 *
 * Field options are filtered per row so a field can only appear in one level
 * at a time. The current row's selected field stays in its own dropdown so the
 * user sees the active selection.
 */
export function GroupingEditor({
  value,
  onChange,
  fieldOptions,
  maxLevels = 3,
  className,
  labels,
}: GroupingEditorProps) {
  const L = { ...DEFAULT_LABELS, ...(labels || {}) };
  const current = value?.fields ?? [];
  const usedFields = new Set(current.map((g) => g.field));

  const writeFields = (next: GroupingFieldEntry[]) => {
    onChange(next.length ? { fields: next } : undefined);
  };

  return (
    <div data-testid="grouping-editor" className={cn("flex flex-col gap-1.5 w-full", className)}>
      {current.map((g, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <select
            data-testid={`grouping-field-${idx}`}
            className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground flex-1 min-w-0"
            value={g.field}
            onChange={(e) => {
              const next = [...current];
              next[idx] = { ...g, field: e.target.value };
              writeFields(next);
            }}
          >
            {fieldOptions
              .filter((f) => f.value === g.field || !usedFields.has(f.value))
              .map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
          </select>
          <button
            type="button"
            title={g.order === 'asc' ? L.ascendingTitle : L.descendingTitle}
            data-testid={`grouping-order-${idx}`}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-muted"
            onClick={() => {
              const next = [...current];
              next[idx] = { ...g, order: g.order === 'asc' ? 'desc' : 'asc' };
              writeFields(next);
            }}
          >
            {g.order === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          </button>
          <label
            title={L.collapseTitle}
            className="flex items-center text-xs text-muted-foreground"
          >
            <input
              type="checkbox"
              data-testid={`grouping-collapsed-${idx}`}
              className="h-3 w-3"
              checked={g.collapsed}
              onChange={(e) => {
                const next = [...current];
                next[idx] = { ...g, collapsed: e.target.checked };
                writeFields(next);
              }}
            />
          </label>
          <button
            type="button"
            title={L.removeTitle}
            data-testid={`grouping-remove-${idx}`}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-muted hover:text-destructive"
            onClick={() => {
              const next = current.filter((_, i) => i !== idx);
              writeFields(next);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {current.length < maxLevels && (() => {
        const remaining = fieldOptions.filter((f) => !usedFields.has(f.value));
        if (remaining.length === 0) return null;
        return (
          <button
            type="button"
            data-testid="grouping-add"
            className="flex h-7 items-center gap-1 self-start rounded-md border border-dashed border-input bg-background px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => {
              const next: GroupingFieldEntry[] = [
                ...current,
                { field: remaining[0].value, order: 'asc', collapsed: false },
              ];
              writeFields(next);
            }}
          >
            <Plus className="h-3 w-3" />
            {L.addGroup}
          </button>
        );
      })()}
    </div>
  );
}
