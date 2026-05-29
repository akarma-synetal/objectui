// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AppNavInspector — scoped editor for the selected app navigation item.
 *
 * Apps accept nav under several keys (nav / navigation / tabs / items
 * / menu). The preview emits selection id as a dotted path
 * `<rootKey>[i]` for top-level items, `<rootKey>[i].children[j]` for
 * nested. This inspector walks the same path to read/write.
 *
 * For simplicity v1 only edits the leaf node (label / path / icon /
 * kind). Reparenting and re-ordering happen elsewhere (drag handles,
 * the top-level SchemaForm).
 */

import * as React from 'react';
import type { MetadataInspectorProps } from '../inspector-registry';
import { t } from '../i18n';
import {
  InspectorShell,
  InspectorReorderButtons,
  InspectorTextField,
  InspectorSelectField,
  InspectorRemoveButton,
  InspectorEmptyState,
  spliceArray,
  moveArray,
} from './_shared';

interface NavItem {
  label?: string;
  title?: string;
  name?: string;
  path?: string;
  href?: string;
  route?: string;
  icon?: string;
  kind?: string;
  children?: NavItem[];
  [k: string]: unknown;
}

const ROOT_KEYS = ['nav', 'navigation', 'tabs', 'items', 'menu'];
const KINDS = ['object', 'page', 'dashboard', 'report', 'link', 'group'];

type Hop = { key: string; index: number };

/** Parse "nav[0].children[2]" → [{key:'nav', index:0}, {key:'children', index:2}]. */
function parsePath(id: string): Hop[] | null {
  const segs = id.split('.');
  const hops: Hop[] = [];
  for (const s of segs) {
    const m = /^([a-zA-Z_]\w*)\[(\d+)\]$/.exec(s);
    if (!m) return null;
    hops.push({ key: m[1], index: Number(m[2]) });
  }
  return hops.length > 0 ? hops : null;
}

function readAt(draft: Record<string, unknown>, hops: Hop[]): { parent: NavItem[]; node: NavItem | null; index: number } {
  let arr = (draft as any)[hops[0].key] as NavItem[] | undefined;
  if (!Array.isArray(arr)) return { parent: [], node: null, index: -1 };
  let node = arr[hops[0].index] ?? null;
  for (let h = 1; h < hops.length; h++) {
    if (!node) return { parent: arr, node: null, index: hops[h].index };
    arr = (node as any)[hops[h].key] as NavItem[] | undefined;
    if (!Array.isArray(arr)) return { parent: [], node: null, index: -1 };
    node = arr[hops[h].index] ?? null;
  }
  return { parent: arr, node, index: hops[hops.length - 1].index };
}

function writeAt(draft: Record<string, unknown>, hops: Hop[], replacement: NavItem | null): Record<string, unknown> {
  // Walk down cloning, then splice at the leaf.
  const rootKey = hops[0].key;
  const root = Array.isArray((draft as any)[rootKey]) ? [...(draft as any)[rootKey] as NavItem[]] : [];
  if (hops.length === 1) {
    return { [rootKey]: spliceArray(root, hops[0].index, replacement) };
  }
  // Walk + clone.
  let arr: NavItem[] = root;
  const stack: Array<{ arr: NavItem[]; index: number; node: NavItem }> = [];
  for (let h = 0; h < hops.length - 1; h++) {
    const node = { ...(arr[hops[h].index] ?? {}) } as NavItem;
    stack.push({ arr, index: hops[h].index, node });
    const nextKey = hops[h + 1].key;
    const childArr = Array.isArray((node as any)[nextKey]) ? [...(node as any)[nextKey] as NavItem[]] : [];
    (node as any)[nextKey] = childArr;
    arr[hops[h].index] = node;
    arr = childArr;
  }
  // Splice at leaf:
  const leafSpliced = spliceArray(arr, hops[hops.length - 1].index, replacement);
  // Re-attach.
  stack[stack.length - 1].node[hops[hops.length - 1].key as keyof NavItem] = leafSpliced as any;
  return { [rootKey]: root };
}

/**
 * Replace the sibling array of the leaf hop with `nextSiblings`.
 * Mirrors `writeAt`'s clone-down strategy but operates on the
 * containing array rather than a single index.
 */
function writeSiblings(draft: Record<string, unknown>, hops: Hop[], nextSiblings: NavItem[]): Record<string, unknown> {
  const rootKey = hops[0].key;
  if (hops.length === 1) {
    return { [rootKey]: nextSiblings };
  }
  const root = Array.isArray((draft as any)[rootKey]) ? [...(draft as any)[rootKey] as NavItem[]] : [];
  let arr: NavItem[] = root;
  for (let h = 0; h < hops.length - 2; h++) {
    const node = { ...(arr[hops[h].index] ?? {}) } as NavItem;
    const nextKey = hops[h + 1].key;
    const childArr = Array.isArray((node as any)[nextKey]) ? [...(node as any)[nextKey] as NavItem[]] : [];
    (node as any)[nextKey] = childArr;
    arr[hops[h].index] = node;
    arr = childArr;
  }
  const parentHop = hops[hops.length - 2];
  const leafKey = hops[hops.length - 1].key;
  const parentCopy = { ...(arr[parentHop.index] ?? {}) } as NavItem;
  (parentCopy as any)[leafKey] = nextSiblings;
  arr[parentHop.index] = parentCopy;
  return { [rootKey]: root };
}

export function AppNavInspector({ selection, draft, onPatch, onClearSelection, onSelectionChange, locale, readOnly }: MetadataInspectorProps) {
  const hops = parsePath(selection.id);
  const { node, parent, index } = hops ? readAt(draft, hops) : { node: null, parent: [] as NavItem[], index: -1 };

  if (!hops || !node) {
    return (
      <InspectorShell kindLabel={t('engine.inspector.appNav.kind', locale)} title={selection.label ?? selection.id} onClose={onClearSelection} closeLabel={t('engine.inspector.appNav.close', locale)}>
        <InspectorEmptyState message={selection.id} />
      </InspectorShell>
    );
  }

  const labelOf = node.label ?? node.title ?? node.name ?? node.path ?? selection.id;
  const path = node.path ?? node.href ?? node.route ?? '';

  const patch = (updates: Partial<NavItem>) => {
    onPatch(writeAt(draft, hops, { ...node, ...updates }));
  };

  const remove = () => {
    onPatch(writeAt(draft, hops, null));
    onClearSelection();
  };

  const move = (to: number) => {
    const next = moveArray(parent, index, to);
    onPatch(writeSiblings(draft, hops, next));
    const prefix = hops.slice(0, -1).map((h) => `${h.key}[${h.index}]`).join('.');
    const leafKey = hops[hops.length - 1].key;
    const newId = prefix ? `${prefix}.${leafKey}[${to}]` : `${leafKey}[${to}]`;
    onSelectionChange?.({ kind: 'nav', id: newId, label: String(labelOf) });
  };

  return (
    <InspectorShell
      kindLabel={t('engine.inspector.appNav.kind', locale)}
      title={String(labelOf)}
      onClose={onClearSelection}
      closeLabel={t('engine.inspector.appNav.close', locale)}
      headerActions={
        <InspectorReorderButtons
          index={index}
          total={parent.length}
          onMove={move}
          upLabel={t('engine.inspector.reorder.up', locale)}
          downLabel={t('engine.inspector.reorder.down', locale)}
          disabled={readOnly}
        />
      }
      footer={<InspectorRemoveButton label={t('engine.inspector.appNav.remove', locale)} onClick={remove} disabled={readOnly} />}
    >
      <InspectorTextField label={t('engine.inspector.appNav.label', locale)} value={String(node.label ?? node.title ?? node.name ?? '')} onCommit={(v) => patch({ label: v })} disabled={readOnly} />
      <InspectorTextField label={t('engine.inspector.appNav.path', locale)} value={String(path)} onCommit={(v) => patch({ path: v })} disabled={readOnly} mono />
      <InspectorTextField label={t('engine.inspector.appNav.icon', locale)} value={String(node.icon ?? '')} onCommit={(v) => patch({ icon: v })} disabled={readOnly} />
      <InspectorSelectField label={t('engine.inspector.appNav.kindField', locale)} value={node.kind} options={KINDS.map((v) => ({ value: v, label: v }))} onCommit={(v) => patch({ kind: v })} disabled={readOnly} />
    </InspectorShell>
  );
}

export const APP_NAV_ROOT_KEYS = ROOT_KEYS;
