/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * useAgents — fetch the list of active AI agents from a framework
 * (`@objectstack/service-ai`) backend.
 *
 * The hook hits `GET {apiBase}/agents` (the canonical endpoint exposed by
 * `buildAgentRoutes`) and returns a normalized list. It is intentionally
 * dependency-free (uses `fetch`) so the chatbot package can stay light.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface AgentDescriptor {
  /** Stable identifier used in the chat URL (e.g. "sales_assistant"). */
  name: string;
  /** Human-readable label shown in pickers. Falls back to `name`. */
  label: string;
  /** Short description / tooltip. */
  description?: string;
  /** Agent role (assistant, planner, etc.) — informational. */
  role?: string;
  /** Whether this agent is currently active on the server. */
  active?: boolean;
}

export interface UseAgentsOptions {
  /**
   * Base URL of the AI service, e.g. "http://localhost:3000/api/v1/ai".
   * If omitted, the hook returns an empty list and no fetch is performed.
   */
  apiBase?: string;
  /** Additional headers (auth tokens, conversation IDs, etc.). */
  headers?: Record<string, string>;
  /** Disable the fetch (useful while the URL is still resolving). */
  enabled?: boolean;
  /** Static fallback list returned when the request fails or is disabled. */
  fallback?: AgentDescriptor[];
}

export interface UseAgentsReturn {
  agents: AgentDescriptor[];
  isLoading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

interface RawAgent {
  name?: string;
  label?: string;
  description?: string;
  role?: string;
  active?: boolean;
  [key: string]: unknown;
}

function normalize(raw: RawAgent[]): AgentDescriptor[] {
  return raw
    .filter((a) => typeof a?.name === 'string' && a.name.length > 0)
    .map((a) => ({
      name: a.name as string,
      label: a.label || (a.name as string),
      description: a.description,
      role: a.role,
      active: a.active !== false,
    }));
}

/**
 * Fetches the active agent catalog from the backend.
 *
 * @example
 * const { agents } = useAgents({ apiBase: '/api/v1/ai' });
 */
export function useAgents(options: UseAgentsOptions = {}): UseAgentsReturn {
  const { apiBase, headers, enabled = true, fallback = [] } = options;

  const [agents, setAgents] = useState<AgentDescriptor[]>(fallback);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  // Stash latest headers in a ref so consumers can pass inline objects without
  // triggering a refetch on every render.
  const headersRef = useRef(headers);
  headersRef.current = headers;

  useEffect(() => {
    if (!enabled || !apiBase) return;

    const controller = new AbortController();
    let cancelled = false;

    setIsLoading(true);
    setError(undefined);

    const url = `${apiBase.replace(/\/$/, '')}/agents`;
    fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...(headersRef.current ?? {}) },
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load agents (${res.status})`);
        return res.json() as Promise<{ agents?: RawAgent[] } | RawAgent[]>;
      })
      .then((payload) => {
        if (cancelled) return;
        const list = Array.isArray(payload) ? payload : payload?.agents ?? [];
        const normalized = normalize(list);
        setAgents(normalized.length > 0 ? normalized : fallback);
      })
      .catch((err: Error) => {
        if (cancelled || err.name === 'AbortError') return;
        setError(err);
        setAgents(fallback);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `fallback` is intentionally excluded — callers usually pass a fresh array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, enabled, reloadToken]);

  const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

  return { agents, isLoading, error, refetch };
}
