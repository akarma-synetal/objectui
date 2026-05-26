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
   */
  EditPage?: ComponentType<{ type: string; name: string }>;
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
}

const REGISTRY = new Map<string, MetadataResourceConfig>();

/**
 * Register (or replace) an entry. Idempotent — re-registering with the
 * same `type` overwrites, matching HMR semantics.
 */
export function registerMetadataResource(config: MetadataResourceConfig): void {
  REGISTRY.set(config.type, config);
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
  };
}
