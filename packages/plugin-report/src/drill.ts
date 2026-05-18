/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Drill-down protocol for spec reports.
 *
 * A "drill" is the contract a user expects when they click an aggregated cell
 * in a report: jump to the underlying records that produced that number. We
 * model it as a first-class action type so any ActionEngine consumer can wire
 * it once and have every report — Summary, Matrix, Joined — speak the same
 * language.
 *
 * ## Protocol
 *
 * A drill action looks like:
 *
 * ```jsonc
 * {
 *   "type": "drill",
 *   "objectName": "opportunity",      // target object (= report.objectName by default)
 *   "filter": { "region": "East" },   // additional filter — typically the group key
 *   "view": "list",                    // 'list' (default) | 'detail' | a custom view id
 *   "recordId": null,                  // when view === 'detail'
 *   "openIn": "current"                // 'current' | 'modal' | 'new-tab'
 * }
 * ```
 *
 * The {@link buildDrillAction} helper composes one from a `SpecReport` and a
 * group key, merging `report.filter`, the runtime filter, and the group key
 * via `$and`. {@link createDrillHandler} produces an `ActionHandler` that
 * delegates the actual route change to a host-supplied `navigate` callback,
 * so the protocol stays UI-agnostic.
 */

import type { ActionDef, ActionHandler, ActionRunner } from '@object-ui/core';
import type { SpecReport } from '@object-ui/types';
import { mergeFilters } from './hooks/useReportData';

/** Open-target for a drill. */
export type DrillOpenIn = 'current' | 'modal' | 'new-tab';

/** Drill target — either a list filtered down to the group, or a specific record. */
export type DrillView = 'list' | 'detail' | (string & {});

/** Serializable shape of a `type: 'drill'` action. */
export interface DrillActionDef extends ActionDef {
  type: 'drill';
  objectName: string;
  filter?: Record<string, unknown>;
  view?: DrillView;
  recordId?: string | number;
  openIn?: DrillOpenIn;
}

/** Resolved navigation target produced by a drill handler. */
export interface DrillNavigateTarget {
  objectName: string;
  filter?: Record<string, unknown>;
  view?: DrillView;
  recordId?: string | number;
  openIn?: DrillOpenIn;
}

/** Options passed when creating a drill handler. */
export interface DrillHandlerOptions {
  /**
   * Host-supplied navigation callback. The handler invokes this with a
   * fully-resolved target so the host can decide whether to push to
   * router, open a modal, or open a new tab.
   */
  navigate: (target: DrillNavigateTarget) => void | Promise<void>;
}

/**
 * Compose a `drill` action from a spec report + group key.
 *
 * Filter precedence (later overrides earlier where keys conflict):
 *   1. `report.filter` (definition-time)
 *   2. `runtimeFilter` (URL / user selection)
 *   3. `groupKey` (the row/cell the user actually clicked)
 *
 * All three are combined via `$and` so backend filter engines see the
 * full intersection.
 */
export function buildDrillAction(
  report: SpecReport,
  groupKey: Record<string, unknown>,
  options: {
    runtimeFilter?: Record<string, unknown>;
    view?: DrillView;
    recordId?: string | number;
    openIn?: DrillOpenIn;
  } = {},
): DrillActionDef {
  const filter = mergeFilters(
    mergeFilters(
      report.filter as Record<string, unknown> | undefined,
      options.runtimeFilter,
    ),
    Object.keys(groupKey).length > 0 ? groupKey : undefined,
  );
  return {
    type: 'drill',
    name: `drill-${report.name}`,
    objectName: report.objectName,
    ...(filter ? { filter } : {}),
    view: options.view ?? 'list',
    ...(options.recordId !== undefined ? { recordId: options.recordId } : {}),
    openIn: options.openIn ?? 'current',
  };
}

/** Type guard for drill actions. */
export function isDrillAction(action: ActionDef | undefined | null): action is DrillActionDef {
  return !!action && (action as { type?: string }).type === 'drill';
}

/**
 * Build an `ActionHandler` for the `drill` action type.
 *
 * Register it on an `ActionRunner` (or `ActionEngine`'s runner) via
 * `runner.registerHandler('drill', createDrillHandler({ navigate }))`.
 */
export function createDrillHandler(opts: DrillHandlerOptions): ActionHandler {
  return async (action) => {
    if (!isDrillAction(action)) {
      return { success: false, error: 'drill handler invoked with non-drill action' };
    }
    try {
      await opts.navigate({
        objectName: action.objectName,
        filter: action.filter,
        view: action.view,
        recordId: action.recordId,
        openIn: action.openIn,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  };
}

/**
 * Register the drill handler on an `ActionRunner` instance. Returns an
 * unregister function for cleanup (useful in React effects).
 */
export function registerDrillHandler(
  runner: ActionRunner,
  opts: DrillHandlerOptions,
): () => void {
  runner.registerHandler('drill', createDrillHandler(opts));
  return () => runner.unregisterHandler('drill');
}
