// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Shared display helpers for metadata items — keep list cards, detail
 * route headers, command-palette rows, and any future surface aligned
 * on the same "best effort label + sensible description" logic.
 */

export function resolveTranslatable(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'defaultValue' in val) return String((val as any).defaultValue);
  if (val && typeof val === 'object' && 'key' in val) return String((val as any).key);
  return '';
}

/** Convert `snake_case` / `kebab-case` machine name → Title Case for display. */
export function humanizeName(name: string): string {
  if (!name) return '';
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Pick a human-readable display label for any metadata item.
 *
 * Falls back through:
 *   1. top-level `label`
 *   2. nested `list.label` / `form.label` (legacy view-set files)
 *   3. humanised machine `name`
 *   4. literal "Untitled"
 */
export function pickLabel(item: any): string {
  const top = resolveTranslatable(item?.label);
  if (top) return top;
  const nested =
    resolveTranslatable(item?.list?.label) ||
    resolveTranslatable(item?.form?.label) ||
    resolveTranslatable(item?.spec?.label);
  if (nested) return nested;
  return humanizeName(item?.name) || 'Untitled';
}

/**
 * Synthesise a one-line description when the item has none, so list
 * cards never look empty / mis-aligned. Keep it factual — never invent
 * data, just summarise what the spec already says.
 */
export function pickDescription(item: any, type: string): string | undefined {
  const direct = resolveTranslatable(item?.description);
  if (direct) return direct;
  switch (type) {
    case 'view': {
      const parts: string[] = [];
      if (item?.list) parts.push('list');
      if (item?.form) parts.push('form');
      const extra = (item?.listViews?.length ?? 0) + (item?.formViews?.length ?? 0);
      if (extra > 0) parts.push(`${extra} variant${extra === 1 ? '' : 's'}`);
      // Try a few well-known shapes for the bound object — top-level
      // `object` (canonical view), nested `data.object` (modern view
      // wrapper), or the legacy list/form sub-spec.
      const obj =
        item?.object ??
        item?.data?.object ??
        item?.list?.data?.object ??
        item?.form?.data?.object ??
        item?.name;
      if (!parts.length) return undefined;
      return obj ? `Default ${parts.join(' + ')} for ${obj}` : `Default ${parts.join(' + ')}`;
    }
    case 'agent': {
      const m = item?.model;
      const modelStr =
        typeof m === 'string'
          ? m
          : m && typeof m === 'object'
          ? [m.provider, m.model].filter(Boolean).join('/')
          : undefined;
      const role = item?.role;
      const roleStr = typeof role === 'string' && role ? role.charAt(0).toUpperCase() + role.slice(1) : undefined;
      if (modelStr && roleStr) return `${roleStr} agent · ${modelStr}`;
      if (modelStr) return `Model: ${modelStr}`;
      if (roleStr) return `${roleStr} agent`;
      return undefined;
    }
    case 'hook': {
      const obj = item?.object;
      const events = Array.isArray(item?.events) ? item.events.join(', ') : item?.events;
      if (obj && events) return `${obj} · ${events}`;
      if (obj) return `Listens on ${obj}`;
      return undefined;
    }
    case 'flow': {
      const obj = item?.object || item?.trigger?.object;
      if (obj) return `Flow on ${obj}`;
      return undefined;
    }
    default:
      return undefined;
  }
}
