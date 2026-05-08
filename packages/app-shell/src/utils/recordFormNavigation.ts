/**
 * Resolvers for record-form navigation targets.
 *
 * Pure helpers extracted from `AppContent.tsx` so the routing rules behind
 * the modal-vs-page decision are unit-testable in isolation. Keep this file
 * free of React / router imports — it must run in a node test environment.
 *
 * @module utils/recordFormNavigation
 */

/**
 * Subset of the object metadata shape consumed by the resolver. Mirrors the
 * fields read from the runtime objects list (`useMetadata().objects`).
 */
export interface ObjectDefinitionForNavigation {
  /** API name used in URLs. */
  name: string;
  /** Optional UI mode override for create/edit interactions. */
  editMode?: 'modal' | 'page';
}

/**
 * Result of the modal-vs-page decision. `kind: 'modal'` means the caller
 * should open the global `<ModalForm>`; `kind: 'page'` means the caller
 * should `navigate(url)` to the full-screen create/edit route.
 */
export type RecordFormTarget =
  | { kind: 'modal' }
  | { kind: 'page'; url: string };

/**
 * Build a record-form navigation target.
 *
 * Returns:
 *   - `{ kind: 'modal' }` when the object metadata does not opt in to page
 *     mode (default behavior — preserves backward compatibility).
 *   - `{ kind: 'page', url }` when `objectDef.editMode === 'page'`. The
 *     URL points at `/{baseUrl}/{objectName}/new` for create, or
 *     `/{baseUrl}/{objectName}/record/{recordId}/edit` for edit. The
 *     `recordId` is derived from `record.id` or `record._id`, falling
 *     back to create-mode if neither is present.
 *
 * Notes:
 *   - Returns `{ kind: 'modal' }` when `objectDef` is missing or has no
 *     `name` — the caller (AppContent) treats this as "no actionable
 *     state" and falls back to the existing modal flow.
 *   - `recordId` is URL-encoded so non-ASCII / reserved characters in
 *     object IDs (e.g. UUIDs with `:` separators) are safe.
 */
export function resolveRecordFormTarget(opts: {
  objectDef: ObjectDefinitionForNavigation | null | undefined;
  baseUrl: string;
  record: { id?: string | number; _id?: string | number } | null | undefined;
}): RecordFormTarget {
  const { objectDef, baseUrl, record } = opts;

  if (!objectDef?.name || objectDef.editMode !== 'page') {
    return { kind: 'modal' };
  }

  const rawId = record?.id ?? record?._id;
  if (record && rawId != null && rawId !== '') {
    const encoded = encodeURIComponent(String(rawId));
    return {
      kind: 'page',
      url: `${baseUrl}/${objectDef.name}/record/${encoded}/edit`,
    };
  }

  return { kind: 'page', url: `${baseUrl}/${objectDef.name}/new` };
}

/**
 * Action descriptor accepted by the navigate-create / navigate-edit
 * handlers. Loose-typed because the same shape is constructed dynamically
 * from JSON metadata at runtime and we want the helpers to be tolerant of
 * legacy or hand-authored inputs.
 */
export interface NavigationActionDef {
  /** Optional explicit object name (overrides any context). */
  objectName?: string;
  /** Optional explicit record id (only meaningful for `navigate_edit`). */
  recordId?: string | number;
  /** Standard params bag — preferred location for objectName / recordId. */
  params?: {
    objectName?: string;
    recordId?: string | number;
    [key: string]: any;
  };
}

/**
 * Optional context typically supplied by an `ActionRunner` (e.g. when the
 * action button is mounted inside an `ObjectView`, the view registers its
 * `objectName` and `baseUrl` on the runner so action JSON can omit them).
 *
 * Tolerant of additional unknown keys because the upstream
 * `ActionRunner.getContext()` returns a generic `ActionContext` with an
 * open index signature; we only read the two fields we care about.
 */
export interface NavigationActionContext {
  objectName?: string;
  baseUrl?: string;
  [key: string]: unknown;
}

export type NavigationActionResult =
  | { success: true; url: string }
  | { success: false; error: string };

/**
 * Resolve the URL for a `navigate_create` action.
 *
 * Order of precedence for `objectName`:
 *   1. `action.params.objectName`
 *   2. `action.objectName`
 *   3. `context.objectName`
 *
 * `baseUrl` falls back to `context.baseUrl`, then to the supplied
 * `defaultBaseUrl` (typically `/apps/{appName}`).
 *
 * Returns `{ success: false }` with a descriptive error when `objectName`
 * cannot be resolved — the caller (`ActionRunner`) surfaces this to the UI.
 */
export function resolveNavigateCreateUrl(opts: {
  action: NavigationActionDef;
  context?: NavigationActionContext;
  defaultBaseUrl: string;
}): NavigationActionResult {
  const { action, context = {}, defaultBaseUrl } = opts;
  const objectName =
    action.params?.objectName ?? action.objectName ?? context.objectName;
  const baseUrl = context.baseUrl ?? defaultBaseUrl;
  if (!objectName) {
    return {
      success: false,
      error: 'navigate_create: objectName is required',
    };
  }
  return { success: true, url: `${baseUrl}/${objectName}/new` };
}

/**
 * Resolve the URL for a `navigate_edit` action.
 *
 * Same `objectName` precedence as {@link resolveNavigateCreateUrl}.
 * `recordId` is read from `action.params.recordId` or `action.recordId`
 * (no context fallback — record ids are intrinsically per-action).
 *
 * Returns `{ success: false }` with a descriptive error when either
 * `objectName` or `recordId` is missing.
 */
export function resolveNavigateEditUrl(opts: {
  action: NavigationActionDef;
  context?: NavigationActionContext;
  defaultBaseUrl: string;
}): NavigationActionResult {
  const { action, context = {}, defaultBaseUrl } = opts;
  const objectName =
    action.params?.objectName ?? action.objectName ?? context.objectName;
  const recordId = action.params?.recordId ?? action.recordId;
  const baseUrl = context.baseUrl ?? defaultBaseUrl;
  if (!objectName || recordId == null || recordId === '') {
    return {
      success: false,
      error: 'navigate_edit: objectName and recordId are required',
    };
  }
  const encoded = encodeURIComponent(String(recordId));
  return {
    success: true,
    url: `${baseUrl}/${objectName}/record/${encoded}/edit`,
  };
}
