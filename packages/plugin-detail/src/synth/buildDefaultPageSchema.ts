/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `buildDefaultPageSchema` — Pure function that synthesizes a canonical
 * Lightning-style Page schema from an object definition (and optional
 * record data + overrides).
 *
 * This is the foundation of Track 3 "convergence": once
 * `RecordDetailView` synthesizes a Page schema for the no-assignedPage
 * branch and renders via `<SchemaRenderer>`, the default and custom
 * detail paths share a single rendering pipeline. All Phase D/E/F
 * polish (record-aware header chip, chevron path, flush accordion,
 * discussion slot) then applies to every object's default detail page
 * automatically.
 *
 * Phase G slice 1: pure synthesis only. No runtime wiring yet —
 * `RecordDetailView` is not yet calling this. That comes in Phase H
 * once the synthesizer covers enough surface area to reach parity with
 * the existing DetailView output.
 */

/** Minimal shape of an object definition we read here. We deliberately
 *  duck-type so this helper has zero hard dependency on a specific
 *  object-schema shape. */
export interface ObjectDefLike {
  name?: string;
  label?: string;
  fields?: Record<string, ObjectFieldLike>;
  /** Optional stage hints — when present we emit a `record:path`. */
  stageField?: string;
  stages?: Array<{ value: any; label: string }>;
  /** Optional list of fields to surface in the highlight strip. */
  highlightFields?: string[];
  /** Name of the field that holds the record's display title (e.g. `name`,
   *  `subject`). When present we exclude it from the auto-derived highlight
   *  list to avoid duplicating the page H1. */
  primaryField?: string;
  /** Optional section grouping for the details region. */
  sections?: Array<{ title?: string; columns?: number; fields?: any[] }>;
}

export interface ObjectFieldLike {
  name?: string;
  label?: string;
  type?: string;
  options?: Array<{ value: any; label: string }>;
}

export interface BuildPageOptions {
  /** Override the auto-derived highlight field list. */
  highlightFields?: string[];
  /** Override the auto-derived statusField / stages. */
  statusField?: string;
  stages?: Array<{ value: any; label: string }>;
  /** Override the auto-derived section grouping. */
  sections?: Array<{ title?: string; columns?: number; fields?: any[] }>;
  /** Suppress the auto-appended `record:discussion` slot. */
  hideDiscussion?: boolean;
  /** Suppress the auto-prepended `record:highlights` strip. */
  hideHighlights?: boolean;
  /** Suppress the auto-prepended `record:path` stepper. */
  hidePath?: boolean;
  /** Pass-through to `page:header.recordChrome`. Defaults to true. */
  recordChrome?: boolean;
  /**
   * Action definitions to surface in the header. When provided and
   * non-empty, the synthesizer emits a `record:quick_actions` node
   * immediately after `page:header`. Use ActionDef shape from the spec
   * (must include `locations: ['record_header']` to render).
   */
  headerActions?: any[];
  /**
   * Related child objects. When non-empty, the synthesizer adds a
   * "Related" tab containing one `record:related_list` per entry.
   *
   * - `objectName` and `relationshipField` are required.
   * - `title` overrides the default child-object label.
   * - `columns` / `limit` / `icon` are forwarded to the renderer.
   */
  related?: Array<{
    title?: string;
    objectName: string;
    relationshipField: string;
    columns?: any[];
    limit?: number;
    icon?: string;
  }>;
  /**
   * When true, emit an Activity tab that renders `record:activity`.
   * The activity renderer fetches its own data via RecordContext.
   */
  showActivity?: boolean;
  /**
   * When provided, emit a History tab containing a `record:history`
   * renderer. The host supplies the audit-log `entries` and `loading`
   * flag because the data fetch logic lives in RecordDetailView.
   */
  history?: { entries: any[]; loading?: boolean; emptyText?: string };
  /**
   * Slot override map. When a slot is provided, the synthesizer emits
   * the override verbatim at the slot's position instead of computing
   * the default. Each slot accepts a single SchemaNode or an array
   * (arrays are flattened in place).
   *
   * Slot menu (v1):
   * - `header` — replaces `page:header`.
   * - `actions` — replaces `record:quick_actions`. The override fires
   *   even when `headerActions` is empty (i.e. the override lets you
   *   add a header bar where the synthesizer would have skipped one).
   * - `highlights` — replaces the highlight strip (chips + chevron
   *   path). The override fires even when neither auto-emission
   *   condition is met.
   * - `details` — replaces the Details tab body (the `record:details`
   *   node). Other tabs (Related / Activity / History) are unaffected.
   * - `tabs` — replaces the entire `page:tabs` node. Wins over
   *   `details` when both are provided. Use this to add or reorder
   *   tabs.
   * - `discussion` — replaces `record:discussion`. Fires even when
   *   `hideDiscussion` is true (the override is explicit intent to
   *   surface a custom footer).
   */
  slots?: {
    header?: any | any[];
    actions?: any | any[];
    highlights?: any | any[];
    details?: any | any[];
    tabs?: any | any[];
    discussion?: any | any[];
  };
}

/** Flatten a slot value (single node or array) into a node array. */
function toNodeArray(slot: any | any[] | undefined): any[] {
  if (slot == null) return [];
  return Array.isArray(slot) ? slot.filter((n) => n != null) : [slot];
}

/**
 * Detect the canonical "status" / "stage" field on an object definition.
 *
 * Heuristic — same as DetailView's `autoSummaryFields`:
 *   1) prefer an explicit `objectDef.stageField`
 *   2) else first field named status / stage / state / phase
 *   3) else null
 */
export function detectStatusField(def?: ObjectDefLike): string | null {
  if (!def) return null;
  if (def.stageField) return def.stageField;
  const fields = def.fields || {};
  const candidates = ['status', 'stage', 'state', 'phase'];
  for (const key of candidates) {
    if (key in fields) return key;
  }
  for (const [name, field] of Object.entries(fields)) {
    const t = (field?.type || '').toLowerCase();
    if (t === 'status' || t === 'stage') return name;
  }
  return null;
}

/**
 * Derive stage values from an object field's `options` (picklist).
 */
export function deriveStages(
  def: ObjectDefLike | undefined,
  statusField: string | null,
): Array<{ value: any; label: string }> | null {
  if (!def || !statusField) return null;
  const field = def.fields?.[statusField];
  const options = field?.options;
  if (!Array.isArray(options) || options.length === 0) return null;
  return options.map((o) => ({ value: o.value, label: o.label }));
}

/**
 * Pick up to N "highlight" fields by name. Skips the status field
 * (already shown in `record:path`) and obvious junk like id / created_at.
 */
export function deriveHighlightFields(
  def: ObjectDefLike | undefined,
  statusField: string | null,
  max = 4,
): string[] {
  if (!def) return [];
  if (Array.isArray(def.highlightFields) && def.highlightFields.length > 0) {
    return def.highlightFields.slice(0, max);
  }
  // System fields and tenancy metadata never make useful highlights —
  // they either have no friendly label (organization_id renders as the
  // workspace name with no field name beside it) or are mostly noise
  // (audit IDs). Filter them up-front so the fallback walk below doesn't
  // pick them when a richer field isn't available.
  const skip = new Set<string>([
    'id', '_id',
    'created_at', 'updated_at', 'deleted_at',
    'created_by', 'updated_by', 'deleted_by',
    'organization_id', 'workspace_id', 'tenant_id',
    'org_id',
  ]);
  if (statusField) skip.add(statusField);
  // The record's display/primary field is already shown as the page H1 —
  // surfacing it again in the highlight strip duplicates content and
  // wastes a slot (e.g. Task pages would show 主题 twice). Skip the
  // common candidates and whatever the def declares as `primaryField`.
  if (def.primaryField) skip.add(def.primaryField);
  for (const candidate of ['name', 'full_name', 'title', 'subject', 'display_name']) {
    if (candidate in (def.fields || {})) skip.add(candidate);
  }
  const preferred = [
    'owner', 'owner_id', 'amount', 'rating', 'source',
    'priority', 'industry', 'phone', 'email',
  ];
  const out: string[] = [];
  const fields = def.fields || {};
  for (const name of preferred) {
    if (name in fields && !skip.has(name)) out.push(name);
    if (out.length >= max) return out;
  }
  for (const name of Object.keys(fields)) {
    if (out.includes(name) || skip.has(name)) continue;
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Sub-builder: the canonical `page:header` node.
 *
 * Exported so authors of slotted pages can compose
 * `[buildDefaultHeader(def), customNode]` without copying the
 * synthesizer's internals.
 */
export function buildDefaultHeader(
  _def: ObjectDefLike | undefined,
  options: Pick<BuildPageOptions, 'recordChrome'> & { actions?: any[] } = {},
): any {
  return {
    type: 'page:header',
    recordChrome: options.recordChrome !== false,
    ...(Array.isArray(options.actions) && options.actions.length > 0
      ? { actions: options.actions }
      : {}),
  };
}

/**
 * Sub-builder: the `record:quick_actions` action bar.
 *
 * Returns `null` when `headerActions` is empty/missing so callers can
 * spread the result conditionally.
 */
export function buildDefaultActions(
  _def: ObjectDefLike | undefined,
  headerActions: any[] | undefined,
): any | null {
  if (!Array.isArray(headerActions) || headerActions.length === 0) return null;
  return {
    type: 'record:quick_actions',
    actions: headerActions,
    location: 'record_header',
  };
}

/**
 * Sub-builder: the highlight strip — `record:highlights` chips plus
 * `record:path` chevron (when a status field is configured).
 *
 * Returns an array because the strip is conceptually one region with
 * two adjacent nodes.
 */
export function buildDefaultHighlights(
  def: ObjectDefLike | undefined,
  options: Pick<BuildPageOptions,
    'highlightFields' | 'statusField' | 'stages' | 'hideHighlights' | 'hidePath'
  > = {},
): any[] {
  const statusField = options.statusField ?? detectStatusField(def);
  const stages = options.stages ?? (statusField ? deriveStages(def, statusField) : null);
  const highlightFields =
    options.highlightFields ?? deriveHighlightFields(def, statusField);
  const out: any[] = [];
  if (!options.hideHighlights && highlightFields.length > 0) {
    out.push({ type: 'record:highlights', fields: highlightFields });
  }
  if (!options.hidePath && statusField && stages && stages.length > 0) {
    out.push({ type: 'record:path', statusField, stages });
  }
  return out;
}

/**
 * Sub-builder: the Details tab body — a single `record:details` node.
 */
export function buildDefaultDetails(
  _def: ObjectDefLike | undefined,
  sections?: BuildPageOptions['sections'],
  hideFields?: string[],
): any {
  return {
    type: 'record:details',
    sections,
    ...(hideFields && hideFields.length > 0 ? { hideFields } : {}),
  };
}

/**
 * Sub-builder: the `page:tabs` node. Emits Details / Related /
 * Activity / History tabs in stable order based on the options.
 *
 * Useful for slotted authors who want to add a custom tab — they can
 * call `buildDefaultTabs(def, opts)` and splice their tab into
 * `.items[]`.
 */
export function buildDefaultTabs(
  def: ObjectDefLike | undefined,
  options: Pick<BuildPageOptions,
    'sections' | 'related' | 'showActivity' | 'history' | 'highlightFields' | 'statusField'
  > = {},
): any {
  const statusField = options.statusField ?? detectStatusField(def);
  const highlightFields =
    options.highlightFields ?? deriveHighlightFields(def, statusField);
  const items: any[] = [
    { label: 'Details', children: [buildDefaultDetails(def, options.sections, highlightFields)] },
  ];
  if (Array.isArray(options.related) && options.related.length > 0) {
    items.push({
      label: 'Related',
      children: options.related.map((rel) => ({
        type: 'record:related_list',
        title: rel.title,
        objectName: rel.objectName,
        relationshipField: rel.relationshipField,
        ...(rel.columns ? { columns: rel.columns } : {}),
        ...(rel.limit ? { limit: rel.limit } : {}),
        ...(rel.icon ? { icon: rel.icon } : {}),
      })),
    });
  }
  if (options.showActivity) {
    items.push({ label: 'Activity', children: [{ type: 'record:activity' }] });
  }
  if (options.history) {
    items.push({
      label: 'History',
      children: [
        {
          type: 'record:history',
          entries: options.history.entries,
          loading: options.history.loading,
          emptyText: options.history.emptyText,
        },
      ],
    });
  }
  return { type: 'page:tabs', items };
}

/**
 * Sub-builder: the inline `record:discussion` footer slot.
 */
export function buildDefaultDiscussion(): any {
  return { type: 'record:discussion' };
}

/**
 * Synthesize the canonical Page schema for an object's default detail
 * page.
 *
 * Shape:
 *   { type:'record', template:'full-width', regions:[ { name:'main',
 *     components: [page:header, record:highlights?, record:path?,
 *     page:tabs, record:discussion?] } ] }
 *
 * Notes:
 *   - The `record:details` tab content is registered separately and
 *     internally still defers to DetailView for actual field
 *     rendering (see record-details.tsx). When Phase G fully extracts
 *     DetailSection into a `record:section` renderer, this synthesis
 *     output won't need to change — only the inner record:details
 *     implementation will swap.
 *   - We DO NOT emit `record:related_list` here because related list
 *     metadata is not on `objectDef`; that wiring lives in the related
 *     adapter and remains the author's job until a follow-up phase
 *     exposes it through the synthesizer.
 */
export function buildDefaultPageSchema(
  def: ObjectDefLike | undefined,
  options: BuildPageOptions = {},
): any {
  const slots = options.slots || {};
  const components: any[] = [];

  // 1) Header slot. When no header override is set, fold any
  //    `headerActions` into the header itself so PageHeaderRenderer
  //    renders custom + system actions side-by-side in a single row
  //    (avoids the floating `record:quick_actions` overlay colliding
  //    with the system Edit/Share/Delete cluster).
  if ('header' in slots && slots.header !== undefined) {
    components.push(...toNodeArray(slots.header));
  } else {
    components.push(
      buildDefaultHeader(def, {
        recordChrome: options.recordChrome,
        actions: options.headerActions,
      }),
    );
  }

  // 2) Header action bar — only emitted as a separate node when an
  //    explicit `actions` slot override is provided. Otherwise actions
  //    are merged into the header above.
  if ('actions' in slots && slots.actions !== undefined) {
    components.push(...toNodeArray(slots.actions));
  }

  // 3) Highlight strip (chips + chevron path).
  if ('highlights' in slots && slots.highlights !== undefined) {
    components.push(...toNodeArray(slots.highlights));
  } else {
    components.push(...buildDefaultHighlights(def, {
      highlightFields: options.highlightFields,
      statusField: options.statusField,
      stages: options.stages,
      hideHighlights: options.hideHighlights,
      hidePath: options.hidePath,
    }));
  }

  // 4) Tabs — `tabs` slot wins over `details` slot when both are
  //    provided (broader override). When only `details` is provided,
  //    splice it into the Details tab body and keep Related/Activity/
  //    History tabs synthesized.
  if ('tabs' in slots && slots.tabs !== undefined) {
    components.push(...toNodeArray(slots.tabs));
  } else if ('details' in slots && slots.details !== undefined) {
    const detailsBody = toNodeArray(slots.details);
    const tabsNode = buildDefaultTabs(def, {
      sections: options.sections,
      related: options.related,
      showActivity: options.showActivity,
      history: options.history,
      highlightFields: options.highlightFields,
      statusField: options.statusField,
    });
    // Replace the first tab's children (Details) with the override.
    if (Array.isArray(tabsNode.items) && tabsNode.items.length > 0) {
      tabsNode.items[0] = { ...tabsNode.items[0], children: detailsBody };
    }
    components.push(tabsNode);
  } else {
    components.push(buildDefaultTabs(def, {
      sections: options.sections,
      related: options.related,
      showActivity: options.showActivity,
      history: options.history,
      highlightFields: options.highlightFields,
      statusField: options.statusField,
    }));
  }

  // 5) Discussion footer.
  if ('discussion' in slots && slots.discussion !== undefined) {
    components.push(...toNodeArray(slots.discussion));
  } else if (!options.hideDiscussion) {
    components.push(buildDefaultDiscussion());
  }

  return {
    type: 'record',
    pageType: 'record',
    object: def?.name,
    template: 'full-width',
    regions: [
      {
        name: 'main',
        width: 'full',
        components,
      },
    ],
  };
}
