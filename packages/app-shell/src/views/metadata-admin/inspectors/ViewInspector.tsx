// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ViewInspector — routes the View right-panel to the right sub-inspector.
 *
 *   • Scoped (a selection exists):
 *       - `{ kind:'column', id:'<variant>.columns[<i>]' }` → ViewColumnInspector
 *       - `{ kind:'view',   id:'<variant>' }`              → ViewVariantInspector
 *   • Default (no selection) → ViewVariantInspector for the primary variant
 *     ("home" panel: pick view type + manage fields, Airtable-style).
 *
 * Routing is by `selection.kind` FIRST — the column inspector's id regex
 * would not match a bare variant id, so we must dispatch before it runs.
 */

import * as React from 'react';
import type { MetadataInspectorProps } from '../inspector-registry';
import type { MetadataDefaultInspectorProps } from '../default-inspector-registry';
import { ViewColumnInspector } from './ViewColumnInspector';
import { ViewVariantInspector } from './ViewVariantInspector';

const VARIANT_KEYS = [
  'list',
  'form',
  'kanban',
  'calendar',
  'gantt',
  'map',
  'gallery',
  'timeline',
  'feed',
  'detail',
] as const;

/** Pick the primary variant key from a draft (prefer `list`, else first). */
function primaryVariantKey(draft: Record<string, unknown>): string {
  const present = VARIANT_KEYS.filter((k) => {
    const v = draft[k];
    return v && typeof v === 'object' && !Array.isArray(v);
  });
  if (present.includes('list')) return 'list';
  return present[0] ?? 'list';
}

/** Scoped inspector: a selection is always present here. */
export function ViewInspector(props: MetadataInspectorProps) {
  const { selection } = props;
  if (selection.kind === 'column') {
    return <ViewColumnInspector {...props} />;
  }
  // kind === 'view' (or any non-column kind) → variant home, scoped.
  const variantKey = selection.id || primaryVariantKey(props.draft);
  return (
    <ViewVariantInspector
      type={props.type}
      name={props.name}
      draft={props.draft}
      onPatch={props.onPatch}
      onSelectionChange={props.onSelectionChange}
      onClearSelection={props.onClearSelection}
      readOnly={props.readOnly}
      locale={props.locale}
      variantKey={variantKey}
      isHome={false}
    />
  );
}

/** Default inspector: no selection — the View's "home" panel. */
export function ViewDefaultInspector(props: MetadataDefaultInspectorProps) {
  return (
    <ViewVariantInspector
      {...props}
      variantKey={primaryVariantKey(props.draft)}
      isHome
    />
  );
}
