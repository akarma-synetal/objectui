import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useHitlInChat } from '../useHitlInChat';
import type { ChatMessage } from '../ChatbotEnhanced';

const baseMessage = (pendingActionId: string, toolCallId = 'tc-1'): ChatMessage => ({
  id: 'm-1',
  role: 'assistant',
  content: '',
  toolInvocations: [
    {
      toolCallId,
      toolName: 'action_delete_task',
      state: 'approval-requested',
      args: { id: 't1' },
      result: { status: 'pending_approval', pendingActionId },
      pendingActionId,
    },
  ],
});

describe('useHitlInChat', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fires continueConversation with an executed-outcome prompt on approve', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        id: 'pa_42',
        status: 'executed',
        result: { deleted: 1, taskId: 't1' },
      }),
    } as Response);

    const continueConversation = vi.fn();
    const { result } = renderHook(() =>
      useHitlInChat({
        messages: [baseMessage('pa_42')],
        apiBase: 'http://localhost:3004/api/v1/ai',
        continueConversation,
      }),
    );

    await act(async () => {
      await result.current.decide('tc-1', true);
    });

    await waitFor(() => expect(continueConversation).toHaveBeenCalledTimes(1));
    const [prompt, ctx] = continueConversation.mock.calls[0];
    expect(prompt).toContain('[HITL pa_42]');
    expect(prompt).toContain('action_delete_task');
    expect(prompt).toContain('approved');
    expect(prompt).toContain('"deleted":1');
    expect(ctx).toMatchObject({
      toolCallId: 'tc-1',
      pendingActionId: 'pa_42',
      decision: 'approved',
      toolName: 'action_delete_task',
    });
  });

  it('fires continueConversation with a rejection prompt that includes the reason', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ id: 'pa_42', status: 'rejected' }),
    } as Response);

    const continueConversation = vi.fn();
    const { result } = renderHook(() =>
      useHitlInChat({
        messages: [baseMessage('pa_42')],
        apiBase: '/api/v1/ai',
        continueConversation,
      }),
    );

    await act(async () => {
      await result.current.decide('tc-1', false, 'too risky');
    });

    await waitFor(() => expect(continueConversation).toHaveBeenCalledTimes(1));
    const [prompt] = continueConversation.mock.calls[0];
    expect(prompt).toContain('rejected');
    expect(prompt).toContain('too risky');
  });

  it('does NOT continue when execution failed', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ id: 'pa_42', status: 'failed', error: 'boom' }),
    } as Response);

    const continueConversation = vi.fn();
    const { result } = renderHook(() =>
      useHitlInChat({
        messages: [baseMessage('pa_42')],
        continueConversation,
      }),
    );

    await act(async () => {
      await result.current.decide('tc-1', true);
    });

    expect(continueConversation).not.toHaveBeenCalled();
    expect(result.current.decisions['tc-1']?.state).toBe('error');
    expect(result.current.decisions['tc-1']?.message).toContain('boom');
  });

  it('does NOT continue when option is omitted', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ id: 'pa_42', status: 'executed', result: 'ok' }),
    } as Response);

    const { result } = renderHook(() =>
      useHitlInChat({
        messages: [baseMessage('pa_42')],
      }),
    );

    await act(async () => {
      await result.current.decide('tc-1', true);
    });

    expect(result.current.decisions['tc-1']?.state).toBe('success');
  });
});
