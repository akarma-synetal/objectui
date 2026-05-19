/**
 * Approvals REST helper.
 *
 * Thin fetch wrapper around the framework's approval endpoints
 * (`/api/v1/approvals/*`). Sends cookies for auth.
 *
 * Mirrors the shape exposed by `@objectstack/plugin-approvals` /
 * `packages/rest/src/rest-server.ts`.
 */

const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
const API_BASE = `${SERVER_URL}/api/v1`;

export interface ApprovalProcessRow {
  id: string;
  name: string;
  object_name: string;
  status: 'active' | 'inactive' | string;
  definition: unknown;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ApprovalRequestRow {
  id: string;
  process_name: string;
  object_name: string;
  record_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'recalled' | string;
  current_step?: string | null;
  current_step_index?: number | null;
  pending_approvers?: string[] | null;
  submitter_id?: string | null;
  submitted_at?: string;
  completed_at?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface ApprovalActionRow {
  id: string;
  request_id: string;
  step_index?: number | null;
  step_name?: string | null;
  actor_id?: string | null;
  action: 'submit' | 'approve' | 'reject' | 'recall' | string;
  comment?: string | null;
  created_at?: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const code = payload?.code ?? `HTTP_${res.status}`;
    const msg = payload?.message ?? payload?.error ?? res.statusText;
    const err = new Error(`${code}: ${msg}`) as Error & { code?: string; status?: number; details?: unknown };
    err.code = code;
    err.status = res.status;
    err.details = payload;
    throw err;
  }
  return payload as T;
}

export const approvalsApi = {
  listProcesses(params: { object?: string; activeOnly?: boolean } = {}) {
    const qs = new URLSearchParams();
    if (params.object) qs.set('object', params.object);
    if (params.activeOnly) qs.set('activeOnly', 'true');
    const q = qs.toString();
    return call<{ data: ApprovalProcessRow[] }>(`/approvals/processes${q ? `?${q}` : ''}`);
  },

  listRequests(params: {
    status?: string;
    object?: string;
    recordId?: string;
    approverId?: string;
    submitterId?: string;
  } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.object) qs.set('object', params.object);
    if (params.recordId) qs.set('recordId', params.recordId);
    if (params.approverId) qs.set('approverId', params.approverId);
    if (params.submitterId) qs.set('submitterId', params.submitterId);
    const q = qs.toString();
    return call<{ data: ApprovalRequestRow[] }>(`/approvals/requests${q ? `?${q}` : ''}`);
  },

  async getRequest(id: string) {
    // Server returns the row directly (not `{data: row}`). Normalize.
    const row = await call<ApprovalRequestRow>(`/approvals/requests/${encodeURIComponent(id)}`);
    return { data: row };
  },

  listActions(requestId: string) {
    return call<{ data: ApprovalActionRow[] }>(
      `/approvals/requests/${encodeURIComponent(requestId)}/actions`,
    );
  },

  async approve(id: string, body: { actorId?: string; actor_id?: string; comment?: string }) {
    // Server returns `{request, finalized}`. Normalize to `{data, finalized}`.
    const out = await call<{ request: ApprovalRequestRow; finalized: boolean }>(
      `/approvals/requests/${encodeURIComponent(id)}/approve`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    return { data: out.request, finalized: out.finalized };
  },

  async reject(id: string, body: { actorId?: string; actor_id?: string; comment?: string }) {
    const out = await call<{ request: ApprovalRequestRow; finalized: boolean }>(
      `/approvals/requests/${encodeURIComponent(id)}/reject`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    return { data: out.request, finalized: out.finalized };
  },

  async recall(id: string, body: { actorId?: string; actor_id?: string; comment?: string }) {
    const out = await call<{ request: ApprovalRequestRow; finalized: boolean }>(
      `/approvals/requests/${encodeURIComponent(id)}/recall`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    return { data: out.request, finalized: out.finalized };
  },
};

/**
 * Build the list of approver identifiers that should match the
 * signed-in user. Used to filter "My Pending" and to decide whether
 * Approve/Reject buttons are enabled.
 */
export function buildApproverIdentities(user: {
  id?: string;
  email?: string;
  roles?: string[];
} | null | undefined): string[] {
  if (!user) return [];
  const ids = new Set<string>();
  if (user.id) ids.add(user.id);
  if (user.email) ids.add(user.email);
  for (const role of user.roles || []) {
    if (role) ids.add(`role:${role}`);
  }
  return Array.from(ids);
}
