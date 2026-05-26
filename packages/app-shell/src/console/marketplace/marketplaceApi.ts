/**
 * Marketplace REST helper.
 *
 * Thin fetch wrapper around the tenant runtime's marketplace proxy
 * (`/api/v1/marketplace/*`). The proxy forwards to the configured
 * cloud control plane (`OS_CLOUD_URL`) — only browse endpoints are
 * exposed. Install is performed against the cloud action endpoint
 * directly (via `installPackage()` below), which requires the user
 * to have a cloud session.
 *
 * See:
 *   cloud/packages/service-cloud/src/routes/marketplace.ts
 *   framework/packages/runtime/src/cloud/marketplace-proxy-plugin.ts
 */

import { getCloudBase } from '../../runtime-config';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
const API_BASE = `${SERVER_URL}/api/v1/marketplace`;

/**
 * Per-locale overrides for translatable package fields. Mirrors
 * `PackageTranslation` from @objectstack/spec/cloud — duplicated here
 * to avoid pulling the spec package into the app-shell bundle.
 * See framework/packages/spec/src/cloud/package.zod.ts.
 */
export interface MarketplacePackageTranslation {
  displayName?: string;
  description?: string;
  readme?: string;
  tagline?: string;
  screenshotCaptions?: Record<string, string>;
}

export type MarketplacePackageTranslations = Record<string, MarketplacePackageTranslation>;

export interface MarketplacePackageSummary {
  id: string;
  manifest_id: string;
  display_name: string;
  description?: string | null;
  category?: string | null;
  tags?: string | null;
  icon_url?: string | null;
  homepage_url?: string | null;
  license?: string | null;
  publisher?: string | null;
  is_starter?: boolean;
  created_at?: string;
  updated_at?: string;
  /**
   * Locale-keyed overrides for display_name / description / readme.
   * Optional on the wire: older control planes / older runtimes may not
   * project this column yet. UI should fall back to the base field.
   */
  translations?: MarketplacePackageTranslations | null;
  latest_version: MarketplacePackageVersion | null;
}

export interface MarketplacePackageDetail extends MarketplacePackageSummary {
  readme?: string | null;
}

export interface MarketplacePackageVersion {
  id: string;
  version: string;
  status?: string;
  is_prerelease?: boolean;
  published_at?: string | null;
  listing_status?: string;
  reviewed_at?: string | null;
}

export interface MarketplaceListResponse {
  items: MarketplacePackageSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface MarketplaceDetailResponse {
  package: MarketplacePackageDetail;
  versions: MarketplacePackageVersion[];
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'omit',
    headers: { 'Accept': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const code = payload?.error?.code ?? payload?.code ?? `HTTP_${res.status}`;
    const message = payload?.error?.message ?? payload?.error ?? res.statusText;
    const err = new Error(typeof message === 'string' ? message : `${code}`);
    (err as any).code = code;
    (err as any).status = res.status;
    throw err;
  }
  // Cloud helpers return `{ success: true, data: ... }`; unwrap when present.
  return (payload?.data ?? payload) as T;
}

export async function listMarketplacePackages(params: { q?: string; category?: string; limit?: number; offset?: number } = {}): Promise<MarketplaceListResponse> {
  const usp = new URLSearchParams();
  if (params.q) usp.set('q', params.q);
  if (params.category) usp.set('category', params.category);
  if (params.limit != null) usp.set('limit', String(params.limit));
  if (params.offset != null) usp.set('offset', String(params.offset));
  const qs = usp.toString();
  return call<MarketplaceListResponse>(`/packages${qs ? `?${qs}` : ''}`);
}

export async function getMarketplacePackage(id: string): Promise<MarketplaceDetailResponse> {
  return call<MarketplaceDetailResponse>(`/packages/${encodeURIComponent(id)}`);
}

/**
 * Install a package into an environment by calling the cloud's
 * `install_package` action **directly** (not via the proxy). Requires the
 * caller's browser to have a valid cloud session cookie — typically
 * because the user has signed into cloud at least once and the cookie
 * domain covers this origin. When that's not the case the call fails
 * with 401; the UI can then surface a "Sign in on cloud" link.
 *
 * `cloudBaseUrl` is supplied by the server at boot via
 * `/api/v1/runtime/config` (see `runtime-config.ts`); we read it through
 * `getCloudBase()` rather than hardcoding `VITE_CLOUD_URL` or sniffing
 * `window.location.hostname`. When the runtime *is* the cloud,
 * `getCloudBase()` returns `''` and we fall back to same-origin.
 */

export interface InstallResponse {
  installation?: { id: string; environment_id: string; package_id: string; version: string };
  message?: string;
  [k: string]: any;
}

export async function installPackage(input: {
  packageId: string;
  environmentId: string;
  seedSampleData?: boolean;
}): Promise<InstallResponse> {
  const base = getCloudBase() || SERVER_URL;
  const res = await fetch(`${base}/api/v1/actions/sys_package/install_package`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recordId: input.packageId,
      params: {
        environment_id: input.environmentId,
        seed_sample_data: !!input.seedSampleData,
      },
    }),
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const code = payload?.code ?? payload?.error?.code ?? `HTTP_${res.status}`;
    const message = payload?.error ?? payload?.message ?? res.statusText;
    const err = new Error(typeof message === 'string' ? message : `${code}`);
    (err as any).code = code;
    (err as any).status = res.status;
    throw err;
  }
  return (payload?.data ?? payload) as InstallResponse;
}

/**
 * Helper: list environments visible to the current cloud user (active
 * organisation). Used to populate the install dialog's environment picker.
 * Calls cloud directly — same auth model as `installPackage`.
 */
export interface CloudEnvironment {
  id: string;
  display_name?: string;
  hostname?: string;
  organization_id?: string;
  plan?: string;
  status?: string;
}

export async function listCloudEnvironments(): Promise<CloudEnvironment[]> {
  const base = getCloudBase() || SERVER_URL;
  const res = await fetch(`${base}/api/v1/data/sys_environment?limit=200`, {
    credentials: 'include',
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`HTTP_${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  const payload: any = await res.json().catch(() => ({}));
  // Cloud's data API returns `{ object, records, total, hasMore }`.
  // We keep `data` / `items` as fallbacks for older builds.
  const rows = payload?.records ?? payload?.data ?? payload?.items ?? payload ?? [];
  return Array.isArray(rows) ? (rows as CloudEnvironment[]) : [];
}

/**
 * List orgs in which the current cloud user has an `owner` or `admin`
 * role on `sys_member`. Used to filter the install dialog's env picker
 * — only envs whose `organization_id` is in this set are installable
 * (the backend enforces the same gate; this is the UX mirror).
 *
 * Returns an empty set on 401 / network failure so the install dialog
 * can render a clean "no installable environments" state.
 *
 * Hardening: we *always* re-filter rows by the caller's session
 * `user_id` because the data API currently returns sys_member rows
 * without per-caller scoping. Without this, the dialog would pick up
 * every org in the system and offer their envs as install targets.
 */
export async function listInstallableOrgIds(): Promise<Set<string>> {
  const base = getCloudBase() || SERVER_URL;
  let meId: string | null = null;
  try {
    const meRes = await fetch(`${base}/api/v1/auth/get-session`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (meRes.ok) {
      const meBody: any = await meRes.json().catch(() => ({}));
      meId = meBody?.user?.id ?? null;
    }
  } catch {
    /* fall through — meId stays null and we return empty set */
  }
  if (!meId) return new Set();

  const url = `${base}/api/v1/data/sys_member?limit=200`;
  let payload: any = null;
  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return new Set();
    payload = await res.json().catch(() => ({}));
  } catch {
    return new Set();
  }
  const rows: any[] = payload?.records ?? payload?.data ?? payload?.items ?? payload ?? [];
  if (!Array.isArray(rows)) return new Set();
  const ids = new Set<string>();
  for (const row of rows) {
    const rowUserId = String(row?.user_id ?? row?.userId ?? '');
    if (rowUserId !== meId) continue;
    const role = String(row?.role ?? '').toLowerCase();
    const orgId = row?.organization_id ?? row?.organizationId;
    if (orgId && (role === 'owner' || role === 'admin')) {
      ids.add(String(orgId));
    }
  }
  return ids;
}

export function cloudInstallDeepLink(packageId: string): string {
  const base = getCloudBase() || 'https://cloud.objectos.app';
  return `${base}/apps/cloud-control/sys_package/${encodeURIComponent(packageId)}`;
}

// ────────────────────────────────────────────────────────────────────
// Local install (this runtime's kernel — not a cloud environment)
// ────────────────────────────────────────────────────────────────────
//
// Architecturally distinct from cloud install:
//   - Single target = the local kernel; no env picker.
//   - Same-origin POST against the local runtime (no CORS).
//   - Local AuthPlugin session is sufficient — no cloud account required.
//   - Manifest is cached on disk so the app keeps working offline.
//
// Backend: framework/packages/runtime/src/cloud/marketplace-install-local-plugin.ts

export interface LocalInstallEntry {
  packageId: string;
  versionId: string;
  manifestId: string;
  version: string;
  installedAt: string;
  installedBy: string | null;
}

export interface LocalInstallResult {
  manifestId: string;
  version: string;
  versionId: string;
  installedAt: string;
  hotLoaded: boolean;
  upgradedFrom: string | null;
  note?: string;
}

export async function installLocal(input: {
  packageId: string;
  versionId?: string;
}): Promise<LocalInstallResult> {
  const res = await fetch(`${API_BASE}/install-local`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      packageId: input.packageId,
      ...(input.versionId ? { versionId: input.versionId } : {}),
    }),
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const code = payload?.error?.code ?? `HTTP_${res.status}`;
    const message = payload?.error?.message ?? res.statusText;
    const err = new Error(typeof message === 'string' ? message : `${code}`);
    (err as any).code = code;
    (err as any).status = res.status;
    throw err;
  }
  return (payload?.data ?? payload) as LocalInstallResult;
}

export async function listLocalInstalls(): Promise<LocalInstallEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/install-local`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const payload: any = await res.json().catch(() => ({}));
    const items = payload?.data?.items ?? payload?.items ?? [];
    return Array.isArray(items) ? (items as LocalInstallEntry[]) : [];
  } catch {
    return [];
  }
}

export async function uninstallLocal(manifestId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/install-local/${encodeURIComponent(manifestId)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const payload: any = await res.json().catch(() => ({}));
    const message = payload?.error?.message ?? res.statusText;
    throw new Error(typeof message === 'string' ? message : `HTTP_${res.status}`);
  }
}
