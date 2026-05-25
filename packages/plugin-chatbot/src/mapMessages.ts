/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Utilities for mapping Vercel AI SDK v6 `UIMessage` shapes (the `parts`
 * model — `[ { type: 'text' | 'reasoning' | 'tool-*' | 'dynamic-tool' |
 * 'source-url' | … } ]`) into the simpler `ChatMessage` shape consumed by
 * `<ChatbotEnhanced>`.
 *
 * Shared between `useObjectChat` (which composes `useChat` internally) and
 * apps that drive `useChat` themselves (e.g. Studio, which needs a custom
 * `prepareSendMessagesRequest` transport).
 */
import type { ChatMessage, ChatToolInvocation, ChatSource } from './ChatbotEnhanced';

interface AnyPart {
  type?: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  id?: string;
  input?: unknown;
  output?: unknown;
  args?: unknown;
  result?: unknown;
  errorText?: string;
  state?: ChatToolInvocation['state'];
  url?: string;
  href?: string;
  title?: string;
}

interface AnyUIMessage {
  id?: string;
  role?: 'user' | 'assistant' | 'system';
  parts?: AnyPart[];
  content?: unknown;
  toolInvocations?: ChatToolInvocation[];
  metadata?: unknown;
}

function extractText(msg: AnyUIMessage, parts: AnyPart[]): string {
  if (typeof msg.content === 'string') return msg.content;
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('');
}

function extractReasoning(parts: AnyPart[]): string | undefined {
  const joined = parts
    .filter((p) => p.type === 'reasoning' || p.type === 'reasoning-delta')
    .map((p) => p.text ?? '')
    .join('\n')
    .trim();
  return joined.length > 0 ? joined : undefined;
}

function extractToolInvocations(parts: AnyPart[]): ChatToolInvocation[] {
  return parts
    .filter((p) => {
      if (p.type === 'dynamic-tool') return true;
      return typeof p.type === 'string' && p.type.startsWith('tool-');
    })
    .map((p) => {
      const toolName =
        p.type === 'dynamic-tool'
          ? (p.toolName ?? 'tool')
          : typeof p.type === 'string'
            ? p.type.replace(/^tool-/, '')
            : 'tool';
      return {
        toolCallId:
          p.toolCallId ?? p.id ?? `${p.type ?? 'tool'}-${Math.random().toString(36).slice(2, 8)}`,
        toolName,
        args: p.input ?? p.args,
        result: p.output ?? p.result,
        errorText: p.errorText,
        state: p.state,
      } satisfies ChatToolInvocation;
    });
}

function extractSources(parts: AnyPart[]): ChatSource[] | undefined {
  const sources = parts
    .filter((p) => p.type === 'source-url' || p.type === 'source')
    .map<ChatSource>((p) => ({
      id: p.id,
      title: p.title,
      url: (p.url ?? p.href) as string,
    }))
    .filter((s) => Boolean(s.url));
  return sources.length > 0 ? sources : undefined;
}

/**
 * Map a single Vercel AI SDK v6 `UIMessage` to the `ChatMessage` shape that
 * `<ChatbotEnhanced>` renders.
 *
 * @param msg - AI SDK `UIMessage` (or compatible shape with `parts`).
 * @param opts - Optional flags. `streaming` flags the latest assistant
 *   message during an in-flight stream so the cursor pulse renders.
 */
export function uiMessageToChatMessage(
  msg: AnyUIMessage,
  opts: { streaming?: boolean } = {},
): ChatMessage {
  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  const tools = extractToolInvocations(parts);
  const legacyTools = Array.isArray(msg.toolInvocations) ? msg.toolInvocations : [];
  return {
    id: (msg.id ?? `msg-${Math.random().toString(36).slice(2, 8)}`) as string,
    role: (msg.role ?? 'assistant') as ChatMessage['role'],
    content: extractText(msg, parts),
    reasoning: extractReasoning(parts),
    toolInvocations: tools.length > 0 ? tools : legacyTools,
    sources: extractSources(parts),
    streaming: opts.streaming,
  };
}

/**
 * Map an array of `UIMessage`s. The trailing assistant message gets the
 * `streaming` flag when `isStreaming` is true (mirrors `useObjectChat`).
 */
export function uiMessagesToChatMessages(
  messages: AnyUIMessage[],
  opts: { isStreaming?: boolean } = {},
): ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const lastIdx = messages.length - 1;
  return messages.map((m, idx) =>
    uiMessageToChatMessage(m, {
      streaming:
        Boolean(opts.isStreaming) && idx === lastIdx && m.role === 'assistant',
    }),
  );
}
