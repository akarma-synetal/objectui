// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Thin REST client for the External Datasource Federation routes
 * (ADR-0015 §6.2, framework `registerExternalDatasourceRoutes`).
 *
 * Mounted server-side under `/api/v1/datasources/:name/external/*`:
 *
 *   GET  /tables[?schema=]              → { tables: RemoteTable[] }
 *   POST /tables/:remote/draft          → { draft: ObjectDraft }
 *   POST /refresh-catalog               → { catalog: ExternalCatalog }
 *   POST /validate                      → { ok, results: SchemaValidationResult[] }
 *
 * Every route degrades to `503 external_service_unavailable` when the host
 * has not wired the `external-datasource` service — callers surface that as a
 * "federation not enabled on this server" hint rather than a hard error.
 *
 * All calls go through `createAuthenticatedFetch()` so the Bearer token,
 * `X-Tenant-ID`, and `Accept-Language` are injected exactly like every other
 * app-shell REST call (RecordDetailView, ObjectView, …).
 */

import { createAuthenticatedFetch } from '@object-ui/auth';

// ---------------------------------------------------------------------------
// Contract types — mirror `@objectstack/spec` (external-datasource-service.ts,
// external-catalog.zod.ts, external-errors.ts). Kept local so app-shell does
// not take a build dependency on the framework spec package.
// ---------------------------------------------------------------------------

/** A remote table discovered via introspection (allowedSchemas-filtered). */
export interface RemoteTable {
  schema?: string;
  name: string;
  columnCount: number;
  rowCountEstimate?: number;
}

/** Options controlling how a remote table is drafted into an Object. */
export interface GenerateDraftOpts {
  remoteSchema?: string;
  rename?: Record<string, string>;
  primaryKey?: string[];
  includeColumns?: string[];
  excludeColumns?: string[];
}

/** A generated Object draft: structured definition + `*.object.ts` source. */
export interface ObjectDraft {
  name: string;
  datasource: string;
  definition: Record<string, unknown>;
  source: string;
  review: Array<{ column: string; remoteType: string; note: string }>;
}

export type SchemaDiffEntryKind =
  | 'missing_table'
  | 'missing_column'
  | 'type_mismatch'
  | 'nullability_mismatch'
  | 'unmapped_column'
  | 'pk_mismatch';

/** A single divergence between a federated Object and its remote table. */
export interface SchemaDiffEntry {
  kind: SchemaDiffEntryKind;
  remoteSchema?: string;
  remoteName?: string;
  column?: string;
  expected?: string;
  actual?: string;
  severity: 'error' | 'warning';
}

/** Per-object validation outcome. */
export interface SchemaValidationResult {
  ok: boolean;
  datasource: string;
  object: string;
  diffs: SchemaDiffEntry[];
}

/** A single remote column captured in a catalog snapshot. */
export interface ExternalColumn {
  name: string;
  sqlType: string;
  nullable: boolean;
  primaryKey?: boolean;
  suggestedFieldType?: string;
}

/** A single remote table/view captured in a catalog snapshot. */
export interface ExternalTable {
  remoteSchema?: string;
  remoteName: string;
  columns: ExternalColumn[];
  indexes?: Array<{ name: string; columns: string[]; unique: boolean }>;
  rowCountEstimate?: number;
}

/** The persisted snapshot of a federated datasource's remote schema. */
export interface ExternalCatalog {
  name: string;
  datasource: string;
  snapshotAt: string;
  dialect?: string;
  tables: ExternalTable[];
}

/**
 * Raised when the server replies `503 external_service_unavailable` — the
 * federation service is not wired into this host. Callers render a friendly
 * "enable federation on the server" message instead of a generic failure.
 */
export class ExternalServiceUnavailableError extends Error {
  constructor() {
    super('external_service_unavailable');
    this.name = 'ExternalServiceUnavailableError';
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const authFetch = createAuthenticatedFetch();

function serverBase(): string {
  const raw = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SERVER_URL ?? '';
  return raw.replace(/\/+$/, '');
}

function externalBase(datasource: string): string {
  return `${serverBase()}/api/v1/datasources/${encodeURIComponent(datasource)}/external`;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (res.status === 503) {
    // Body is `{ error: 'external_service_unavailable' }` — treat distinctly.
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    const code =
      body && typeof body === 'object' && 'error' in body
        ? String((body as Record<string, unknown>).error)
        : '';
    if (code === 'external_service_unavailable') throw new ExternalServiceUnavailableError();
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body && typeof body === 'object' && 'error' in body) {
        detail = String((body as Record<string, unknown>).error);
      }
    } catch {
      /* keep status-text detail */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

/** List remote tables, optionally filtered to a single remote schema. */
export async function listRemoteTables(
  datasource: string,
  opts: { schema?: string } = {},
): Promise<RemoteTable[]> {
  const qs = opts.schema ? `?schema=${encodeURIComponent(opts.schema)}` : '';
  const res = await authFetch(`${externalBase(datasource)}/tables${qs}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const data = await jsonOrThrow<{ tables: RemoteTable[] }>(res);
  return data.tables ?? [];
}

/** Generate an Object draft (structured + `*.object.ts` source) from a table. */
export async function generateObjectDraft(
  datasource: string,
  remoteName: string,
  opts: GenerateDraftOpts = {},
): Promise<ObjectDraft> {
  const res = await authFetch(
    `${externalBase(datasource)}/tables/${encodeURIComponent(remoteName)}/draft`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    },
  );
  const data = await jsonOrThrow<{ draft: ObjectDraft }>(res);
  return data.draft;
}

/** Refresh and return the cached remote-schema snapshot. */
export async function refreshCatalog(datasource: string): Promise<ExternalCatalog> {
  const res = await authFetch(`${externalBase(datasource)}/refresh-catalog`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  const data = await jsonOrThrow<{ catalog: ExternalCatalog }>(res);
  return data.catalog;
}

/** Validate every federated Object bound to this datasource. */
export async function validateDatasource(
  datasource: string,
): Promise<{ ok: boolean; results: SchemaValidationResult[] }> {
  const res = await authFetch(`${externalBase(datasource)}/validate`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  return jsonOrThrow<{ ok: boolean; results: SchemaValidationResult[] }>(res);
}

/**
 * Persist a generated Object draft as a real `object` metadata item
 * (PUT `/api/v1/meta/object/:name`, mirroring `MetadataClient.save`). The
 * draft's `definition` is the parseable ObjectSchema body.
 */
export async function importObjectDraft(draft: ObjectDraft): Promise<void> {
  const res = await authFetch(
    `${serverBase()}/api/v1/meta/object/${encodeURIComponent(draft.name)}`,
    {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(draft.definition),
    },
  );
  await jsonOrThrow<unknown>(res);
}
