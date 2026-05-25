// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { Bot, X, Trash2, Loader2, ShieldAlert } from 'lucide-react';
import {
  ChatbotEnhanced,
  uiMessagesToChatMessages,
} from '@object-ui/plugin-chatbot';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  useAiChatPanel,
  loadMessages,
  saveMessages,
} from '@/hooks/use-ai-chat-panel';
import { useAssistantContext } from '@/hooks/use-assistant-context';
import {
  useAssistantResolution,
  STUDIO_AGENT,
  type SkillSummary,
} from '@/hooks/use-assistant-skills';
import { getApiBaseUrl } from '@/lib/config';

const PANEL_WIDTH = 380;

/** Endpoint used for the Universal Assistant ambient chat. */
export const ASSISTANT_CHAT_PATH = '/api/v1/ai/assistant/chat';

/** localStorage key for the most-recent forced skill (slash command). */
export const SKILL_OVERRIDE_KEY = 'objectstack:ai-chat-skill';

/**
 * Build the Universal Assistant chat URL.
 * @internal — exported for testing
 */
export function chatApiUrl(baseUrl: string): string {
  return `${baseUrl}${ASSISTANT_CHAT_PATH}`;
}

/**
 * Load the persisted slash-command skill override (if any).
 * @internal — exported for testing
 */
export function loadSkillOverride(): string | null {
  try {
    return localStorage.getItem(SKILL_OVERRIDE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist a slash-command skill override.
 * @internal — exported for testing
 */
export function saveSkillOverride(skill: string | null): void {
  try {
    if (skill) localStorage.setItem(SKILL_OVERRIDE_KEY, skill);
    else localStorage.removeItem(SKILL_OVERRIDE_KEY);
  } catch {
    // silently ignore
  }
}

/**
 * Parse a slash-command from the input. Returns the skill name if the
 * input begins with `/<skill>` followed by whitespace or end-of-input.
 */
function parseSlashCommand(text: string): { skill: string; rest: string } | null {
  const m = /^\/([a-z][a-z0-9_]*)(?:\s+(.*))?$/is.exec(text.trim());
  if (!m) return null;
  return { skill: m[1].toLowerCase(), rest: (m[2] ?? '').trim() };
}

export function AiChatPanel() {
  const { isOpen, setOpen } = useAiChatPanel();
  const [skillOverride, setSkillOverride] = useState<string | null>(loadSkillOverride);
  const [palettePrefix, setPalettePrefix] = useState<string | null>(null);
  const baseUrl = getApiBaseUrl();

  const context = useAssistantContext();
  const {
    agent: resolvedAgent,
    skills: activeSkills,
    loading: assistantLoading,
  } = useAssistantResolution(context);

  const initialMessages = useMemo(() => loadMessages() as UIMessage[], []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: chatApiUrl(baseUrl),
        credentials: 'include',
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            messages,
            context,
            agent: STUDIO_AGENT,
            ...(skillOverride ? { skill: skillOverride } : {}),
          },
        }),
      }),
    [baseUrl, context, skillOverride],
  );

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
    addToolApprovalResponse,
    regenerate,
    stop,
  } = useChat({
    transport,
    messages: initialMessages,
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  // Persist messages to localStorage whenever they change.
  useEffect(() => {
    if (messages.length > 0) saveMessages(messages);
  }, [messages]);

  const chatMessages = useMemo(
    () => uiMessagesToChatMessages(messages, { isStreaming }),
    [messages, isStreaming],
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    saveMessages([]);
  }, [setMessages]);

  const clearSkillOverride = useCallback(() => {
    setSkillOverride(null);
    saveSkillOverride(null);
  }, []);

  const applySkillOverride = useCallback((skillName: string) => {
    setSkillOverride(skillName);
    saveSkillOverride(skillName);
    setPalettePrefix(null);
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      const slash = parseSlashCommand(trimmed);
      if (slash) {
        const known = activeSkills.find((s) => s.name === slash.skill);
        if (known) {
          applySkillOverride(known.name);
          if (slash.rest) sendMessage({ text: slash.rest });
          return;
        }
      }
      setPalettePrefix(null);
      sendMessage({ text: trimmed });
    },
    [activeSkills, applySkillOverride, isStreaming, sendMessage],
  );

  const handleInputChange = useCallback((value: string) => {
    setPalettePrefix(value.startsWith('/') ? value.slice(1).toLowerCase() : null);
  }, []);

  const handleToolApprove = useCallback(
    (toolCallId: string, approved: boolean, reason?: string) => {
      addToolApprovalResponse({ id: toolCallId, approved, reason });
    },
    [addToolApprovalResponse],
  );

  // Filter skill palette suggestions on the partial slash command.
  const filteredSkills: SkillSummary[] = useMemo(() => {
    if (palettePrefix === null) return [];
    return activeSkills.filter(
      (s) =>
        s.name.toLowerCase().includes(palettePrefix) ||
        s.label.toLowerCase().includes(palettePrefix),
    );
  }, [activeSkills, palettePrefix]);

  if (!isOpen) return null;

  // ── Assistant status row → headerSlot ──
  const headerSlot = (
    <div className="px-3 py-2" data-testid="assistant-status">
      {assistantLoading ? (
        <div className="flex h-7 items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Resolving assistant…
        </div>
      ) : resolvedAgent ? (
        <div className="flex h-7 items-center gap-1.5 overflow-hidden text-xs">
          <Bot className="h-3 w-3 shrink-0 text-primary" />
          <span className="font-medium" data-testid="assistant-agent-label">
            {resolvedAgent.label}
          </span>
          {activeSkills.length > 0 && (
            <span
              className="truncate text-muted-foreground"
              data-testid="assistant-active-skills"
              title={activeSkills.map((s) => s.label).join(', ')}
            >
              · {activeSkills.length} skill{activeSkills.length === 1 ? '' : 's'}
            </span>
          )}
          {skillOverride && (
            <span
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary"
              data-testid="assistant-skill-override"
            >
              /{skillOverride}
              <button
                onClick={clearSkillOverride}
                className="hover:text-primary/70"
                aria-label="Clear skill override"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
        </div>
      ) : (
        <div className="flex h-7 items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="h-3 w-3" />
          No assistant available
        </div>
      )}
    </div>
  );

  // ── Slash command palette → promptOverlaySlot ──
  const promptOverlaySlot =
    palettePrefix !== null ? (
      <div
        data-testid="skill-palette"
        className="max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-lg"
      >
        {filteredSkills.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            No matching skills for the current context.
          </div>
        ) : (
          filteredSkills.map((s) => (
            <button
              key={s.name}
              type="button"
              data-testid={`skill-palette-item-${s.name}`}
              onClick={() => applySkillOverride(s.name)}
              className="flex w-full flex-col items-start gap-0.5 border-b border-border/50 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-accent"
            >
              <span className="font-medium">/{s.name}</span>
              <span className="text-muted-foreground">{s.label}</span>
              {s.description && (
                <span className="line-clamp-2 text-[10px] opacity-70">{s.description}</span>
              )}
            </button>
          ))
        )}
      </div>
    ) : null;

  return (
    <aside
      data-testid="ai-chat-panel"
      className={cn(
        'fixed right-0 top-0 z-50 h-full',
        'flex flex-col border-l border-border',
        'bg-background shadow-xl',
        'animate-in slide-in-from-right duration-200',
      )}
      style={{ width: PANEL_WIDTH }}
    >
      {/* ── Header (Studio-owned: positioning + close button) ── */}
      <div className="shrink-0 border-b">
        <div className="flex h-12 items-center justify-between px-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="h-4 w-4 text-primary" />
            AI Chat
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={clearHistory}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Clear chat</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear history</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Shared composition layer over AI Elements ── */}
      <ChatbotEnhanced
        className="flex-1 min-h-0 border-none"
        messages={chatMessages}
        placeholder={
          skillOverride ? `Ask /${skillOverride}…` : 'Ask AI… (type / for skills)'
        }
        headerSlot={headerSlot}
        promptOverlaySlot={promptOverlaySlot}
        onSendMessage={handleSend}
        onInputChange={handleInputChange}
        onToolApprove={handleToolApprove}
        onStop={() => stop()}
        onReload={() => regenerate()}
        isLoading={isStreaming}
        error={error ?? undefined}
      />
    </aside>
  );
}
