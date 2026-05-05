/**
 * ConsoleFloatingChatbot
 *
 * Extracted from ConsoleLayout so it can be code-split via React.lazy.
 * The chatbot pulls in `react-markdown` + `micromark` (~150 KB) which is
 * unused on every page until the AI assistant is enabled, so deferring it
 * keeps those bytes off the initial paint.
 * @module
 */
import React from 'react';
import { FloatingChatbot, useObjectChat, type ChatMessage } from '@object-ui/plugin-chatbot';

interface ConsoleObject {
  name: string;
  label?: string;
}

export interface ConsoleFloatingChatbotProps {
  appLabel: string;
  objects: ConsoleObject[];
}

export default function ConsoleFloatingChatbot({ appLabel, objects }: ConsoleFloatingChatbotProps) {
  const objectNames = objects.map((o) => o.label || o.name).join(', ');

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    stop,
    reload,
    clear,
  } = useObjectChat({
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant' as const,
        content: `Hello! I'm your **${appLabel}** assistant. How can I help you today?`,
      },
    ],
    autoResponse: true,
    autoResponseText: objectNames
      ? `I can help you work with ${objectNames}. What would you like to do?`
      : 'Thanks for your message! I\'m here to help you navigate and manage your data.',
    autoResponseDelay: 800,
  });

  return (
    <FloatingChatbot
      floatingConfig={{
        position: 'bottom-right',
        defaultOpen: false,
        panelWidth: 400,
        panelHeight: 520,
        title: `${appLabel} Assistant`,
        triggerSize: 56,
      }}
      messages={messages as ChatMessage[]}
      placeholder="Ask anything..."
      onSendMessage={(content: string) => sendMessage(content)}
      onClear={clear}
      onStop={isLoading ? stop : undefined}
      onReload={reload}
      isLoading={isLoading}
      error={error}
      enableMarkdown
    />
  );
}
