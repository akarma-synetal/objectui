// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowNodeConfigField — renders one scalar config control for a flow node,
 * driven by a `FlowConfigField` descriptor. Bridges descriptor "kind" to the
 * shared inspector field primitives and writes back to `node.config[key]`.
 */

import * as React from 'react';
import type { FlowConfigField } from './flow-node-config';
import {
  InspectorTextField,
  InspectorNumberField,
  InspectorSelectField,
  InspectorCheckboxField,
} from './_shared';

export interface FlowNodeConfigFieldProps {
  field: FlowConfigField;
  value: unknown;
  onCommit: (value: unknown) => void;
  disabled?: boolean;
}

export function FlowNodeConfigField({ field, value, onCommit, disabled }: FlowNodeConfigFieldProps) {
  const control = (() => {
    switch (field.kind) {
      case 'number':
        return (
          <InspectorNumberField
            label={field.label}
            value={typeof value === 'number' ? value : value != null && value !== '' ? Number(value) : undefined}
            placeholder={field.placeholder}
            onCommit={(v) => onCommit(v)}
            disabled={disabled}
          />
        );
      case 'boolean':
        return (
          <InspectorCheckboxField
            label={field.label}
            value={value === true}
            onCommit={(v) => onCommit(v)}
            disabled={disabled}
          />
        );
      case 'select':
        return (
          <InspectorSelectField
            label={field.label}
            value={value != null ? String(value) : ''}
            options={field.options ?? []}
            onCommit={(v) => onCommit(v)}
            disabled={disabled}
          />
        );
      case 'expression':
      case 'text':
      default:
        return (
          <InspectorTextField
            label={field.label}
            value={value != null ? String(value) : ''}
            placeholder={field.placeholder}
            onCommit={(v) => onCommit(v)}
            disabled={disabled}
            mono={field.kind === 'expression'}
          />
        );
    }
  })();

  return (
    <div className="space-y-1">
      {control}
      {field.help && <p className="text-[11px] leading-snug text-muted-foreground">{field.help}</p>}
    </div>
  );
}
