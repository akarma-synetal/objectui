// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /$package/ai/approvals — HITL (Human-In-The-Loop) approval queue.
 *
 * Renders the shared `<AiPendingActionsInbox>` from `@object-ui/plugin-chatbot`
 * — the same component the Console mounts at `/system/ai-approvals`. Keeping
 * a single source of truth means Studio operators and Console users see the
 * exact same inbox UI and decision flow against `/api/v1/ai/pending-actions/*`.
 */
import { createFileRoute } from '@tanstack/react-router';
import { AiPendingActionsInbox } from '@object-ui/plugin-chatbot';
import { getApiBaseUrl } from '@/lib/config';

function AiApprovalsComponent() {
  const baseUrl = getApiBaseUrl();
  const apiBase = `${baseUrl.replace(/\/$/, '')}/api/v1/ai`;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <AiPendingActionsInbox
        apiBase={apiBase}
        title="AI Approvals"
        description="Review tool calls that the model marked as destructive. Approve to run, reject to discard. Decisions here flow through the same `pending-actions` queue the Console operator uses."
        pollInterval={5000}
      />
    </div>
  );
}

export const Route = createFileRoute('/$package/ai/approvals/')({
  component: AiApprovalsComponent,
});
