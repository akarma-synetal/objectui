/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * MetadataClient
 *
 * Thin, framework-agnostic HTTP client for the ObjectStack metadata
 * API (`/api/v1/meta/*`). Used by the platform Setup app surfaces in
 * `@object-ui/plugin-designer` (Object Manager, Field Designer, etc.)
 * so they can read and write protocol metadata without depending on
 * `ObjectStackAdapter` (which is a generic data-source binding and
 * carries a lot of view/dashboard-specific behaviour we don't need
 * here).
 *
 * Endpoints (see `packages/rest/src/rest-server.ts`):
 *   GET    /api/v1/meta                  — list all metadata types
 *   GET    /api/v1/meta/:type            — list items of a type
 *   GET    /api/v1/meta/:type/:name      — get one item (returns the
 *                                          unwrapped item content)
 *   PUT    /api/v1/meta/:type/:name      — save (overlay) one item
 *                                          honours `If-Match` for OCC
 *   DELETE /api/v1/meta/:type/:name      — reset overlay to artifact
 *   GET    /api/v1/meta/:type/:name/history — durable change log
 *
 * The client deliberately keeps the response shape opaque (typed as
 * `unknown`/generic `T`) so callers explicitly narrow per-metadata-
 * type, mirroring the framework's "single Zod source per type" rule.
 */

export interface MetadataClientConfig {
  /** Base URL of the ObjectStack server (no trailing slash needed). */
  baseUrl: string;
  /**
   * Optional environment ID to scope reads/writes to a tenant. When
   * provided, requests use the scoped path
   * `/api/v1/environments/:environmentId/meta/...` and overlays are
   * persisted in the environment's own metadata store.
   */
  environmentId?: string;
  /** Optional custom fetch implementation (defaults to `globalThis.fetch`). */
  fetch?: typeof fetch;
  /** Additional headers (e.g. auth) included on every request. */
  headers?: Record<string, string>;
}

export interface MetadataListOptions {
  /** Filter by source package id (matches the `package` query param). */
  packageId?: string;
}

export interface MetadataSaveOptions {
  /**
   * Optimistic concurrency token (the `checksum` returned by the last
   * read). When present, sent as the `If-Match` header so concurrent
   * edits get a 409 instead of overwriting each other.
   */
  ifMatch?: string;
  /** Optional actor id, sent as `X-Actor` for history attribution. */
  actor?: string;
}

export interface MetadataHistoryOptions {
  /** Only return events after this sequence number. */
  sinceSeq?: number;
  /** Limit the number of events returned. */
  limit?: number;
}

export interface MetadataError extends Error {
  status: number;
  code?: string;
  body?: unknown;
}

const META_PREFIX = '/meta';
const API_PREFIX = '/api/v1';

function buildBase(config: MetadataClientConfig): string {
  const trimmed = config.baseUrl.replace(/\/+$/, '');
  const scoped = config.environmentId
    ? `${API_PREFIX}/environments/${encodeURIComponent(config.environmentId)}${META_PREFIX}`
    : `${API_PREFIX}${META_PREFIX}`;
  // Allow baseUrl to already include `/api/v1`; collapse the duplicate.
  if (/\/api\/v\d+$/i.test(trimmed)) {
    const stripped = trimmed.replace(/\/api\/v\d+$/i, '');
    const scopedNoApi = config.environmentId
      ? `${API_PREFIX}/environments/${encodeURIComponent(config.environmentId)}${META_PREFIX}`
      : `${API_PREFIX}${META_PREFIX}`;
    return `${stripped}${scopedNoApi}`;
  }
  return `${trimmed}${scoped}`;
}

async function parseError(res: Response): Promise<MetadataError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = await res.text().catch(() => undefined);
  }
  const message =
    (body && typeof body === 'object' && 'error' in (body as Record<string, unknown>)
      ? String((body as Record<string, unknown>).error)
      : undefined) ?? `Metadata request failed: ${res.status} ${res.statusText}`;
  const err = new Error(message) as MetadataError;
  err.status = res.status;
  err.body = body;
  if (body && typeof body === 'object' && 'code' in (body as Record<string, unknown>)) {
    err.code = String((body as Record<string, unknown>).code);
  }
  return err;
}

/**
 * MetadataClient — read/write protocol metadata via the framework REST API.
 *
 * @example
 * ```ts
 * const client = new MetadataClient({ baseUrl: 'http://localhost:3000' });
 * const objects = await client.list<{ name: string; label?: string }>('object');
 * const account = await client.get<{ fields: Record<string, unknown> }>('object', 'account');
 * await client.save('object', 'account', { ...account, label: 'Customer' });
 * ```
 */
export class MetadataClient {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string>;

  constructor(config: MetadataClientConfig) {
    this.base = buildBase(config);
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.headers = { Accept: 'application/json', ...(config.headers ?? {}) };
  }

  /** Update the client's environment scope at runtime. */
  withEnvironment(environmentId: string | undefined): MetadataClient {
    return new MetadataClient({
      baseUrl: this.base
        .replace(/\/api\/v\d+(?:\/environments\/[^/]+)?\/meta$/, '')
        .replace(/\/+$/, ''),
      environmentId,
      fetch: this.fetchImpl,
      headers: this.headers,
    });
  }

  /** List all registered metadata types (returns the registry rows). */
  async listTypes(): Promise<unknown[]> {
    const res = await this.fetchImpl(this.base, { method: 'GET', headers: this.headers });
    if (!res.ok) throw await parseError(res);
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.items ?? []);
  }

  /** List items of a metadata type (e.g. `object`, `field`, `view`). */
  async list<T = unknown>(type: string, options: MetadataListOptions = {}): Promise<T[]> {
    const qs = options.packageId
      ? `?package=${encodeURIComponent(options.packageId)}`
      : '';
    const url = `${this.base}/${encodeURIComponent(type)}${qs}`;
    const res = await this.fetchImpl(url, { method: 'GET', headers: this.headers });
    if (!res.ok) throw await parseError(res);
    const data = await res.json();
    if (Array.isArray(data)) return data as T[];
    if (data && Array.isArray((data as { items?: unknown[] }).items)) {
      return (data as { items: T[] }).items;
    }
    return [];
  }

  /**
   * Get a single metadata item. Returns the unwrapped item content
   * (matching the framework REST handler which calls `res.json(item)`).
   * Returns `null` on 404 to keep the call-site ergonomic.
   */
  async get<T = unknown>(type: string, name: string): Promise<T | null> {
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}`;
    const res = await this.fetchImpl(url, { method: 'GET', headers: this.headers });
    if (res.status === 404) return null;
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as T;
  }

  /**
   * Save (PUT) a metadata item. The framework accepts both the bare
   * item payload and the `{ item: ... }` / `{ metadata: ... }`
   * envelopes; we send bare for consistency.
   */
  async save<T = unknown>(
    type: string,
    name: string,
    item: unknown,
    options: MetadataSaveOptions = {},
  ): Promise<T> {
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}`;
    const headers: Record<string, string> = {
      ...this.headers,
      'Content-Type': 'application/json',
    };
    if (options.ifMatch) headers['If-Match'] = options.ifMatch;
    if (options.actor) headers['X-Actor'] = options.actor;
    const res = await this.fetchImpl(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(item),
    });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as T;
  }

  /**
   * Reset a metadata customization overlay back to the artifact default.
   * Idempotent: returns the result even when no overlay row existed.
   */
  async reset<T = unknown>(
    type: string,
    name: string,
    options: MetadataSaveOptions = {},
  ): Promise<T> {
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}`;
    const headers: Record<string, string> = { ...this.headers };
    if (options.ifMatch) headers['If-Match'] = options.ifMatch;
    if (options.actor) headers['X-Actor'] = options.actor;
    const res = await this.fetchImpl(url, { method: 'DELETE', headers });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as T;
  }

  /** Fetch the durable history (change log) for one metadata item. */
  async history<T = unknown>(
    type: string,
    name: string,
    options: MetadataHistoryOptions = {},
  ): Promise<T> {
    const params = new URLSearchParams();
    if (options.sinceSeq !== undefined) params.set('sinceSeq', String(options.sinceSeq));
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    const qs = params.toString();
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/history${qs ? `?${qs}` : ''}`;
    const res = await this.fetchImpl(url, { method: 'GET', headers: this.headers });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as T;
  }
}
