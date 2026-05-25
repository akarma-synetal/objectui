/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * usePendingActions — REST helper hook for the framework's HITL (Human-In-
 * The-Loop) approval queue, exposed by `@objectstack/service-ai` at
 * `/api/v1/ai/pending-actions/*`.
 *
 * Designed to be shared between the Console workspace inbox and the Studio
 * builder's AI traces panel. Pure React + fetch — no extra deps so it
 * stays inside `plugin-chatbot`'s tiny bundle.
 *
 * The hook polls the list endpoint (default 5 s) and exposes
 * `approve`/`reject` mutators that re-fetch on completion so consumers
 * don't need to micromanage state.
 *
 * @module
 */

import * as React from 'react';

export type PendingActionStatus =
  | 'pending'
  | 'approved'
  | 'executed'
  | 'failed'
  | 'rejected';

/**
 * Wire-format row returned by
 * `GET /api/v1/ai/pending-actions` and friends. Mirrors the
 * `ai_pending_action` object schema declared in
 * `@objectstack/service-ai`.
 */
export interface PendingActionRow {
  id: string;
  conversation_id?: string | null;
  message_id?: string | null;
  object_name: string;
  action_name: string;
  tool_name: string;
  /** JSON-encoded string. Consumers typically `JSON.parse` to render. */
  tool_input: string;
  status: PendingActionStatus | string;
  result?: string | null;
  error?: string | null;
  rejection_reason?: string | null;
  proposed_by?: string | null;
  decided_by?: string | null;
  proposed_at?: string;
  decided_at?: string | null;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

/**
 * Successful approval outcome returned by
 * `POST /api/v1/ai/pending-actions/:id/approve`.
 *
 * The HTTP status is 200 when `status === 'executed'` and 500 when the
 * downstream dispatcher failed (`status === 'failed'`). The hook surfaces
 * both as a normal resolved value so the UI can show the error inline
 * without throwing.
 */
export interface ApproveOutcome {
  id: string;
  status: 'executed' | 'failed' | string;
  result?: unknown;
  error?: string;
  [k: string]: unknown;
}

export interface RejectOutcome {
  id: string;
  status: 'rejected' | string;
}

export interface UsePendingActionsOptions {
  /**
   * Base URL of the AI service, e.g. `http://localhost:3000/api/v1/ai`.
   * Falls back to `/api/v1/ai` (same-origin) when unset.
   */
  apiBase?: string;
  /**
   * Status filter forwarded as `?status=` to the list endpoint. Set to
   * `'all'` (or undefined) to fetch every row.
   */
  status?: PendingActionStatus | 'all';
  /**
   * Conversation filter forwarded as `?conversationId=`. Useful for
   * scoping the inbox to a specific chat thread.
   */
  conversationId?: string;
  /** Hard limit forwarded as `?limit=`. */
  limit?: number;
  /**
   * Extra headers merged into every request (e.g. `X-Environment-Id`,
   * `Authorization`). Cookies are always sent via `credentials: 'include'`.
   */
  headers?: Record<string, string>;
  /**
   * Polling interval in ms. `0` disables polling (caller must invoke
   * `refresh()` manually). Default: 5000.
   */
  pollInterval?: number;
  /** Disable the hook entirely (skips initial fetch + polling). */
  enabled?: boolean;
}

export interface UsePendingActionsReturn {
  items: PendingActionRow[];
  total: number;
  isLoading: boolean;
  error: Error | undefined;
  /** Re-fetch the list. Awaitable. */
  refresh: () => Promise<void>;
  /**
   * Approve a row. Resolves with the dispatcher outcome (success or
   * failed). Re-fetches the list on completion. Throws on transport,
   * 404, or 409 errors.
   */
  approve: (id: string) => Promise<ApproveOutcome>;
  /**
   * Reject a row with an optional reason. Re-fetches the list on
   * completion. Throws on transport, 404, or 409 errors.
   */
  reject: (id: string, reason?: string) => Promise<RejectOutcome>;
}

const DEFAULT_BASE = '/api/v1/ai';

function buildUrl(base: string, path: string, params?: Record<string, string | number | undefined>): string {
  const root = base.replace(/\/$/, '');
  const qs = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v == null || v === '') continue;
      qs.set(k, String(v));
    }
  }
  const tail = qs.toString();
  return `${root}${path}${tail ? `?${tail}` : ''}`;
}

async function call<T>(
  url: string,
  init: RequestInit,
  extraHeaders: Record<string, string> | undefined,
): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(extraHeaders ?? {}),
      ...(init.headers ?? {}),
    },
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const msg =
      body?.error?.message ??
      body?.message ??
      body?.error ??
      `${res.status} ${res.statusText}`;
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body as T;
}

/**
 * Hook that drives the HITL pending-actions inbox.
 *
 * @example
 * ```tsx
 * const { items, isLoading, error, approve, reject, refresh } =
 *   usePendingActions({
 *     apiBase: 'http://localhost:3004/api/v1/ai',
 *     status: 'pending',
 *     headers: { 'X-Environment-Id': 'env_local' },
 *   });
 * ```
 */
export function usePendingActions(
  options: UsePendingActionsOptions = {},
): UsePendingActionsReturn {
  const {
    apiBase = DEFAULT_BASE,
    status = 'pending',
    conversationId,
    limit,
    headers,
    pollInterval = 5000,
    enabled = true,
  } = options;

  const [items, setItems] = React.useState<PendingActionRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | undefined>(undefined);

  // Stash mutable bits in a ref so the polling effect doesn't re-arm on
  // every header object identity change.
  const cfgRef = React.useRef({ apiBase, status, conversationId, limit, headers });
  cfgRef.current = { apiBase, status, conversationId, limit, headers };

  const refresh = React.useCallback(async () => {
    const { apiBase, status, conversationId, limit, headers } = cfgRef.current;
    setIsLoading(true);
    setError(undefined);
    try {
      const url = buildUrl(apiBase, '/pending-actions', {
        status: status && status !== 'all' ? status : undefined,
        conversationId,
        limit,
      });
      const out = await call<{ items: PendingActionRow[]; total?: number }>(
        url,
        { method: 'GET' },
        headers,
      );
      setItems(Array.isArray(out.items) ? out.items : []);
      setTotal(typeof out.total === 'number' ? out.total : (out.items?.length ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const approve = React.useCallback(async (id: string): Promise<ApproveOutcome> => {
    const { apiBase, headers } = cfgRef.current;
    const url = buildUrl(apiBase, `/pending-actions/${encodeURIComponent(id)}/approve`);
    try {
      const out = await call<ApproveOutcome>(url, { method: 'POST', body: '{}' }, headers);
      return out;
    } finally {
      void refresh();
    }
  }, [refresh]);

  const reject = React.useCallback(async (id: string, reason?: string): Promise<RejectOutcome> => {
    const { apiBase, headers } = cfgRef.current;
    const url = buildUrl(apiBase, `/pending-actions/${encodeURIComponent(id)}/reject`);
    try {
      const out = await call<RejectOutcome>(
        url,
        { method: 'POST', body: JSON.stringify(reason ? { reason } : {}) },
        headers,
      );
      return out;
    } finally {
      void refresh();
    }
  }, [refresh]);

  // Initial fetch + polling.
  React.useEffect(() => {
    if (!enabled) return;
    void refresh();
    if (!pollInterval || pollInterval <= 0) return;
    const id = setInterval(() => { void refresh(); }, pollInterval);
    return () => clearInterval(id);
  }, [enabled, pollInterval, refresh, apiBase, status, conversationId, limit]);

  return { items, total, isLoading, error, refresh, approve, reject };
}
