// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowNodeInspector — scoped editor for the selected flow node.
 *
 * Selection shape:  { kind: 'node', id: <nodeId> }
 * Patches:           draft.nodes[i] = {...node, ...updates}
 *
 * Node config is heterogeneous across node types (action vs decision
 * vs subflow vs wait…), so beyond label/type we expose the rest as a
 * JSON textarea — keeps the surface minimal without locking authors
 * out of any field.
 */

import * as React from 'react';
import type { MetadataInspectorProps } from '../inspector-registry';
import { t } from '../i18n';
import {
  InspectorShell,
  InspectorTextField,
  InspectorSelectField,
  InspectorRemoveButton,
  InspectorEmptyState,
  spliceArray,
} from './_shared';

interface FlowNode { id: string; type?: string; label?: string; [k: string]: unknown }

const NODE_TYPES = [
  'start', 'end', 'action', 'decision', 'branch', 'gateway',
  'subflow', 'wait', 'loop', 'parallel', 'invoke',
];

export function FlowNodeInspector({ selection, draft, onPatch, onClearSelection, locale, readOnly }: MetadataInspectorProps) {
  const nodes = Array.isArray((draft as any).nodes) ? (draft as any).nodes as FlowNode[] : [];
  const index = nodes.findIndex((n) => n?.id === selection.id);
  const node = index >= 0 ? nodes[index] : null;

  if (!node) {
    return (
      <InspectorShell kindLabel={t('engine.inspector.flowNode.kind', locale)} title={selection.label ?? selection.id} onClose={onClearSelection} closeLabel={t('engine.inspector.flowNode.close', locale)}>
        <InspectorEmptyState message={selection.id} />
      </InspectorShell>
    );
  }

  const patch = (updates: Partial<FlowNode>) => {
    onPatch({ nodes: spliceArray(nodes, index, { ...node, ...updates }) });
  };

  const otherConfig = React.useMemo(() => {
    const { id, type, label, ...rest } = node;
    return JSON.stringify(rest, null, 2);
  }, [node]);

  const [configText, setConfigText] = React.useState(otherConfig);
  const [configError, setConfigError] = React.useState<string | null>(null);
  React.useEffect(() => { setConfigText(otherConfig); setConfigError(null); }, [otherConfig]);

  const commitConfig = () => {
    try {
      const parsed = configText.trim() === '' ? {} : JSON.parse(configText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not object');
      setConfigError(null);
      onPatch({ nodes: spliceArray(nodes, index, { id: node.id, type: node.type, label: node.label, ...parsed }) });
    } catch (e) {
      setConfigError(String((e as Error).message));
    }
  };

  const remove = () => {
    onPatch({ nodes: spliceArray(nodes, index, null) });
    onClearSelection();
  };

  return (
    <InspectorShell
      kindLabel={t('engine.inspector.flowNode.kind', locale)}
      title={node.label || node.id}
      onClose={onClearSelection}
      closeLabel={t('engine.inspector.flowNode.close', locale)}
      footer={<InspectorRemoveButton label={t('engine.inspector.flowNode.remove', locale)} onClick={remove} disabled={readOnly} />}
    >
      <InspectorTextField label={t('engine.inspector.flowNode.id', locale)} value={node.id} onCommit={(v) => patch({ id: v })} disabled={readOnly} mono />
      <InspectorTextField label={t('engine.inspector.flowNode.label', locale)} value={node.label ?? ''} onCommit={(v) => patch({ label: v })} disabled={readOnly} />
      <InspectorSelectField
        label={t('engine.inspector.flowNode.type', locale)}
        value={node.type}
        options={NODE_TYPES.map((v) => ({ value: v, label: v }))}
        onCommit={(v) => patch({ type: v })}
        disabled={readOnly}
      />
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{t('engine.inspector.flowNode.config', locale)}</label>
        <textarea
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          onBlur={commitConfig}
          disabled={readOnly}
          rows={8}
          className="w-full rounded border px-2 py-1.5 text-xs font-mono bg-background"
        />
        {configError && <div className="text-xs text-destructive">{configError}</div>}
      </div>
    </InspectorShell>
  );
}
