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
  const skip = new Set<string>(['id', '_id', 'created_at', 'updated_at', 'deleted_at']);
  if (statusField) skip.add(statusField);
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
  const statusField = options.statusField ?? detectStatusField(def);
  const stages = options.stages ?? (statusField ? deriveStages(def, statusField) : null);
  const highlightFields =
    options.highlightFields ?? deriveHighlightFields(def, statusField);

  const components: any[] = [
    {
      type: 'page:header',
      recordChrome: options.recordChrome !== false,
    },
  ];

  // Header actions: surface user-configured record_header actions as a
  // Lightning-style quick-action bar sitting just below the header chip.
  // Empty list is skipped so we don't render the "no actions configured"
  // placeholder.
  if (Array.isArray(options.headerActions) && options.headerActions.length > 0) {
    components.push({
      type: 'record:quick_actions',
      actions: options.headerActions,
      location: 'record_header',
    });
  }

  if (!options.hideHighlights && highlightFields.length > 0) {
    components.push({
      type: 'record:highlights',
      fields: highlightFields,
    });
  }

  if (!options.hidePath && statusField && stages && stages.length > 0) {
    components.push({
      type: 'record:path',
      statusField,
      stages,
    });
  }

  // Build tab list. Always start with Details; conditionally append
  // Related / Activity / History based on options. The label strings
  // are translated automatically by PageTabsRenderer's `translateLabel`
  // when they match a known English key.
  const tabs: any[] = [
    {
      label: 'Details',
      children: [
        {
          type: 'record:details',
          sections: options.sections,
        },
      ],
    },
  ];

  if (Array.isArray(options.related) && options.related.length > 0) {
    tabs.push({
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
    tabs.push({
      label: 'Activity',
      children: [{ type: 'record:activity' }],
    });
  }

  if (options.history) {
    tabs.push({
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

  components.push({
    type: 'page:tabs',
    items: tabs,
  });

  if (!options.hideDiscussion) {
    components.push({ type: 'record:discussion' });
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
