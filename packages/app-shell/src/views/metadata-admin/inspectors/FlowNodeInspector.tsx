// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowNodeInspector — scoped editor for the selected flow node.
 *
 * Selection shape:  { kind: 'node', id: <nodeId> }
 * Patches:           draft.nodes[i] = {...node, ...updates}
 *
 * Beyond id / label / type / description, each node type exposes a set of
 * typed form fields (see `flow-node-config`) that edit scalar keys on
 * `node.config`. Any remaining config keys (objects, arrays, bespoke flags)
 * are surfaced in an "Advanced (JSON)" block so authors are never locked out.
 */

import * as React from 'react';
import { Plus } from 'lucide-react';
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
import { fieldsForNodeType, isFieldVisible, FLOW_NODE_TYPE_OPTIONS } from './flow-node-config';
import { FlowNodeConfigField } from './FlowNodeConfigField';

interface FlowNode {
  id: string;
  type?: string;
  label?: string;
  description?: string;
  config?: Record<string, unknown>;
  [k: string]: unknown;
}

function asConfig(node: FlowNode | null): Record<string, unknown> {
  const c = node?.config;
  return c && typeof c === 'object' && !Array.isArray(c) ? (c as Record<string, unknown>) : {};
}

export function FlowNodeInspector({ selection, draft, onPatch, onClearSelection, locale, readOnly }: MetadataInspectorProps) {
  const nodes = Array.isArray((draft as any).nodes) ? ((draft as any).nodes as FlowNode[]) : [];
  const index = nodes.findIndex((n) => n?.id === selection.id);
  const node = index >= 0 ? nodes[index] : null;

  const fields = fieldsForNodeType(node?.type);
  const config = asConfig(node);
  const visibleFields = fields.filter((f) => isFieldVisible(f, config));
  const knownKeys = React.useMemo(() => new Set(fields.map((f) => f.key)), [fields]);

  const extraJson = React.useMemo(() => {
    const extra = Object.fromEntries(Object.entries(config).filter(([k]) => !knownKeys.has(k)));
    return Object.keys(extra).length ? JSON.stringify(extra, null, 2) : '';
    // Recompute when the node identity changes (patch) or the known keys change.
  }, [node, knownKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  const [advText, setAdvText] = React.useState(extraJson);
  const [advError, setAdvError] = React.useState<string | null>(null);
  const [advOpen, setAdvOpen] = React.useState(extraJson.trim() !== '');
  // Reveals the optional custom-keys editor on nodes that currently have none.
  const [advReveal, setAdvReveal] = React.useState(false);
  React.useEffect(() => {
    setAdvText(extraJson);
    setAdvError(null);
    setAdvOpen(extraJson.trim() !== '');
    setAdvReveal(false);
  }, [extraJson]);

  if (!node) {
    return (
      <InspectorShell kindLabel={t('engine.inspector.flowNode.kind', locale)} title={selection.label ?? selection.id} onClose={onClearSelection} closeLabel={t('engine.inspector.flowNode.close', locale)}>
        <InspectorEmptyState message={selection.id} />
      </InspectorShell>
    );
  }

  const patchNode = (updates: Partial<FlowNode>) => {
    onPatch({ nodes: spliceArray(nodes, index, { ...node, ...updates }) });
  };

  const hasExtras = extraJson.trim() !== '';

  const setConfigKey = (key: string, value: unknown) => {
    const next = { ...config };
    if (value === undefined || value === '' || value === null) delete next[key];
    else next[key] = value;
    if (Object.keys(next).length === 0) {
      const { config: _omit, ...restNode } = node;
      void _omit;
      onPatch({ nodes: spliceArray(nodes, index, restNode) });
    } else {
      patchNode({ config: next });
    }
  };

  const commitAdvanced = () => {
    try {
      const parsed = advText.trim() === '' ? {} : JSON.parse(advText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Must be a JSON object');
      // Known-field values always win: the Advanced block may only set keys that
      // no form field owns, so it can never overwrite or resurrect a field key.
      const knownPart = Object.fromEntries(Object.entries(config).filter(([k]) => knownKeys.has(k)));
      const extrasPart = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(([k]) => !knownKeys.has(k)),
      );
      const merged = { ...knownPart, ...extrasPart };
      setAdvError(null);
      if (Object.keys(merged).length === 0) {
        const { config: _omit, ...restNode } = node;
        void _omit;
        onPatch({ nodes: spliceArray(nodes, index, restNode) });
      } else {
        patchNode({ config: merged });
      }
    } catch (e) {
      setAdvError(String((e as Error).message));
    }
  };

  const remove = () => {
    onPatch({ nodes: spliceArray(nodes, index, null) });
    onClearSelection();
  };

  const typeOptions = FLOW_NODE_TYPE_OPTIONS.includes(node.type as (typeof FLOW_NODE_TYPE_OPTIONS)[number])
    ? [...FLOW_NODE_TYPE_OPTIONS]
    : [...FLOW_NODE_TYPE_OPTIONS, node.type ?? ''].filter(Boolean);

  return (
    <InspectorShell
      kindLabel={t('engine.inspector.flowNode.kind', locale)}
      title={node.label || node.id}
      onClose={onClearSelection}
      closeLabel={t('engine.inspector.flowNode.close', locale)}
      footer={<InspectorRemoveButton label={t('engine.inspector.flowNode.remove', locale)} onClick={remove} disabled={readOnly} />}
    >
      <InspectorTextField label={t('engine.inspector.flowNode.id', locale)} value={node.id} onCommit={(v) => patchNode({ id: v })} disabled={readOnly} mono />
      <InspectorTextField label={t('engine.inspector.flowNode.label', locale)} value={node.label ?? ''} onCommit={(v) => patchNode({ label: v })} disabled={readOnly} />
      <InspectorSelectField
        label={t('engine.inspector.flowNode.type', locale)}
        value={node.type}
        options={typeOptions.map((v) => ({ value: v, label: v }))}
        onCommit={(v) => patchNode({ type: v })}
        disabled={readOnly}
      />
      <InspectorTextField
        label={t('engine.inspector.flowNode.description', locale)}
        value={node.description ?? ''}
        onCommit={(v) => patchNode({ description: v || undefined })}
        disabled={readOnly}
      />

      {fields.length === 0 ? (
        <p className="pt-1 text-xs italic text-muted-foreground">
          {t('engine.inspector.flowNode.noConfig', locale)}
        </p>
      ) : (
        visibleFields.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('engine.inspector.flowNode.configuration', locale)}
            </span>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>
        )
      )}

      {visibleFields.map((field) => (
        <FlowNodeConfigField
          key={field.key}
          field={field}
          value={config[field.key]}
          onCommit={(v) => setConfigKey(field.key, v)}
          disabled={readOnly}
          locale={locale}
        />
      ))}

      {hasExtras || advReveal ? (
        <details
          className="group rounded border bg-muted/20"
          open={advOpen}
          onToggle={(e) => setAdvOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer select-none px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {t('engine.inspector.flowNode.advanced', locale)}
          </summary>
          <div className="space-y-1 border-t p-2">
            <p className="text-[11px] leading-snug text-muted-foreground">{t('engine.inspector.flowNode.advancedHint', locale)}</p>
            <textarea
              value={advText}
              onChange={(e) => setAdvText(e.target.value)}
              onBlur={commitAdvanced}
              disabled={readOnly}
              rows={6}
              placeholder="{ }"
              className="w-full rounded border bg-background px-2 py-1.5 font-mono text-xs"
            />
            {advError && <div className="text-xs text-destructive">{advError}</div>}
          </div>
        </details>
      ) : (
        !readOnly && (
          <button
            type="button"
            onClick={() => {
              setAdvReveal(true);
              setAdvOpen(true);
            }}
            className="inline-flex items-center gap-1 self-start text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            {t('engine.inspector.flowNode.advanced', locale)}
          </button>
        )
      )}
    </InspectorShell>
  );
}
