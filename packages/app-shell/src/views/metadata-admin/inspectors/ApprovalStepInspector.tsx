// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ApprovalStepInspector — scoped editor for the selected approval step.
 *
 * Selection shape:  { kind: 'step', id: <stepName | "steps[i]"> }
 * Patches:           draft.steps[i] = {...step, ...updates}
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

interface ApprovalStep {
  name?: string;
  label?: string;
  description?: string;
  behavior?: 'unanimous' | 'first';
  entryCriteria?: string | { source?: string };
  rejectionBehavior?: 'back_to_previous' | 'reject_process';
  [k: string]: unknown;
}

const BEHAVIORS = [
  { value: 'unanimous', label: 'unanimous (all approve)' },
  { value: 'first', label: 'first response wins' },
];

const REJECTION = [
  { value: 'back_to_previous', label: 'back to previous step' },
  { value: 'reject_process', label: 'reject entire process' },
];

function celOf(v: ApprovalStep['entryCriteria']): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v.source ?? '';
}

export function ApprovalStepInspector({ selection, draft, onPatch, onClearSelection, onSelectionChange, locale, readOnly }: MetadataInspectorProps) {
  const steps = Array.isArray((draft as any).steps) ? (draft as any).steps as ApprovalStep[] : [];
  // Lookup by name, or by "steps[i]" pseudo-id (assigned when name is empty).
  const index = (() => {
    const m = /^steps\[(\d+)\]$/.exec(selection.id);
    if (m) return Number(m[1]);
    return steps.findIndex((s) => s?.name === selection.id);
  })();
  const step = index >= 0 && index < steps.length ? steps[index] : null;

  if (!step) {
    return (
      <InspectorShell kindLabel={t('engine.inspector.approvalStep.kind', locale)} title={selection.label ?? selection.id} onClose={onClearSelection} closeLabel={t('engine.inspector.approvalStep.close', locale)}>
        <InspectorEmptyState message={selection.id} />
      </InspectorShell>
    );
  }

  const patch = (updates: Partial<ApprovalStep>) => {
    onPatch({ steps: spliceArray(steps, index, { ...step, ...updates }) });
  };

  const remove = () => {
    onPatch({ steps: spliceArray(steps, index, null) });
    onClearSelection();
  };

  const move = (to: number) => {
    onPatch({ steps: moveArray(steps, index, to) });
    // Re-select by name if available (stable across position), else by new index.
    const id = step.name || `steps[${to}]`;
    onSelectionChange?.({ kind: 'step', id, label: step.label || step.name || `Step ${to + 1}` });
  };

  return (
    <InspectorShell
      kindLabel={t('engine.inspector.approvalStep.kind', locale)}
      title={step.label || step.name || `Step ${index + 1}`}
      onClose={onClearSelection}
      closeLabel={t('engine.inspector.approvalStep.close', locale)}
      headerActions={
        <InspectorReorderButtons
          index={index}
          total={steps.length}
          onMove={move}
          upLabel={t('engine.inspector.reorder.up', locale)}
          downLabel={t('engine.inspector.reorder.down', locale)}
          disabled={readOnly}
        />
      }
      footer={<InspectorRemoveButton label={t('engine.inspector.approvalStep.remove', locale)} onClick={remove} disabled={readOnly} />}
    >
      <InspectorTextField label={t('engine.inspector.approvalStep.name', locale)} value={step.name ?? ''} onCommit={(v) => patch({ name: v })} disabled={readOnly} mono />
      <InspectorTextField label={t('engine.inspector.approvalStep.label', locale)} value={step.label ?? ''} onCommit={(v) => patch({ label: v })} disabled={readOnly} />
      <InspectorTextField label={t('engine.inspector.approvalStep.description', locale)} value={step.description ?? ''} onCommit={(v) => patch({ description: v })} disabled={readOnly} />
      <InspectorSelectField label={t('engine.inspector.approvalStep.behavior', locale)} value={step.behavior} options={BEHAVIORS} onCommit={(v) => patch({ behavior: v as ApprovalStep['behavior'] })} disabled={readOnly} />
      <InspectorTextField label={t('engine.inspector.approvalStep.entryCriteria', locale)} value={celOf(step.entryCriteria)} onCommit={(v) => patch({ entryCriteria: v })} disabled={readOnly} mono />
      <InspectorSelectField label={t('engine.inspector.approvalStep.rejectionBehavior', locale)} value={step.rejectionBehavior} options={REJECTION} onCommit={(v) => patch({ rejectionBehavior: v as ApprovalStep['rejectionBehavior'] })} disabled={readOnly} />
    </InspectorShell>
  );
}
