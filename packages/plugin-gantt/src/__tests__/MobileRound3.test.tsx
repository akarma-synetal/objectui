/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Mobile UX round 3 — Gantt: collapsible task list, today marker + jump,
 * and pinch-to-zoom timeline.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GanttView, type GanttTask } from '../GanttView';

// Today is always inside the auto-padded range (start = now-7d, end = now+14d).
const today = new Date();
const inThreeDays = new Date(today.getTime() + 3 * 86400000);
const inTenDays = new Date(today.getTime() + 10 * 86400000);

const tasks: GanttTask[] = [
  { id: '1', title: 'Phase one', start: today, end: inThreeDays, progress: 50 },
  { id: '2', title: 'Phase two', start: inThreeDays, end: inTenDays, progress: 10 },
];

describe('Mobile UX Round 3 — GanttView', () => {
  describe('today marker', () => {
    it('renders a sticky vertical today marker when today is in range', () => {
      render(<GanttView tasks={tasks} />);
      expect(screen.getByTestId('gantt-today-marker')).toBeInTheDocument();
    });

    it('exposes a Jump-to-Today button', () => {
      render(<GanttView tasks={tasks} />);
      const btn = screen.getByTestId('gantt-jump-today');
      expect(btn).toBeEnabled();
      // smoke: clicking the button should not throw
      fireEvent.click(btn);
    });

    it('does NOT render a today marker when today is outside the range', () => {
      const past1 = new Date('1990-01-01');
      const past2 = new Date('1990-02-01');
      render(
        <GanttView
          tasks={[{ id: 'x', title: 'Old', start: past1, end: past2, progress: 0 }]}
          startDate={past1}
          endDate={past2}
        />,
      );
      expect(screen.queryByTestId('gantt-today-marker')).not.toBeInTheDocument();
    });
  });

  describe('collapsible task list', () => {
    it('renders a toggle button that flips aria-pressed when clicked', () => {
      render(<GanttView tasks={tasks} />);
      const toggle = screen.getByTestId('gantt-toggle-task-list');
      const initiallyPressed = toggle.getAttribute('aria-pressed');
      fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-pressed')).not.toBe(initiallyPressed);
    });
  });

  describe('pinch-to-zoom', () => {
    it('does not throw when two-finger touch events are dispatched on the timeline', () => {
      render(<GanttView tasks={tasks} />);
      const timeline = screen.getByTestId('gantt-timeline');
      const start = new Event('touchstart', { bubbles: true }) as any;
      start.touches = [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ];
      timeline.dispatchEvent(start);

      const move = new Event('touchmove', { bubbles: true }) as any;
      move.touches = [
        { clientX: 50, clientY: 100 },
        { clientX: 250, clientY: 100 },
      ];
      timeline.dispatchEvent(move);

      const end = new Event('touchend', { bubbles: true });
      timeline.dispatchEvent(end);
      // smoke: handlers don't throw
      expect(timeline).toBeInTheDocument();
    });
  });
});
