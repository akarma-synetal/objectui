// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MetadataResourceEditPage — generic AutoForm-driven editor (Phase 3c).
 *
 * What it does:
 *   1. Fetches the layered view (`?layers=true`) so the user sees code
 *      vs overlay vs effective.
 *   2. Renders a SchemaForm against the JSONSchema in the type's
 *      `/meta/types` registry row.
 *   3. Save → PUT, with automatic destructive-change handling: a 409
 *      `destructive_change` response opens a confirmation dialog
 *      listing the issues, and on confirm we retry with `?force=true`.
 *   4. Reset overlay → DELETE (overlay only).
 *   5. References tab → calls `client.references()` and lists
 *      back-pointers so admins know what will break before deleting.
 *
 * Works for any of the 27 metadata types — bespoke editors (Object,
 * Field, View, Permission Matrix) opt out by registering a custom
 * EditPage via `registerMetadataResource()`.
 */

import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Save,
  RotateCcw,
  Trash2,
  History,
  Link2,
  Loader2,
  AlertTriangle,
  Layers3,
  Boxes,
  Eye,
  Pencil,
  X,
  PanelRightClose,
  PanelRightOpen,
  Maximize2,
  Minimize2,
  MousePointer2,
  SlidersHorizontal,
  FileCode2,
  Zap,
  ZapOff,
  Send,
  Undo2,
} from 'lucide-react';
import { Button } from '@object-ui/components';
import { Badge } from '@object-ui/components';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@object-ui/components';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@object-ui/components';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@object-ui/components';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import type {
  MetadataLayered,
  MetadataReference,
} from '@object-ui/data-objectstack';
import { PageShell } from './PageShell';
import { LayeredDiff, countOverlaidFields } from './LayeredDiff';
import { SchemaForm, type SchemaFormIssue } from './SchemaForm';
import {
  useMetadataClient,
  useMetadataTypes,
  type RichMetadataTypeEntry,
} from './useMetadata';
import {
  getMetadataResource,
  resolveResourceConfig,
  listAnchorsFor,
} from './registry';
import { RelatedPanel, type RelatedTarget } from './RelatedPanel';
import { MetadataDetailDrawer } from './MetadataDetailDrawer';
import { HistoryPanel } from './ResourceHistoryPage';
import { getMetadataPreview, type MetadataSelection } from './preview-registry';
import { getMetadataInspector } from './inspector-registry';
import { detectLocale, t, tFormat } from './i18n';

// react-resizable-panels' `direction` prop type does not always narrow
// cleanly in our TS config; cast at the boundary (precedent:
// packages/components/src/custom/navigation-overlay.tsx).
const PanelGroup = ResizablePanelGroup as React.FC<any>;

/**
 * Normalize the framework's draft envelope into either the draft body or
 * `null` (no pending draft). The envelope is:
 *
 *   - `{ type, name, item: {...} }` when a draft exists,
 *   - `{ type, name, label }`       when no draft exists (HTTP 200, item absent).
 *
 * The presence of the `item` key is the single signal; we do NOT fall back
 * to using the envelope itself as the body — doing so would mis-identify the
 * "no draft" stub (which still has `type`/`name`/`label` keys) as a real
 * pending draft and would corrupt the editor baseline.
 */
function extractDraftBody(
  draftResp: unknown,
): Record<string, unknown> | null {
  if (!draftResp || typeof draftResp !== 'object') return null;
  const env = draftResp as Record<string, unknown>;
  if (!('item' in env)) return null;
  const body = env.item;
  if (!body || typeof body !== 'object') return null;
  return Object.keys(body as object).length > 0
    ? (body as Record<string, unknown>)
    : null;
}

export interface MetadataResourceEditPageProps {
  type?: string;
  name?: string;
  /** When true, this is the Create flow (skip initial fetch). */
  createMode?: boolean;
  /**
   * When true, the editor is rendered inside another surface (e.g.
   * the Related drawer). Hides Related-tab and URL-sync so the inner
   * page does not fight the outer page for `?tab` / `?open`.
   */
  embedded?: boolean;
}

export function MetadataResourceEditPage({
  type: typeProp,
  name: nameProp,
  createMode = false,
  embedded = false,
}: MetadataResourceEditPageProps) {
  const params = useParams<{ type?: string; name?: string }>();
  const type = typeProp ?? params.type ?? '';
  const name = nameProp ?? params.name ?? '';
  const navigate = useNavigate();
  const client = useMetadataClient();
  const { entries } = useMetadataTypes(client);
  const entry: RichMetadataTypeEntry | undefined = entries.find((t) => t.type === type);
  const config = resolveResourceConfig(type, entry);
  const locale = React.useMemo(() => detectLocale(), []);

  // Custom editor takes over.
  const customConfig = getMetadataResource(type);
  if (customConfig?.EditPage && !createMode) {
    const Custom = customConfig.EditPage;
    return <Custom type={type} name={name} />;
  }
  if (customConfig?.CreatePage && createMode) {
    const Custom = customConfig.CreatePage;
    return <Custom type={type} />;
  }

  const [layered, setLayered] = React.useState<MetadataLayered<any> | null>(null);
  const [draft, setDraft] = React.useState<Record<string, unknown>>(
    createMode ? { name: '' } : {},
  );
  const [refs, setRefs] = React.useState<MetadataReference[] | null>(null);
  const [loading, setLoading] = React.useState(!createMode);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [issues, setIssues] = React.useState<SchemaFormIssue[]>([]);
  const [destructiveIssues, setDestructiveIssues] = React.useState<
    null | Array<{ kind?: string; path?: string; message?: string }>
  >(null);
  const [pendingItem, setPendingItem] = React.useState<unknown>(null);
  // Per-item draft pending publish (mode=draft saves land here).
  // When non-null, the editor is "viewing the draft" and we surface
  // Publish / Discard-draft actions.
  const [hasDraft, setHasDraft] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  // Bumped by destructive operations (rollback / discard-draft) to
  // force the load effect to refetch layered + draft state.
  const [reloadKey, setReloadKey] = React.useState(0);

  // Form edit mode. The form is read-only by default — admins land in a
  // "view" state and must click Edit to mutate, mirroring the Salesforce /
  // Notion convention. createMode is always editing (you can't view what
  // doesn't exist yet). Truly read-only types (no allowOrgOverride) stay
  // read-only regardless.
  const [editing, setEditing] = React.useState<boolean>(!!createMode);
  // Currently selected sub-element (e.g. a dashboard widget). The
  // preview emits this; the inspector consumes it. Must live above
  // any early returns to preserve hook order — reset on item
  // navigation or when leaving edit mode below.
  const [selection, setSelection] = React.useState<MetadataSelection | null>(null);
  React.useEffect(() => {
    setSelection(null);
  }, [type, name]);
  React.useEffect(() => {
    if (!editing) setSelection(null);
  }, [editing]);
  // Snapshot of the last saved draft. Used by Cancel to revert in-flight
  // edits, and as the source-of-truth when entering edit mode.
  const draftSnapshotRef = React.useRef<Record<string, unknown> | null>(null);

  // Last successful save timestamp — surfaced as "Saved HH:MM" indicator
  // next to the icon-only Save button.
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null);

  // Auto-save toggle, persisted per-browser. Defaults to on for an
  // "it just works" experience; users can disable it from the toolbar.
  const [autoSaveEnabled, setAutoSaveEnabled] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = window.localStorage.getItem('metadata-admin:autosave');
      return v === null ? true : v === '1';
    } catch {
      return true;
    }
  });
  React.useEffect(() => {
    try {
      window.localStorage.setItem('metadata-admin:autosave', autoSaveEnabled ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [autoSaveEnabled]);
  // Tracks the last draft snapshot we attempted to auto-save, so a
  // validation failure does not loop on the same payload — auto-save
  // only retries once the user mutates the draft again.
  const lastAutoSaveSnapshotRef = React.useRef<string | null>(null);

  // Prefetch object name list once — fuels the `ref:object` widget.
  // We don't block render on it; the widget shows a "Loading…" state.
  const [objectNames, setObjectNames] = React.useState<string[]>([]);
  const [objectsLoading, setObjectsLoading] = React.useState(true);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = (await client.list('object')) as Array<{ name?: string }>;
        if (cancelled) return;
        setObjectNames(
          list.map((x) => x?.name).filter((n): n is string => !!n).sort(),
        );
      } catch {
        if (!cancelled) setObjectNames([]);
      } finally {
        if (!cancelled) setObjectsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);
  const widgetContext = React.useMemo(
    () => ({ objectNames, objectsLoading }),
    [objectNames, objectsLoading],
  );

  // Load layered view + initial draft.
  React.useEffect(() => {
    if (createMode) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [lay, draftResp] = await Promise.all([
          client.layered<any>(type, name),
          // Draft reads are best-effort — a 404/error must not block
          // the page; readers without overlay-write permission still
          // see the published item.
          client.getDraft<any>(type, name).catch(() => null),
        ]);
        if (cancelled) return;
        setLayered(lay);
        // Surface server-computed load-time validation errors as inline
        // SchemaForm issues — operators see what's wrong with the
        // saved metadata immediately, not just on the next Save round-trip.
        const loadDiag = (lay as any)?._diagnostics as
          | { valid: boolean; errors?: Array<{ path: string; message: string }> }
          | undefined;
        if (loadDiag && loadDiag.valid === false && Array.isArray(loadDiag.errors)) {
          setIssues(
            loadDiag.errors.map((e) => ({
              path: e.path || '',
              message: e.message,
            })),
          );
        } else {
          setIssues([]);
        }
        // Draft envelope from the framework is `{ type, name, item }`;
        // an empty/missing item means "no pending draft".
        const draftReal = extractDraftBody(draftResp);
        // Prefer the pending draft as the editing baseline — the
        // operator is mid-flight on this item and should see their
        // own in-progress state, not the last published version.
        const initial = (draftReal
          ?? lay.effective
          ?? lay.code
          ?? {}) as Record<string, unknown>;
        setDraft(initial);
        draftSnapshotRef.current = initial;
        setHasDraft(!!draftReal);
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? String(err));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, type, name, createMode, reloadKey]);

  // Lazy-load references the first time the References sheet opens.
  const [refsLoading, setRefsLoading] = React.useState(false);
  async function loadReferences() {
    if (refs != null || refsLoading) return;
    setRefsLoading(true);
    try {
      const r = await client.references(type, name);
      setRefs(r);
    } catch (err: any) {
      // Surface as empty list; non-blocking.
      setRefs([]);
      console.error('references() failed', err);
    } finally {
      setRefsLoading(false);
    }
  }

  // Related drawer state. `null` = closed. We avoid querystring round-
  // trips on every keystroke; URL state is best-effort sync via effect
  // below.
  const [relatedTarget, setRelatedTarget] = React.useState<RelatedTarget | null>(null);

  const hasAnchors = React.useMemo(
    () => !createMode && !embedded && listAnchorsFor(type).length > 0,
    [type, createMode, embedded],
  );

  // Read ?tab and ?open on first mount so deep-links work. Embedded
  // items are not deep-linkable (they live in the parent body and need
  // the parent payload to materialise) so we only restore metadata
  // targets here.
  const initialTabRef = React.useRef<string | null>(null);

  const [openSheet, setOpenSheet] =
    React.useState<'layers' | 'references' | 'related' | 'history' | null>(null);

  // Inspector tabs: properties form vs raw JSON source view. Source view
  // is for power users who need to edit fields the form doesn't expose
  // (e.g. nested arrays). Tracked locally — not persisted between
  // navigations since most users live in the form 99% of the time.
  const [inspectorTab, setInspectorTab] =
    React.useState<'properties' | 'source'>('properties');

  // When the References sheet opens, lazy-load the data (idempotent).
  // Also keep the URL `?tab=` query in sync so deep-links round-trip.
  React.useEffect(() => {
    if (openSheet === 'references') {
      void loadReferences();
    }
    if (typeof window !== 'undefined' && !embedded) {
      const url = new URL(window.location.href);
      if (openSheet) url.searchParams.set('tab', openSheet);
      else url.searchParams.delete('tab');
      window.history.replaceState({}, '', url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSheet, embedded]);

  // Designer-style split-panel state. The inspector (right form panel)
  // can collapse to give the preview the full canvas. The collapsed
  // state is persisted in localStorage so the user's preference sticks
  // across navigations.
  const inspectorStorageKey = 'metadata-edit:inspector-collapsed';
  const inspectorSizeStorageKey = 'metadata-edit:inspector-size';
  const [inspectorCollapsed, setInspectorCollapsed] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(inspectorStorageKey) === '1';
  });
  // Remember the user's preferred inspector size so collapsing then
  // re-expanding restores it instead of leaving a sliver. react-resizable-
  // panels' built-in expand() returns to the size right before collapse
  // which is often near 0, hence the explicit memory.
  const lastInspectorSizeRef = React.useRef<number>(38);
  // Hydrate from localStorage on mount.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = Number(window.localStorage.getItem(inspectorSizeStorageKey));
    if (Number.isFinite(v) && v >= 22 && v <= 80) {
      lastInspectorSizeRef.current = v;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inspectorPanelRef = React.useRef<any>(null);
  const toggleInspector = React.useCallback(() => {
    setInspectorCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(inspectorStorageKey, next ? '1' : '0');
      }
      return next;
    });
  }, []);
  // Drive the imperative panel resize from a state-change effect rather
  // than inside the setter — the latter runs before React has committed
  // the new state and react-resizable-panels can race with its own
  // onResize observer, producing tiny re-expanded sizes.
  // ⚠️ resize() treats numeric values as **pixels**; pass a string to
  // get a percentage. resize(38) → 38px (~2.7%); resize('38%') → 38%.
  React.useEffect(() => {
    const handle = inspectorPanelRef.current;
    if (!handle) return;
    if (inspectorCollapsed) {
      handle.resize?.('0%');
    } else {
      const target = lastInspectorSizeRef.current || 38;
      handle.resize?.(`${target}%`);
    }
  }, [inspectorCollapsed]);

  // Canvas-local UX state — preview-only view (hides design chrome
  // without dropping dirty edits) and fullscreen (canvas takes over the
  // viewport so designers can focus). Both are session-scoped.
  const [previewOnly, setPreviewOnly] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  // Lock body scroll while fullscreen so the underlying page can't peek
  // through and the user's scroll position is preserved on exit.
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFullscreen]);
  // Escape exits fullscreen.
  React.useEffect(() => {
    if (typeof window === 'undefined' || !isFullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsFullscreen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  // Auto-enable design mode for designer-capable types. We do this once
  // per (type,name) navigation so the user lands in the productive
  // state instead of having to click "Edit". Truly read-only types
  // (canWrite=false) keep the old behavior. The check happens inside
  // the effect to avoid hook-order issues with the early `loading`
  // return below.
  const designerAutoOnRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    designerAutoOnRef.current = null;
  }, [type, name]);
  React.useEffect(() => {
    if (createMode || embedded || loading) return;
    const key = `${type}/${name ?? ''}`;
    if (designerAutoOnRef.current === key) return;
    const PC = getMetadataPreview(type);
    if (!PC) return;
    const isArtifact = layered?.code != null;
    const cw = isArtifact
      ? !!entry?.allowOrgOverride
      : !!(entry?.allowOrgOverride || entry?.allowRuntimeCreate);
    if (!cw) return;
    designerAutoOnRef.current = key;
    setEditing(true);
  }, [type, name, createMode, embedded, loading, entry, layered]);

  // Keyboard shortcut: Cmd/Ctrl+\ toggles the inspector. This is the
  // designer convention shared by Figma, VS Code (Cmd+B), Sketch — `\`
  // sits next to Return so it's reachable one-handed.
  React.useEffect(() => {
    if (typeof window === 'undefined' || embedded) return;
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.shiftKey || e.altKey) return;
      if (e.key !== '\\') return;
      // Ignore when typing in an editor (textarea / contenteditable).
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      toggleInspector();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [embedded, toggleInspector]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || embedded) return;
    const sp = new URLSearchParams(window.location.search);
    const tab = sp.get('tab');
    if (tab === 'layers' || tab === 'references' || tab === 'related') {
      setOpenSheet(tab);
    }
    initialTabRef.current = tab;
    const open = sp.get('open');
    if (open && open.includes(':')) {
      const [t, n] = open.split(':', 2);
      if (t && n) setRelatedTarget({ kind: 'metadata', type: t, name: n });
    }
    // intentionally empty deps — first mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect drawer target into the URL so refresh/share works.
  React.useEffect(() => {
    if (typeof window === 'undefined' || embedded) return;
    const url = new URL(window.location.href);
    if (relatedTarget?.kind === 'metadata') {
      url.searchParams.set('open', `${relatedTarget.type}:${relatedTarget.name}`);
    } else {
      url.searchParams.delete('open');
    }
    window.history.replaceState({}, '', url.toString());
  }, [relatedTarget, embedded]);

  async function doSave(force: boolean) {
    setSaving(true);
    setError(null);
    setIssues([]);
    try {
      // Ensure `name` is set on create.
      const itemToSave = createMode
        ? { ...draft, name: String(draft.name ?? name) }
        : draft;
      const savedName = String(itemToSave.name ?? name);
      if (!savedName) {
        setError('A name is required.');
        setSaving(false);
        return;
      }
      // Save lands in the draft buffer — the runtime keeps serving the
      // last published version until the operator clicks Publish. The
      // backend defaults to publish mode for backward-compatibility, so
      // Studio must opt into draft explicitly.
      await client.save<any>(type, savedName, itemToSave, { force, mode: 'draft' });
      // Refresh layered + draft state after save.
      const [lay, draftResp] = await Promise.all([
        client.layered<any>(type, savedName),
        client.getDraft<any>(type, savedName).catch(() => null),
      ]);
      setLayered(lay);
      const draftReal = extractDraftBody(draftResp);
      setHasDraft(!!draftReal);
      const fresh = (draftReal ?? lay.effective ?? itemToSave) as Record<string, unknown>;
      setDraft(fresh);
      draftSnapshotRef.current = fresh;
      setLastSavedAt(new Date());
      lastAutoSaveSnapshotRef.current = JSON.stringify(fresh);
      setDestructiveIssues(null);
      setPendingItem(null);
      // Stay in design mode after save for designer-capable types so the
      // user keeps their inspector context. Non-designer types fall back
      // to the previous "exit edit on save" UX.
      const stayInEditing = !createMode && !!getMetadataPreview(type);
      if (!createMode && !stayInEditing) setEditing(false);
      if (createMode) {
        navigate(`../${encodeURIComponent(savedName)}`, { relative: 'path' });
      }
    } catch (err: any) {
      // Map destructive change → confirmation dialog.
      if (err?.status === 409 && err?.code === 'destructive_change') {
        const i = err?.body?.issues ?? [];
        setDestructiveIssues(Array.isArray(i) ? i : []);
        setPendingItem(draft);
      }
      // Map schema validation → inline field errors.
      else if (err?.status === 422 || err?.code === 'invalid_metadata' || err?.code === 'invalid_payload') {
        const i = err?.body?.issues ?? [];
        let mapped: SchemaFormIssue[] = (Array.isArray(i) ? i : []).map((x: any) => ({
          path: Array.isArray(x.path) ? x.path.join('.') : String(x.path ?? ''),
          message: String(x.message ?? 'Invalid'),
        }));
        // Backend's invalid_metadata sometimes returns a flat string like
        // "<type>/<name> failed spec validation: <path>: <message>".
        // Parse it into a single inline issue + summary so users see the
        // real problem instead of "0 issues".
        const raw: string = String(err?.body?.error ?? err?.message ?? '');
        if (mapped.length === 0 && raw) {
          const m = raw.match(/failed spec validation:\s*(.+?):\s*(.+)$/);
          if (m) {
            mapped = [{ path: m[1].trim(), message: m[2].trim() }];
          } else {
            mapped = [{ path: '', message: raw }];
          }
        }
        setIssues(mapped);
        if (mapped.length === 1 && !mapped[0].path) {
          setError(mapped[0].message);
        } else if (mapped.length === 1) {
          setError(`${mapped[0].path}: ${mapped[0].message}`);
        } else {
          setError(`Validation failed (${mapped.length} issues).`);
        }
      } else {
        setError(err?.message ?? String(err));
      }
    } finally {
      setSaving(false);
    }
  }

  async function doReset() {
    // Two semantics:
    //   - artifact-backed item: "Reset overlay" — keep the code default.
    //   - DB-only item: "Delete" — the item disappears entirely (no
    //     artifact baseline to fall back to). Navigate back to the list
    //     since the current URL no longer refers to anything.
    const itemIsArtifact = !createMode && layered?.code != null;
    const confirmKey = itemIsArtifact
      ? 'engine.edit.resetConfirm'
      : 'engine.edit.deleteConfirm';
    if (!confirm(tFormat(confirmKey, locale, { type, name: name ?? '' }))) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await client.reset(type, name);
      if (itemIsArtifact) {
        const lay = await client.layered<any>(type, name);
        setLayered(lay);
        const fresh = (lay.effective ?? lay.code ?? {}) as Record<string, unknown>;
        setDraft(fresh);
        draftSnapshotRef.current = fresh;
        // Designer-capable types stay in design mode; allow the auto-on
        // effect to re-trigger after this reset.
        if (getMetadataPreview(type)) {
          designerAutoOnRef.current = null;
        } else {
          setEditing(false);
        }
      } else {
        // No artifact baseline → return to the list view.
        navigate(`../`, { relative: 'path' });
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  // Promote the pending draft to the active overlay. Mirrors `doSave`'s
  // refresh pattern so the editor stays in sync with the new baseline.
  async function doPublish() {
    setPublishing(true);
    setError(null);
    try {
      await client.publish<any>(type, name);
      const [lay, draftResp] = await Promise.all([
        client.layered<any>(type, name),
        client.getDraft<any>(type, name).catch(() => null),
      ]);
      setLayered(lay);
      const draftReal = extractDraftBody(draftResp);
      setHasDraft(!!draftReal);
      const fresh = (draftReal ?? lay.effective ?? draft) as Record<string, unknown>;
      setDraft(fresh);
      draftSnapshotRef.current = fresh;
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setPublishing(false);
    }
  }

  // Discard the pending draft (`DELETE ?state=draft`). The published
  // overlay is untouched; the editor reverts to showing the live body.
  async function doDiscardDraft() {
    if (!confirm(tFormat('engine.edit.discardDraftConfirm', locale, { type, name: name ?? '' }))) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await client.reset(type, name, { state: 'draft' });
      const lay = await client.layered<any>(type, name);
      setLayered(lay);
      const fresh = (lay.effective ?? lay.code ?? {}) as Record<string, unknown>;
      setDraft(fresh);
      draftSnapshotRef.current = fresh;
      setHasDraft(false);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  // Dirty detection: cheap structural comparison via JSON. The draft is
  // small (a single metadata record) so this is fine on each render.
  // Used to surface an "unsaved" indicator next to the Save button.
  // Must be declared BEFORE any early returns to preserve hook order.
  const isDirty = React.useMemo(() => {
    if (createMode) return Object.keys(draft).length > 0;
    const snap = draftSnapshotRef.current;
    if (!snap) return false;
    try {
      return JSON.stringify(draft) !== JSON.stringify(snap);
    } catch {
      return false;
    }
  }, [draft, createMode]);

  // Two-tier authorization (PR-10d.7) — hoisted above the early `loading`
  // return so the auto-save / keyboard / blocker effects below can read
  // them. Recomputed cheaply on every render.
  //   - artifact-backed items (layered.code != null) need allowOrgOverride
  //   - DB-only items (no artifact) need allowOrgOverride OR allowRuntimeCreate
  //   - createMode is always writable (the server will gate on intent)
  const isArtifactItem = !createMode && layered?.code != null;
  const canWrite = createMode
    ? !!(entry?.allowOrgOverride || entry?.allowRuntimeCreate)
    : isArtifactItem
      ? !!entry?.allowOrgOverride
      : !!(entry?.allowOrgOverride || entry?.allowRuntimeCreate);
  const readOnly = !canWrite && !createMode;

  // Auto-save: debounce edits and persist silently once the user pauses
  // for AUTOSAVE_DEBOUNCE_MS. Skipped for create mode (need an explicit
  // name first), read-only forms, and while a save is already in flight.
  // We track the last attempted snapshot so a validation failure doesn't
  // loop on the same payload — the user has to mutate the draft again.
  const AUTOSAVE_DEBOUNCE_MS = 1500;
  // Keep doSave fresh inside the effect without re-arming the timer on
  // every render.
  const doSaveRef = React.useRef(doSave);
  React.useEffect(() => {
    doSaveRef.current = doSave;
  });
  React.useEffect(() => {
    if (!autoSaveEnabled) return;
    if (createMode || readOnly || !editing || !isDirty || saving) return;
    let snap: string;
    try {
      snap = JSON.stringify(draft);
    } catch {
      return;
    }
    if (snap === lastAutoSaveSnapshotRef.current) return;
    const handle = window.setTimeout(() => {
      lastAutoSaveSnapshotRef.current = snap;
      doSaveRef.current(false);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draft, isDirty, editing, saving, createMode, readOnly, autoSaveEnabled]);

  // Keyboard shortcut — ⌘S / Ctrl+S triggers save when dirty.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        if (!canWrite || readOnly) return;
        if (!editing && !createMode) return;
        e.preventDefault();
        if (!saving && (createMode || isDirty)) {
          doSaveRef.current(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canWrite, readOnly, editing, createMode, saving, isDirty]);

  // Beforeunload guard — browser-native "leave site?" prompt when the
  // user closes the tab / reloads with unsaved changes.
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required for Chrome to actually show the prompt.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // In-app navigation guard — intercept anchor / link clicks before the
  // router consumes them. Cheaper and more compatible than useBlocker,
  // which requires a data router (the host app uses BrowserRouter).
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      // Allow new-tab / download / external links — they don't replace
      // the current page.
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
      } catch {
        return;
      }
      if (!confirm(t('engine.edit.unsavedLeaveConfirm', locale))) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [isDirty, locale]);

  if (loading) {
    return (
      <PageShell entry={entry} itemName={name}>
        <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading {type}/{name}…
        </div>
      </PageShell>
    );
  }

  const schema =
    (entry?.schema as Record<string, unknown> | undefined) ??
    (config.defaultSchema as Record<string, unknown> | undefined);

  // Banner variant: when type ships with allowRuntimeCreate but this
  // specific item is locked because it comes from a code package, we
  // show a different message inviting the user to create their own.
  const showArtifactLockedBanner =
    readOnly && isArtifactItem && !!entry?.allowRuntimeCreate;

  // Preview tab — opt-in via `registerMetadataPreview()`. Hidden in
  // create mode (nothing to preview yet) and inside the embedded
  // drawer (the parent context owns the preview surface).
  const PreviewComponent = !createMode && !embedded ? getMetadataPreview(type) : undefined;

  // Optional scoped inspector for the selected sub-element (e.g. a
  // dashboard widget). Registered separately via
  // `registerMetadataInspector()` so a type can opt in independently
  // of having a Preview, and so plugins can swap implementations.
  const InspectorComponent = getMetadataInspector(type);

  // Cancel edits: revert the draft to the last saved snapshot and exit
  // edit mode. Safe to call even with no snapshot (no-op).
  function doCancelEdit() {
    if (draftSnapshotRef.current) {
      setDraft(draftSnapshotRef.current);
    }
    setIssues([]);
    setError(null);
    setEditing(false);
  }

  // When the form is "live" but not yet in edit mode, it renders as
  // read-only. createMode is always editing; truly read-only types
  // (no allowOrgOverride) ignore the editing toggle entirely.
  const formReadOnly = readOnly || (!editing && !createMode);

  // Note: URL `?tab=` deep-links were repurposed to open side-panel
  // sheets (Layers / References / Related). Anything else is ignored —
  // the main work area is always the form+preview.

  // Action group rendered identically in either the PageShell header
  // (form-only types) or the canvas toolbar (types with a PreviewComponent).
  // Centralising it lets us merge the two top bars into one when a
  // designer is present, saving a full row of vertical chrome.
  const actionsNode = (
    <>
      {/* Info sheets — icon-only group, mirrors the canvas
          toolbar style (small ghost icons + tooltip). Keeps
          the primary edit / save actions visually dominant. */}
      {(!createMode || hasAnchors) && (
        <div className="flex items-center rounded-md border bg-background p-0.5">
          {!createMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpenSheet('layers')}
              title={t('engine.edit.layers', locale)}
              className="h-7 w-7 p-0 relative"
            >
              <Layers3 className="h-3.5 w-3.5" />
              {layered?.overlay && (() => {
                const n = countOverlaidFields(layered.code, layered.effective);
                return n > 0 ? (
                  <span
                    className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-emerald-600 text-emerald-50 text-[9px] leading-[14px] text-center font-medium"
                    title={t('engine.layers.diff', locale)}
                  >
                    {n}
                  </span>
                ) : null;
              })()}
            </Button>
          )}
          {!createMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpenSheet('references')}
              title={t('engine.edit.references', locale)}
              className="h-7 w-7 p-0 relative"
            >
              <Link2 className="h-3.5 w-3.5" />
              {refs && refs.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-muted text-foreground text-[9px] leading-[14px] text-center font-medium border">
                  {refs.length}
                </span>
              )}
            </Button>
          )}
          {hasAnchors && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpenSheet('related')}
              title={t('engine.edit.related', locale)}
              className="h-7 w-7 p-0"
            >
              <Boxes className="h-3.5 w-3.5" />
            </Button>
          )}
          {!createMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpenSheet('history')}
              title={t('engine.edit.history', locale)}
              className="h-7 w-7 p-0"
            >
              <History className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
      {!createMode && canWrite && layered?.overlay && (
        <Button
          variant="ghost"
          size="sm"
          onClick={doReset}
          disabled={saving}
          title={
            isArtifactItem
              ? t('engine.edit.reset', locale)
              : t('engine.edit.delete', locale)
          }
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
        >
          {isArtifactItem ? (
            <RotateCcw className="h-3.5 w-3.5" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      {/* Edit-mode toggle.
          - Designer types (with PreviewComponent): always editing.
            The Design / Preview toggle in the canvas toolbar takes the
            place of an Edit / Cancel binary — users switch to Preview
            to see the rendered result, no "leave edit mode" needed.
          - Form-only types: keep the Salesforce-style Edit / Cancel
            convention (View → click Edit → mutate → Save or Cancel).
          - createMode: always editing, Save only.
          - Truly read-only types (no allowOrgOverride): no buttons. */}
      {canWrite && !createMode && !editing && !PreviewComponent && (
        <Button size="sm" onClick={() => setEditing(true)} className="h-7">
          <Pencil className="h-3.5 w-3.5 mr-1" />
          {t('engine.edit.edit', locale)}
        </Button>
      )}
      {canWrite && (editing || createMode) && (
        <SaveStatusIndicator
          saving={saving}
          isDirty={isDirty}
          autoSaveEnabled={autoSaveEnabled}
          lastSavedAt={lastSavedAt}
          createMode={!!createMode}
          locale={locale}
        />
      )}
      {canWrite && (editing || createMode) && !createMode && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAutoSaveEnabled((v) => !v)}
          className="h-7 w-7 p-0 text-muted-foreground"
          title={
            autoSaveEnabled
              ? t('engine.edit.autoSaveOn', locale)
              : t('engine.edit.autoSaveOff', locale)
          }
        >
          {autoSaveEnabled ? (
            <Zap className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <ZapOff className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      {canWrite && !createMode && editing && !PreviewComponent && (
        <Button
          variant="ghost"
          size="sm"
          onClick={doCancelEdit}
          disabled={saving}
          className="h-7 w-7 p-0"
          title={t('engine.cancel', locale)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
      {canWrite && (editing || createMode) && (
        <Button
          size="sm"
          onClick={() => doSave(false)}
          disabled={saving || (!createMode && !isDirty)}
          className="h-7 w-7 p-0 relative"
          title={
            saving
              ? t('engine.edit.saving', locale)
              : !createMode && !isDirty
                ? t('engine.edit.noChanges', locale)
                : `${t('engine.edit.save', locale)} (⌘S)`
          }
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {isDirty && !saving && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 inline-block h-2 w-2 rounded-full bg-amber-300 ring-2 ring-background"
            />
          )}
        </Button>
      )}
      {/* Publish / Discard draft — only when there is a pending draft.
          Save writes to the draft buffer; the runtime keeps serving the
          published version until the operator clicks Publish. */}
      {canWrite && !createMode && hasDraft && (
        <Button
          variant="ghost"
          size="sm"
          onClick={doDiscardDraft}
          disabled={saving || publishing}
          className="h-7 w-7 p-0 text-muted-foreground"
          title={t('engine.edit.discardDraft', locale)}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
      )}
      {canWrite && !createMode && hasDraft && (
        <Button
          size="sm"
          onClick={doPublish}
          disabled={saving || publishing || isDirty}
          className="h-7 px-2 relative bg-emerald-600 hover:bg-emerald-700 text-emerald-50"
          title={
            isDirty
              ? t('engine.edit.publishBlockedDirty', locale)
              : t('engine.edit.publish', locale)
          }
        >
          {publishing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Send className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">{t('engine.edit.publish', locale)}</span>
            </>
          )}
        </Button>
      )}
    </>
  );

  return (
    <PageShell
      entry={entry ?? { type, label: type }}
      itemName={createMode ? '(new)' : name}
      subtitle={createMode ? t('engine.edit.createNew', locale) : undefined}
      actions={PreviewComponent ? null : actionsNode}
    >
      <div
        className={
          PreviewComponent
            ? 'flex h-full min-h-0 flex-col'
            : 'p-6 space-y-6 max-w-7xl'
        }
      >
        {(error || readOnly || hasDraft) && (
          <div
            className={
              PreviewComponent
                ? 'px-6 pt-4 space-y-3'
                : 'space-y-3'
            }
          >
            {error && (
              <div className="text-sm text-destructive border border-destructive/30 rounded p-3 bg-destructive/5">
                {error}
              </div>
            )}
            {hasDraft && !createMode && (
              <div className="text-xs text-emerald-900 border border-emerald-300 bg-emerald-50 rounded p-3 dark:text-emerald-200 dark:border-emerald-700/50 dark:bg-emerald-950/30 flex items-center gap-3">
                <Send className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{t('engine.edit.draftPending', locale)}</span>
                {canWrite && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={doDiscardDraft}
                      disabled={saving || publishing}
                      className="h-7"
                    >
                      {t('engine.edit.discardDraft', locale)}
                    </Button>
                    <Button
                      size="sm"
                      onClick={doPublish}
                      disabled={saving || publishing || isDirty}
                      className="h-7 bg-emerald-600 hover:bg-emerald-700 text-emerald-50"
                    >
                      {publishing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        t('engine.edit.publish', locale)
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
            {readOnly && (
              <div className="text-xs text-amber-800 border border-amber-300 bg-amber-50 rounded p-3 dark:text-amber-200 dark:border-amber-700/50 dark:bg-amber-950/30 flex items-start gap-3">
                <div className="flex-1">
                  {showArtifactLockedBanner ? (
                    /* Type allows runtime-create but THIS item ships from
                       a code package. Tell the user clearly and provide
                       a CTA to author their own. */
                    t('engine.edit.artifactLockedBanner', locale)
                      .split(/(\{type\})/)
                      .map((part, i) => {
                        if (part === '{type}') return <code key={i} className="font-mono">{type}</code>;
                        return <React.Fragment key={i}>{part}</React.Fragment>;
                      })
                  ) : (
                    /* The platform i18n bundle ships `engine.edit.readOnlyTypeBanner`
                       with `{flag} / {type} / {override}` placeholders so the
                       monospace tokens are inlined inside the translated sentence
                       in any locale. Splitting on the three tokens preserves the
                       sentence order across translations. */
                    t('engine.edit.readOnlyTypeBanner', locale)
                      .split(/(\{flag\}|\{type\}|\{override\})/)
                      .map((part, i) => {
                        if (part === '{flag}') return <code key={i} className="font-mono">OBJECTSTACK_METADATA_WRITABLE</code>;
                        if (part === '{type}') return <code key={i} className="font-mono">{type}</code>;
                        if (part === '{override}') return <code key={i} className="font-mono">allowOrgOverride</code>;
                        return <React.Fragment key={i}>{part}</React.Fragment>;
                      })
                  )}
                </div>
                {showArtifactLockedBanner && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => navigate(`../new`, { relative: 'path' })}
                  >
                    {t('engine.list.create', locale)}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <div
          className={
            PreviewComponent
              ? 'flex w-full flex-1 min-h-0 flex-col'
              : 'w-full'
          }
        >
          <div
            className={
              PreviewComponent
                ? 'mt-2 flex-1 min-h-0 flex flex-col px-6 pb-4'
                : 'mt-4 space-y-3'
            }
          >
            {/* Read-only banner. In split mode we suppress it — the
                "可写" badge in the header plus the Edit button in the
                action bar already convey both signal and call-to-action,
                and saving every vertical pixel for the canvas matters. */}
            {!PreviewComponent && formReadOnly && !readOnly && canWrite && !createMode && (
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground border rounded p-2.5 bg-muted/30">
                <span>
                  {t('engine.edit.readOnlyBanner', locale).split(/\{edit\}/).map((part, i, arr) => (
                    <React.Fragment key={i}>
                      {part}
                      {i < arr.length - 1 && <strong>{t('engine.edit.edit', locale)}</strong>}
                    </React.Fragment>
                  ))}
                </span>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  {t('engine.edit.edit', locale)}
                </Button>
              </div>
            )}
            {(() => {
              // Server-computed load-time validation errors on the
              // effective payload — surfaced here so operators can see
              // a structural problem without saving first. The same
              // errors are also threaded into SchemaForm as `issues`
              // and rendered inline next to each broken field.
              const diag = (layered as any)?._diagnostics as
                | { valid: boolean; errors?: Array<{ path: string; message: string }> }
                | undefined;
              if (!diag || diag.valid !== false) return null;
              const errs = diag.errors ?? [];
              const head = errs.slice(0, 3);
              const rest = Math.max(0, errs.length - head.length);
              return (
                <div className="flex items-start gap-2 text-xs border rounded p-2.5 border-destructive/40 bg-destructive/[0.06] text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {tFormat('engine.edit.diagnostics.title', locale, { count: errs.length })}
                    </div>
                    <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                      {head.map((e, i) => (
                        <li key={i} className="truncate">
                          <span className="opacity-70">{e.path || '(root)'}</span>: {e.message}
                        </li>
                      ))}
                      {rest > 0 && (
                        <li className="opacity-70">
                          {tFormat('engine.edit.diagnostics.more', locale, { count: rest })}
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              );
            })()}
            {PreviewComponent ? (
              <div
                className={
                  isFullscreen
                    ? 'fixed inset-0 z-50 bg-background flex flex-col p-3'
                    : 'relative flex-1 min-h-0 flex'
                }
              >
                <PanelGroup
                  direction="horizontal"
                  className="flex-1 min-h-0 rounded-md border bg-background overflow-hidden"
                  id={`metadata-edit-${type}`}
                >
                  <ResizablePanel defaultSize={62} minSize={30}>
                    <div className="relative h-full flex flex-col">
                      {/* Canvas toolbar — owns the design/preview toggle
                          and fullscreen affordance so designers can drive
                          the canvas without round-tripping to the page
                          header. In fullscreen we also surface Save /
                          Cancel / Inspector controls here since the
                          PageShell header is hidden. */}
                      <div className="flex items-center justify-between gap-2 border-b bg-background/95 backdrop-blur px-3 py-2 sticky top-0 z-10">
                        <div className="flex items-center gap-1">
                          {canWrite && (
                            <div
                              role="tablist"
                              aria-label={t('engine.edit.designer', locale)}
                              className="inline-flex items-center rounded-md border bg-muted/40 p-0.5"
                            >
                              <button
                                type="button"
                                role="tab"
                                aria-selected={!previewOnly}
                                onClick={() => setPreviewOnly(false)}
                                className={
                                  'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ' +
                                  (!previewOnly
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground')
                                }
                                title={t('engine.edit.designMode', locale)}
                              >
                                <MousePointer2 className="h-3.5 w-3.5" />
                                {t('engine.edit.designMode', locale)}
                              </button>
                              <button
                                type="button"
                                role="tab"
                                aria-selected={previewOnly}
                                onClick={() => setPreviewOnly(true)}
                                className={
                                  'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ' +
                                  (previewOnly
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground')
                                }
                                title={t('engine.edit.previewMode', locale)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                {t('engine.edit.previewMode', locale)}
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {/* All page-level actions live here when the
                              designer is present — merged from the
                              PageShell header to reclaim a full row. */}
                          {actionsNode}
                          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                          {PreviewComponent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={toggleInspector}
                              className="h-7 w-7 p-0"
                              title={
                                (inspectorCollapsed
                                  ? t('engine.edit.showInspector', locale)
                                  : t('engine.edit.hideInspector', locale)) + ' (⌘\\)'
                              }
                            >
                              {inspectorCollapsed ? (
                                <PanelRightOpen className="h-3.5 w-3.5" />
                              ) : (
                                <PanelRightClose className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsFullscreen((v) => !v)}
                            className="h-7 w-7 p-0"
                            title={
                              isFullscreen
                                ? t('engine.edit.exitFullscreen', locale)
                                : t('engine.edit.fullscreen', locale)
                            }
                          >
                            {isFullscreen ? (
                              <Minimize2 className="h-3.5 w-3.5" />
                            ) : (
                              <Maximize2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto p-4 bg-[radial-gradient(circle_at_1px_1px,theme(colors.border)_1px,transparent_0)] [background-size:16px_16px] bg-muted/30">
                        <PreviewComponent
                          type={type}
                          name={name}
                          draft={draft}
                          editing={editing && !previewOnly}
                          selection={previewOnly ? null : selection}
                          onSelectionChange={setSelection}
                          locale={locale}
                          onPatch={(patch) =>
                            setDraft((d) => ({ ...(d as Record<string, unknown>), ...patch }))
                          }
                        />
                      </div>
                    </div>
                  </ResizablePanel>
                  <ResizableHandle
                    withHandle
                    className={
                      inspectorCollapsed
                        ? 'hidden'
                        : 'w-1.5 bg-border/40 hover:bg-primary/40 active:bg-primary/60 transition-colors'
                    }
                  />
                  <ResizablePanel
                    panelRef={inspectorPanelRef}
                    defaultSize={lastInspectorSizeRef.current}
                    minSize={22}
                    collapsible
                    collapsedSize={0}
                    onResize={(size) => {
                      const pct = size.asPercentage;
                      const collapsed = pct <= 0.5;
                      if (!collapsed) {
                        lastInspectorSizeRef.current = pct;
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem(
                            inspectorSizeStorageKey,
                            String(Math.round(pct)),
                          );
                        }
                      }
                      setInspectorCollapsed((prev) => {
                        if (prev === collapsed) return prev;
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem(
                            inspectorStorageKey,
                            collapsed ? '1' : '0',
                          );
                        }
                        return collapsed;
                      });
                    }}
                  >
                    <div className="h-full overflow-auto">
                      {/* Inspector header — anchors the user to "this is
                          where the metadata for the selected item lives".
                          The collapse affordance lives in the canvas
                          toolbar (left of Fullscreen) so it stays
                          reachable when the panel is closed; we
                          deliberately do not duplicate it here. */}
                      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 backdrop-blur px-3 py-2">
                        <div
                          role="tablist"
                          className="inline-flex items-center rounded-md border bg-muted/40 p-0.5"
                        >
                          <button
                            type="button"
                            role="tab"
                            aria-selected={inspectorTab === 'properties'}
                            onClick={() => setInspectorTab('properties')}
                            className={
                              'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ' +
                              (inspectorTab === 'properties'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground')
                            }
                            title={t('engine.edit.inspector.properties', locale)}
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            {t('engine.edit.inspector.properties', locale)}
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={inspectorTab === 'source'}
                            onClick={() => setInspectorTab('source')}
                            className={
                              'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ' +
                              (inspectorTab === 'source'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground')
                            }
                            title={t('engine.edit.inspector.source', locale)}
                          >
                            <FileCode2 className="h-3.5 w-3.5" />
                            {t('engine.edit.inspector.source', locale)}
                          </button>
                        </div>
                        {isDirty && (
                          <Badge variant="outline" className="text-[10px] border-amber-400/60 text-amber-600 dark:text-amber-300">
                            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                            {t('engine.edit.unsaved', locale)}
                          </Badge>
                        )}
                      </div>
                      <div className="p-4">
                        {inspectorTab === 'source' ? (
                          <SourceEditor
                            value={draft}
                            onChange={setDraft}
                            readOnly={formReadOnly}
                          />
                        ) : selection && InspectorComponent ? (
                          <InspectorComponent
                            type={type}
                            name={name}
                            draft={draft}
                            selection={selection}
                            onPatch={(patch) =>
                              setDraft((d) => ({
                                ...(d as Record<string, unknown>),
                                ...patch,
                              }))
                            }
                            onClearSelection={() => setSelection(null)}
                            onSelectionChange={setSelection}
                            readOnly={formReadOnly}
                            locale={locale}
                          />
                        ) : (
                          <SchemaForm
                            schema={schema}
                            form={entry?.form as any}
                            value={draft}
                            onChange={setDraft}
                            issues={issues}
                            hiddenFields={config.hiddenFields}
                            fieldOrder={config.fieldOrder}
                            readOnly={formReadOnly}
                            createMode={createMode}
                            widgetContext={widgetContext}
                          />
                        )}
                      </div>
                    </div>
                  </ResizablePanel>
                </PanelGroup>
                {/* The floating reopen pill that used to live here was
                    removed: the canvas toolbar already hosts a permanent
                    VSCode-style inspector toggle next to the fullscreen
                    button, so this duplicate affordance was just noise. */}
              </div>
            ) : (
              <SchemaForm
                schema={schema}
                form={entry?.form as any}
                value={draft}
                onChange={setDraft}
                issues={issues}
                hiddenFields={config.hiddenFields}
                fieldOrder={config.fieldOrder}
                readOnly={formReadOnly}
                createMode={createMode}
                widgetContext={widgetContext}
              />
            )}
          </div>
        </div>
      </div>

      {/* Layers / References / Related are right-side sheets, opened from
          the page-shell header. They used to live in tabs above the form,
          which stole vertical space from the primary work area. */}
      <Sheet
        open={openSheet === 'layers'}
        onOpenChange={(o) => !o && setOpenSheet(null)}
      >
        <SheetContent side="right" className="w-[92vw] sm:max-w-[720px] p-0 flex flex-col gap-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-base">{t('engine.edit.layers', locale)}</SheetTitle>
            <SheetDescription className="text-xs">
              {type} / {name}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-auto p-4">
            <LayeredDiff layered={layered} locale={locale} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={openSheet === 'references'}
        onOpenChange={(o) => !o && setOpenSheet(null)}
      >
        <SheetContent side="right" className="w-[92vw] sm:max-w-[720px] p-0 flex flex-col gap-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-base">
              {t('engine.edit.references', locale)}
              {refs && (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {refs.length}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {type} / {name}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-auto p-4">
            <ReferencesPanel refs={refs} loading={refsLoading} />
          </div>
        </SheetContent>
      </Sheet>

      {hasAnchors && (
        <Sheet
          open={openSheet === 'related'}
          onOpenChange={(o) => !o && setOpenSheet(null)}
        >
          <SheetContent side="right" className="w-[92vw] sm:max-w-[860px] p-0 flex flex-col gap-0">
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle className="text-base">{t('engine.edit.related', locale)}</SheetTitle>
              <SheetDescription className="text-xs">
                {type} / {name}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 min-h-0 overflow-auto p-4">
              <RelatedPanel
                type={type}
                name={name}
                parentItem={draft}
                onOpen={(t) => setRelatedTarget(t)}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {!createMode && (
        <Sheet
          open={openSheet === 'history'}
          onOpenChange={(o) => !o && setOpenSheet(null)}
        >
          <SheetContent side="right" className="w-[92vw] sm:max-w-[720px] p-0 flex flex-col gap-0">
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle className="text-base">{t('engine.edit.history', locale)}</SheetTitle>
              <SheetDescription className="text-xs">
                {type} / {name}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 min-h-0 overflow-auto p-4">
              <HistoryPanel
                type={type}
                name={name}
                client={client}
                onRollback={() => setReloadKey((k) => k + 1)}
                rollbackLabel={t('engine.edit.rollback', locale)}
                rollbackConfirm={(version) =>
                  t('engine.edit.rollbackConfirm', locale).replace(
                    '{version}',
                    String(version),
                  )
                }
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      <MetadataDetailDrawer
        target={relatedTarget}
        onClose={() => setRelatedTarget(null)}
        parentContext={{ type, name }}
      />

      {/* Destructive-change confirmation dialog */}
      <Dialog
        open={destructiveIssues != null}
        onOpenChange={(open) => {
          if (!open) {
            setDestructiveIssues(null);
            setPendingItem(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Destructive change detected
            </DialogTitle>
            <DialogDescription>
              The framework refused this save because it would drop or narrow
              data already in use. Review the issues and confirm to override.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-auto space-y-2 my-2">
            {destructiveIssues?.map((i, idx) => (
              <div
                key={idx}
                className="rounded border bg-amber-50 border-amber-200 p-2 text-xs"
              >
                <div className="font-mono text-amber-900">{i.kind ?? 'change'}</div>
                {i.path && (
                  <div className="text-amber-800 font-mono mt-0.5">{i.path}</div>
                )}
                <div className="text-amber-900 mt-1">{i.message}</div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDestructiveIssues(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => doSave(true)}
              disabled={saving}
            >
              {saving ? 'Forcing…' : 'Force save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function ReferencesPanel({
  refs,
  loading,
}: {
  refs: MetadataReference[] | null;
  loading: boolean;
}) {
  if (loading || refs == null) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Scanning references…
      </div>
    );
  }
  if (refs.length === 0) {
    return (
      <Empty>
        <EmptyTitle>No references found</EmptyTitle>
        <EmptyDescription>
          Nothing in the metadata graph points at this item. Safe to delete.
        </EmptyDescription>
      </Empty>
    );
  }
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">From type</th>
            <th className="px-3 py-2 text-left">From name</th>
            <th className="px-3 py-2 text-left">Path</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {refs.map((r, i) => (
            <tr key={i} className="hover:bg-accent/50">
              <td className="px-3 py-2">
                <Badge variant="outline" className="text-[10px] font-mono">
                  {r.fromType}
                </Badge>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{r.fromName}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {r.path}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * SourceEditor — raw JSON editor for the inspector's "Source" tab.
 *
 * Lets power users edit fields the JSONSchema form doesn't expose
 * (nested arrays, custom keys, etc.). Maintains a local string buffer
 * so the user can type freely; only commits to the parent `draft`
 * when the buffer is valid JSON. Parse errors surface inline without
 * blocking the form — switching back to the Properties tab discards
 * any unparseable scratch text.
 */
function SourceEditor({
  value,
  onChange,
  readOnly,
}: {
  value: unknown;
  onChange: (next: Record<string, unknown>) => void;
  readOnly?: boolean;
}) {
  const stringify = React.useCallback(
    (v: unknown) => {
      try {
        return JSON.stringify(v ?? {}, null, 2);
      } catch {
        return '{}';
      }
    },
    [],
  );
  const [text, setText] = React.useState<string>(() => stringify(value));
  const [parseError, setParseError] = React.useState<string | null>(null);
  const lastCommittedRef = React.useRef<string>(text);

  // Resync the buffer when the parent draft changes externally (e.g.
  // a Save/Reset or a selection-driven inspector patch). We only sync
  // when the upstream value differs from what we last committed — so
  // the user's in-flight edits aren't clobbered.
  React.useEffect(() => {
    const next = stringify(value);
    if (next !== lastCommittedRef.current) {
      setText(next);
      lastCommittedRef.current = next;
      setParseError(null);
    }
  }, [value, stringify]);

  const handleChange = (next: string) => {
    setText(next);
    try {
      const parsed = JSON.parse(next);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setParseError(null);
        lastCommittedRef.current = next;
        onChange(parsed as Record<string, unknown>);
      } else {
        setParseError('Root must be a JSON object');
      }
    } catch (err: any) {
      setParseError(err?.message ?? 'Invalid JSON');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        className="w-full min-h-[60vh] font-mono text-xs bg-muted/30 border rounded p-3 outline-none focus:ring-2 focus:ring-ring resize-y"
      />
      {parseError && (
        <div className="text-xs text-destructive flex items-start gap-1.5">
          <span aria-hidden>⚠</span>
          <span>{parseError}</span>
        </div>
      )}
    </div>
  );
}

/**
 * SaveStatusIndicator — small inline label next to the Save icon that
 * communicates auto-save state so the icon-only button is not a black
 * box. Five states:
 *   - saving      → "Saving…" with spinner
 *   - dirty + on  → "Auto-saving in 1.5s" (subtle, amber)
 *   - dirty + off → "Unsaved" (amber)
 *   - clean + ts  → "Saved 14:32" (muted)
 *   - createMode  → hidden until first save
 */
function SaveStatusIndicator({
  saving,
  isDirty,
  autoSaveEnabled,
  lastSavedAt,
  createMode,
  locale,
}: {
  saving: boolean;
  isDirty: boolean;
  autoSaveEnabled: boolean;
  lastSavedAt: Date | null;
  createMode: boolean;
  locale: 'en-US' | 'zh-CN' | string;
}) {
  // Re-render every 30s so "Saved 14:32" stays accurate without
  // requiring the caller to manage a ticker.
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (!lastSavedAt) return;
    const id = window.setInterval(force, 30_000);
    return () => window.clearInterval(id);
  }, [lastSavedAt]);

  if (saving) {
    return (
      <span className="text-xs text-muted-foreground hidden md:inline-flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('engine.edit.saving', locale)}
      </span>
    );
  }
  if (isDirty) {
    if (createMode) return null;
    return (
      <span className="text-xs text-amber-600 dark:text-amber-300 hidden md:inline-flex items-center gap-1">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
        {autoSaveEnabled
          ? t('engine.edit.autoSavingShortly', locale)
          : t('engine.edit.unsaved', locale)}
      </span>
    );
  }
  if (lastSavedAt) {
    const hh = String(lastSavedAt.getHours()).padStart(2, '0');
    const mm = String(lastSavedAt.getMinutes()).padStart(2, '0');
    return (
      <span className="text-xs text-muted-foreground hidden md:inline-flex items-center gap-1">
        {tFormat('engine.edit.savedAt', locale, { time: `${hh}:${mm}` })}
      </span>
    );
  }
  return null;
}
