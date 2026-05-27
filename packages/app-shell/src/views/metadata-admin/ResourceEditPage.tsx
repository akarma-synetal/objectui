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
  History,
  Link2,
  Loader2,
  AlertTriangle,
  Layers3,
  Eye,
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
import { LayeredDiff } from './LayeredDiff';
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
import { getMetadataPreview } from './preview-registry';

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
      setDraft((lay.effective ?? itemToSave) as Record<string, unknown>);
      setDestructiveIssues(null);
      setPendingItem(null);
      if (createMode) {
        navigate(`../${encodeURIComponent(savedName)}`);
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
    if (!confirm(`Reset overlay for ${type}/${name}? Code-level value will be restored.`)) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await client.reset(type, name);
      const lay = await client.layered<any>(type, name);
      setLayered(lay);
      setDraft((lay.effective ?? lay.code ?? {}) as Record<string, unknown>);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

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
  const readOnly = !entry?.allowOrgOverride && !createMode;

  const DesignerTab = !createMode ? customConfig?.DesignerTab : undefined;
  const designerTabLabel = customConfig?.designerTabLabel ?? 'Designer';

  // Preview tab — opt-in via `registerMetadataPreview()`. Hidden in
  // create mode (nothing to preview yet) and inside the embedded
  // drawer (the parent context owns the preview surface).
  const PreviewComponent = !createMode && !embedded ? getMetadataPreview(type) : undefined;

  return (
    <PageShell
      entry={entry ?? { type, label: type }}
      itemName={createMode ? '(new)' : name}
      subtitle={createMode ? 'Create new' : 'Edit overlay'}
      actions={
        <>
          {!createMode && entry?.allowOrgOverride && (
            <Button variant="ghost" size="sm" onClick={doReset} disabled={saving}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset overlay
            </Button>
          )}
          {!createMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`./history`)}
            >
              <History className="h-4 w-4 mr-1" />
              History
            </Button>
          )}
          {entry?.allowOrgOverride && (
            <Button size="sm" onClick={() => doSave(false)} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          )}
        </>
      }
    >
      <div className="p-6 space-y-6 max-w-7xl">
        {error && (
          <div className="text-sm text-destructive border border-destructive/30 rounded p-3 bg-destructive/5">
            {error}
          </div>
        )}
        {readOnly && (
          <div className="text-xs text-amber-800 border border-amber-300 bg-amber-50 rounded p-3">
            This type is read-only. To enable runtime editing, set{' '}
            <code className="font-mono">OBJECTSTACK_METADATA_WRITABLE</code> to
            include <code className="font-mono">{type}</code>, or flip{' '}
            <code className="font-mono">allowOrgOverride</code> in the registry.
          </div>
        )}

        <Tabs
          defaultValue={
            initialTabRef.current ?? (DesignerTab ? 'designer' : 'form')
          }
          className="w-full"
          onValueChange={(v) => {
            if (typeof window === 'undefined' || embedded) return;
            const url = new URL(window.location.href);
            url.searchParams.set('tab', v);
            window.history.replaceState({}, '', url.toString());
          }}
        >
          <TabsList>
            {DesignerTab && (
              <TabsTrigger value="designer">{designerTabLabel}</TabsTrigger>
            )}
            <TabsTrigger value="form">Form</TabsTrigger>
            {PreviewComponent && (
              <TabsTrigger value="preview">
                <Eye className="h-3.5 w-3.5 mr-1" />
                Preview
              </TabsTrigger>
            )}
            {!createMode && (
              <TabsTrigger value="layers">
                Layers
                {layered?.overlay && (
                  <Badge className="ml-1.5 text-[10px] bg-emerald-600 text-emerald-50">
                    overlay
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {!createMode && (
              <TabsTrigger
                value="references"
                onClick={loadReferences}
              >
                <Link2 className="h-3.5 w-3.5 mr-1" />
                References
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
                Related
              </TabsTrigger>
            )}
          </TabsList>

          {DesignerTab && (
            <TabsContent value="designer" className="mt-4">
              <DesignerTab type={type} name={name} />
            </TabsContent>
          )}

          <TabsContent value="form" className="mt-4">
            <SchemaForm
              schema={schema}
              form={entry?.form as any}
              value={draft}
              onChange={setDraft}
              issues={issues}
              hiddenFields={config.hiddenFields}
              fieldOrder={config.fieldOrder}
              readOnly={readOnly}
              createMode={createMode}
              widgetContext={widgetContext}
            />
          </TabsContent>

          {PreviewComponent && (
            <TabsContent value="preview" className="mt-4">
              <PreviewComponent type={type} name={name} draft={draft} />
            </TabsContent>
          )}

          {!createMode && (
            <TabsContent value="layers" className="mt-4">
              <LayeredDiff layered={layered} />
            </TabsContent>
          )}

          {!createMode && (
            <TabsContent value="references" className="mt-4">
              <ReferencesPanel refs={refs} loading={refsLoading} />
            </TabsContent>
          )}

          {hasAnchors && (
            <TabsContent value="related" className="mt-4">
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
