/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:quick_actions` — Salesforce Lightning-style quick action bar.
 * Consumes the spec's `ActionDef[]` (see `packages/spec/src/ui/action.zod.ts`)
 * via `useActionEngine`, which handles location filtering, shortcut binding,
 * bulk mode, condition evaluation, and the execution pipeline (api / navigate
 * / onClick / toast / reload / redirect, etc.).
 *
 * Default location is `record_header` — drop this component into a page:header
 * region (or page:tabs/toolbar) to surface the per-record action set.
 */

import React from 'react';
import { useRecordContext, useActionEngine } from '@object-ui/react';
import { usePermissions } from '@object-ui/permissions';
import { Button, cn } from '@object-ui/components';
import type { ActionDef, ActionLocation } from '@object-ui/core';

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface RecordQuickActionsRendererProps {
  schema?: {
    actions?: ActionDef[];
    location?: ActionLocation;
    requiredPermissions?: string[];
    align?: 'start' | 'center' | 'end';
    size?: 'sm' | 'default' | 'lg';
    variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
    aria?: { label?: string };
    properties?: Record<string, any>;
    [k: string]: any;
  };
  className?: string;
  [k: string]: any;
}

export const RecordQuickActionsRenderer: React.FC<RecordQuickActionsRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  const ctx = useRecordContext();
  const { designer } = splitDesigner(props);
  const perms = usePermissions();

  // Spec bridge inlines `properties.*` onto the node but also preserves the
  // raw bag. Read from both for compatibility.
  const actions: ActionDef[] = Array.isArray(schema.actions)
    ? schema.actions
    : Array.isArray(schema.properties?.actions)
      ? (schema.properties!.actions as ActionDef[])
      : [];

  const objectName = ctx?.objectName || '';
  const required: string[] = Array.isArray(schema.requiredPermissions)
    ? schema.requiredPermissions
    : [];
  if (required.length > 0 && objectName) {
    const ok = required.every((p) => perms.can(objectName, p as any));
    if (!ok) {
      return (
        <div className={className} {...designer} role="status" aria-live="polite">
          <p className="text-sm text-muted-foreground italic">
            Insufficient permissions to view quick actions.
          </p>
        </div>
      );
    }
  }

  const location: ActionLocation = (schema.location as ActionLocation) || 'record_header';

  const { getActionsForLocation, executeAction } = useActionEngine({
    actions,
    context: {
      record: ctx?.data,
      recordId: ctx?.recordId as any,
      objectName: ctx?.objectName,
    } as any,
  });

  const visibleActions = actions.length > 0 ? getActionsForLocation(location) : [];

  if (visibleActions.length === 0) {
    return (
      <div className={className} {...designer}>
        <div className="text-xs text-muted-foreground italic px-3 py-2 border border-dashed rounded">
          record:quick_actions — no actions configured
        </div>
      </div>
    );
  }

  const align = schema.align || 'end';
  const justify =
    align === 'start' ? 'justify-start' : align === 'center' ? 'justify-center' : 'justify-end';
  // When sitting in the record_header region right below the page:header
  // (the canonical Salesforce Lightning placement), pull the toolbar up so
  // it visually pairs with the title instead of orphaning on its own row.
  // Disabled when rendered inline inside page:header's own action slot
  // (the `inline` flag is set by PageHeader's first-class `actions` prop).
  const inlineWithHeader = location === 'record_header' && !schema.inline;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        inlineWithHeader && '-mt-12 sm:-mt-14 mb-2 relative z-10',
        justify,
        className,
      )}
      role="toolbar"
      aria-label={schema.aria?.label || 'Quick actions'}
      {...designer}
    >
      {visibleActions.map((action, idx) => {
        const label = action.label || action.name || `Action ${idx + 1}`;
        const variant = (action as any).variant || schema.variant || 'default';
        const size = (action as any).size || schema.size || 'sm';
        const disabled =
          typeof action.disabled === 'boolean' ? action.disabled : undefined;
        return (
          <Button
            key={action.name || `qa-${idx}`}
            variant={variant}
            size={size}
            disabled={disabled}
            onClick={() => {
              if (typeof action.onClick === 'function') {
                void action.onClick();
                return;
              }
              if (action.name) void executeAction(action.name);
            }}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
};

export default RecordQuickActionsRenderer;
