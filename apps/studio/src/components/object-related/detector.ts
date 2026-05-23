// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Detect whether a metadata document references a given object.
 *
 * Each metadata type uses slightly different keys to bind to an
 * object — this module centralises the probe so the Object Hub can
 * surface every referencing item in a single panel.
 */

export type RelatedDomain = 'data' | 'ui' | 'automation' | 'ai' | 'system' | 'security';

export interface RelatedTypeConfig {
  /** Metadata type id (matches MetadataTypeSchema). */
  type: string;
  /** Display label (plural) for the sidebar group. */
  label: string;
  /** Domain group used to order/colour the sidebar. */
  domain: RelatedDomain;
  /** Whether MetadataPreview can render this type meaningfully. */
  previewable: boolean;
}

export const RELATED_TYPES: RelatedTypeConfig[] = [
  { type: 'view',           label: 'Views & Forms',  domain: 'ui',         previewable: true },
  { type: 'dashboard',      label: 'Dashboards',     domain: 'ui',         previewable: true },
  { type: 'report',         label: 'Reports',        domain: 'ui',         previewable: true },
  { type: 'action',         label: 'Actions',        domain: 'ui',         previewable: false },
  { type: 'hook',           label: 'Hooks',          domain: 'data',       previewable: false },
  { type: 'trigger',        label: 'Triggers',       domain: 'data',       previewable: false },
  { type: 'validation',     label: 'Validations',    domain: 'data',       previewable: false },
  { type: 'flow',           label: 'Flows',          domain: 'automation', previewable: false },
  { type: 'workflow',       label: 'Workflows',      domain: 'automation', previewable: false },
  { type: 'approval',       label: 'Approvals',      domain: 'automation', previewable: false },
  { type: 'email_template', label: 'Email Templates',domain: 'system',     previewable: false },
  { type: 'agent',          label: 'AI Agents',      domain: 'ai',         previewable: false },
  { type: 'tool',           label: 'AI Tools',       domain: 'ai',         previewable: false },
];

function deepIncludesObject(value: unknown, name: string, depth = 0): boolean {
  if (depth > 4 || value == null) return false;
  if (typeof value === 'string') return false;
  if (Array.isArray(value)) {
    for (const item of value) if (deepIncludesObject(item, name, depth + 1)) return true;
    return false;
  }
  if (typeof value !== 'object') return false;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if ((k === 'object' || k === 'objectName' || k === 'object_name' || k === 'target') && v === name) {
      return true;
    }
    if (typeof v === 'object' && deepIncludesObject(v, name, depth + 1)) return true;
  }
  return false;
}

export function itemReferencesObject(type: string, item: any, name: string): boolean {
  const spec = item?.spec ?? item;
  if (!spec || typeof spec !== 'object') return false;

  switch (type) {
    case 'view': {
      const direct =
        spec.object ??
        spec.spec?.object ??
        spec.list?.data?.object ??
        spec.form?.data?.object ??
        spec.data?.object ??
        spec.objectName;
      if (direct === name) return true;
      const lv = spec.listViews;
      if (lv && typeof lv === 'object') {
        for (const sv of Object.values(lv as Record<string, any>)) {
          if (sv?.data?.object === name || sv?.objectName === name) return true;
        }
      }
      return false;
    }
    case 'hook':
    case 'trigger':
    case 'validation':
    case 'action':
    case 'approval':
      return (
        spec.object === name ||
        spec.objectName === name ||
        spec.object_name === name ||
        spec.target === name
      );
    case 'flow':
    case 'workflow':
      return (
        spec.object === name ||
        spec.objectName === name ||
        spec.trigger?.object === name ||
        spec.trigger?.objectName === name ||
        spec.trigger?.config?.objectName === name ||
        deepIncludesObject(spec.steps, name) ||
        deepIncludesObject(spec.states, name)
      );
    case 'dashboard':
    case 'report':
      return (
        spec.objectName === name ||
        spec.object === name ||
        deepIncludesObject(spec.widgets, name) ||
        deepIncludesObject(spec.queries, name) ||
        deepIncludesObject(spec.dataSource, name)
      );
    case 'agent':
    case 'tool':
    case 'email_template':
      return deepIncludesObject(spec, name);
    default:
      return false;
  }
}

export function isFormView(spec: any): boolean {
  if (!spec) return false;
  return !!(
    spec.sections ||
    spec.groups ||
    spec.form ||
    spec.type === 'simple' ||
    spec.type === 'tabbed' ||
    spec.type === 'wizard' ||
    spec.viewType === 'form'
  );
}
