/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * ConcurrentUpdateDialog — Optimistic Concurrency Control conflict UX.
 *
 * Surfaced when a save races another writer and the server rejects with
 * `409 CONCURRENT_UPDATE`. Mirrors the pattern used by Jira / ServiceNow /
 * Dynamics 365: present the user with the freshest server value alongside
 * their pending edit, and let them choose how to resolve.
 *
 * The dialog is intentionally schema-agnostic: it shows the raw field
 * name plus before/after string previews. The caller is responsible for
 * supplying user-facing field labels and for actually performing the
 * "Reload" / "Overwrite" actions (the dialog just signals intent).
 */
"use client";

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@object-ui/components';

export interface ConcurrentUpdateConflict {
  /** Field machine name that the user tried to update. */
  field: string;
  /** User-facing label for the field. */
  label?: string;
  /** Value the user attempted to write. */
  pendingValue: unknown;
  /** Value currently on the server (may be undefined when unknown). */
  currentValue: unknown;
  /** Latest server-side `updated_at` token, useful for an "overwrite" retry. */
  currentVersion?: string;
  /** Full latest server record, when the backend included it in the 409. */
  currentRecord?: Record<string, unknown> | null;
}

export interface ConcurrentUpdateDialogProps {
  open: boolean;
  conflict: ConcurrentUpdateConflict | null;
  /** "Reload latest" — discard the user's pending edit and refetch. */
  onReload: () => void;
  /** "Overwrite anyway" — retry the save, re-keyed against currentVersion. */
  onOverwrite: () => void;
  /** "Cancel" — close the dialog and leave the form in its pre-save state. */
  onCancel: () => void;
  /** Whether an action is in flight (disables buttons). */
  busy?: boolean;
}

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.length > 0 ? value : '""';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const ConcurrentUpdateDialog: React.FC<ConcurrentUpdateDialogProps> = ({
  open,
  conflict,
  onReload,
  onOverwrite,
  onCancel,
  busy = false,
}) => {
  const fieldLabel = conflict?.label || conflict?.field || 'this field';
  const pendingPreview = conflict ? formatValue(conflict.pendingValue) : '';
  const currentPreview = conflict ? formatValue(conflict.currentValue) : '';

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>This record was modified by someone else</AlertDialogTitle>
          <AlertDialogDescription>
            Another user saved a newer version of <strong>{fieldLabel}</strong> while you
            were editing. To prevent silently overwriting their change, please choose how
            to resolve the conflict.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-md border bg-muted/30 text-sm">
          <div className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 p-3">
            <div className="text-muted-foreground">Your edit</div>
            <div className="font-mono break-all">{pendingPreview}</div>
            <div className="text-muted-foreground">Current value</div>
            <div className="font-mono break-all">{currentPreview}</div>
          </div>
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={busy} onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <button
            type="button"
            disabled={busy}
            onClick={onReload}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            Reload latest
          </button>
          <AlertDialogAction disabled={busy} onClick={onOverwrite}>
            Overwrite anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConcurrentUpdateDialog;

/**
 * Lightweight duck-typed check. Avoids a runtime dependency on
 * `@object-ui/data-objectstack` (and any other adapter that wants to
 * raise the same kind of error) while still recognising the canonical
 * shape: `code === 'CONCURRENT_UPDATE'` carrying optional
 * `currentVersion` / `currentRecord` fields.
 */
export function isConcurrentUpdateError(err: unknown): err is {
  code: 'CONCURRENT_UPDATE';
  currentVersion?: string;
  currentRecord?: Record<string, unknown> | null;
  message?: string;
} {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; name?: string };
  return e.code === 'CONCURRENT_UPDATE' || e.name === 'ConcurrentUpdateError';
}
