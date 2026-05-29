// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectPreview — runtime-fidelity preview of an Object metadata draft.
 *
 * Mounts the same `<ObjectGrid>` component that production runs in
 * `@object-ui/plugin-grid`, with the draft's `name` and derived columns.
 * This guarantees the preview pane shows EXACTLY what users will see in
 * the deployed app — no parallel renderer, no synthetic placeholders.
 *
 * Schema editing (rename / retype / reorder / add field) is handled in
 * the Form panel by the `record` field type (SchemaForm `RecordField`),
 * NOT inside the preview. See ADR-0014 §"Why not Airtable mode" for the
 * rationale: ObjectStack's Field protocol has ~30 properties (validation,
 * options with color/icon, formula, RLS, …) which a column-header popover
 * cannot honestly expose. We follow the Salesforce/ServiceNow split of
 * Data view ≠ Schema editor instead of the Airtable hybrid.
 */

import * as React from 'react';
import { ObjectGrid } from '@object-ui/plugin-grid';
import type { ObjectGridSchema, ListColumn } from '@object-ui/types';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';

interface FieldDef {
  name?: string;
  label?: string;
  type?: string;
  [k: string]: unknown;
}

/** Derive grid columns from the draft's `fields` record/array. */
function deriveColumns(fieldsInput: unknown): ListColumn[] {
  if (!fieldsInput) return [];
  const entries: Array<{ name: string; def: FieldDef }> = Array.isArray(fieldsInput)
    ? (fieldsInput as FieldDef[])
        .map((def, i) => ({
          name: String(def?.name ?? `field_${i + 1}`),
          def,
        }))
        .filter((x) => !!x.name)
    : Object.entries(fieldsInput as Record<string, FieldDef>).map(([name, def]) => ({
        name,
        def,
      }));

  return entries.map(({ name, def }) => ({
    field: name,
    label: String(def?.label ?? name),
    type: def?.type as ListColumn['type'],
  }));
}

export function ObjectPreview({ name, draft }: MetadataPreviewProps) {
  const objectName = String((draft as any).name ?? name ?? '');
  const columns = React.useMemo(() => deriveColumns((draft as any).fields), [draft]);
  const label = String((draft as any).label ?? objectName);
  const pluralLabel = String((draft as any).pluralLabel ?? `${label}s`);

  if (!objectName) {
    return (
      <PreviewShell hint="object">
        <PreviewMessage>
          Give the object a name in the Form tab to enable the preview.
        </PreviewMessage>
      </PreviewShell>
    );
  }

  if (columns.length === 0) {
    return (
      <PreviewShell hint="object · 0 fields">
        <PreviewMessage>
          Add at least one field in the Form tab to enable the preview.
        </PreviewMessage>
      </PreviewShell>
    );
  }

  // Build a minimal ObjectGridSchema. When `data` is omitted ObjectGrid
  // defaults to `{ provider: 'object', object: objectName }` and fetches
  // real rows from the REST API — exactly what production does.
  const schema: ObjectGridSchema = {
    type: 'object-grid',
    objectName,
    label: pluralLabel,
    columns,
  };

  return (
    <PreviewShell hint={`object · ${columns.length} field${columns.length === 1 ? '' : 's'}`}>
      <PreviewErrorBoundary fallbackHint="The object metadata couldn't be rendered. Save the draft and reload to retry.">
        <div className="h-full overflow-auto">
          <ObjectGrid schema={schema} />
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}
