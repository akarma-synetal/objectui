// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlowRunner, type ScreenFlowState } from '../FlowRunner';

const STATE: ScreenFlowState = {
  flowName: 'reassign_wizard',
  runId: 'run-1',
  screen: {
    nodeId: 'collect',
    title: 'New Assignee',
    fields: [{ name: 'new_assignee', label: 'New Assignee', type: 'text', required: true }],
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function setup(authFetch: (url: string, init?: RequestInit) => Promise<Response>) {
  const onClose = vi.fn();
  const onComplete = vi.fn();
  render(
    <FlowRunner state={STATE} authFetch={authFetch} baseUrl="" onClose={onClose} onComplete={onComplete} />,
  );
  return { onClose, onComplete };
}

async function fillAndSubmit() {
  const user = userEvent.setup();
  // The screen title and the field label share the same text — target the
  // input by role instead of label text.
  await user.type(screen.getAllByRole('textbox')[0], 'linus@example.com');
  await user.click(screen.getByRole('button', { name: 'Submit' }));
}

beforeEach(() => vi.restoreAllMocks());

describe('FlowRunner resume outcomes', () => {
  it('closes the runner on a TERMINAL flow failure (suspension already consumed)', async () => {
    const authFetch = vi.fn(async () =>
      jsonResponse({ success: true, data: { success: false, error: "Node 'apply' failed: Update requires an ID" } }),
    );
    const { onClose, onComplete } = setup(authFetch);
    await fillAndSubmit();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('stays open on a transport-level failure so the user can retry', async () => {
    const authFetch = vi.fn(async () => jsonResponse({ success: false, error: 'gateway timeout' }, 502));
    const { onClose, onComplete } = setup(authFetch);
    await fillAndSubmit();
    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    // The form is still interactive for a retry.
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
  });

  it('renders the next screen on a multi-step pause', async () => {
    const authFetch = vi.fn(async () =>
      jsonResponse({
        success: true,
        data: {
          status: 'paused',
          runId: 'run-1',
          screen: { nodeId: 'confirm', title: 'Confirm Change', fields: [{ name: 'note', label: 'Note', type: 'text' }] },
        },
      }),
    );
    const { onClose, onComplete } = setup(authFetch);
    await fillAndSubmit();
    await waitFor(() => expect(screen.getByText('Confirm Change')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('completes (host refresh) on a successful terminal result', async () => {
    const authFetch = vi.fn(async () => jsonResponse({ success: true, data: { success: true, durationMs: 5 } }));
    const { onComplete } = setup(authFetch);
    await fillAndSubmit();
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });
});
