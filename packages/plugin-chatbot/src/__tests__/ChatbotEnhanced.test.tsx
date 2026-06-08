/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Smoke tests for the AI-Elements-composed ChatbotEnhanced. Heavier
 * interaction tests (streaming, tool-call rendering) live in the app-level
 * e2e suite — these only validate the public surface stays stable.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatbotEnhanced, type ChatMessage } from '../ChatbotEnhanced';

describe('ChatbotEnhanced (AI Elements composition)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders the empty conversation state with suggestion chips', () => {
    const onSendMessage = vi.fn();
    render(
      <ChatbotEnhanced
        suggestions={["Show me today's tasks", 'Summarise this account']}
        onSendMessage={onSendMessage}
      />
    );

    expect(screen.getByText(/Summarise this account/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Show me today's tasks/i));
    expect(onSendMessage).toHaveBeenCalledWith("Show me today's tasks");
  });

  it('renders user and assistant messages', () => {
    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'Hello' },
      { id: 'a1', role: 'assistant', content: 'Hi! How can I help?' },
    ];
    render(<ChatbotEnhanced messages={messages} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText(/How can I help/i)).toBeInTheDocument();
  });

  it('shows an error banner with a retry affordance', () => {
    const onReload = vi.fn();
    render(
      <ChatbotEnhanced
        messages={[{ id: 'a1', role: 'assistant', content: 'oops' }]}
        error={new Error('network down')}
        onReload={onReload}
      />
    );
    expect(screen.getByText(/Response failed/i)).toBeInTheDocument();
    expect(screen.getByText(/network down/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Retry/i));
    expect(onReload).toHaveBeenCalled();
  });

  it('shows an assistant thinking row while waiting for a response', () => {
    render(
      <ChatbotEnhanced
        messages={[{ id: 'u1', role: 'user', content: 'Find recent deals' }]}
        isLoading
      />
    );

    expect(screen.getByText('Find recent deals')).toBeInTheDocument();
    expect(screen.getByText(/Assistant is responding/i)).toBeInTheDocument();
  });

  it('renders thinking dots inside an empty streaming assistant message', () => {
    render(
      <ChatbotEnhanced
        messages={[
          { id: 'u1', role: 'user', content: 'Find recent deals' },
          { id: 'a1', role: 'assistant', content: '', streaming: true },
        ]}
        isLoading
      />
    );

    expect(screen.getByText(/Assistant is responding/i)).toBeInTheDocument();
    expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    expect(screen.queryByText('Regenerate')).not.toBeInTheDocument();
  });

  it('turns the submit control into a stop control while streaming', () => {
    const onStop = vi.fn();
    render(
      <ChatbotEnhanced
        messages={[{ id: 'u1', role: 'user', content: 'Find recent deals' }]}
        isLoading
        onStop={onStop}
      />
    );

    expect(screen.queryByLabelText('Submit')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Stop response'));
    expect(onStop).toHaveBeenCalled();
  });

  it('exposes a copy action on assistant messages', () => {
    render(
      <ChatbotEnhanced
        messages={[{ id: 'a1', role: 'assistant', content: 'copy me' }]}
      />
    );
    const copyBtn = screen.getByText('Copy').closest('button')!;
    fireEvent.click(copyBtn);
    expect((navigator.clipboard.writeText as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      'copy me'
    );
  });

  it('summarizes tool invocations and hides reasoning by default', () => {
    render(
      <ChatbotEnhanced
        messages={[
          {
            id: 'a1',
            role: 'assistant',
            content: 'Found 3 deals.',
            reasoning: 'Picked the query_data tool because the user asked for deals.',
            toolInvocations: [
              {
                toolCallId: 'tc1',
                toolName: 'query_data',
                args: { objectName: 'deal', limit: 3 },
                result: { count: 3 },
                state: 'output-available',
              },
            ],
            sources: [
              { id: 's1', title: 'CRM docs', url: 'https://docs.example.com/crm' },
            ],
          },
        ]}
      />
    );
    expect(screen.queryByText(/Agent activity/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Query data/i)).toBeInTheDocument();
    expect(screen.getByText(/Completed/i)).toBeInTheDocument();
    expect(screen.queryByText(/query_data/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Picked the query_data tool/i)).not.toBeInTheDocument();
    // Sources trigger renders count
    expect(screen.getByText(/Used 1 sources/i)).toBeInTheDocument();
  });

  it('renders raw tool invocations and reasoning in debug mode', () => {
    render(
      <ChatbotEnhanced
        processVisibility="debug"
        messages={[
          {
            id: 'a1',
            role: 'assistant',
            content: 'Found 3 deals.',
            reasoning: 'Picked the query_data tool because the user asked for deals.',
            toolInvocations: [
              {
                toolCallId: 'tc1',
                toolName: 'query_data',
                args: { objectName: 'deal', limit: 3 },
                result: { count: 3 },
                state: 'output-available',
              },
            ],
          },
        ]}
      />
    );
    expect(screen.getAllByText(/query_data/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Picked the query_data tool/i)).toBeInTheDocument();
  });

  it('renders a model picker and forwards changes', () => {
    const onModelChange = vi.fn();
    render(
      <ChatbotEnhanced
        models={[
          { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' },
          { id: 'claude-3-5-sonnet', label: 'Claude 3.5', provider: 'anthropic' },
        ]}
        selectedModelId="gpt-4o-mini"
        onModelChange={onModelChange}
      />
    );
    const picker = screen.getByLabelText(/Model/i) as HTMLSelectElement;
    fireEvent.change(picker, { target: { value: 'claude-3-5-sonnet' } });
    expect(onModelChange).toHaveBeenCalledWith('claude-3-5-sonnet');
  });
});
