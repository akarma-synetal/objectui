// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Shared building blocks for scoped metadata inspectors.
 *
 * Every inspector renders the same three regions:
 *   • Header strip — kind chip + element label + close button
 *   • Scrollable form area — labelled inputs in a single column
 *   • Footer — destructive "remove this element" button
 *
 * The widgets below factor those regions out so each per-type
 * inspector can stay focused on field definitions and update logic.
 *
 * All inputs are uncontrolled-from-outside: parent owns the draft
 * record, inspectors call `onCommit(value)` which trips an immutable
 * splice + `onPatch({...})`. Locale-aware via the `useT` hook the
 * caller already has in scope — the shared shell takes raw strings.
 */

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@object-ui/components';
import { Badge, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@object-ui/components';

/* ─────────────── Layout shell ─────────────── */

export interface InspectorShellProps {
  kindLabel: string;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function InspectorShell({ kindLabel, title, onClose, closeLabel = 'Close', children, footer }: InspectorShellProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b px-4 py-2.5">
        <div className="min-w-0">
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{kindLabel}</Badge>
          <div className="mt-1 truncate text-sm font-medium" title={title}>{title}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={closeLabel} className="h-7 w-7 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">{children}</div>
      {footer && <div className="border-t px-4 py-2.5">{footer}</div>}
    </div>
  );
}

/* ─────────────── Form atoms ─────────────── */

export function InspectorTextField({
  label,
  value,
  onCommit,
  placeholder,
  disabled,
  mono,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onCommit(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn('h-8 text-sm', mono && 'font-mono')}
      />
    </div>
  );
}

export function InspectorNumberField({
  label,
  value,
  onCommit,
  placeholder,
  disabled,
}: {
  label: string;
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onCommit(v === '' ? undefined : Number(v));
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="h-8 text-sm"
      />
    </div>
  );
}

export function InspectorSelectField({
  label,
  value,
  options,
  onCommit,
  placeholder = '—',
  disabled,
}: {
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  onCommit: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value ?? ''} onValueChange={onCommit} disabled={disabled}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function InspectorCheckboxField({
  label,
  value,
  onCommit,
  disabled,
}: {
  label: string;
  value: boolean;
  onCommit: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(e) => onCommit(e.target.checked)}
        className="h-3.5 w-3.5"
      />
      <span>{label}</span>
    </label>
  );
}

export function InspectorRemoveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="destructive" size="sm" onClick={onClick} disabled={disabled} className="w-full">
      {label}
    </Button>
  );
}

export function InspectorEmptyState({ message }: { message: string }) {
  return <div className="text-xs italic text-muted-foreground p-4 text-center">{message}</div>;
}

/**
 * Helper to immutably splice an item in an array on a draft.
 * Returns a new array; never mutates input.
 */
export function spliceArray<T>(arr: T[] | undefined, index: number, replacement: T | null): T[] {
  const a = Array.isArray(arr) ? [...arr] : [];
  if (replacement === null) a.splice(index, 1);
  else a[index] = replacement;
  return a;
}
