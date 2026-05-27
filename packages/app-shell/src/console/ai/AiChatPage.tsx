// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AiChatPage — full-page ChatGPT-style AI surface.
 *
 * Mounted at `/ai` (new chat) and `/ai/:conversationId` (resume an existing
 * conversation). Left rail lists the signed-in user's `ai_conversations`;
 * right pane embeds `ChatbotEnhanced` wired to
 * `POST /api/v1/ai/agents/:name/chat`.
 *
 * Auto-persist is handled server-side in `@objectstack/service-ai`: as long
 * as the request body carries `conversationId`, the user + assistant + tool
 * turns are appended to `ai_messages` automatically.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@object-ui/auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@object-ui/components';
import {
  ChatbotEnhanced,
  useAgents,
  useObjectChat,
  useHitlInChat,
  type AgentDescriptor,
  type ChatMessage,
} from '@object-ui/plugin-chatbot';

import { AppHeader } from '../../layout/AppHeader';
import { useNavigationContext } from '../../context/NavigationContext';
import { useChatConversation, type HydratedUIMessage } from '../../hooks/useChatConversation';
import { ConversationsSidebar } from './ConversationsSidebar';

const DEFAULT_AI_PATH = '/api/v1/ai';

function resolveApiBase(explicit?: string): string {
  if (explicit) return explicit.replace(/\/$/, '');
  const env = (import.meta as any).env ?? {};
  const fromEnv = env.VITE_AI_BASE_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const serverUrl = (env.VITE_SERVER_URL as string | undefined) ?? '';
  return `${serverUrl.replace(/\/$/, '')}${DEFAULT_AI_PATH}`;
}

export interface AiChatPageProps {
  /** Override the resolved AI service base URL. */
  apiBase?: string;
  /** Default agent to select on first render. */
  defaultAgent?: string;
}

export function AiChatPage({ apiBase: apiBaseProp, defaultAgent: defaultAgentProp }: AiChatPageProps = {}) {
  const { user } = useAuth();
  const userId = user?.id;
  const { conversationId: urlConversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { setContext } = useNavigationContext();

  useEffect(() => {
    setContext('home');
  }, [setContext]);

  const apiBase = useMemo(() => resolveApiBase(apiBaseProp), [apiBaseProp]);
  const env = (import.meta as any).env ?? {};
  const envDefaultAgent = env.VITE_AI_DEFAULT_AGENT as string | undefined;

  const { agents, isLoading: agentsLoading, error: agentsError } = useAgents({ apiBase });

  const [activeAgent, setActiveAgent] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!activeAgent && agents.length > 0) {
      const preferred = defaultAgentProp ?? envDefaultAgent;
      const match = preferred ? agents.find((a) => a.name === preferred) : undefined;
      setActiveAgent((match ?? agents[0]).name);
    }
  }, [agents, activeAgent, defaultAgentProp, envDefaultAgent]);

  const chatApi = activeAgent
    ? `${apiBase}/agents/${encodeURIComponent(activeAgent)}/chat`
    : undefined;

  const { conversationId, initialMessages, isLoading: convoLoading } = useChatConversation({
    userId,
    scope: activeAgent,
    apiBase,
    activeId: urlConversationId,
  });

  const [refreshKey, setRefreshKey] = useState(0);

  // After the hook resolves a real id for a fresh `/ai` visit, mirror it into
  // the URL so the sidebar's active-row + share/refresh both work.
  useEffect(() => {
    if (!urlConversationId && conversationId) {
      navigate(`/ai/${conversationId}`, { replace: true });
    }
  }, [urlConversationId, conversationId, navigate]);

  const titledRef = useRef<Set<string>>(new Set());

  // A resumed conversation already has history; treat it as already-titled
  // so we don't clobber the original title on the next user turn.
  useEffect(() => {
    if (conversationId && initialMessages.length > 0) {
      titledRef.current.add(conversationId);
    }
  }, [conversationId, initialMessages.length]);

  const handleSent = useCallback(
    (firstUserMessage?: string) => {
      // New user turn → bump sidebar list so the row's preview/timestamp refreshes.
      setRefreshKey((k) => k + 1);

      // Auto-title the conversation from the first user message. Server only
      // tracks `title` when we PATCH it; without this every row shows the same
      // "New conversation" placeholder. We mark `conversationId` as titled in a
      // ref so subsequent turns don't re-rename and clobber a manual rename.
      if (!firstUserMessage || !conversationId) return;
      if (titledRef.current.has(conversationId)) return;
      titledRef.current.add(conversationId);
      const text = firstUserMessage.trim();
      if (!text) return;
      const truncated = text.length > 40 ? `${text.slice(0, 40)}…` : text;
      fetch(`${apiBase}/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: truncated }),
      })
        .then(() => setRefreshKey((k) => k + 1))
        .catch(() => {
          // Leave it untitled; user can rename manually.
          titledRef.current.delete(conversationId);
        });
    },
    [apiBase, conversationId],
  );

  return (
    <div className="flex h-svh w-full flex-col bg-background" data-testid="ai-chat-page">
      <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center gap-2 border-b bg-background px-2 sm:px-4">
        <AppHeader variant="home" />
      </header>
      <div className="flex flex-1 min-h-0 w-full">
        <ConversationsSidebar
          userId={userId}
          apiBase={apiBase}
          refreshKey={refreshKey}
          className="hidden w-72 shrink-0 border-r md:flex"
        />
        <main className="flex flex-1 min-w-0 flex-col">
          <ChatPane
            key={`${chatApi ?? 'local'}:${conversationId ?? 'pending'}`}
            agents={agents}
            agentsLoading={agentsLoading}
            agentsError={agentsError}
            activeAgent={activeAgent}
            onAgentChange={setActiveAgent}
            chatApi={chatApi}
            apiBase={apiBase}
            conversationId={conversationId}
            initialMessages={initialMessages}
            hydrating={convoLoading}
            onSent={handleSent}
          />
        </main>
      </div>
    </div>
  );
}

interface ChatPaneProps {
  agents: AgentDescriptor[];
  agentsLoading: boolean;
  agentsError: Error | undefined;
  activeAgent: string | undefined;
  onAgentChange: (name: string) => void;
  chatApi: string | undefined;
  apiBase: string;
  conversationId: string | undefined;
  initialMessages: HydratedUIMessage[];
  hydrating: boolean;
  onSent: (firstUserMessage?: string) => void;
}

function ChatPane({
  agents,
  agentsLoading,
  agentsError,
  activeAgent,
  onAgentChange,
  chatApi,
  apiBase,
  conversationId,
  initialMessages,
  hydrating,
  onSent,
}: ChatPaneProps) {
  const activeAgentLabel = useMemo<string>(() => {
    const found = agents.find((a) => a.name === activeAgent);
    return found?.label ?? activeAgent ?? 'Assistant';
  }, [agents, activeAgent]);

  const hydrated = useMemo<ChatMessage[]>(() => {
    return initialMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.parts.map((p) => p.text).join(''),
    }));
  }, [initialMessages]);

  const suggestions = useMemo<string[] | undefined>(() => {
    if (hydrated.length > 0) return undefined;
    return buildAgentSuggestions(activeAgent, activeAgentLabel);
  }, [hydrated.length, activeAgent, activeAgentLabel]);

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    stop,
    reload,
    clear,
  } = useObjectChat({
    api: chatApi,
    conversationId,
    body: {
      context: {
        activeApp: 'AI',
        agentName: activeAgent,
      },
    },
    initialMessages: hydrated,
    autoResponse: !chatApi,
    autoResponseText: "Thanks for your message! I'm here to help.",
    autoResponseDelay: 600,
  });

  const hitl = useHitlInChat({
    messages: messages as ChatMessage[],
    apiBase,
    continueConversation: (prompt) => {
      sendMessage(prompt);
    },
  });

  const handleSend = useCallback(
    (content: string, files?: File[]) => {
      sendMessage(content, files);
      onSent(content);
    },
    [sendMessage, onSent],
  );

  const headerSlot =
    agents.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <span className="text-xs text-muted-foreground">Agent:</span>
        <Select value={activeAgent} onValueChange={onAgentChange} disabled={agentsLoading}>
          <SelectTrigger className="h-7 w-[220px] text-xs" data-testid="ai-chat-agent-picker">
            <SelectValue placeholder="Choose agent..." />
          </SelectTrigger>
          <SelectContent align="start">
            {agents.map((agent) => (
              <SelectItem key={agent.name} value={agent.name} className="text-xs">
                <span className="font-medium">{agent.label}</span>
                {agent.description ? (
                  <span className="block text-muted-foreground text-[10px] truncate max-w-[260px]">
                    {agent.description}
                  </span>
                ) : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hydrating ? (
          <span className="text-[10px] text-muted-foreground">Loading history…</span>
        ) : null}
        {agentsError ? (
          <span
            className="text-[10px] text-amber-700 dark:text-amber-400"
            title={agentsError.message}
          >
            ⚠ Offline demo mode — agent list unavailable
          </span>
        ) : null}
      </div>
    ) : null;

  return (
    <ChatbotEnhanced
      className="flex-1 min-h-0 rounded-none border-0"
      maxHeight="100%"
      headerSlot={headerSlot}
      messages={messages as ChatMessage[]}
      placeholder={
        activeAgent
          ? `Ask ${activeAgentLabel}…  (try “${(suggestions?.[0]) ?? 'How can you help?'}”)`
          : agentsLoading
            ? 'Loading agents…'
            : 'Ask anything…'
      }
      suggestions={suggestions}
      onSendMessage={handleSend}
      onClear={clear}
      onStop={isLoading ? stop : undefined}
      onReload={reload}
      isLoading={isLoading}
      error={error}
      enableMarkdown
      onToolApprove={hitl.decide}
      toolDecisions={hitl.decisions}
      toolApproveLabel="Approve & run"
      toolDenyLabel="Reject"
      toolDenyReason="Operator rejected from chat"
      data-testid="ai-chat-panel"
    />
  );
}

const AGENT_SUGGESTIONS: Record<string, string[]> = {
  data_chat: [
    '系统里有多少个用户？列出他们的邮箱。',
    '帮我列出最近创建的 5 条记录。',
    '统计每个对象的记录数。',
  ],
  metadata_assistant: [
    '系统里注册了哪些对象类型？',
    'sys_user 对象有哪些字段？',
    '描述一下用户相关的对象关系。',
  ],
};

const GENERIC_SUGGESTIONS = [
  'What can you help me with?',
  'List the available data objects.',
  'Summarize my recent activity.',
];

function buildAgentSuggestions(
  agentName: string | undefined,
  agentLabel: string,
): string[] {
  if (agentName && AGENT_SUGGESTIONS[agentName]) {
    return AGENT_SUGGESTIONS[agentName];
  }
  const lower = (agentName ?? agentLabel).toLowerCase();
  if (lower.includes('data')) return AGENT_SUGGESTIONS.data_chat;
  if (lower.includes('metadata')) return AGENT_SUGGESTIONS.metadata_assistant;
  return GENERIC_SUGGESTIONS;
}

export default AiChatPage;
