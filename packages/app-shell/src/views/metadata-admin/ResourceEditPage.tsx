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
  Eye,
  Pencil,
  X,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { Button } from '@object-ui/components';
import { Badge } from '@object-ui/components';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
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
import { getMetadataPreview, type MetadataSelection } from './preview-registry';
import { getMetadataInspector } from './inspector-registry';
import { detectLocale, t, tFormat } from './i18n';

// react-resizable-panels' `direction` prop type does not always narrow
// cleanly in our TS config; cast at the boundary (precedent:
// packages/components/src/custom/navigation-overlay.tsx).
const PanelGroup = ResizablePanelGroup as React.FC<any>;

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
        const lay = await client.layered<any>(type, name);
        if (cancelled) return;
        setLayered(lay);
        // Initial draft = effective if available, otherwise code.
        const initial = (lay.effective ?? lay.code ?? {}) as Record<string, unknown>;
        setDraft(initial);
        draftSnapshotRef.current = initial;
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
  }, [client, type, name, createMode]);

  // Lazy-load references when the tab is opened.
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

  // Designer-style split-panel state. The inspector (right form panel)
  // can collapse to give the preview the full canvas. The collapsed
  // state is persisted in localStorage so the user's preference sticks
  // across navigations.
  const inspectorStorageKey = 'metadata-edit:inspector-collapsed';
  const [inspectorCollapsed, setInspectorCollapsed] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(inspectorStorageKey) === '1';
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inspectorPanelRef = React.useRef<any>(null);
  const toggleInspector = React.useCallback(() => {
    const handle = inspectorPanelRef.current;
    setInspectorCollapsed((prev) => {
      const next = !prev;
      if (handle) {
        if (next) handle.collapse();
        else handle.expand();
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(inspectorStorageKey, next ? '1' : '0');
      }
      return next;
    });
  }, []);

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
    if (tab) initialTabRef.current = tab;
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
      const result = await client.save<any>(type, savedName, itemToSave, { force });
      // Refresh layered after save.
      const lay = await client.layered<any>(type, savedName);
      setLayered(lay);
      const fresh = (lay.effective ?? itemToSave) as Record<string, unknown>;
      setDraft(fresh);
      draftSnapshotRef.current = fresh;
      setDestructiveIssues(null);
      setPendingItem(null);
      // Exit edit mode on successful save (unless we were creating —
      // navigation to the new record's URL will reset state anyway).
      if (!createMode) setEditing(false);
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
        setEditing(false);
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

  // Two-tier authorization (PR-10d.7):
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

  // Default tab priority:
  //   1. URL ?tab= (explicit user nav / deep link). Legacy 'preview' is
  //      remapped to 'form' since preview now renders alongside the form
  //      in a split-panel layout.
  //   2. Form (the split-panel view, which also contains the live preview)
  const requestedTab = initialTabRef.current;
  const defaultTab =
    requestedTab === 'preview' ? 'form' : (requestedTab ?? 'form');

  return (
    <PageShell
      entry={entry ?? { type, label: type }}
      itemName={createMode ? '(new)' : name}
      subtitle={createMode ? t('engine.edit.createNew', locale) : t('engine.edit.editOverlay', locale)}
      actions={
        <>
          {PreviewComponent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleInspector}
              title={
                (inspectorCollapsed
                  ? t('engine.edit.showInspector', locale)
                  : t('engine.edit.hideInspector', locale)) + ' (⌘\\)'
              }
            >
              {inspectorCollapsed ? (
                <PanelRightOpen className="h-4 w-4 mr-1" />
              ) : (
                <PanelRightClose className="h-4 w-4 mr-1" />
              )}
              {inspectorCollapsed
                ? t('engine.edit.showInspector', locale)
                : t('engine.edit.hideInspector', locale)}
            </Button>
          )}
          {!createMode && canWrite && layered?.overlay && (
            <Button variant="ghost" size="sm" onClick={doReset} disabled={saving}>
              {isArtifactItem ? (
                <>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  {t('engine.edit.reset', locale)}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('engine.edit.delete', locale)}
                </>
              )}
            </Button>
          )}
          {!createMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`./history`, { relative: 'path' })}
            >
              <History className="h-4 w-4 mr-1" />
              {t('engine.edit.history', locale)}
            </Button>
          )}
          {/* Edit-mode toggle. Three states:
              - View (default, !editing & !createMode): show "Edit".
              - Editing: show Cancel + Save.
              - createMode: always editing, show Save only (Cancel would
                discard the whole create flow which is awkward; users can
                navigate away to cancel).
              Truly read-only types (no allowOrgOverride) skip all of this. */}
          {canWrite && !createMode && !editing && (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />
              {t('engine.edit.edit', locale)}
            </Button>
          )}
          {canWrite && !createMode && editing && (
            <Button variant="ghost" size="sm" onClick={doCancelEdit} disabled={saving}>
              <X className="h-4 w-4 mr-1" />
              {t('engine.cancel', locale)}
            </Button>
          )}
          {canWrite && (editing || createMode) && (
            <Button
              size="sm"
              onClick={() => doSave(false)}
              disabled={saving || (!createMode && !isDirty)}
              title={
                !createMode && !isDirty
                  ? t('engine.edit.noChanges', locale)
                  : undefined
              }
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {t('engine.edit.save', locale)}
              {isDirty && !saving && (
                <span
                  aria-hidden
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-300"
                />
              )}
            </Button>
          )}
        </>
      }
    >
      <div
        className={
          PreviewComponent
            ? 'flex h-full min-h-0 flex-col'
            : 'p-6 space-y-6 max-w-7xl'
        }
      >
        {(error || readOnly) && (
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

        <Tabs
          defaultValue={defaultTab}
          className={
            PreviewComponent
              ? 'flex w-full flex-1 min-h-0 flex-col'
              : 'w-full'
          }
          onValueChange={(v) => {
            if (typeof window === 'undefined' || embedded) return;
            const url = new URL(window.location.href);
            url.searchParams.set('tab', v);
            window.history.replaceState({}, '', url.toString());
          }}
        >
          <TabsList className={PreviewComponent ? 'mx-6 mt-3 self-start' : ''}>
            <TabsTrigger value="form">
              {PreviewComponent && <Eye className="h-3.5 w-3.5 mr-1" />}
              {t('engine.edit.detail', locale)}
            </TabsTrigger>
            {!createMode && (
              <TabsTrigger value="layers">
                {t('engine.edit.layers', locale)}
                {layered?.overlay && (() => {
                  const n = countOverlaidFields(layered.code, layered.effective);
                  return (
                    <Badge
                      className="ml-1.5 text-[10px] bg-emerald-600 text-emerald-50"
                      title={t('engine.layers.diff', locale)}
                    >
                      {n > 0
                        ? tFormat('engine.edit.overlaidCount', locale, { count: n })
                        : t('engine.edit.overlay', locale)}
                    </Badge>
                  );
                })()}
              </TabsTrigger>
            )}
            {!createMode && (
              <TabsTrigger
                value="references"
                onClick={loadReferences}
              >
                <Link2 className="h-3.5 w-3.5 mr-1" />
                {t('engine.edit.references', locale)}
                {refs && (
                  <Badge variant="outline" className="ml-1.5 text-[10px]">
                    {refs.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {hasAnchors && (
              <TabsTrigger value="related">
                <Layers3 className="h-3.5 w-3.5 mr-1" />
                {t('engine.edit.related', locale)}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent
            value="form"
            className={
              PreviewComponent
                ? 'mt-2 flex-1 min-h-0 flex flex-col px-6 pb-4 data-[state=inactive]:hidden'
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
            {PreviewComponent ? (
              <div className="relative flex-1 min-h-0 flex">
                <PanelGroup
                  direction="horizontal"
                  className="flex-1 min-h-0 rounded-md border bg-background overflow-hidden"
                  id={`metadata-edit-${type}`}
                >
                  <ResizablePanel defaultSize={inspectorCollapsed ? 100 : 62} minSize={30}>
                    <div className="h-full overflow-auto p-4 bg-[radial-gradient(circle_at_1px_1px,theme(colors.border)_1px,transparent_0)] [background-size:16px_16px] bg-muted/30">
                      <PreviewComponent
                        type={type}
                        name={name}
                        draft={draft}
                        editing={editing}
                        selection={selection}
                        onSelectionChange={setSelection}
                        locale={locale}
                        onPatch={(patch) =>
                          setDraft((d) => ({ ...(d as Record<string, unknown>), ...patch }))
                        }
                      />
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
                    defaultSize={inspectorCollapsed ? 0 : 38}
                    minSize={22}
                    collapsible
                    collapsedSize={0}
                    onResize={(size) => {
                      const collapsed = size.asPercentage <= 0.5;
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
                          where the metadata for the selected item lives"
                          and frees the page-shell action bar for global
                          actions only (Save/History/etc.). */}
                      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/95 backdrop-blur px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {t('engine.edit.inspector', locale)}
                          </span>
                          {isDirty && (
                            <Badge variant="outline" className="text-[10px] border-amber-400/60 text-amber-600 dark:text-amber-300">
                              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                              {t('engine.edit.unsaved', locale)}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={toggleInspector}
                          title={t('engine.edit.hideInspector', locale) + ' (⌘\\)'}
                        >
                          <PanelRightClose className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="p-4">
                        {selection && InspectorComponent ? (
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
                {/* Floating reopen pill — anchored to the right edge of
                    the canvas when the inspector is collapsed. Saves a
                    trip to the top action bar for the most common
                    designer action. */}
                {inspectorCollapsed && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={toggleInspector}
                    title={t('engine.edit.showInspector', locale) + ' (⌘\\)'}
                    className="absolute right-2 top-2 h-8 gap-1 shadow-md bg-background/95 backdrop-blur"
                  >
                    <PanelRightOpen className="h-3.5 w-3.5" />
                    <span className="text-xs">
                      {t('engine.edit.inspector', locale)}
                    </span>
                  </Button>
                )}
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
          </TabsContent>

          {!createMode && (
            <TabsContent
              value="layers"
              className={PreviewComponent ? 'mt-2 px-6 pb-6 overflow-auto' : 'mt-4'}
            >
              <LayeredDiff layered={layered} locale={locale} />
            </TabsContent>
          )}

          {!createMode && (
            <TabsContent
              value="references"
              className={PreviewComponent ? 'mt-2 px-6 pb-6 overflow-auto' : 'mt-4'}
            >
              <ReferencesPanel refs={refs} loading={refsLoading} />
            </TabsContent>
          )}

          {hasAnchors && (
            <TabsContent
              value="related"
              className={PreviewComponent ? 'mt-2 px-6 pb-6 overflow-auto' : 'mt-4'}
            >
              <RelatedPanel
                type={type}
                name={name}
                parentItem={draft}
                onOpen={(t) => setRelatedTarget(t)}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

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
