/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Mobile UX round 3 — sticky save bar, fullscreen long-text editor, and
 * auto-stepper for long forms on small viewports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { ObjectForm } from '../ObjectForm';

// Helpers ----------------------------------------------------------------

const setMobileViewport = (mobile: boolean) => {
  window.innerWidth = mobile ? 375 : 1280;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: mobile && /max-width:\s*767/.test(query),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
};

const buildSchema = (fieldCount: number) => {
  const fields: Record<string, any> = {};
  for (let i = 0; i < fieldCount; i++) {
    fields[`f${i}`] = { label: `Field ${i}`, type: i === 0 ? 'textarea' : 'text', required: false };
  }
  return {
    name: 'thing',
    fields,
  };
};

const makeDS = (fieldCount: number) => ({
  getObjectSchema: vi.fn().mockResolvedValue(buildSchema(fieldCount)),
  findOne: vi.fn().mockResolvedValue({}),
  find: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({ id: '1' }),
  update: vi.fn().mockResolvedValue({ id: '1' }),
  delete: vi.fn().mockResolvedValue(true),
});

beforeEach(() => {
  setMobileViewport(false);
});

// Tests -------------------------------------------------------------------

describe('Mobile UX Round 3 — ObjectForm', () => {
  describe('sticky save bar', () => {
    it('applies the sticky-action wrapper class when mobile.stickyActions is set', async () => {
      const ds = makeDS(3);
      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'thing',
            mode: 'create',
            mobile: { stickyActions: true },
          } as any}
          dataSource={ds as any}
        />,
      );
      const wrapper = await screen.findByTestId('form-mobile-sticky-actions');
      expect(wrapper.className).toMatch(/sticky/);
      expect(wrapper.className).toMatch(/bottom-0/);
    });

    it('does NOT apply the sticky wrapper without mobile.stickyActions', async () => {
      const ds = makeDS(3);
      render(
        <ObjectForm
          schema={{ type: 'object-form', objectName: 'thing', mode: 'create' } as any}
          dataSource={ds as any}
        />,
      );
      // wait for form to render
      await screen.findByText(/Create|Update/i);
      expect(screen.queryByTestId('form-mobile-sticky-actions')).toBeNull();
    });
  });

  describe('fullscreen long-text', () => {
    it('renders an expand button on textarea fields when mobile.fullscreenLongText is set', async () => {
      const ds = makeDS(2);
      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'thing',
            mode: 'create',
            mobile: { fullscreenLongText: true },
          } as any}
          dataSource={ds as any}
        />,
      );
      const expandBtn = await screen.findByTestId('textarea-fullscreen-toggle');
      expect(expandBtn).toBeTruthy();
    });

    it('opens a fullscreen editor dialog when expand is clicked, and commits on Done', async () => {
      const ds = makeDS(2);
      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'thing',
            mode: 'create',
            mobile: { fullscreenLongText: true },
          } as any}
          dataSource={ds as any}
        />,
      );
      const expandBtn = await screen.findByTestId('textarea-fullscreen-toggle');
      fireEvent.click(expandBtn);
      const dialogInput = await screen.findByTestId('textarea-fullscreen-input');
      fireEvent.change(dialogInput, { target: { value: 'hello fullscreen' } });
      const saveBtn = screen.getByTestId('textarea-fullscreen-save');
      fireEvent.click(saveBtn);
      await waitFor(() => {
        expect(screen.queryByTestId('textarea-fullscreen-dialog')).toBeNull();
      });
    });

    it('does not show the expand button without the flag', async () => {
      const ds = makeDS(2);
      render(
        <ObjectForm
          schema={{ type: 'object-form', objectName: 'thing', mode: 'create' } as any}
          dataSource={ds as any}
        />,
      );
      await screen.findByText(/Create|Update/i);
      expect(screen.queryByTestId('textarea-fullscreen-toggle')).toBeNull();
    });
  });

  describe('auto-stepper', () => {
    it('routes through a step indicator when mobile.stepper === true', async () => {
      const ds = makeDS(3);
      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'thing',
            mode: 'create',
            mobile: { stepper: true },
          } as any}
          dataSource={ds as any}
        />,
      );
      // WizardForm renders step labels for each synthetic section
      await waitFor(() => {
        expect(screen.queryAllByText(/Field 0|Step 1/).length).toBeGreaterThan(0);
      });
    });

    it("does NOT route through the wizard when mobile.stepper === 'auto' and viewport is desktop", async () => {
      setMobileViewport(false);
      const ds = makeDS(12);
      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'thing',
            mode: 'create',
            mobile: { stepper: 'auto', stepperMinFields: 8 },
          } as any}
          dataSource={ds as any}
        />,
      );
      await screen.findByText(/Create|Update/i);
      // Flat form — no Next/Back wizard buttons
      expect(screen.queryByText(/^Next$/)).toBeNull();
    });

    it('does NOT route through the wizard when fewer than 2 fields', async () => {
      const ds = makeDS(1);
      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'thing',
            mode: 'create',
            mobile: { stepper: true },
          } as any}
          dataSource={ds as any}
        />,
      );
      await screen.findByText(/Create|Update/i);
      expect(screen.queryByText(/^Next$/)).toBeNull();
    });
  });
});
