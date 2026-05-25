// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Server-backed AI chat conversation lifecycle.
 *
 * Binds a chat UI to an `ai_conversations` row owned by the signed-in user.
 * On mount it tries the cached id (per user, optionally per scope); falls
 * back to creating a fresh conversation when the cached one is gone
 * (404/403).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Minimal UIMessage shape compatible with `@ai-sdk/react`'s `useChat`. */
export interface HydratedUIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: Array<{ type: 'text'; text: string }>;
}

export interface UseChatConversationOptions {
  /** Authenticated user id; hook is inert until this is defined. */
  userId: string | undefined;
  /**
   * Optional scope (e.g. agent name) for keying separate conversations under
   * the same user.
   */
  scope?: string;
  /**
   * Base URL of the AI service (no trailing slash). Hook calls
   * `${apiBase}/conversations[/...]`. Required.
   */
  apiBase: string;
}

export interface UseChatConversationReturn {
  conversationId: string | undefined;
  initialMessages: HydratedUIMessage[];
  isLoading: boolean;
  /** Delete the current conversation + start a fresh one. */
  reset: () => Promise<void>;
}

const CACHE_PREFIX = 'objectstack:ai-chat-conversation-id';

function cacheKey(userId: string, scope?: string): string {
  return scope ? `${CACHE_PREFIX}:${userId}:${scope}` : `${CACHE_PREFIX}:${userId}`;
}

function readCache(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, value: string | undefined): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* ignore — private mode, quota, etc. */
  }
}

interface ServerMessage {
  id?: string;
  role: string;
  content: unknown;
}

interface ServerConversation {
  id: string;
  messages?: ServerMessage[];
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (
          part &&
          typeof part === 'object' &&
          'text' in part &&
          typeof (part as { text?: unknown }).text === 'string'
        ) {
          return (part as { text: string }).text;
        }
        return '';
      })
      .join('');
  }
  return '';
}

function toUIMessages(rows: ServerMessage[] | undefined): HydratedUIMessage[] {
  if (!rows) return [];
  const out: HydratedUIMessage[] = [];
  rows.forEach((row, idx) => {
    const role = row.role as HydratedUIMessage['role'];
    if (role !== 'user' && role !== 'assistant' && role !== 'system') return;
    const text = contentToText(row.content);
    if (!text) return;
    out.push({
      id: row.id ?? `msg-${idx}`,
      role,
      parts: [{ type: 'text', text }],
    });
  });
  return out;
}

async function fetchConversation(apiBase: string, id: string): Promise<ServerConversation | null> {
  const res = await fetch(`${apiBase}/conversations/${encodeURIComponent(id)}`, {
    credentials: 'include',
  });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`GET conversation failed: ${res.status}`);
  return (await res.json()) as ServerConversation;
}

async function createConversation(apiBase: string): Promise<ServerConversation> {
  const res = await fetch(`${apiBase}/conversations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`POST conversation failed: ${res.status}`);
  return (await res.json()) as ServerConversation;
}

async function deleteConversation(apiBase: string, id: string): Promise<void> {
  await fetch(`${apiBase}/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  }).catch(() => {
    /* best-effort */
  });
}

export function useChatConversation(
  options: UseChatConversationOptions,
): UseChatConversationReturn {
  const { userId, scope, apiBase } = options;
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [initialMessages, setInitialMessages] = useState<HydratedUIMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(userId));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setConversationId(undefined);
      setInitialMessages([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    const key = cacheKey(userId, scope);
    setIsLoading(true);

    (async () => {
      try {
        const cached = readCache(key);
        if (cached) {
          const existing = await fetchConversation(apiBase, cached);
          if (cancelled) return;
          if (existing) {
            setConversationId(existing.id);
            setInitialMessages(toUIMessages(existing.messages));
            return;
          }
          writeCache(key, undefined);
        }
        const fresh = await createConversation(apiBase);
        if (cancelled) return;
        writeCache(key, fresh.id);
        setConversationId(fresh.id);
        setInitialMessages(toUIMessages(fresh.messages));
      } catch {
        if (!cancelled) {
          setConversationId(undefined);
          setInitialMessages([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, scope, apiBase]);

  const reset = useCallback(async () => {
    if (!userId) return;
    const key = cacheKey(userId, scope);
    setIsLoading(true);
    try {
      if (conversationId) await deleteConversation(apiBase, conversationId);
      writeCache(key, undefined);
      const fresh = await createConversation(apiBase);
      writeCache(key, fresh.id);
      if (!mountedRef.current) return;
      setConversationId(fresh.id);
      setInitialMessages([]);
    } catch {
      if (mountedRef.current) {
        setConversationId(undefined);
        setInitialMessages([]);
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [conversationId, userId, scope, apiBase]);

  return { conversationId, initialMessages, isLoading, reset };
}
