/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@object-ui/components';
import { Plus, Search } from 'lucide-react';
import type { AvailableField, Translator } from './editorTypes';

// ---------------------------------------------------------------------------
// FieldPickerDialog — reusable popup multi-select for picking fields.
// Used by ColumnsEditor, GroupingsBuilder, etc. The dialog batches selections
// so the user can pick several fields at once instead of clicking inline
// checkboxes one-by-one in a cramped sidebar.
// ---------------------------------------------------------------------------

export interface FieldPickerDialogProps {
  availableFields: AvailableField[];
  /** Field values already selected (will be disabled in the picker). */
  selectedValues: string[];
  /** Invoked with the *new* field values picked (does not include already-selected). */
  onAdd: (fieldValues: string[]) => void;
  t: Translator;
  /** Trigger button label override. */
  triggerLabel?: string;
  /** Dialog title override. */
  title?: string;
  /** Dialog description override. */
  description?: string;
  /** Test-id namespace for buttons / inputs. */
  testIdPrefix?: string;
  /** Allow only a single selection at a time (e.g. picking a single grouping field). */
  singleSelect?: boolean;
  /** When true (+singleSelect), clicking a row immediately commits and closes. */
  commitOnSelect?: boolean;
  /** Disable the trigger button. */
  disabled?: boolean;
  /** Extra trigger className. */
  triggerClassName?: string;
  /** Custom trigger element (e.g. a button showing the currently picked field). */
  trigger?: React.ReactElement;
}

export function FieldPickerDialog({
  availableFields,
  selectedValues,
  onAdd,
  t,
  triggerLabel,
  title,
  description,
  testIdPrefix = 'field-picker',
  singleSelect = false,
  commitOnSelect = false,
  disabled = false,
  triggerClassName,
  trigger,
}: FieldPickerDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [pending, setPending] = React.useState<Set<string>>(new Set());

  const selectedSet = React.useMemo(() => new Set(selectedValues), [selectedValues]);

  // Reset transient state every time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setSearch('');
      setPending(new Set());
    }
  }, [open]);

  const q = search.trim().toLowerCase();
  const remaining = availableFields.filter((f) => !selectedSet.has(f.value));
  const filtered = q
    ? remaining.filter(
        (f) => f.label.toLowerCase().includes(q) || f.value.toLowerCase().includes(q),
      )
    : remaining;

  const togglePending = (fieldValue: string) => {
    if (singleSelect && commitOnSelect) {
      // Skip the staged state entirely: commit + close.
      onAdd([fieldValue]);
      setOpen(false);
      return;
    }
    setPending((prev) => {
      const next = new Set(singleSelect ? [] : prev);
      if (prev.has(fieldValue)) {
        next.delete(fieldValue);
      } else {
        next.add(fieldValue);
      }
      return next;
    });
  };

  const commit = () => {
    if (pending.size === 0) {
      setOpen(false);
      return;
    }
    // Preserve the order the user encountered them in the filtered list.
    const ordered = remaining.map((f) => f.value).filter((v) => pending.has(v));
    onAdd(ordered);
    setOpen(false);
  };

  const cancel = () => {
    setOpen(false);
  };

  const noFieldsAvailable = availableFields.length === 0;
  const allAlreadyAdded = !noFieldsAvailable && remaining.length === 0;

  const resolvedTriggerLabel =
    triggerLabel ?? t('report.editor.addColumns', 'Add fields');
  const resolvedTitle =
    title ?? t('report.editor.fieldPickerTitle', 'Select fields');
  const resolvedDescription =
    description ??
    t(
      'report.editor.fieldPickerDescription',
      'Pick one or more fields to add. Use the search box to narrow the list.',
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={triggerClassName ?? 'h-8 gap-1.5'}
            disabled={disabled || noFieldsAvailable || allAlreadyAdded}
            data-testid={`${testIdPrefix}-trigger`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{resolvedTriggerLabel}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md max-w-[92vw] gap-3"
        data-testid={`${testIdPrefix}-dialog`}
      >
        <DialogHeader>
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription>{resolvedDescription}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            className="h-9 w-full text-sm border rounded pl-7 pr-2 bg-background"
            placeholder={t('report.editor.searchFields', 'Search fields…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid={`${testIdPrefix}-search`}
            autoFocus
          />
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center justify-between">
          <span>
            {filtered.length}/{remaining.length}
            {pending.size > 0 ? ` · ${t('report.editor.fieldPickerSelected', '{n} selected').replace('{n}', String(pending.size))}` : ''}
          </span>
          {pending.size > 0 && (
            <button
              type="button"
              className="text-[11px] underline-offset-2 hover:underline text-muted-foreground"
              onClick={() => setPending(new Set())}
              data-testid={`${testIdPrefix}-clear`}
            >
              {t('report.editor.fieldPickerClear', 'Clear selection')}
            </button>
          )}
        </div>
        <div
          className="max-h-72 overflow-auto border rounded bg-background/40 p-1 space-y-0.5"
          data-testid={`${testIdPrefix}-list`}
        >
          {noFieldsAvailable ? (
            <div className="text-xs text-muted-foreground px-2 py-3 text-center">
              {t('report.editor.noFields', 'No fields available — pick a data source first.')}
            </div>
          ) : allAlreadyAdded ? (
            <div className="text-xs text-muted-foreground px-2 py-3 text-center">
              {t('report.editor.noFieldsAvailable', 'All fields already added.')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground px-2 py-3 text-center">
              {t('report.editor.noMatchingFields', 'No fields match your search.')}
            </div>
          ) : (
            filtered.map((f) => {
              const checked = pending.has(f.value);
              return (
                <label
                  key={f.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-sm cursor-pointer"
                  data-testid={`${testIdPrefix}-row-${f.value}`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => togglePending(f.value)}
                    data-testid={`${testIdPrefix}-toggle-${f.value}`}
                  />
                  <span className="flex-1 truncate" title={f.label}>{f.label}</span>
                  {f.type && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{f.type}</span>
                  )}
                </label>
              );
            })
          )}
        </div>
        {!(singleSelect && commitOnSelect) && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancel}
              data-testid={`${testIdPrefix}-cancel`}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={commit}
              disabled={pending.size === 0}
              data-testid={`${testIdPrefix}-confirm`}
            >
              {pending.size > 0
                ? t('report.editor.fieldPickerAddN', 'Add {n}').replace('{n}', String(pending.size))
                : t('report.editor.fieldPickerAdd', 'Add')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
