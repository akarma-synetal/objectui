// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MetadataPreviewRegistry — per-type "Preview" tab renderers for the
 * metadata-admin engine.
 *
 * The Preview tab is opt-in: a type only gets a Preview tab when its
 * type id is registered here. This matches the philosophy used for
 * `DesignerTab` and the bespoke `EditPage` in `registry.ts` — generic
 * by default, escape hatch when a type benefits from a richer surface.
 *
 * The renderer receives the **current draft** (not the saved layered
 * record), so users see their unsaved edits live. Drafts can be
 * incomplete or invalid — implementations must defensively read fields.
 *
 *   registerMetadataPreview('page', PagePreview);
 *   const Preview = getMetadataPreview('page');
 *   if (Preview) <Preview type="page" name="crm_welcome" draft={draft} />;
 *
 * If the type isn't registered, the engine simply omits the tab — no
 * empty "preview not available" surface is shown.
 */

import type { ComponentType } from 'react';

export interface MetadataPreviewProps {
  /** The metadata type, e.g. 'page', 'dashboard'. */
  type: string;
  /** The item's primary-key name. May be empty string in create mode. */
  name: string;
  /**
   * The live draft from the Form tab. Implementations should treat this
   * as immutable and untrusted (validation may be in progress).
   */
  draft: Record<string, unknown>;
}

export type MetadataPreview = ComponentType<MetadataPreviewProps>;

const REGISTRY = new Map<string, MetadataPreview>();

/**
 * Register (or replace) the Preview tab renderer for a metadata type.
 * Idempotent — re-registering overwrites the previous entry so app
 * authors can swap implementations from their plugin bootstrap.
 */
export function registerMetadataPreview(type: string, component: MetadataPreview): void {
  REGISTRY.set(type, component);
}

/** Look up the registered preview for a type, if any. */
export function getMetadataPreview(type: string): MetadataPreview | undefined {
  return REGISTRY.get(type);
}

/** Snapshot of registered preview types (diagnostics). */
export function listMetadataPreviewTypes(): string[] {
  return Array.from(REGISTRY.keys()).sort();
}
