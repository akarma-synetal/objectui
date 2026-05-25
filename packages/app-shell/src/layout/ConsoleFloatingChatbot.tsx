/**
 * ConsoleFloatingChatbot
 *
 * Wires the global FAB chatbot to the framework's `@objectstack/service-ai`
 * backend (the `/api/v1/ai/agents/:agentName/chat` Vercel Data Stream
 * endpoint) and exposes an in-header agent picker.
 *
 * The chatbot pulls in `react-markdown` + `micromark` (~150 KB) which is
 * unused on every page until the AI assistant is enabled, so deferring it
 * keeps those bytes off the initial paint.
 * @module
 */
import React from 'react';
import {
  FloatingChatbot,
  useObjectChat,
  useAgents,
  useHitlInChat,
  type ChatMessage,
  type AgentDescriptor,
} from '@object-ui/plugin-chatbot';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@object-ui/components';

interface ConsoleObject {
  name: string;
  label?: string;
}

export interface ConsoleFloatingChatbotProps {
  appLabel: string;
  objects: ConsoleObject[];
  /**
   * Base URL of the AI service. Defaults to `${VITE_SERVER_URL}/api/v1/ai`
   * (or the relative `/api/v1/ai` when no server URL is configured).
   */
  apiBase?: string;
  /** Default agent name to select on first render. */
  defaultAgent?: string;
}

const DEFAULT_AI_PATH = '/api/v1/ai';

function resolveApiBase(explicit?: string): string {
  if (explicit) return explicit.replace(/\/$/, '');
  const env = (import.meta as any).env ?? {};
  const fromEnv = env.VITE_AI_BASE_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const serverUrl = (env.VITE_SERVER_URL as string | undefined) ?? '';
  return `${serverUrl.replace(/\/$/, '')}${DEFAULT_AI_PATH}`;
}

/**
 * Inner component that owns the chat hook. Re-mounted (via `key`) whenever
 * the active agent changes so `useObjectChat`'s first-render mode lock
 * (api vs local) picks up the new endpoint.
 */
interface ChatbotInnerProps {
  appLabel: string;
  objects: ConsoleObject[];
  agents: AgentDescriptor[];
  agentsLoading: boolean;
  agentsError: Error | undefined;
  activeAgent: string | undefined;
  onAgentChange: (name: string) => void;
  chatApi: string | undefined;
  /**
   * Base URL of the AI service (no trailing slash). Forwarded to
   * `useHitlInChat` so the inline approve/reject buttons can hit
   * `POST /pending-actions/:id/{approve,reject}` on the right host.
   */
  apiBase: string;
}

function ChatbotInner({
  appLabel,
  objects,
  agents,
  agentsLoading,
  agentsError,
  activeAgent,
  onAgentChange,
  chatApi,
  apiBase,
}: ChatbotInnerProps) {
  const objectNames = objects.map((o) => o.label || o.name).join(', ');

  const activeAgentLabel = React.useMemo<string>(() => {
    const found = agents.find((a) => a.name === activeAgent);
    return found?.label ?? activeAgent ?? appLabel;
  }, [agents, activeAgent, appLabel]);

  const welcomeContent = activeAgent
    ? `Hello! I'm **${activeAgentLabel}**, your ${appLabel} assistant. How can I help you today?`
    : `Hello! I'm your **${appLabel}** assistant. ${
        agentsError ? '(Backend unreachable — running in offline demo mode.)' : ''
      }`;

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
    conversationId: activeAgent ? `${appLabel}:${activeAgent}` : undefined,
    body: {
      context: {
        activeApp: appLabel,
        objects: objects.map((o) => ({ name: o.name, label: o.label })),
        agentName: activeAgent,
      },
    },
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant' as const,
        content: welcomeContent,
      },
    ],
    // Local-mode fallback: only used when `chatApi` is undefined (no agent
    // resolved yet, or no backend available). Keeps the UI usable.
    autoResponse: !chatApi,
    autoResponseText: objectNames
      ? `I can help you work with ${objectNames}. What would you like to do?`
      : "Thanks for your message! I'm here to help you navigate and manage your data.",
    autoResponseDelay: 600,
  });

  // HITL bridge — turns the pending-approval tool result envelope from the
  // framework's action-tools.ts into inline approve/reject buttons that talk
  // directly to /api/v1/ai/pending-actions/:id/{approve,reject}.
  const hitl = useHitlInChat({
    messages: messages as ChatMessage[],
    apiBase,
  });

  const headerExtra =
    agents.length > 0 ? (
      <Select
        value={activeAgent}
        onValueChange={onAgentChange}
        disabled={agentsLoading}
      >
        <SelectTrigger
          className="h-7 w-[180px] text-xs"
          data-testid="floating-chatbot-agent-picker"
        >
          <SelectValue placeholder="Choose agent..." />
        </SelectTrigger>
        <SelectContent align="end">
          {agents.map((agent: AgentDescriptor) => (
            <SelectItem key={agent.name} value={agent.name} className="text-xs">
              <span className="font-medium">{agent.label}</span>
              {agent.description ? (
                <span className="block text-muted-foreground text-[10px] truncate max-w-[220px]">
                  {agent.description}
                </span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : null;

  return (
    <FloatingChatbot
      floatingConfig={{
        position: 'bottom-right',
        defaultOpen: false,
        panelWidth: 420,
        panelHeight: 560,
        title: `${appLabel} Assistant`,
        triggerSize: 56,
      }}
      headerExtra={headerExtra}
      messages={messages as ChatMessage[]}
      placeholder={
        activeAgent
          ? `Ask ${activeAgentLabel}...`
          : agentsLoading
            ? 'Loading agents...'
            : 'Ask anything...'
      }
      onSendMessage={(content: string) => sendMessage(content)}
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
    />
  );
}

export default function ConsoleFloatingChatbot({
  appLabel,
  objects,
  apiBase: apiBaseProp,
  defaultAgent: defaultAgentProp,
}: ConsoleFloatingChatbotProps) {
  const apiBase = React.useMemo(() => resolveApiBase(apiBaseProp), [apiBaseProp]);
  const env = (import.meta as any).env ?? {};
  const envDefaultAgent = env.VITE_AI_DEFAULT_AGENT as string | undefined;

  const { agents, isLoading: agentsLoading, error: agentsError } = useAgents({ apiBase });

  const [activeAgent, setActiveAgent] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    if (!activeAgent && agents.length > 0) {
      const preferred = defaultAgentProp ?? envDefaultAgent;
      const match = preferred ? agents.find((a) => a.name === preferred) : undefined;
      setActiveAgent((match ?? agents[0]).name);
    }
  }, [agents, activeAgent, defaultAgentProp, envDefaultAgent]);

  const chatApi = activeAgent
    ? `${apiBase}/agents/${encodeURIComponent(activeAgent)}/chat`
    : undefined;

  // `key` forces a clean remount whenever the active agent (and therefore the
  // chat API URL) changes — required because `useObjectChat` locks its mode
  // (api vs local) on first render.
  return (
    <ChatbotInner
      key={chatApi ?? 'local'}
      appLabel={appLabel}
      objects={objects}
      agents={agents}
      agentsLoading={agentsLoading}
      agentsError={agentsError}
      activeAgent={activeAgent}
      onAgentChange={setActiveAgent}
      chatApi={chatApi}
      apiBase={apiBase}
    />
  );
}

