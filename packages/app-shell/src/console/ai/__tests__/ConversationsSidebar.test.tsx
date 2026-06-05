import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const remove = vi.fn(async () => undefined);
const rename = vi.fn(async () => undefined);

vi.mock('../../../hooks/useConversationList', () => ({
  useConversationList: () => ({
    conversations: [
      {
        id: 'conv-a',
        title: 'Pipeline review',
        preview: 'Show recent opportunities',
        updatedAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
    error: undefined,
    refetch: vi.fn(),
    remove,
    rename,
  }),
}));

import { ConversationsSidebar } from '../ConversationsSidebar';

function renderSidebar(onNavigate = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/ai/conv-a']}>
      <Routes>
        <Route
          path="/ai/:conversationId"
          element={
            <ConversationsSidebar
              userId="u1"
              apiBase="/api/v1/ai"
              onNavigate={onNavigate}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return { onNavigate };
}

describe('ConversationsSidebar', () => {
  it('renders row actions as real buttons and closes mobile chrome after navigation', () => {
    const { onNavigate } = renderSidebar();

    fireEvent.click(screen.getByTestId('ai-conversation-select-conv-a'));
    expect(onNavigate).toHaveBeenCalledTimes(1);

    expect(screen.getByLabelText('Rename conversation')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete conversation')).toBeInTheDocument();
  });
});
