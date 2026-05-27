// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MetadataResourceRegistry — per-type overrides for the generic metadata
 * admin engine (Phase 3c).
 *
 * The engine drives all 27 metadata types from a single ListPage /
 * EditPage / HistoryPage shell. By default everything is rendered via
 * a JSONSchema-driven AutoForm (using the rich `/meta/types` registry
 * row's `schema` field). Specialised editors (ObjectManager,
 * FieldDesigner, ObjectViewConfigurator, PermissionMatrix, …) opt in
 * by calling `registerMetadataResource()` to override the default
 * components for their type.
 *
 * This keeps the contract for "add a new metadata type" trivial:
 *   1. Define its Zod schema in `packages/spec/src/<domain>/`.
 *   2. Add it to `DEFAULT_METADATA_TYPE_REGISTRY` (framework).
 *   3. Done. It shows up in the Setup app's Metadata Directory with
 *      a working list / create / edit / history out of the box.
 *
 * Conventions:
 *   • `primaryKey` defaults to `'name'` (the universal metadata
 *     short-name; ADR-0006).
 *   • `searchableFields` defaults to `['name','label','description']`.
 *   • `listColumns` defaults to inferring from primary + label.
 *   • `supportsHistory` defaults to true (every overlay goes through
 *     `sys_metadata_history`).
 */

import type { ComponentType, ReactNode } from 'react';

export type MetadataDomain =
  | 'data'
  | 'ui'
  | 'automation'
  | 'ai'
  | 'system'
  | 'platform'
  | 'identity'
  | 'security'
  | 'other';

/**
 * One row in the registry — describes how the generic engine should
 * render and edit a metadata type. All fields are optional; sensible
 * defaults apply if a type isn't registered at all.
 */
export interface MetadataResourceConfig {
  /** Metadata type, e.g. 'view', 'flow', 'agent'. */
  type: string;
  /** Display label. Falls back to server-side label or the type id. */
  label?: string;
  /** Long-form description shown in the page hero. */
  description?: string;
  /** Lucide icon name (e.g. 'database', 'workflow'). */
  iconName?: string;
  /** Coarse grouping for the directory page. */
  domain?: MetadataDomain;
  /** Primary key field, default `'name'`. */
  primaryKey?: string;
  /** Fields searched by the free-text filter. Default `['name','label','description']`. */
  searchableFields?: string[];
  /** Columns rendered in the list page. */
  listColumns?: Array<{
    key: string;
    label: string;
    /** Optional cell renderer. `value` is `item[key]`. */
    render?: (value: unknown, item: Record<string, unknown>) => ReactNode;
    /** Column width hint in CSS (e.g. `'180px'`, `'30%'`). */
    width?: string;
  }>;
  /**
   * Fully custom list page. When provided, the generic shell is bypassed.
   * Receives `{ type }`. Use this for ObjectManager, etc.
   */
  ListPage?: ComponentType<{ type: string }>;
  /**
   * Fully custom edit page. Receives `{ type, name }`.
   *
   * Use this when the bespoke editor replaces the JSONSchema form entirely
   * (e.g. PermissionMatrix grid). For visual designers that should coexist
   * with the generic Form/Layers/References tabs, prefer `DesignerTab`.
   */
  EditPage?: ComponentType<{ type: string; name: string }>;
  /**
   * Optional visual designer that renders inside its own dedicated tab on
   * the generic edit page, alongside Form / Layers / References. Receives
   * `{ type, name }` and should render without an outer `PageShell` — the
   * generic engine owns the chrome.
   *
   * When both `EditPage` and `DesignerTab` are provided, `EditPage` wins
   * (full takeover); the tab variant is only used when `EditPage` is unset.
   */
  DesignerTab?: ComponentType<{ type: string; name: string }>;
  /**
   * Optional label for the Designer tab. Defaults to "Designer".
   */
  designerTabLabel?: string;
  /**
   * Fully custom create page. Receives `{ type }`.
   */
  CreatePage?: ComponentType<{ type: string }>;
  /** Fields hidden from the AutoForm (still serialised on save). */
  hiddenFields?: string[];
  /** Suggested form field order (top to bottom). */
  fieldOrder?: string[];
  /** Whether the type opts in to the history tab. Default true. */
  supportsHistory?: boolean;
  /**
   * Override the empty-state copy on the list page (e.g. "No views yet —
   * Studio's Page Designer creates these for you").
   */
  emptyStateHint?: string;
  /**
   * Fallback JSONSchema used by the generic SchemaForm when the
   * framework's `/meta/types` endpoint doesn't expose a `schema` field
   * for this type (most types today). This lets us deliver a usable
   * form-driven create/edit experience without first wiring full
   * Zod→JSONSchema generation in the framework registry.
   *
   * If the server registry DOES return a `schema`, this is ignored.
   */
  defaultSchema?: Record<string, unknown>;
}

const REGISTRY = new Map<string, MetadataResourceConfig>();

/**
 * Register (or merge) an entry. Idempotent — re-registering with the
 * same `type` merges the new fields with any existing entry so that
 * bespoke editors (e.g. PermissionMatrixEditor) and generic-engine
 * defaults (e.g. `defaultSchema`) can be registered independently and
 * coexist. Explicit `undefined` values do not overwrite.
 */
export function registerMetadataResource(config: MetadataResourceConfig): void {
  const prev = REGISTRY.get(config.type);
  if (!prev) {
    REGISTRY.set(config.type, config);
    return;
  }
  const merged: MetadataResourceConfig = { ...prev };
  for (const [k, v] of Object.entries(config as unknown as Record<string, unknown>)) {
    if (v !== undefined) (merged as unknown as Record<string, unknown>)[k] = v;
  }
  REGISTRY.set(config.type, merged);
}

/** Look up an entry. Returns `undefined` when the type isn't registered. */
export function getMetadataResource(type: string): MetadataResourceConfig | undefined {
  return REGISTRY.get(type);
}

/** Snapshot of all registered entries (diagnostics; directory page). */
export function listMetadataResources(): MetadataResourceConfig[] {
  return Array.from(REGISTRY.values());
}

/**
 * Merge a registered config (if any) with server-side defaults from
 * `/meta/types`. Server fields win for label/description/domain
 * (the spec is source of truth); user-registered fields win for
 * everything else (UI behaviour).
 */
export function resolveResourceConfig(
  type: string,
  serverEntry?: {
    label?: string;
    description?: string;
    domain?: string;
    allowOrgOverride?: boolean;
  },
): MetadataResourceConfig & { allowOrgOverride?: boolean } {
  const registered = REGISTRY.get(type) ?? { type };
  return {
    ...registered,
    type,
    label: registered.label ?? serverEntry?.label ?? type,
    description: registered.description ?? serverEntry?.description,
    domain: (registered.domain ?? (serverEntry?.domain as MetadataDomain) ?? 'other'),
    allowOrgOverride: serverEntry?.allowOrgOverride,
    defaultSchema: registered.defaultSchema,
  };
}
