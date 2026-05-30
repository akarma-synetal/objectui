// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * view-item-normalize — bridge the backend's **expanded ViewItem** shape
 * (ADR-0017, "Object has-many View") into the draft shape the Studio View
 * editor (inspector + preview) already understands, and back again on save.
 *
 * ## Why
 *
 * The framework expands each per-object aggregated `*.view.ts` container
 * into independent first-class ViewItems addressed as `<object>.<viewKey>`.
 * `GET /meta/view/<object>.<viewKey>` returns:
 *
 *   {
 *     name: "crm_campaign.campaign_calendar",
 *     object: "crm_campaign",
 *     viewKind: "list",            // list-family | form-family discriminant
 *     label: "Launch Calendar",
 *     scope: "package",
 *     config: {                    // ← the REAL single-view spec lives here
 *       type: "calendar",
 *       data: { object: "crm_campaign" },
 *       columns: ["name", "channel", "status"],
 *       calendar: { startDateField: "start_date", … },
 *     },
 *   }
 *
 * The View editor, however, models a view *document* whose single-view spec
 * sits under a **family key** (`list` for list-family, `form` for
 * form-family) — that is what `ViewVariantInspector` reads (`draft.list`,
 * `draft.form`) and what `ViewPreview.detectVariants` scans for. It has no
 * knowledge of the `config` wrapper, so an expanded ViewItem rendered as-is
 * shows a blank "Table / List" with 0 columns — the user opens a calendar
 * view but sees nothing of it.
 *
 * These two pure transforms unwrap `config` → `{ [familyKey]: config }` on
 * load and fold it back on save, leaving every NON-expanded shape (legacy
 * overlay views, the bare aggregated `<object>` container, freshly-created
 * drafts) untouched.
 */

const FAMILY_KEYS = ['list', 'form'] as const;
type FamilyKey = (typeof FAMILY_KEYS)[number];

function familyKeyFor(viewKind: unknown): FamilyKey {
  return viewKind === 'form' ? 'form' : 'list';
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * True when `item` is an **expanded ViewItem** — it carries the
 * `viewKind` discriminant AND a nested `config` object holding the real
 * single-view spec. Legacy/aggregated/create shapes lack both and are
 * left alone.
 */
export function isExpandedViewItem(item: unknown): item is Record<string, unknown> {
  if (!isPlainObject(item)) return false;
  const viewKind = item.viewKind;
  if (viewKind !== 'list' && viewKind !== 'form') return false;
  return isPlainObject(item.config);
}

/**
 * Load-time: expanded ViewItem → editor draft.
 *
 *   { name, object, viewKind:'list', label, scope, config:{…} }
 *     → { name, object, viewKind:'list', label, scope, list:{…} }
 *
 * Identity / provenance metadata (`name`, `object`, `viewKind`, `label`,
 * `scope`, `_provenance`, `_diagnostics`, …) is preserved verbatim at the
 * top level so read-only detection, the header, and the round-trip back to
 * {@link draftToViewItem} all keep working. Non-expanded items pass through.
 */
export function viewItemToDraft(item: unknown): Record<string, unknown> {
  if (!isExpandedViewItem(item)) {
    return isPlainObject(item) ? item : {};
  }
  const { config, ...meta } = item;
  const familyKey = familyKeyFor(item.viewKind);
  // A non-expanded view document might *also* already carry a `list`/`form`
  // key; the expansion contract guarantees expanded items do not, so a
  // straight assignment is safe.
  return { ...meta, [familyKey]: config };
}

/**
 * True when `item` is a **bare aggregated view container** — the legacy
 * per-object `defineView({ list, form, listViews, formViews })` document
 * the framework still registers under the bare `<object>` key for runtime
 * back-compat (dual-read). It carries NO `viewKind` discriminant and holds
 * at least one of the aggregate buckets.
 *
 * Studio expands every such container into independent `<object>.<viewKey>`
 * ViewItems (including the defaults), so the container row is fully
 * redundant in the metadata list and should be hidden there.
 */
export function isAggregatedViewContainer(item: unknown): boolean {
  if (!isPlainObject(item)) return false;
  if (item.viewKind) return false; // already an independent ViewItem
  return Boolean(item.list || item.form || item.listViews || item.formViews);
}

/**
 * Derive the display "type" of a view list row. Expanded ViewItems keep
 * their display type under `config.type` (`grid` / `calendar` / `kanban`
 * / …) and only the list/form *family* at the top level (`viewKind`); a
 * legacy flat view carries `type` directly. Returns `undefined` when
 * nothing is resolvable (e.g. an aggregated container).
 */
export function viewDisplayType(item: unknown): string | undefined {
  if (!isPlainObject(item)) return undefined;
  const config = item.config;
  if (isPlainObject(config) && typeof config.type === 'string') return config.type;
  if (typeof item.type === 'string') return item.type;
  if (item.viewKind === 'form') return 'form';
  if (item.viewKind === 'list') return 'list';
  return undefined;
}

/**
 * Save-time: editor draft → expanded ViewItem.
 *
 * The inverse of {@link viewItemToDraft}. Only fires when the draft still
 * carries the top-level `viewKind` discriminant AND the matching family
 * object — i.e. it originated from an expanded ViewItem. Every other draft
 * (create flow, legacy overlay, aggregated container) is returned unchanged
 * so this transform is a no-op outside the expanded-ViewItem round-trip.
 */
export function draftToViewItem(draft: unknown): Record<string, unknown> {
  if (!isPlainObject(draft)) return {};
  const viewKind = draft.viewKind;
  if (viewKind !== 'list' && viewKind !== 'form') return draft;
  const familyKey = familyKeyFor(viewKind);
  const config = draft[familyKey];
  if (!isPlainObject(config)) return draft;
  const rest = { ...draft };
  delete rest[familyKey];
  return { ...rest, config };
}
