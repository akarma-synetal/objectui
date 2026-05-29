// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PageBlockInspector — scoped editor for the selected page block /
 * component subtree.
 *
 * Selection shape:  { kind: 'block', id: 'children[i]' | 'children[i].children[j]' | … }
 *
 * A Page schema is a SDUI tree; "blocks" are children nodes. The id
 * is a dotted path of `children[i]` hops, identical in spirit to
 * AppNavInspector but always rooted at top-level `children`.
 */

import * as React from 'react';
import type { MetadataInspectorProps } from '../inspector-registry';
import { t } from '../i18n';
import {
  InspectorShell,
  InspectorTextField,
  InspectorRemoveButton,
  InspectorEmptyState,
  spliceArray,
} from './_shared';

interface Block {
  type?: string;
  id?: string;
  className?: string;
  hidden?: string;
  children?: Block[];
  [k: string]: unknown;
}

type Hop = { key: string; index: number };

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

function readAt(root: Record<string, unknown>, hops: Hop[]): Block | null {
  let arr = (root as any)[hops[0].key] as Block[] | undefined;
  if (!Array.isArray(arr)) return null;
  let node: Block | null = arr[hops[0].index] ?? null;
  for (let h = 1; h < hops.length; h++) {
    if (!node) return null;
    arr = (node as any)[hops[h].key] as Block[] | undefined;
    if (!Array.isArray(arr)) return null;
    node = arr[hops[h].index] ?? null;
  }
  return node;
}

function writeAt(root: Record<string, unknown>, hops: Hop[], replacement: Block | null): Record<string, unknown> {
  const rootKey = hops[0].key;
  const rootArr = Array.isArray((root as any)[rootKey]) ? [...(root as any)[rootKey] as Block[]] : [];
  if (hops.length === 1) {
    return { [rootKey]: spliceArray(rootArr, hops[0].index, replacement) };
  }
  let arr = rootArr;
  for (let h = 0; h < hops.length - 1; h++) {
    const cur = { ...(arr[hops[h].index] ?? {}) } as Block;
    const nextKey = hops[h + 1].key;
    const childArr = Array.isArray((cur as any)[nextKey]) ? [...(cur as any)[nextKey] as Block[]] : [];
    (cur as any)[nextKey] = childArr;
    arr[hops[h].index] = cur;
    arr = childArr;
  }
  spliceArray; // (silence unused if any optimizer)
  const last = hops[hops.length - 1];
  // Replace within the inner-most reference (already cloned above).
  if (replacement === null) arr.splice(last.index, 1);
  else arr[last.index] = replacement;
  return { [rootKey]: rootArr };
}

export function PageBlockInspector({ selection, draft, onPatch, onClearSelection, locale, readOnly }: MetadataInspectorProps) {
  const hops = parsePath(selection.id);
  const block = hops ? readAt(draft, hops) : null;

  if (!hops || !block) {
    return (
      <InspectorShell kindLabel={t('engine.inspector.pageBlock.kind', locale)} title={selection.label ?? selection.id} onClose={onClearSelection} closeLabel={t('engine.inspector.pageBlock.close', locale)}>
        <InspectorEmptyState message={selection.id} />
      </InspectorShell>
    );
  }

  const patch = (updates: Partial<Block>) => onPatch(writeAt(draft, hops, { ...block, ...updates }));
  const remove = () => { onPatch(writeAt(draft, hops, null)); onClearSelection(); };

  return (
    <InspectorShell
      kindLabel={t('engine.inspector.pageBlock.kind', locale)}
      title={String(block.id || block.type || selection.id)}
      onClose={onClearSelection}
      closeLabel={t('engine.inspector.pageBlock.close', locale)}
      footer={<InspectorRemoveButton label={t('engine.inspector.pageBlock.remove', locale)} onClick={remove} disabled={readOnly} />}
    >
      <InspectorTextField label={t('engine.inspector.pageBlock.type', locale)} value={block.type ?? ''} onCommit={(v) => patch({ type: v })} disabled={readOnly} mono />
      <InspectorTextField label={t('engine.inspector.pageBlock.id', locale)} value={block.id ?? ''} onCommit={(v) => patch({ id: v })} disabled={readOnly} mono />
      <InspectorTextField label={t('engine.inspector.pageBlock.className', locale)} value={block.className ?? ''} onCommit={(v) => patch({ className: v })} disabled={readOnly} mono />
      <InspectorTextField label={t('engine.inspector.pageBlock.hidden', locale)} value={block.hidden ?? ''} onCommit={(v) => patch({ hidden: v })} disabled={readOnly} mono />
    </InspectorShell>
  );
}
