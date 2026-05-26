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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

  const handleSent = useCallback(() => {
    // New user turn → bump sidebar list so the row's preview/timestamp refreshes.
    setRefreshKey((k) => k + 1);
  }, []);

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
  onSent: () => void;
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
    initialMessages: hydrated.length > 0
      ? hydrated
      : [
          {
            id: 'welcome',
            role: 'assistant' as const,
            content: activeAgent
              ? `Hello! I'm **${activeAgentLabel}**. How can I help you today?`
              : `Hello! I'm your AI assistant.${
                  agentsError ? ' (Backend unreachable — running in offline demo mode.)' : ''
                }`,
          },
        ],
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
      onSent();
    },
    [sendMessage, onSent],
  );

  const headerSlot =
    agents.length > 0 ? (
      <div className="flex items-center gap-2 px-4 py-2">
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
          ? `Ask ${activeAgentLabel}...`
          : agentsLoading
            ? 'Loading agents...'
            : 'Ask anything...'
      }
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

export default AiChatPage;
