/**
 * Thin REST client for `/api/settings`. Matches the surface mounted by
 * `@objectstack/service-settings`.
 */

import type {
  SettingsActionResult,
  SettingsListResponse,
  SettingsNamespacePayload,
} from './types';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
const BASE = `${SERVER_URL}/api/settings`;

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const err = new Error(detail?.error?.message ?? res.statusText) as Error & { status?: number; payload?: any };
    err.status = res.status;
    err.payload = detail;
    throw err;
  }
  return res.json() as Promise<T>;
}

const jsonHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

export async function listSettingsManifests(): Promise<SettingsListResponse> {
  const res = await fetch(BASE, { credentials: 'include', headers: jsonHeaders() });
  return jsonOrThrow<SettingsListResponse>(res);
}

export async function getSettingsNamespace(namespace: string): Promise<SettingsNamespacePayload> {
  const res = await fetch(`${BASE}/${encodeURIComponent(namespace)}`, {
    credentials: 'include',
    headers: jsonHeaders(),
  });
  return jsonOrThrow<SettingsNamespacePayload>(res);
}

export async function saveSettingsNamespace(
  namespace: string,
  patch: Record<string, unknown>,
): Promise<{ values: SettingsNamespacePayload['values'] }> {
  const res = await fetch(`${BASE}/${encodeURIComponent(namespace)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: jsonHeaders(),
    body: JSON.stringify(patch),
  });
  return jsonOrThrow<{ values: SettingsNamespacePayload['values'] }>(res);
}

export async function runSettingsAction(
  namespace: string,
  actionId: string,
  payload?: unknown,
): Promise<SettingsActionResult> {
  const res = await fetch(`${BASE}/${encodeURIComponent(namespace)}/${encodeURIComponent(actionId)}`, {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders(),
    body: JSON.stringify(payload ?? {}),
  });
  // The action endpoint always returns SettingsActionResult JSON, even on 400.
  const data = (await res.json().catch(() => ({ ok: false, message: res.statusText }))) as SettingsActionResult;
  if (typeof data?.ok !== 'boolean') {
    return { ok: res.ok, message: (data as any)?.error?.message ?? res.statusText };
  }
  return data;
}
