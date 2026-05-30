// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MetadataDefaultInspectorRegistry — "home" inspectors shown when the
 * preview has NO active selection.
 *
 * The scoped {@link MetadataInspectorRegistry} only kicks in once the
 * preview emits a selection. Before that, the right panel falls back to
 * the generic whole-draft `SchemaForm`. For some types that generic form
 * is a poor authoring surface (e.g. a View, where authors want a curated
 * "pick a view type, manage which fields show" panel — Airtable style).
 *
 * Registering a default inspector here lets the host render a curated,
 * selection-less panel instead of the generic form. Selecting a
 * sub-element (a column) still swaps in the scoped inspector.
 */
import type { ComponentType } from 'react';
import type { SupportedLocale } from './i18n';
import type { MetadataSelection } from './preview-registry';

export interface MetadataDefaultInspectorProps {
  /** Metadata type, e.g. 'view'. */
  type: string;
  /** Item primary-key name (may be empty in create mode). */
  name: string;
  /** Current draft from the editor. Treat as immutable. */
  draft: Record<string, unknown>;
  /** Apply a shallow patch to the draft. */
  onPatch: (patch: Record<string, unknown>) => void;
  /**
   * Emit a selection. The default inspector uses this to drill into a
   * sub-element (e.g. focus one column), which makes the host swap in the
   * scoped inspector for that selection.
   */
  onSelectionChange?: (next: MetadataSelection | null) => void;
  /** Whether the host is in edit mode. False → disable inputs. */
  readOnly: boolean;
  /** Active UI locale for i18n. */
  locale: SupportedLocale;
}

export type MetadataDefaultInspector = ComponentType<MetadataDefaultInspectorProps>;

const REGISTRY = new Map<string, MetadataDefaultInspector>();

export function registerMetadataDefaultInspector(
  type: string,
  component: MetadataDefaultInspector,
): void {
  REGISTRY.set(type, component);
}

export function getMetadataDefaultInspector(
  type: string,
): MetadataDefaultInspector | undefined {
  return REGISTRY.get(type);
}
