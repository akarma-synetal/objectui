/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useMemo } from 'react';
import { ExpressionEvaluator } from '@object-ui/core';

/**
 * Normalize a schema-supplied predicate (`visible` / `enabled` / `disabled` /
 * `hidden`) into the `${expr}` template form expected by `useCondition`.
 *
 * Accepts:
 *   - `boolean` → returned as-is (predicate hooks short-circuit on booleans).
 *   - `string`  → wrapped as `${string}` (legacy DX shorthand).
 *   - `Expression` envelope `{ dialect, source }` (new format from
 *     `@objectstack/spec`'s normalized predicate inputs) → unwrapped, then
 *     wrapped as `${source}`. Both `cel` and `template` dialects already use
 *     compatible variable syntax (`record.x`, etc.).
 *   - `null` / `undefined` / empty → `undefined` (default visible/enabled).
 *
 * This is the canonical helper to use in renderers so we never end up with
 * `${[object Object]}` after JS template-literal interpolation.
 */
export function toPredicateInput(
  value: unknown,
): string | boolean | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return `\${${value}}`;
  if (typeof value === 'object' && typeof (value as any).source === 'string') {
    const src = (value as any).source as string;
    return src ? `\${${src}}` : undefined;
  }
  return undefined;
}

/**
 * Hook for evaluating expressions with dynamic context
 * 
 * @example
 * ```tsx
 * const isVisible = useExpression('${data.age >= 18}', { data });
 * const label = useExpression('Hello ${user.name}!', { user });
 * ```
 */
export function useExpression(
  expression: string | boolean | number | null | undefined,
  context: Record<string, any> = {}
): any {
  // We evaluate directly without caching the evaluator to avoid issues with context changes
  return useMemo(
    () => {
      const evaluator = new ExpressionEvaluator(context);
      return evaluator.evaluate(expression);
    },
    [expression, context]
  );
}

/**
 * Hook for evaluating conditional expressions
 * Returns a boolean value
 * 
 * @example
 * ```tsx
 * const isVisible = useCondition('${data.status === "active"}', { data });
 * ```
 */
export function useCondition(
  condition: string | boolean | undefined,
  context: Record<string, any> = {}
): boolean {
  // We evaluate directly without caching the evaluator to avoid issues with context changes
  return useMemo(
    () => {
      const evaluator = new ExpressionEvaluator(context);
      return evaluator.evaluateCondition(condition);
    },
    [condition, context]
  );
}
