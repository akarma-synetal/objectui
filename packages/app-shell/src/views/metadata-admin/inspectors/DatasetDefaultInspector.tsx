// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DatasetDefaultInspector — the curated designer for an analytics `dataset`
 * (ADR-0021). Replaces the generic whole-draft JSON SchemaForm with structured,
 * fool-proof editors for the dataset's parts:
 *
 *   - base `object`,
 *   - `include` relationships (the join allowlist — D-C),
 *   - `dimensions` (name + field/`relationship.field` + type), and
 *   - `measures` (name + aggregate + field + certified).
 *
 * The aggregate is a closed dropdown (count/sum/avg/min/max/count_distinct) so
 * an author can't type an unsupported function — the dataset compiler rejects
 * `array_agg`/`string_agg` in v1, and surfacing only the valid set avoids that
 * round-trip. Edits flow through `onPatch`; the DatasetPreview on the canvas
 * re-runs live as the draft changes.
 */

import * as React from 'react';
import { Plus, X } from 'lucide-react';
import { Badge, Button, Input, Label } from '@object-ui/components';
import {
  InspectorShell,
  InspectorTextField,
  InspectorSelectField,
  InspectorCheckboxField,
  InspectorRemoveButton,
  appendArray,
  spliceArray,
} from './_shared';
import type { MetadataDefaultInspectorProps } from '../default-inspector-registry';

// Closed to what the dataset compiler supports (no array_agg/string_agg in v1).
const AGGREGATE_OPTIONS = [
  { value: 'count', label: 'count' },
  { value: 'sum', label: 'sum' },
  { value: 'avg', label: 'avg' },
  { value: 'min', label: 'min' },
  { value: 'max', label: 'max' },
  { value: 'count_distinct', label: 'count distinct' },
];

const DIMENSION_TYPE_OPTIONS = [
  { value: 'string', label: 'string' },
  { value: 'number', label: 'number' },
  { value: 'date', label: 'date' },
  { value: 'boolean', label: 'boolean' },
  { value: 'lookup', label: 'lookup' },
];

type Dimension = { name?: string; field?: string; type?: string };
type Measure = { name?: string; aggregate?: string; field?: string; certified?: boolean };

function SectionHeader({ title, count, onAdd, addLabel }: { title: string; count: number; onAdd?: () => void; addLabel: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground">{title}</Label>
        <Badge variant="outline" className="text-[10px]">{count}</Badge>
      </div>
      {onAdd && (
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]" onClick={onAdd}>
          <Plus className="h-3 w-3" /> {addLabel}
        </Button>
      )}
    </div>
  );
}

export function DatasetDefaultInspector({ draft, onPatch, readOnly }: MetadataDefaultInspectorProps) {
  const label = typeof draft.label === 'string' ? draft.label : '';
  const description = typeof draft.description === 'string' ? draft.description : '';
  const object = typeof draft.object === 'string' ? draft.object : '';
  const include: string[] = Array.isArray(draft.include) ? (draft.include as string[]) : [];
  const dimensions: Dimension[] = Array.isArray(draft.dimensions) ? (draft.dimensions as Dimension[]) : [];
  const measures: Measure[] = Array.isArray(draft.measures) ? (draft.measures as Measure[]) : [];

  const patchDimension = (i: number, patch: Partial<Dimension>) =>
    onPatch({ dimensions: dimensions.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });
  const patchMeasure = (i: number, patch: Partial<Measure>) =>
    onPatch({ measures: measures.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) });

  return (
    <InspectorShell kindLabel="Dataset" title={String(label || draft.name || 'Dataset')} onClose={() => {}} hideClose>
      <InspectorTextField label="Label" value={label} onCommit={(v) => onPatch({ label: v })} disabled={readOnly} />
      <InspectorTextField label="Description" value={description} onCommit={(v) => onPatch({ description: v })} disabled={readOnly} />
      <InspectorTextField label="Base object" value={object} onCommit={(v) => onPatch({ object: v })} placeholder="e.g. opportunity" disabled={readOnly} mono />

      {/* Included relationships (the join allowlist) */}
      <div className="border-t pt-3 space-y-1.5">
        <SectionHeader
          title="Included relationships"
          count={include.length}
          addLabel="Add"
          onAdd={readOnly ? undefined : () => onPatch({ include: appendArray(include, '') })}
        />
        {include.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-center text-[11px] text-muted-foreground">
            No joins. Add a relationship name (e.g. <code>account</code>) to use <code>account.field</code> dimensions/measures.
          </p>
        ) : (
          include.map((rel, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                value={rel}
                onChange={(e) => onPatch({ include: include.map((r, idx) => (idx === i ? e.target.value : r)) })}
                placeholder="relationship name (lookup field)"
                disabled={readOnly}
                className="h-8 text-sm font-mono"
              />
              {!readOnly && (
                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" onClick={() => onPatch({ include: spliceArray(include, i, null) })} aria-label="Remove relationship">
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Dimensions */}
      <div className="border-t pt-3 space-y-2">
        <SectionHeader
          title="Dimensions"
          count={dimensions.length}
          addLabel="Add dimension"
          onAdd={readOnly ? undefined : () => onPatch({ dimensions: appendArray(dimensions, { name: '', field: '', type: 'string' }) })}
        />
        {dimensions.map((d, i) => (
          <div key={i} className="rounded-md border p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Dimension {i + 1}</span>
              {!readOnly && <InspectorRemoveButton label="Remove" onClick={() => onPatch({ dimensions: spliceArray(dimensions, i, null) })} />}
            </div>
            <InspectorTextField label="Name" value={d.name ?? ''} onCommit={(v) => patchDimension(i, { name: v })} placeholder="e.g. region" disabled={readOnly} mono />
            <InspectorTextField label="Field" value={d.field ?? ''} onCommit={(v) => patchDimension(i, { field: v })} placeholder="field or relationship.field" disabled={readOnly} mono />
            <InspectorSelectField label="Type" value={d.type} options={DIMENSION_TYPE_OPTIONS} onCommit={(v) => patchDimension(i, { type: v })} disabled={readOnly} />
          </div>
        ))}
      </div>

      {/* Measures */}
      <div className="border-t pt-3 space-y-2">
        <SectionHeader
          title="Measures"
          count={measures.length}
          addLabel="Add measure"
          onAdd={readOnly ? undefined : () => onPatch({ measures: appendArray(measures, { name: '', aggregate: 'sum', field: '', certified: false }) })}
        />
        {measures.map((m, i) => (
          <div key={i} className="rounded-md border p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Measure {i + 1}</span>
              {!readOnly && <InspectorRemoveButton label="Remove" onClick={() => onPatch({ measures: spliceArray(measures, i, null) })} />}
            </div>
            <InspectorTextField label="Name" value={m.name ?? ''} onCommit={(v) => patchMeasure(i, { name: v })} placeholder="e.g. revenue" disabled={readOnly} mono />
            <InspectorSelectField label="Aggregate" value={m.aggregate} options={AGGREGATE_OPTIONS} onCommit={(v) => patchMeasure(i, { aggregate: v })} disabled={readOnly} />
            <InspectorTextField label="Field" value={m.field ?? ''} onCommit={(v) => patchMeasure(i, { field: v })} placeholder="field (optional for count)" disabled={readOnly} mono />
            <InspectorCheckboxField label="Certified" value={!!m.certified} onCommit={(v) => patchMeasure(i, { certified: v })} disabled={readOnly} />
          </div>
        ))}
      </div>
    </InspectorShell>
  );
}
