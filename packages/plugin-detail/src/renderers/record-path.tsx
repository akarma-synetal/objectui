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
import { useRecordContext, useSafeFieldLabel } from '@object-ui/react';
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
  const { translateOptions } = useSafeFieldLabel();
  const { designer } = splitDesigner(props);

  const rawStages: Array<{ value: any; label: string; terminal?: 'won' | 'lost' }> = Array.isArray(schema.stages)
    ? (schema.stages as any)
    : [];
  const statusField: string | undefined = schema.statusField;
  // Localize picklist labels when an i18n provider is mounted and the
  // record context knows which object owns the field. Falls back to the
  // schema's own labels (already English in synth, possibly authored in
  // any language for full Lightning pages) when no translation is found.
  const stages: Array<{ value: any; label: string; terminal?: 'won' | 'lost' }> = React.useMemo(() => {
    if (rawStages.length === 0 || !statusField || !ctx?.objectName) return rawStages;
    const translated = translateOptions(ctx.objectName, statusField, rawStages as any);
    if (Array.isArray(translated) && translated.length === rawStages.length) {
      return rawStages.map((s, i) => ({ ...s, label: (translated as any)[i]?.label ?? s.label }));
    }
    return rawStages;
  }, [rawStages, statusField, ctx?.objectName, translateOptions]);
  const current = statusField && ctx?.data ? (ctx.data as any)[statusField] : undefined;

  // Classify each stage. Honor explicit `terminal` from the schema first;
  // fall back to a heuristic so CRM examples / Salesforce-style picklists
  // ("closed_won", "closed_lost", "失败", "流失") get the right treatment
  // without requiring authors to migrate their stage configs.
  const LOST_TOKENS = /(^|[_-\s])(closed_)?(lost|failed?|cancell?ed|失败|流失|丢单|败)([_-\s]|$)/i;
  const WON_TOKENS = /(^|[_-\s])(closed_)?(won|success|成交|赢|完成)([_-\s]|$)/i;
  const classify = (s: { value: any; label?: string; terminal?: 'won' | 'lost' }): 'won' | 'lost' | undefined => {
    if (s.terminal) return s.terminal;
    const probe = `${String(s.value ?? '')} ${String(s.label ?? '')}`;
    if (LOST_TOKENS.test(probe)) return 'lost';
    if (WON_TOKENS.test(probe)) return 'won';
    return undefined;
  };
  const stageKinds = stages.map(classify);
  // Find the index of the FIRST lost-class stage so we can render it
  // (and any subsequent lost terminals) as a visually separated alt
  // group. Won-class stages stay inside the forward chevron path —
  // they're the successful terminus.
  const firstLostIdx = stageKinds.findIndex((k) => k === 'lost');
  const forwardStages = firstLostIdx === -1 ? stages : stages.slice(0, firstLostIdx);
  const lostStages = firstLostIdx === -1 ? [] : stages.slice(firstLostIdx);
  const forwardKinds = firstLostIdx === -1 ? stageKinds : stageKinds.slice(0, firstLostIdx);

  let currentIdx = stages.findIndex((s) => s.value === current);
  if (currentIdx < 0) currentIdx = -1;
  const currentInLost = firstLostIdx !== -1 && currentIdx >= firstLostIdx;

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

  const last = forwardStages.length - 1;

  // Mobile shows ALL stages as pills (lost too) — visual separation done
  // via color, not layout, since there's not enough room to fork the row.

  return (
    <div className={cn('w-full', className)} {...designer}>
      {/* Desktop: chevron path → optional lost-alt group */}
      <div
        className="hidden sm:flex w-full items-stretch gap-2"
        role="list"
        aria-label={(schema.aria as any)?.label || 'Record path'}
      >
        <div className="flex flex-1 items-stretch">
          {forwardStages.map((stage, idx) => {
            const isCompleted = !currentInLost && currentIdx >= 0 && idx < currentIdx;
            const isCurrent = !currentInLost && idx === currentIdx;
            const isWonTerminus = forwardKinds[idx] === 'won' && idx === last;
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
                  forwardStages.length === 1 && 'rounded-md border',
                  isCurrent && 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40',
                  isCompleted && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
                  // Style the won-terminus subtly so it reads as "the goal"
                  // even when we haven't reached it yet.
                  !isCurrent && !isCompleted && isWonTerminus && 'bg-emerald-500/5 text-emerald-700/85 dark:text-emerald-300/85 border border-emerald-500/20',
                  !isCurrent && !isCompleted && !isWonTerminus && 'bg-background text-foreground/85 border border-border/60',
                )}
              >
                <span
                  className="inline-flex items-center gap-1.5 truncate"
                  style={{
                    paddingLeft: idx === 0 ? 0 : `${CHEVRON / 2}px`,
                    paddingRight: idx === last ? 0 : `${CHEVRON / 2}px`,
                  }}
                >
                  {isCompleted && <span aria-hidden className="text-emerald-600 dark:text-emerald-400 font-semibold">✓</span>}
                  {isWonTerminus && !isCurrent && <span aria-hidden className="opacity-70">🏆</span>}
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
        {lostStages.length > 0 && (
          // Separated alt-terminus group — gap, muted/destructive tint,
          // pill (not chevron) shape so it doesn't read as "step N+1" in
          // the forward path. Same affordance that Salesforce/HubSpot use.
          <div className="flex items-stretch gap-1 pl-2 border-l border-border/40" aria-label="Alternative terminal stages">
            {lostStages.map((stage, lIdx) => {
              const absIdx = firstLostIdx + lIdx;
              const isCurrent = absIdx === currentIdx;
              return (
                <div
                  key={`${stage.value}-lost-${lIdx}`}
                  role="listitem"
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cn(
                    'shrink-0 px-3 py-2 text-xs font-medium rounded-md border whitespace-nowrap',
                    isCurrent && 'bg-destructive text-destructive-foreground border-destructive shadow-sm ring-1 ring-destructive/40',
                    !isCurrent && 'bg-destructive/5 text-destructive/85 border-destructive/20',
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden className="opacity-70">✗</span>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile: horizontally scrollable pill row */}
      <div
        className="flex sm:hidden w-full items-stretch gap-1 overflow-x-auto pb-1 -mx-1 px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label={(schema.aria as any)?.label || 'Record path'}
      >
        {stages.map((stage, idx) => {
          const kind = stageKinds[idx];
          const isLost = kind === 'lost';
          const isCompleted = !isLost && !currentInLost && currentIdx >= 0 && idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <div
              key={`${stage.value}-${idx}-m`}
              role="listitem"
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap',
                isLost && isCurrent && 'bg-destructive text-destructive-foreground border-destructive shadow-sm',
                isLost && !isCurrent && 'bg-destructive/5 text-destructive/85 border-destructive/20',
                !isLost && isCurrent && 'bg-primary text-primary-foreground border-primary shadow-sm ring-1 ring-primary/40',
                !isLost && isCompleted && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30',
                !isLost && !isCurrent && !isCompleted && 'bg-background text-foreground/85 border-border/60',
              )}
            >
              <span className="inline-flex items-center gap-1">
                {isLost && <span aria-hidden className="opacity-70">✗</span>}
                {!isLost && isCompleted && <span aria-hidden className="text-emerald-600 dark:text-emerald-400 font-semibold">✓</span>}
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
