/**
 * Tests for the HistoryPanel UI: it must render the timeline, mark the
 * current entry, and call jumpTo() on click.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryPanel } from './HistoryPanel';
import type { UndoRedoState } from '../hooks/useUndoRedo';

vi.mock('@object-ui/components', () => ({
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  ScrollArea: ({ children, ...p }: any) => <div {...p}>{children}</div>,
}));
vi.mock('lucide-react', () => ({
  Undo2: () => <span data-testid="i-undo" />,
  Redo2: () => <span data-testid="i-redo" />,
  History: () => <span data-testid="i-history" />,
  RotateCcw: () => <span data-testid="i-rotate" />,
}));

function makeHistory<T>(timeline: T[], currentIndex: number): UndoRedoState<T> {
  return {
    current: timeline[currentIndex],
    canUndo: currentIndex > 0,
    canRedo: currentIndex < timeline.length - 1,
    undoCount: currentIndex,
    redoCount: timeline.length - 1 - currentIndex,
    timeline,
    currentIndex,
    push: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    reset: vi.fn(),
    jumpTo: vi.fn(),
    clearPersisted: vi.fn(),
  };
}

describe('HistoryPanel', () => {
  it('renders one entry per timeline item with the current one marked', () => {
    const history = makeHistory(['a', 'b', 'c', 'd'], 1);
    render(<HistoryPanel history={history} />);
    expect(screen.getByTestId('history-panel-entry-0')).toBeInTheDocument();
    expect(screen.getByTestId('history-panel-entry-1')).toHaveAttribute('data-current', 'true');
    expect(screen.getByTestId('history-panel-entry-2')).toBeInTheDocument();
    expect(screen.getByTestId('history-panel-entry-3')).toBeInTheDocument();
  });

  it('uses the renderLabel callback when provided', () => {
    const history = makeHistory([{ name: 'A' }, { name: 'B' }], 0);
    render(<HistoryPanel history={history} renderLabel={(e) => `step ${(e as any).name}`} />);
    expect(screen.getByText('step A')).toBeInTheDocument();
    expect(screen.getByText('step B')).toBeInTheDocument();
  });

  it('calls jumpTo with the clicked index', () => {
    const history = makeHistory(['a', 'b', 'c'], 1);
    render(<HistoryPanel history={history} />);
    fireEvent.click(screen.getByTestId('history-panel-entry-0'));
    expect(history.jumpTo).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByTestId('history-panel-entry-2'));
    expect(history.jumpTo).toHaveBeenCalledWith(2);
  });

  it('wires the header undo/redo buttons', () => {
    const history = makeHistory(['a', 'b', 'c'], 1);
    render(<HistoryPanel history={history} />);
    fireEvent.click(screen.getByTestId('history-panel-undo'));
    expect(history.undo).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('history-panel-redo'));
    expect(history.redo).toHaveBeenCalled();
  });

  it('disables undo/redo buttons appropriately', () => {
    const history = makeHistory(['a'], 0);
    render(<HistoryPanel history={history} />);
    expect(screen.getByTestId('history-panel-undo')).toBeDisabled();
    expect(screen.getByTestId('history-panel-redo')).toBeDisabled();
  });
});
