/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Regression tests for the `record:alert` renderer. We lock in the
 * contract that the renderer is a thin, predictable wrapper over the
 * shared ActionEngine: visibility predicates gate the banner, the CTA
 * is resolved from object metadata and dispatched through
 * `useActionEngine`, dismiss state persists per (object, record, key)
 * in localStorage, and severity → tailwind classes never silently
 * swap default icons.
 *
 * The renderer relies on several `@object-ui/react` hooks that normally
 * require a live provider tree (RecordContext, ActionProvider,
 * MetadataProvider). We stub them surgically so the tests stay focused
 * on renderer behaviour, not on provider wiring — the same approach
 * the live render in `RecordDetailView` relies on at runtime.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const mockExecuteAction = vi.fn(async () => ({ success: true }));

const stub = {
  recordCtx: undefined as any,
  metadataItem: undefined as any,
  predicate: { input: undefined as any, passes: true },
};

vi.mock('@object-ui/react', () => ({
  useRecordContext: () => stub.recordCtx,
  useMetadataItem: (_type: string, _name: string | null) => ({ item: stub.metadataItem }),
  useCondition: (_input: unknown, _scope: unknown) => stub.predicate.passes,
  toPredicateInput: (visible: unknown) => {
    stub.predicate.input = visible;
    return visible;
  },
  useActionEngine: (_opts: unknown) => ({
    executeAction: mockExecuteAction,
    getActionsForLocation: () => [],
    getBulkActions: () => [],
    handleShortcut: async () => null,
    engine: {} as any,
  }),
}));

vi.mock('@object-ui/components', () => ({
  Alert: ({ children, className, role, ...rest }: any) => (
    <div data-testid="alert" role={role} className={className} {...rest}>
      {children}
    </div>
  ),
  AlertTitle: ({ children }: any) => <h5 data-testid="alert-title">{children}</h5>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-body">{children}</div>,
  Button: ({ children, onClick, variant, ...rest }: any) => (
    <button data-testid="alert-cta" data-variant={variant} onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  LazyIcon: ({ name, className }: any) => (
    <svg data-testid="alert-icon" data-name={name} className={className} />
  ),
}));

import { RecordAlertRenderer } from '../record-alert';

const RECORD_DEFAULTS = {
  recordCtx: {
    data: { id: 'rec_1', name: 'Acme', email_verified: false },
    objectName: 'sys_user',
    recordId: 'rec_1',
  },
  metadataItem: {
    actions: [
      {
        name: 'resend_verification_email',
        label: 'Resend Verification Email',
        type: 'api',
        target: '/api/v1/auth/send-verification-email',
        successMessage: 'Verification email sent — check your inbox.',
      },
    ],
  },
};

beforeEach(() => {
  mockExecuteAction.mockClear();
  stub.recordCtx = RECORD_DEFAULTS.recordCtx;
  stub.metadataItem = RECORD_DEFAULTS.metadataItem;
  stub.predicate = { input: undefined, passes: true };
  // happy-dom doesn't always ship a working localStorage; install a
  // minimal Storage shim so the renderer's persistence path is
  // exercised the same way as in the browser.
  const store: Record<string, string> = {};
  const shim = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  } as Storage;
  Object.defineProperty(window, 'localStorage', { value: shim, configurable: true, writable: true });
  cleanup();
});

describe('RecordAlertRenderer', () => {
  it('renders title + body + default info icon when severity is omitted', () => {
    render(
      <RecordAlertRenderer
        schema={{ properties: { title: 'Heads up', body: 'Pay attention.' } }}
      />,
    );
    expect(screen.getByTestId('alert-title').textContent).toBe('Heads up');
    expect(screen.getByTestId('alert-body').textContent).toContain('Pay attention.');
    expect(screen.getByTestId('alert-icon').getAttribute('data-name')).toBe('Info');
  });

  it('applies warning severity classes + warning icon', () => {
    render(<RecordAlertRenderer schema={{ properties: { severity: 'warning', title: 'Verify' } }} />);
    const alert = screen.getByTestId('alert');
    expect(alert.className).toMatch(/amber/);
    expect(screen.getByTestId('alert-icon').getAttribute('data-name')).toBe('AlertTriangle');
  });

  it('respects an explicit icon override', () => {
    render(
      <RecordAlertRenderer schema={{ properties: { severity: 'warning', icon: 'mail', title: 'X' } }} />,
    );
    expect(screen.getByTestId('alert-icon').getAttribute('data-name')).toBe('mail');
  });

  it('sets role=alert + aria-live=assertive for error severity', () => {
    render(<RecordAlertRenderer schema={{ properties: { severity: 'error', title: 'Oops' } }} />);
    const alert = screen.getByTestId('alert');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
  });

  it('renders the CTA when action.actionName resolves to an object action', () => {
    render(
      <RecordAlertRenderer
        schema={{
          properties: {
            title: 'Email unverified',
            action: { actionName: 'resend_verification_email' },
          },
        }}
      />,
    );
    expect(screen.getByTestId('alert-cta').textContent).toBe('Resend Verification Email');
  });

  it('CTA label override takes precedence over action.label', () => {
    render(
      <RecordAlertRenderer
        schema={{
          properties: {
            title: 'X',
            action: { actionName: 'resend_verification_email', label: 'Send again' },
          },
        }}
      />,
    );
    expect(screen.getByTestId('alert-cta').textContent).toBe('Send again');
  });

  it('does NOT render a CTA when the action name fails to resolve in metadata', () => {
    render(
      <RecordAlertRenderer
        schema={{
          properties: { title: 'X', action: { actionName: 'no_such_action' } },
        }}
      />,
    );
    expect(screen.queryByTestId('alert-cta')).toBeNull();
  });

  it('clicking the CTA dispatches through useActionEngine by action name', () => {
    render(
      <RecordAlertRenderer
        schema={{
          properties: { title: 'X', action: { actionName: 'resend_verification_email' } },
        }}
      />,
    );
    fireEvent.click(screen.getByTestId('alert-cta'));
    expect(mockExecuteAction).toHaveBeenCalledTimes(1);
    expect(mockExecuteAction).toHaveBeenCalledWith('resend_verification_email');
  });

  it('hides while the record is still loading (empty record)', () => {
    stub.recordCtx = { data: {}, objectName: 'sys_user', recordId: 'rec_1' };
    const { container } = render(<RecordAlertRenderer schema={{ properties: { title: 'X' } }} />);
    expect(container.firstChild).toBeNull();
  });

  it('hides when the visibility predicate evaluates to false', () => {
    stub.predicate = { input: 'record.email_verified == false', passes: false };
    const { container } = render(
      <RecordAlertRenderer
        schema={{ properties: { title: 'X', visible: 'record.email_verified == false' } }}
      />,
    );
    expect(container.firstChild).toBeNull();
    expect(stub.predicate.input).toBe('record.email_verified == false');
  });

  it('renders unconditionally when no `visible` predicate is supplied', () => {
    render(<RecordAlertRenderer schema={{ properties: { title: 'Always visible' } }} />);
    expect(screen.getByTestId('alert')).toBeTruthy();
  });

  it('dismissible: click hides + localStorage persists across remounts (scoped by object+id+key)', () => {
    const { container } = render(
      <RecordAlertRenderer
        schema={{
          properties: {
            title: 'Verify',
            body: 'Verify your email',
            dismissible: true,
            dismissKey: 'unverified_email',
          },
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(container.firstChild).toBeNull();

    expect(window.localStorage.getItem('os.record-alert:sys_user:rec_1:unverified_email')).toBe('1');

    // Fresh mount of the same alert against the same record → reads
    // localStorage and stays hidden without further interaction.
    cleanup();
    const fresh = render(
      <RecordAlertRenderer
        schema={{
          properties: {
            title: 'Verify',
            body: 'Verify your email',
            dismissible: true,
            dismissKey: 'unverified_email',
          },
        }}
      />,
    );
    expect(fresh.container.firstChild).toBeNull();
  });

  it('dismiss is scoped per record — dismissing record A does NOT silence record B', () => {
    render(
      <RecordAlertRenderer
        schema={{ properties: { title: 'X', dismissible: true, dismissKey: 'k' } }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    cleanup();

    // Different record id → alert should render fresh.
    stub.recordCtx = {
      data: { id: 'rec_2', email_verified: false },
      objectName: 'sys_user',
      recordId: 'rec_2',
    };
    const other = render(
      <RecordAlertRenderer
        schema={{ properties: { title: 'X', dismissible: true, dismissKey: 'k' } }}
      />,
    );
    expect(other.getByTestId('alert')).toBeTruthy();
  });

  it('flat properties (legacy shape) are read as a fallback to nested .properties', () => {
    render(<RecordAlertRenderer schema={{ severity: 'success', title: 'Saved' } as any} />);
    expect(screen.getByTestId('alert-title').textContent).toBe('Saved');
    expect(screen.getByTestId('alert-icon').getAttribute('data-name')).toBe('CheckCircle2');
  });
});
