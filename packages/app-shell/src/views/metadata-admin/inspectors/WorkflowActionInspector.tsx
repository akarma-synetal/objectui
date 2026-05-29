// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * WorkflowActionInspector — scoped editor for the selected workflow
 * action (immediate or time-dependent).
 *
 * Selection shapes:
 *   { kind: 'action', id: 'actions[i]' }                      — immediate
 *   { kind: 'action', id: 'timeTriggers[i].actions[j]' }     — scheduled
 *
 * Patches: rewrite the appropriate slot in the draft, then onPatch().
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

interface WorkflowAction { type?: string; name?: string; [k: string]: unknown }
interface TimeTrigger { offset?: number; unit?: string; actions?: WorkflowAction[]; [k: string]: unknown }

const ACTION_TYPES = [
  'field_update', 'email_alert', 'task_create', 'outbound_message',
  'webhook', 'apex', 'flow_invoke', 'notification',
];

interface ParsedSel {
  scope: 'immediate' | 'timed';
  i: number;
  j?: number;
}

function parseSelectionId(id: string): ParsedSel | null {
  const a = /^actions\[(\d+)\]$/.exec(id);
  if (a) return { scope: 'immediate', i: Number(a[1]) };
  const b = /^timeTriggers\[(\d+)\]\.actions\[(\d+)\]$/.exec(id);
  if (b) return { scope: 'timed', i: Number(b[1]), j: Number(b[2]) };
  return null;
}

export function WorkflowActionInspector({ selection, draft, onPatch, onClearSelection, onSelectionChange, locale, readOnly }: MetadataInspectorProps) {
  const parsed = parseSelectionId(selection.id);
  const immediate = Array.isArray((draft as any).actions) ? (draft as any).actions as WorkflowAction[] : [];
  const timed = Array.isArray((draft as any).timeTriggers) ? (draft as any).timeTriggers as TimeTrigger[] : [];

  const action: WorkflowAction | null = (() => {
    if (!parsed) return null;
    if (parsed.scope === 'immediate') return immediate[parsed.i] ?? null;
    const t = timed[parsed.i];
    if (!t || !Array.isArray(t.actions)) return null;
    return t.actions[parsed.j!] ?? null;
  })();

  if (!action || !parsed) {
    return (
      <InspectorShell kindLabel={t('engine.inspector.workflowAction.kind', locale)} title={selection.label ?? selection.id} onClose={onClearSelection} closeLabel={t('engine.inspector.workflowAction.close', locale)}>
        <InspectorEmptyState message={selection.id} />
      </InspectorShell>
    );
  }

  const patch = (updates: Partial<WorkflowAction>) => {
    const next = { ...action, ...updates };
    if (parsed.scope === 'immediate') {
      onPatch({ actions: spliceArray(immediate, parsed.i, next) });
    } else {
      const trig = timed[parsed.i];
      const newActions = spliceArray(trig.actions ?? [], parsed.j!, next);
      const newTrigs = spliceArray(timed, parsed.i, { ...trig, actions: newActions });
      onPatch({ timeTriggers: newTrigs });
    }
  };

  const remove = () => {
    if (parsed.scope === 'immediate') {
      onPatch({ actions: spliceArray(immediate, parsed.i, null) });
    } else {
      const trig = timed[parsed.i];
      const newActions = spliceArray(trig.actions ?? [], parsed.j!, null);
      onPatch({ timeTriggers: spliceArray(timed, parsed.i, { ...trig, actions: newActions }) });
    }
    onClearSelection();
  };

  const otherConfig = React.useMemo(() => {
    const { type, name, ...rest } = action;
    return JSON.stringify(rest, null, 2);
  }, [action]);
  const [configText, setConfigText] = React.useState(otherConfig);
  const [configError, setConfigError] = React.useState<string | null>(null);
  React.useEffect(() => { setConfigText(otherConfig); setConfigError(null); }, [otherConfig]);

  const commitConfig = () => {
    try {
      const parsedObj = configText.trim() === '' ? {} : JSON.parse(configText);
      if (!parsedObj || typeof parsedObj !== 'object' || Array.isArray(parsedObj)) throw new Error('not object');
      setConfigError(null);
      patch(parsedObj as Partial<WorkflowAction>);
    } catch (e) {
      setConfigError(String((e as Error).message));
    }
  };

  const { currentIndex, total } = (() => {
    if (parsed.scope === 'immediate') return { currentIndex: parsed.i, total: immediate.length };
    const trig = timed[parsed.i];
    const arr = Array.isArray(trig?.actions) ? trig.actions : [];
    return { currentIndex: parsed.j!, total: arr.length };
  })();

  const move = (to: number) => {
    if (parsed.scope === 'immediate') {
      onPatch({ actions: moveArray(immediate, parsed.i, to) });
      onSelectionChange?.({ kind: 'action', id: `actions[${to}]`, label: action.name || action.type });
    } else {
      const trig = timed[parsed.i];
      const newActions = moveArray(trig.actions ?? [], parsed.j!, to);
      onPatch({ timeTriggers: spliceArray(timed, parsed.i, { ...trig, actions: newActions }) });
      onSelectionChange?.({ kind: 'action', id: `timeTriggers[${parsed.i}].actions[${to}]`, label: action.name || action.type });
    }
  };

  return (
    <InspectorShell
      kindLabel={t('engine.inspector.workflowAction.kind', locale)}
      title={action.name || action.type || selection.id}
      onClose={onClearSelection}
      closeLabel={t('engine.inspector.workflowAction.close', locale)}
      headerActions={
        <InspectorReorderButtons
          index={currentIndex}
          total={total}
          onMove={move}
          upLabel={t('engine.inspector.reorder.up', locale)}
          downLabel={t('engine.inspector.reorder.down', locale)}
          disabled={readOnly}
        />
      }
      footer={<InspectorRemoveButton label={t('engine.inspector.workflowAction.remove', locale)} onClick={remove} disabled={readOnly} />}
    >
      <InspectorSelectField label={t('engine.inspector.workflowAction.type', locale)} value={action.type} options={ACTION_TYPES.map((v) => ({ value: v, label: v }))} onCommit={(v) => patch({ type: v })} disabled={readOnly} />
      <InspectorTextField label={t('engine.inspector.workflowAction.name', locale)} value={action.name ?? ''} onCommit={(v) => patch({ name: v })} disabled={readOnly} />
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{t('engine.inspector.workflowAction.config', locale)}</label>
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
