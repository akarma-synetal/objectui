/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Unit tests for the UIMessage → ChatMessage mappers. These are the
 * single source of truth used by both `useObjectChat` and apps that drive
 * `@ai-sdk/react`'s `useChat()` directly (e.g. Studio's chat panel).
 */
import { describe, it, expect } from 'vitest';
import { uiMessageToChatMessage, uiMessagesToChatMessages } from '../mapMessages';

describe('uiMessageToChatMessage', () => {
  it('concatenates text parts and falls back to streaming=false by default', () => {
    const out = uiMessageToChatMessage({
      id: 'm1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: ' world' },
      ],
    });
    expect(out).toMatchObject({
      id: 'm1',
      role: 'assistant',
      content: 'Hello world',
    });
    expect(out.streaming).toBeUndefined();
  });

  it('extracts reasoning parts into the `reasoning` field', () => {
    const out = uiMessageToChatMessage({
      id: 'm2',
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: 'Thinking step 1.' },
        { type: 'text', text: 'Answer.' },
      ],
    });
    expect(out.content).toBe('Answer.');
    expect(out.reasoning).toContain('Thinking step 1.');
  });

  it('extracts tool-* parts into ChatToolInvocation entries', () => {
    const out = uiMessageToChatMessage({
      id: 'm3',
      role: 'assistant',
      parts: [
        {
          type: 'tool-listUsers',
          toolCallId: 'call_1',
          state: 'output-available',
          input: { limit: 5 },
          output: { users: [] },
        },
      ],
    });
    expect(out.toolInvocations).toHaveLength(1);
    expect(out.toolInvocations?.[0]).toMatchObject({
      toolCallId: 'call_1',
      toolName: 'listUsers',
      state: 'output-available',
    });
  });

  it('preserves legacy msg.toolInvocations when no tool-* parts are present', () => {
    const out = uiMessageToChatMessage({
      id: 'm4',
      role: 'assistant',
      parts: [{ type: 'text', text: 'done' }],
      toolInvocations: [
        { toolCallId: 'legacy', toolName: 'foo', state: 'result', result: {} },
      ],
    });
    expect(out.toolInvocations).toHaveLength(1);
    expect(out.toolInvocations?.[0]).toMatchObject({ toolCallId: 'legacy' });
  });

  it('honours opts.streaming', () => {
    const out = uiMessageToChatMessage(
      { id: 'm5', role: 'assistant', parts: [{ type: 'text', text: 'hi' }] },
      { streaming: true },
    );
    expect(out.streaming).toBe(true);
  });
});

describe('uiMessagesToChatMessages', () => {
  it('returns [] for empty / non-array input', () => {
    expect(uiMessagesToChatMessages([])).toEqual([]);
    expect(uiMessagesToChatMessages(undefined as never)).toEqual([]);
  });

  it('only flags the trailing assistant message as streaming when isStreaming=true', () => {
    const out = uiMessagesToChatMessages(
      [
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
        { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'hello' }] },
        { id: 'a2', role: 'assistant', parts: [{ type: 'text', text: 'how can I help' }] },
      ],
      { isStreaming: true },
    );
    expect(out.map((m) => Boolean(m.streaming))).toEqual([false, false, true]);
  });

  it('does not flag streaming when the last message is a user turn', () => {
    const out = uiMessagesToChatMessages(
      [
        { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'hello' }] },
        { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'a follow-up' }] },
      ],
      { isStreaming: true },
    );
    expect(out.map((m) => Boolean(m.streaming))).toEqual([false, false]);
  });

  it('omits streaming flag entirely when isStreaming is false', () => {
    const out = uiMessagesToChatMessages(
      [{ id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'done' }] }],
      { isStreaming: false },
    );
    expect(out[0]?.streaming).toBeFalsy();
  });
});
