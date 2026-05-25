/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

import { useChatConversation } from '../useChatConversation';

const API_BASE = 'http://ai.test/api/v1/ai';
const CACHE_PREFIX = 'objectstack:ai-chat-conversation-id';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useChatConversation', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is inert when userId is undefined', async () => {
    const { result } = renderHook(() =>
      useChatConversation({ userId: undefined, apiBase: API_BASE }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBeUndefined();
    expect(result.current.initialMessages).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hydrates from a cached conversation id', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1`, 'conv-cached');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'conv-cached',
        messages: [
          { id: 'm1', role: 'user', content: 'hello' },
          { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'hi back' }] },
        ],
      }),
    );

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u1', apiBase: API_BASE }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBe('conv-cached');
    expect(result.current.initialMessages).toEqual([
      { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] },
      { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'hi back' }] },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/conversations/conv-cached`);
  });

  it('falls back to POST when cached id 404s', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1`, 'conv-missing');
    fetchMock
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ id: 'conv-new', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u1', apiBase: API_BASE }),
    );

    await waitFor(() => expect(result.current.conversationId).toBe('conv-new'));
    expect(result.current.initialMessages).toEqual([]);
    expect(localStorage.getItem(`${CACHE_PREFIX}:u1`)).toBe('conv-new');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/conversations/conv-missing`);
    const postCall = fetchMock.mock.calls[1];
    expect(postCall[0]).toBe(`${API_BASE}/conversations`);
    expect((postCall[1] as RequestInit).method).toBe('POST');
  });

  it('creates a new conversation when there is no cache', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'conv-fresh', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u2', apiBase: API_BASE }),
    );

    await waitFor(() => expect(result.current.conversationId).toBe('conv-fresh'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/conversations`);
    expect(localStorage.getItem(`${CACHE_PREFIX}:u2`)).toBe('conv-fresh');
  });

  it('uses a distinct cache key per scope', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1`, 'conv-default');
    localStorage.setItem(`${CACHE_PREFIX}:u1:agent-x`, 'conv-scoped');
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'conv-scoped', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u1', scope: 'agent-x', apiBase: API_BASE }),
    );

    await waitFor(() => expect(result.current.conversationId).toBe('conv-scoped'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/conversations/conv-scoped`);
  });

  it('reset() deletes the current conversation and creates a new one', async () => {
    localStorage.setItem(`${CACHE_PREFIX}:u1`, 'conv-old');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: 'conv-old', messages: [] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ id: 'conv-new', messages: [] }));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u1', apiBase: API_BASE }),
    );
    await waitFor(() => expect(result.current.conversationId).toBe('conv-old'));

    await act(async () => {
      await result.current.reset();
    });

    expect(result.current.conversationId).toBe('conv-new');
    expect(result.current.initialMessages).toEqual([]);
    expect(localStorage.getItem(`${CACHE_PREFIX}:u1`)).toBe('conv-new');

    const calls = fetchMock.mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[1][0]).toBe(`${API_BASE}/conversations/conv-old`);
    expect((calls[1][1] as RequestInit).method).toBe('DELETE');
    expect(calls[2][0]).toBe(`${API_BASE}/conversations`);
    expect((calls[2][1] as RequestInit).method).toBe('POST');
  });

  it('swallows fetch errors and clears loading', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() =>
      useChatConversation({ userId: 'u3', apiBase: API_BASE }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversationId).toBeUndefined();
    expect(result.current.initialMessages).toEqual([]);
  });
});
