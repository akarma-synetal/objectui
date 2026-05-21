/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Helpers that introspect a page schema tree without needing the React
 * runtime. Used by RecordDetailView to decide whether to auto-append
 * a discussion / chatter slot at the bottom of the page.
 */

const DISCUSSION_TYPES = new Set(['record:discussion', 'record:chatter']);

/**
 * Walks a page schema tree and returns true if any node has a
 * `type` of `record:discussion` or `record:chatter`.
 *
 * Recurses into:
 *  - `children`, `items`, `body`, `components`
 *  - `properties.children`, `properties.items`
 *  - `regions` (synth + full-Lightning pages nest components here)
 *
 * Cycles are guarded with a WeakSet.
 */
export function hasExplicitDiscussion(root: unknown): boolean {
  const seen = new WeakSet<object>();
  const walk = (node: any): boolean => {
    if (!node || typeof node !== 'object') return false;
    if (seen.has(node)) return false;
    seen.add(node);
    if (Array.isArray(node)) return node.some(walk);
    const t = node?.type;
    if (typeof t === 'string' && DISCUSSION_TYPES.has(t)) return true;
    const candidates: any[] = [
      node.children,
      node.items,
      node.body,
      node.components,
      node.properties?.children,
      node.properties?.items,
      // Synth + full-Lightning pages nest components inside
      // `regions[].components[]`. Without this branch the walker
      // fails to see the `record:discussion` baked in by
      // `buildDefaultPageSchema`, and the host appends a second
      // chatter panel on top of it.
      node.regions,
    ];
    return candidates.some(walk);
  };
  return walk(root);
}
