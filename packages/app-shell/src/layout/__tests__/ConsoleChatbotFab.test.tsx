import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsoleChatbotFab } from '../ConsoleChatbotFab';

describe('ConsoleChatbotFab', () => {
  it('keeps the lightweight FAB above the mobile bottom navigation', () => {
    render(<ConsoleChatbotFab appLabel="Workspace" objects={[]} />);

    const fab = screen.getByTestId('console-chatbot-fab');
    expect(fab).toHaveAccessibleName('Open Workspace assistant');
    expect(fab).toHaveClass('bottom-20');
    expect(fab).toHaveClass('sm:bottom-6');
  });
});
