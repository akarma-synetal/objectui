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

  // Chevron clip paths: outer stages get half-clipped, middle stages get
  // both a left notch and a right point so they tessellate into a path.
  // We use a 14px arrow head; first segment has no left notch and last
  // segment has no right point.
  const CHEVRON = 14;
  const clipFor = (idx: number, last: number) => {
    if (stages.length === 1) return undefined;
    if (idx === 0) {
      return `polygon(0 0, calc(100% - ${CHEVRON}px) 0, 100% 50%, calc(100% - ${CHEVRON}px) 100%, 0 100%)`;
    }
    if (idx === last) {
      return `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${CHEVRON}px 50%)`;
    }
    return `polygon(0 0, calc(100% - ${CHEVRON}px) 0, 100% 50%, calc(100% - ${CHEVRON}px) 100%, 0 100%, ${CHEVRON}px 50%)`;
  };

  const last = stages.length - 1;

  return (
    <div className={cn('w-full', className)} {...designer}>
      {/* Desktop: chevron path */}
      <div
        className="hidden sm:flex w-full items-stretch"
        role="list"
        aria-label={(schema.aria as any)?.label || 'Record path'}
      >
        {stages.map((stage, idx) => {
          const isCompleted = currentIdx >= 0 && idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const clipPath = clipFor(idx, last);
          return (
            <div
              key={`${stage.value}-${idx}`}
              role="listitem"
              aria-current={isCurrent ? 'step' : undefined}
              style={clipPath ? { clipPath, WebkitClipPath: clipPath } : undefined}
              className={cn(
                'relative flex-1 min-w-0 px-5 py-2 text-xs font-medium text-center',
                idx > 0 && '-ml-2',
                stages.length === 1 && 'rounded-md border',
                isCurrent && 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40',
                isCompleted && 'bg-muted text-muted-foreground',
                !isCurrent && !isCompleted && 'bg-background text-foreground/70 border border-border/60',
              )}
            >
              <span
                className="inline-flex items-center gap-1.5 truncate"
                style={{
                  paddingLeft: idx === 0 ? 0 : `${CHEVRON / 2}px`,
                  paddingRight: idx === last ? 0 : `${CHEVRON / 2}px`,
                }}
              >
                {isCompleted && <span aria-hidden>✓</span>}
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile: horizontally scrollable pill row */}
      <div
        className="flex sm:hidden w-full items-stretch gap-1 overflow-x-auto pb-1 -mx-1 px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label={(schema.aria as any)?.label || 'Record path'}
      >
        {stages.map((stage, idx) => {
          const isCompleted = currentIdx >= 0 && idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <div
              key={`${stage.value}-${idx}-m`}
              role="listitem"
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap',
                isCurrent && 'bg-primary text-primary-foreground border-primary shadow-sm ring-1 ring-primary/40',
                isCompleted && 'bg-muted text-muted-foreground border-transparent',
                !isCurrent && !isCompleted && 'bg-background text-foreground/70 border-border/60',
              )}
            >
              <span className="inline-flex items-center gap-1">
                {isCompleted && <span aria-hidden>✓</span>}
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecordPathRenderer;
