// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ViewVariantInspector — the curated "home" panel for a View variant.
 *
 * Shown:
 *   • as the DEFAULT right panel (no selection) for the primary variant, and
 *   • as the scoped inspector when a variant tab is selected
 *     (`{ kind:'view', id:'<variant>' }`).
 *
 * SPEC-DRIVEN: the per-view-type config fields are NOT hardcoded. They are
 * rendered by feeding the spec's canonical authoring form (`viewForm`) and
 * the spec-derived View JSONSchema into the generic {@link SchemaForm}. The
 * form's type-conditional `visibleOn` sections automatically surface the
 * right fields for grid / kanban / calendar / gallery / gantt / timeline /
 * chart — adding a new view type or prop to `@objectstack/spec` flows
 * through with zero code changes here.
 *
 * The inspector keeps a thin curated layer for two cross-cutting concerns
 * the spec form can't express well on its own:
 *   1. the VIEW TYPE picker (options sourced from the spec `type` enum), and
 *   2. the bound OBJECT (stored at `data.object`, drives field loading).
 *
 * Column add / reorder / select lives in the live column canvas above the
 * grid; per-column properties live in {@link ViewColumnInspector}. Those
 * fields are therefore pruned from the spec form to avoid double-editing.
 */

import * as React from 'react';
import {
  InspectorShell,
  InspectorTextField,
  InspectorSelectField,
} from './_shared';
import type { MetadataDefaultInspectorProps } from '../default-inspector-registry';
import { SchemaForm } from '../SchemaForm';
import { useObjectFields } from '../previews/useObjectFields';
import {
  getViewForm,
  getListVariantSchema,
  getFormVariantSchema,
} from '../view-schema';

export interface ViewVariantInspectorProps extends MetadataDefaultInspectorProps {
  /** Which top-level variant this inspector edits (e.g. 'list'). */
  variantKey: string;
  /** When true, the close (×) button is hidden (home mode). */
  isHome: boolean;
  /** Clear the current selection (scoped mode only). */
  onClearSelection?: () => void;
}

/** Variant keys that store a FORM-family view (no columns). */
const FORM_FAMILY = new Set(['form', 'detail']);

/** Human labels for the spec `type` enum (falls back to the raw value). */
const TYPE_LABELS: Record<string, string> = {
  grid: 'Table / List',
  kanban: 'Kanban',
  calendar: 'Calendar',
  gallery: 'Gallery',
  gantt: 'Gantt',
  timeline: 'Timeline',
  map: 'Map',
  chart: 'Chart',
};

/** Keys re-pinned from the live draft after every spec-form edit. */
const PRESERVED_KEYS = ['columns', 'data', 'name'] as const;

/** Resolve the object name a variant is bound to (and where it is stored). */
function readObjectBinding(schema: Record<string, unknown>): {
  value: string;
  path: 'data.object' | 'object';
} {
  const data = schema.data as Record<string, unknown> | undefined;
  if (data && typeof data === 'object' && typeof data.object === 'string') {
    return { value: data.object, path: 'data.object' };
  }
  if (typeof schema.object === 'string') {
    return { value: schema.object, path: 'object' };
  }
  return { value: '', path: 'data.object' };
}

/** Build the View-type <select> options from the spec `type` enum. */
function useTypeOptions(currentType: string) {
  return React.useMemo(() => {
    const schema = getListVariantSchema();
    const rawEnum = schema?.properties?.type?.enum;
    const values: string[] =
      Array.isArray(rawEnum) && rawEnum.length
        ? rawEnum.filter((v: unknown): v is string => typeof v === 'string')
        : ['grid', 'kanban', 'calendar', 'gallery', 'gantt', 'timeline'];
    const opts = values.map((v) => ({ value: v, label: TYPE_LABELS[v] ?? v }));
    if (!opts.some((o) => o.value === currentType) && currentType) {
      opts.push({ value: currentType, label: currentType });
    }
    return opts;
  }, [currentType]);
}

export function ViewVariantInspector({
  draft,
  variantKey,
  isHome,
  onPatch,
  readOnly,
  onClearSelection,
}: ViewVariantInspectorProps) {
  const variant = (draft[variantKey] as Record<string, unknown> | undefined) ?? {};

  const isFormFamily = FORM_FAMILY.has(variantKey);
  const viewType =
    typeof variant.type === 'string' ? (variant.type as string) : 'grid';
  const typeOptions = useTypeOptions(viewType);
  const binding = readObjectBinding(variant);

  // Load the bound object's field catalog so field-reference config props
  // (groupByField, startDateField, xAxisField, visibleFields, …) render as
  // object-field pickers rather than free-text inputs.
  const { fields: objectFields } = useObjectFields(binding.value || undefined);
  const widgetContext = React.useMemo(
    () => ({
      objectFields: objectFields.map((f) => ({
        name: f.name,
        label: f.label,
        type: f.type,
      })),
    }),
    [objectFields],
  );

  const form = isFormFamily ? undefined : getViewForm();
  const schema = isFormFamily ? getFormVariantSchema() : getListVariantSchema();

  /** Shallow-write a curated patch onto the variant. */
  const writeVariant = (patch: Record<string, unknown>) => {
    onPatch({ [variantKey]: { ...variant, ...patch } });
  };

  /** Whole-variant write from the spec form; re-pin canvas-owned keys. */
  const writeForm = (next: Record<string, unknown>) => {
    const merged: Record<string, unknown> = { ...next };
    for (const k of PRESERVED_KEYS) {
      if (k in variant) merged[k] = variant[k];
      else delete merged[k];
    }
    onPatch({ [variantKey]: merged });
  };

  const setObject = (v: string) => {
    if (binding.path === 'object') {
      writeVariant({ object: v });
    } else {
      const data = (variant.data as Record<string, unknown> | undefined) ?? {};
      writeVariant({ data: { ...data, object: v } });
    }
  };

  return (
    <InspectorShell
      kindLabel="View"
      title={String(variant.label ?? variantKey)}
      onClose={() => onClearSelection?.()}
      closeLabel="Close"
      hideClose={isHome}
    >
      <InspectorSelectField
        label="View type"
        value={viewType}
        options={typeOptions}
        onCommit={(v) => writeVariant({ type: v })}
        disabled={readOnly}
      />
      <InspectorTextField
        label="Object"
        value={binding.value}
        onCommit={setObject}
        placeholder="e.g. crm_lead"
        disabled={readOnly}
        mono
      />

      <div className="border-t pt-3">
        {schema ? (
          <SchemaForm
            schema={schema}
            form={form}
            value={variant}
            hiddenFields={['type', 'object']}
            readOnly={readOnly}
            widgetContext={widgetContext}
            onChange={writeForm}
          />
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Spec schema unavailable — basic properties only.
          </p>
        )}
      </div>
    </InspectorShell>
  );
}
