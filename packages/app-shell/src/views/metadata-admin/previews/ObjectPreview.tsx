// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectPreview — Airtable-style schema-as-table preview for an Object
 * metadata draft.
 *
 * Each field is rendered as a TABLE COLUMN (with type icon + label + name);
 * sample rows are fetched from the live API when the object exists, or
 * synthesised when it doesn't (so the preview is meaningful in create mode
 * too). When the host is in edit mode, authors can:
 *
 *   • Click a column header → rename, retype, toggle Required, delete.
 *   • Drag a column header → reorder fields.
 *   • Click "+" at the trailing column → add a new field with smart name
 *     suggestion from the display label.
 *
 * Edits are emitted upward as a `{ fields }` patch on `onPatch`, which the
 * metadata-admin host folds into the draft — so the Form tab and the
 * FieldsTable stay perfectly in sync.
 *
 * When `onPatch` is omitted, the preview is fully read-only (legacy
 * behaviour preserved for existing call sites).
 */

import * as React from 'react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';
import { FieldsTable } from './object/FieldsTable';

interface FieldDef {
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  [k: string]: unknown;
}

/**
 * Read `draft.fields` which may be a Record<string, FieldDef> (the
 * canonical shape) or an array of FieldDef. Returns a stable ordered
 * list of `{ name, def }`.
 */
function readFields(draft: Record<string, unknown>): Array<{ name: string; def: FieldDef }> {
  const f = draft.fields;
  if (!f) return [];
  if (Array.isArray(f)) {
    return f
      .map((d: any, i) => {
        const name = String(d?.name ?? '').trim() || `field_${i + 1}`;
        return { name, def: d as FieldDef };
      })
      .filter((x) => !!x.name);
  }
  if (typeof f === 'object') {
    return Object.entries(f as Record<string, FieldDef>).map(([name, def]) => ({
      name,
      def: { ...def, name },
    }));
  }
  return [];
}

export function ObjectPreview({ name, draft, editing, onPatch }: MetadataPreviewProps) {
  const objectName = String((draft as any).name ?? name ?? '');
  const fields = React.useMemo(() => readFields(draft), [draft]);
  const [sampleRows, setSampleRows] = React.useState<Record<string, unknown>[]>([]);

  // Fetch live rows when the object has a name. Failures degrade silently
  // — we just show placeholder cells.
  React.useEffect(() => {
    if (!objectName) {
      setSampleRows([]);
      return;
    }
    let cancelled = false;
    const url = `/api/v1/objects/${encodeURIComponent(objectName)}?limit=5`;
    fetch(url, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled) return;
        const items =
          (body?.items as Record<string, unknown>[] | undefined) ??
          (body?.data as Record<string, unknown>[] | undefined) ??
          (Array.isArray(body) ? (body as Record<string, unknown>[]) : []) ??
          [];
        setSampleRows(items);
      })
      .catch(() => {
        if (!cancelled) setSampleRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [objectName]);

  if (!objectName && fields.length === 0) {
    return (
      <PreviewShell hint="object">
        <PreviewMessage>
          Give the object a name and add at least one field to enable the preview.
        </PreviewMessage>
      </PreviewShell>
    );
  }

  const label = String((draft as any).label ?? objectName);
  const pluralLabel = String((draft as any).pluralLabel ?? `${label}s`);
  const canEdit = !!editing && !!onPatch;

  return (
    <PreviewShell hint={`object · ${fields.length} field${fields.length === 1 ? '' : 's'}`}>
      <PreviewErrorBoundary fallbackHint="The object metadata couldn't be rendered. Save the draft and reload to retry.">
        <div className="p-3 space-y-3">
          {/* Header banner */}
          <div className="flex items-baseline gap-2 px-1 text-xs">
            <span className="text-sm font-medium">{pluralLabel}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{objectName}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {sampleRows.length > 0
                ? `${sampleRows.length} sample row${sampleRows.length === 1 ? '' : 's'} from live data`
                : canEdit
                  ? 'No live data — placeholder samples shown. Drag column headers to reorder.'
                  : 'No live data — placeholder samples shown.'}
            </span>
          </div>

          <FieldsTable
            fields={fields}
            sampleRows={sampleRows}
            editing={canEdit}
            onFieldsChange={
              canEdit
                ? (nextFields: Record<string, FieldDef>) => onPatch!({ fields: nextFields })
                : undefined
            }
          />

          {/* Tip strip */}
          {canEdit && (
            <div className="text-[10px] text-muted-foreground italic px-1">
              Tip: click a column header to edit the field, drag the grip handle to reorder,
              or click "+" to add a new column. All changes flow back to the Form tab.
            </div>
          )}
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}
