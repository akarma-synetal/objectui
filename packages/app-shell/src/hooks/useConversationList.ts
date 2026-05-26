// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Loads the signed-in user's AI conversation history.
 *
 * Backed by `GET /api/v1/ai/conversations` exposed by
 * `@objectstack/service-ai`. The endpoint already filters by
 * `req.user.userId` server-side so we just forward credentials.
 */

import { useCallback, useEffect, useState } from 'react';

export interface ConversationSummary {
  id: string;
  title?: string;
  agentId?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Preview text derived from the most recent message, if available. */
  preview?: string;
}

export interface UseConversationListOptions {
  userId: string | undefined;
  apiBase: string;
  limit?: number;
  /** Bump to force a refetch (e.g. after creating/deleting a conversation). */
  refreshKey?: number | string;
}

export interface UseConversationListReturn {
  conversations: ConversationSummary[];
  isLoading: boolean;
  error: Error | undefined;
  refetch: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

interface ServerConversation {
  id: string;
  title?: string;
  agentId?: string;
  createdAt?: string;
  updatedAt?: string;
  messages?: Array<{ role: string; content: unknown }>;
}

function extractPreview(messages: ServerConversation['messages']): string | undefined {
  if (!messages || messages.length === 0) return undefined;
  // Prefer the most recent user message, fall back to last message.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'user') {
      const text = stringifyContent(m.content);
      if (text) return text;
    }
  }
  const last = messages[messages.length - 1];
  return stringifyContent(last?.content);
}

function stringifyContent(content: unknown): string | undefined {
  if (typeof content === 'string') return content.slice(0, 140);
  if (Array.isArray(content)) {
    const text = content
      .map((p) => {
        if (typeof p === 'string') return p;
        if (p && typeof p === 'object' && 'text' in p && typeof (p as { text?: unknown }).text === 'string') {
          return (p as { text: string }).text;
        }
        return '';
      })
      .join('');
    return text ? text.slice(0, 140) : undefined;
  }
  return undefined;
}

function normalize(row: ServerConversation): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    agentId: row.agentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    preview: extractPreview(row.messages),
  };
}

export function useConversationList(
  options: UseConversationListOptions,
): UseConversationListReturn {
  const { userId, apiBase, limit = 50, refreshKey } = options;
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(userId));
  const [error, setError] = useState<Error | undefined>(undefined);
  const [internalKey, setInternalKey] = useState(0);

  const refetch = useCallback(async () => {
    setInternalKey((k) => k + 1);
  }, []);

  const remove = useCallback(
    async (id: string) => {
      try {
        await fetch(`${apiBase}/conversations/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      } finally {
        setConversations((rows) => rows.filter((r) => r.id !== id));
      }
    },
    [apiBase],
  );

  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setIsLoading(false);
      setError(undefined);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(undefined);
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/conversations?limit=${encodeURIComponent(String(limit))}`,
          { credentials: 'include' },
        );
        if (!res.ok) throw new Error(`GET conversations failed: ${res.status}`);
        const body = (await res.json()) as
          | ServerConversation[]
          | { conversations?: ServerConversation[]; items?: ServerConversation[] };
        const rows: ServerConversation[] = Array.isArray(body)
          ? body
          : (body.conversations ?? body.items ?? []);
        if (cancelled) return;
        const sorted = rows
          .map(normalize)
          .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
        setConversations(sorted);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setConversations([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, apiBase, limit, internalKey, refreshKey]);

  return { conversations, isLoading, error, refetch, remove };
}
