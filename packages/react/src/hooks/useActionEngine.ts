/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * useActionEngine — React hook wrapping ActionEngine for location-based action management.
 *
 * Provides declarative access to the ActionEngine's location filtering, bulk operations,
 * keyboard shortcut handling, and execution pipeline from React components.
 *
 * @example
 * ```tsx
 * const { getActionsForLocation, executeAction } = useActionEngine({
 *   actions: schema.actions,
 *   context: { record, user },
 * });
 *
 * const toolbarActions = getActionsForLocation('list_toolbar');
 * ```
 */

import { useCallback, useContext, useMemo } from 'react';
import {
  ActionEngine,
  type ActionLocation,
  type ActionDef,
  type ActionContext,
  type ActionResult,
} from '@object-ui/core';
import { ActionCtxReact } from '../context/ActionContext';

export interface UseActionEngineOptions {
  /** Action definitions to register */
  actions?: ActionDef[];
  /** Action context (record, user, etc.) */
  context?: ActionContext;
}

export interface UseActionEngineReturn {
  /** Get actions available at a specific location, sorted by priority */
  getActionsForLocation: (location: ActionLocation) => ActionDef[];
  /** Get actions that support bulk operations */
  getBulkActions: () => ActionDef[];
  /** Execute an action by name */
  executeAction: (name: string, contextOverride?: Partial<ActionContext>) => Promise<ActionResult>;
  /** Handle a keyboard shortcut */
  handleShortcut: (keys: string) => Promise<ActionResult | null>;
  /** The underlying ActionEngine instance */
  engine: ActionEngine;
}

export function useActionEngine(options: UseActionEngineOptions = {}): UseActionEngineReturn {
  const { actions = [], context = {} } = options;
  // When wrapped in an <ActionProvider>, reuse its ActionRunner so that:
  //   • Visibility / disabled / condition CEL expressions evaluate against
  //     the same context (user, datasource, etc.) the provider was seeded
  //     with — not just the per-call `context` arg.
  //   • Action execution (executeAction / handleShortcut) inherits the
  //     provider's confirm / param-collection / modal / result-dialog /
  //     toast / navigate handlers. Without sharing, a nested engine would
  //     silently no-op on any action that declares `params: [...]` or
  //     `confirmText`, because its local runner has no handlers installed.
  // When no provider is present (unit tests, standalone playgrounds), we
  // fall back to a self-contained runner constructed from the `context` arg.
  const providerCtx = useContext(ActionCtxReact);
  const sharedRunner = providerCtx?.runner ?? null;

  const engine = useMemo(() => {
    // Normalize context to expose both flat (`record`, `user`) and `ctx.*`
    // namespaces. Mirrors `ActionProvider`'s normalization so predicates that
    // use `ctx.user.id` (the CEL convention) resolve the same way whether
    // the engine is sharing a provider runner or operating standalone.
    const normalized = (context && Object.keys(context).length > 0)
      ? {
          ...context,
          ctx: ((context as any).ctx && typeof (context as any).ctx === 'object')
            ? { ...context, ...(context as any).ctx }
            : { ...context },
        }
      : context;
    const e = sharedRunner ? new ActionEngine(sharedRunner) : new ActionEngine(normalized as any);
    // Layer the caller's per-render context on top of the shared runner's
    // baseline (e.g. record-scoped data into a user-scoped provider).
    if (sharedRunner && normalized && Object.keys(normalized).length > 0) {
      e.getRunner().updateContext(normalized as any);
    }
    e.registerActions(actions);
    return e;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedRunner, JSON.stringify(actions), JSON.stringify(context)]);

  const getActionsForLocation = useCallback(
    (location: ActionLocation) => engine.getActionsForLocation(location),
    [engine],
  );

  const getBulkActions = useCallback(() => engine.getBulkActions(), [engine]);

  const executeAction = useCallback(
    (name: string, contextOverride?: Partial<ActionContext>) =>
      engine.executeAction(name, contextOverride),
    [engine],
  );

  const handleShortcut = useCallback(
    (keys: string) => engine.handleShortcut(keys),
    [engine],
  );

  return { getActionsForLocation, getBulkActions, executeAction, handleShortcut, engine };
}
