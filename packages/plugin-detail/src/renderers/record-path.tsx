/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:path` — Salesforce Lightning Path-style stepper. Reads the value
 * of `schema.statusField` from the bound record and highlights the matching
 * stage in `schema.stages[]`. Stages preceding the current one render as
 * completed (with a check); the current renders as active; subsequent
 * stages render as upcoming.
 *
 * This is a greenfield component (no underlying plugin-detail equivalent),
 * intentionally minimal so it can be styled in line with the host page.
 */

import React from 'react';
import { useRecordContext } from '@object-ui/react';
import type { RecordPathComponentProps } from '@object-ui/types';
import { cn } from '@object-ui/components';

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface RecordPathRendererProps {
  schema?: RecordPathComponentProps & Record<string, any>;
  className?: string;
  [k: string]: any;
}

export const RecordPathRenderer: React.FC<RecordPathRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  const ctx = useRecordContext();
  const { designer } = splitDesigner(props);

  const stages: Array<{ value: any; label: string }> = Array.isArray(schema.stages)
    ? (schema.stages as any)
    : [];
  const statusField: string | undefined = schema.statusField;
  const current = statusField && ctx?.data ? (ctx.data as any)[statusField] : undefined;

  let currentIdx = stages.findIndex((s) => s.value === current);
  if (currentIdx < 0) currentIdx = -1;

  if (stages.length === 0) {
    return (
      <div className={className} {...designer}>
        <div className="text-xs text-muted-foreground italic px-3 py-2 border border-dashed rounded">
          record:path — no stages configured
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('flex w-full items-stretch gap-1', className)}
      role="list"
      aria-label={(schema.aria as any)?.label || 'Record path'}
      {...designer}
    >
      {stages.map((stage, idx) => {
        const isCompleted = currentIdx >= 0 && idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div
            key={`${stage.value}-${idx}`}
            role="listitem"
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'relative flex-1 px-4 py-2 text-xs font-medium border text-center',
              'first:rounded-l-md last:rounded-r-md',
              isCurrent && 'bg-primary text-primary-foreground border-primary',
              isCompleted && 'bg-muted text-muted-foreground',
              !isCurrent && !isCompleted && 'bg-background text-foreground/70',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {isCompleted && <span aria-hidden>✓</span>}
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default RecordPathRenderer;
