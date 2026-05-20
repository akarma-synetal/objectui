/**
 * useRecordApprovals
 *
 * Resolves the approval state for a single record so the detail-view header
 * can surface "Submit for Approval" / "Recall" actions and a status badge.
 *
 * Talks directly to the framework REST endpoints under
 * `/api/v1/approvals/*`. Fails open: if the approvals plugin is not
 * installed (404) or the user has no identity, returns inert state so the
 * detail view continues to render normally.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface ApprovalProcessLite {
  id: string;
  name: string;
  label?: string;
  object_name: string;
  active?: boolean;
}

export interface ApprovalRequestLite {
  id: string;
  process_name: string;
  object_name: string;
  record_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'recalled' | string;
  submitter_id?: string | null;
  current_step?: string | null;
  pending_approvers?: string[] | null;
  submitted_at?: string;
  completed_at?: string | null;
}

interface UseRecordApprovalsResult {
  loading: boolean;
  available: boolean;
  processes: ApprovalProcessLite[];
  pendingRequest: ApprovalRequestLite | null;
  latestRequest: ApprovalRequestLite | null;
  canSubmit: boolean;
  canRecall: boolean;
  submit: (input?: { processName?: string; comment?: string }) => Promise<ApprovalRequestLite>;
  recall: (input?: { comment?: string }) => Promise<ApprovalRequestLite>;
  refresh: () => Promise<void>;
}

function apiBase() {
  const url = (import.meta as any).env?.VITE_SERVER_URL || '';
  return `${String(url).replace(/\/$/, '')}/api/v1`;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const err: any = new Error(payload?.error || `HTTP ${res.status}`);
    err.code = payload?.code ?? `HTTP_${res.status}`;
    err.status = res.status;
    throw err;
  }
  return payload as T;
}

export function useRecordApprovals(
  objectName: string | undefined,
  recordId: string | undefined,
  currentUserId?: string | null,
): UseRecordApprovalsResult {
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const [processes, setProcesses] = useState<ApprovalProcessLite[]>([]);
  const [requests, setRequests] = useState<ApprovalRequestLite[]>([]);
  const unavailableRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!objectName || !recordId) return;
    if (unavailableRef.current) return;
    setLoading(true);
    try {
      const [procResp, reqResp] = await Promise.all([
        fetchJson<{ data: ApprovalProcessLite[] }>(
          `/approvals/processes?object=${encodeURIComponent(objectName)}&activeOnly=true`,
        ),
        fetchJson<{ data: ApprovalRequestLite[] }>(
          `/approvals/requests?object=${encodeURIComponent(objectName)}&recordId=${encodeURIComponent(recordId)}`,
        ),
      ]);
      setProcesses(procResp?.data ?? []);
      setRequests(reqResp?.data ?? []);
      setAvailable(true);
    } catch (err: any) {
      if (err?.status === 404) {
        unavailableRef.current = true;
        setAvailable(false);
      }
      // Other errors are transient — silently keep last state.
    } finally {
      setLoading(false);
    }
  }, [objectName, recordId]);

  useEffect(() => {
    if (!objectName || !recordId) {
      setProcesses([]);
      setRequests([]);
      return;
    }
    refresh();
  }, [objectName, recordId, refresh]);

  const pendingRequest = useMemo(
    () => requests.find((r) => r.status === 'pending') ?? null,
    [requests],
  );

  const latestRequest = useMemo(() => {
    if (requests.length === 0) return null;
    const sorted = [...requests].sort((a, b) => {
      const at = a.submitted_at || a.completed_at || '';
      const bt = b.submitted_at || b.completed_at || '';
      return bt.localeCompare(at);
    });
    return sorted[0] ?? null;
  }, [requests]);

  const canSubmit = available && processes.length > 0 && !pendingRequest;
  const canRecall = !!pendingRequest && !!currentUserId
    && pendingRequest.submitter_id === currentUserId;

  const submit = useCallback(
    async (input?: { processName?: string; comment?: string }) => {
      if (!objectName || !recordId) throw new Error('Missing object or record');
      const processName = input?.processName
        ?? (processes.length === 1 ? processes[0].name : undefined);
      const row = await fetchJson<ApprovalRequestLite>(`/approvals/requests`, {
        method: 'POST',
        body: JSON.stringify({
          object: objectName,
          recordId,
          ...(processName ? { processName } : {}),
          ...(input?.comment ? { comment: input.comment } : {}),
        }),
      });
      await refresh();
      return row;
    },
    [objectName, recordId, processes, refresh],
  );

  const recall = useCallback(
    async (input?: { comment?: string }) => {
      if (!pendingRequest) throw new Error('No pending request');
      const out = await fetchJson<{ request: ApprovalRequestLite }>(
        `/approvals/requests/${encodeURIComponent(pendingRequest.id)}/recall`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...(currentUserId ? { actorId: currentUserId } : {}),
            ...(input?.comment ? { comment: input.comment } : {}),
          }),
        },
      );
      await refresh();
      return out.request;
    },
    [pendingRequest, currentUserId, refresh],
  );

  return {
    loading,
    available,
    processes,
    pendingRequest,
    latestRequest,
    canSubmit,
    canRecall,
    submit,
    recall,
    refresh,
  };
}
