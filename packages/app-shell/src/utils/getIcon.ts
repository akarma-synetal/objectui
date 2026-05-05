/**
 * Icon utilities
 *
 * Helpers for resolving Lucide icons by name.
 *
 * Implementation: instead of statically importing every icon (~1500
 * components, ~568 KB raw / 140 KB gz), we wrap lucide-react's built-in
 * `DynamicIcon` so each icon is fetched as its own tiny chunk on first use.
 *
 * The exported `getIcon(name)` API stays synchronous and returns a React
 * component, preserving call sites that do `const Icon = getIcon(name); <Icon />`.
 */

import React from 'react';
import { Database } from 'lucide-react';
// @ts-expect-error - lucide-react has no `exports` field; subpath types live alongside dynamic.mjs
import { DynamicIcon } from 'lucide-react/dynamic.mjs';

/** Convert PascalCase / camelCase / mixed names to kebab-case for DynamicIcon. */
function toKebab(name: string): string {
  if (name.includes('-')) return name.toLowerCase();
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Aliases for icon names that exist in other icon sets (FontAwesome, Material,
 * Bootstrap…) but use a different name in Lucide. Mapped to the closest
 * Lucide equivalent so existing metadata authored against FA stays portable.
 */
const ICON_ALIASES: Record<string, string> = {
  bullseye: 'target',
  bullhorn: 'megaphone',
  tachometer: 'gauge',
  'tachometer-alt': 'gauge',
  dashboard: 'layout-dashboard',
  'life-ring': 'life-buoy',
  tasks: 'list-checks',
  'file-invoice': 'receipt',
  'file-signature': 'file-pen-line',
  'file-pdf': 'file-text',
  'check-square': 'square-check',
  'arrow-up-right-from-square': 'external-link',
  'sign-out-alt': 'log-out',
  'sign-in-alt': 'log-in',
  'cog': 'settings',
  'gears': 'settings',
  'envelope': 'mail',
  'phone-alt': 'phone',
  'map-marker-alt': 'map-pin',
  'edit': 'pencil',
  'trash-alt': 'trash-2',
  'plus-circle': 'circle-plus',
  'minus-circle': 'circle-minus',
  'times-circle': 'circle-x',
  'check-circle': 'circle-check',
  'info-circle': 'info',
  'question-circle': 'circle-help',
  'exclamation-triangle': 'triangle-alert',
};

const cache = new Map<string, React.ElementType>();

/**
 * Resolve a Lucide icon by name (kebab-case or PascalCase).
 *
 * Returns a React component that lazy-loads the underlying SVG icon on
 * mount. Falls back to the `Database` icon (statically imported) when no
 * `name` is given.
 *
 * The returned component is memoised per `name` so repeated calls with the
 * same name yield the same component reference (stable for React.memo).
 */
export function getIcon(name?: string): React.ElementType {
  if (!name) return Database;
  const cached = cache.get(name);
  if (cached) return cached;

  const kebab = ICON_ALIASES[toKebab(name)] ?? toKebab(name);
  const Wrapped: React.FC<any> = (props) =>
    React.createElement(DynamicIcon as any, {
      name: kebab,
      fallback: Database,
      ...props,
    });
  Wrapped.displayName = `LucideIcon(${name})`;
  cache.set(name, Wrapped);
  return Wrapped;
}
