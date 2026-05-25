/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * useHitlInChat — bridge between the streaming chat and the framework's
 * HITL (Human-In-The-Loop) approval REST endpoints.
 *
 * Background
 * ----------
 * When an LLM picks an action-tool that's marked dangerous on the framework
 * side (`enableActionApproval` + `confirmText` / `mode:'delete'` / `variant:
 * 'danger'`), the tool handler does NOT execute. Instead it persists a row
 * in `ai_pending_actions` and returns
 *   `{ status: 'pending_approval', pendingActionId: 'pa_…', message: '…' }`
 * inside the tool result (`@objectstack/service-ai/tools/action-tools.ts`).
 *
 * The chat client sees this as a regular tool-output text part. `mapMessages`
 * detects the envelope and lifts `pendingActionId` plus a synthetic
 * `state: 'approval-requested'` onto the `ChatToolInvocation`. This hook then
 * lets the operator approve or reject the proposal inline — without leaving
 * the chat for the standalone AI Approvals inbox.
 *
 * Wire-up
 * -------
 * ```tsx
 * const hitl = useHitlInChat({ messages, apiBase, headers });
 * <FloatingChatbot
 *   {...rest}
 *   messages={messages}
 *   onToolApprove={hitl.decide}
 *   toolDecisions={hitl.decisions}
 * />
 * ```
 */
import * as React from 'react';
import type { ChatMessage, ToolDecisionState } from './ChatbotEnhanced';
import type { ApproveOutcome, RejectOutcome } from './usePendingActions';

export type { ToolDecisionState };

export interface UseHitlInChatOptions {
  /**
   * Chat message list (already-mapped `ChatMessage[]` from `useObjectChat`
   * or `uiMessagesToChatMessages`). The hook scans `toolInvocations[*]`
   * looking for entries with `pendingActionId` and indexes them.
   */
  messages: ChatMessage[];
  /**
   * Framework AI base URL — for example `http://localhost:3004/api/v1/ai`.
   * Defaults to `/api/v1/ai` (same-origin) to match `usePendingActions`.
   */
  apiBase?: string;
  /** Extra headers (e.g. `X-Environment-Id`, `Authorization`). */
  headers?: Record<string, string>;
  /**
   * Optional callback fired after a decision completes (regardless of
   * success/failure). Useful for refreshing the inbox view if it is also
   * mounted on the same page.
   */
  onDecided?: (toolCallId: string, outcome: ApproveOutcome | RejectOutcome) => void;
}

export interface UseHitlInChatReturn {
  /**
   * Map keyed by toolCallId. Pass directly to `<ChatbotEnhanced
   * toolDecisions={…}>` to render inline status under each pending tool.
   */
  decisions: Record<string, ToolDecisionState>;
  /**
   * Approve / reject handler — wire to `onToolApprove`. Looks up the
   * `pendingActionId` registered by `mapMessages` for the given toolCallId
   * and calls the matching REST endpoint.
   */
  decide: (toolCallId: string, approved: boolean, reason?: string) => Promise<void>;
  /**
   * True while at least one in-flight REST call is outstanding.
   * (Useful for disabling chat input while approvals settle, if desired.)
   */
  isDeciding: boolean;
}

function normalizeBase(base?: string): string {
  if (!base || base.length === 0) return '/api/v1/ai';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function buildHeaders(
  base: Record<string, string> | undefined,
  body: boolean,
): HeadersInit {
  const headers: Record<string, string> = { ...(base ?? {}) };
  if (body) headers['Content-Type'] = 'application/json';
  return headers;
}

async function parseJson(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text } as Record<string, unknown>;
  }
}

export function useHitlInChat(options: UseHitlInChatOptions): UseHitlInChatReturn {
  const { messages, apiBase, headers, onDecided } = options;
  const base = normalizeBase(apiBase);

  // Index toolCallId → pendingActionId from the latest messages. Memoised
  // because messages stream tick-by-tick and we don't want to rebuild the
  // map on every keystroke.
  const idMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const msg of messages) {
      const tools = msg.toolInvocations ?? [];
      for (const tool of tools) {
        if (tool.pendingActionId && tool.toolCallId) {
          map.set(tool.toolCallId, tool.pendingActionId);
        }
      }
    }
    return map;
  }, [messages]);

  const [decisions, setDecisions] = React.useState<Record<string, ToolDecisionState>>({});
  const inflightRef = React.useRef(0);
  const [isDeciding, setIsDeciding] = React.useState(false);

  const setDecision = React.useCallback(
    (toolCallId: string, next: ToolDecisionState | undefined) => {
      setDecisions((prev) => {
        if (!next) {
          if (!(toolCallId in prev)) return prev;
          const { [toolCallId]: _omit, ...rest } = prev;
          return rest;
        }
        return { ...prev, [toolCallId]: next };
      });
    },
    [],
  );

  const decide = React.useCallback(
    async (toolCallId: string, approved: boolean, reason?: string) => {
      const id = idMap.get(toolCallId);
      if (!id) {
        setDecision(toolCallId, {
          state: 'error',
          message:
            'No pending-action id found for this tool call. The tool result may not be a HITL proposal.',
        });
        return;
      }
      setDecision(toolCallId, {
        state: 'pending',
        message: approved ? 'Approving…' : 'Rejecting…',
      });
      inflightRef.current += 1;
      setIsDeciding(true);
      try {
        const url = `${base}/pending-actions/${encodeURIComponent(id)}/${
          approved ? 'approve' : 'reject'
        }`;
        const body = approved ? '{}' : JSON.stringify({ reason: reason ?? '' });
        const response = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: buildHeaders(headers, true),
          body,
        });
        const payload = (await parseJson(response)) ?? {};
        if (!response.ok) {
          const message =
            typeof payload.error === 'string'
              ? payload.error
              : `Approval failed: HTTP ${response.status}`;
          setDecision(toolCallId, { state: 'error', message });
          onDecided?.(toolCallId, {
            id,
            status: 'failed',
            error: message,
          } as ApproveOutcome);
          return;
        }
        const status = (payload.status as string) ?? (approved ? 'executed' : 'rejected');
        if (status === 'executed') {
          setDecision(toolCallId, {
            state: 'success',
            message: 'Approved — action executed.',
          });
        } else if (status === 'rejected') {
          setDecision(toolCallId, {
            state: 'success',
            message: reason ? `Rejected: ${reason}` : 'Rejected.',
          });
        } else if (status === 'failed') {
          const errMsg = (payload.error as string) ?? 'Action approved but execution failed.';
          setDecision(toolCallId, { state: 'error', message: errMsg });
        } else {
          setDecision(toolCallId, { state: 'success', message: `Status: ${status}` });
        }
        onDecided?.(toolCallId, payload as ApproveOutcome | RejectOutcome);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setDecision(toolCallId, { state: 'error', message });
      } finally {
        inflightRef.current -= 1;
        if (inflightRef.current <= 0) {
          inflightRef.current = 0;
          setIsDeciding(false);
        }
      }
    },
    [base, headers, idMap, onDecided, setDecision],
  );

  return { decisions, decide, isDeciding };
}
