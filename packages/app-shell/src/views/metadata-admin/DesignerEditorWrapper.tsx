// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DesignerEditorWrapper — Phase 3d.
 *
 * Generic "load metadata → hand to a controlled designer component →
 * save on commit" wrapper. Lets us plug existing bespoke designers
 * (ObjectViewConfigurator, DashboardEditor, PageDesigner, …) into the
 * unified Setup-app shell without rewriting them.
 *
 * Each designer takes a different prop shape, so we accept a
 * `renderDesigner` callback that gets `(value, onChange, readOnly)`
 * and returns whatever the designer needs.
 *
 * Wiring is dead simple — see `builtinComponents.tsx`:
 *
 *   registerMetadataResource({
 *     type: 'view',
 *     EditPage: (props) => (
 *       <DesignerEditorWrapper
 *         {...props}
 *         renderDesigner={(value, onChange, readOnly) => (
 *           <ObjectViewConfigurator config={value} onChange={onChange} readOnly={readOnly} />
 *         )}
 *       />
 *     ),
 *   });
 *
 * The wrapper handles:
 *   • Initial fetch via `client.layered()` (so admins see overlay vs code).
 *   • Local edit state with Save / Revert.
 *   • Destructive-change confirmation (409 → dialog → retry with force).
 *   • Reset overlay button (DELETE).
 *   • Read-only fallback when the type isn't allowed to override at runtime
 *     (driven by /meta/types#allowOrgOverride).
 *
 * Validation errors (422) are surfaced as an error banner; bespoke
 * designers usually handle their own field-level UX.
 */

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  Loader2,
  RotateCcw,
  History as HistoryIcon,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@object-ui/components';
import { Badge } from '@object-ui/components';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@object-ui/components';
import { PageShell } from './PageShell';
import { useMetadataClient, useMetadataTypes, type RichMetadataTypeEntry } from './useMetadata';
import { resolveResourceConfig } from './registry';
import { t, detectLocale } from './i18n';

export interface DesignerEditorWrapperProps<TValue = any> {
  type: string;
  name: string;
  /**
   * Render the actual designer. Receives the current draft value, a
   * setter, and whether the editor must be read-only.
   */
  renderDesigner: (
    value: TValue,
    onChange: (next: TValue) => void,
    readOnly: boolean,
  ) => React.ReactNode;
  /**
   * Optional adapter to normalise the value the server returns into
   * the shape the designer wants. Defaults to identity.
   */
  fromMetadata?: (raw: unknown) => TValue;
  /**
   * Optional adapter to turn the designer's value back into the
   * metadata payload before save. Defaults to identity.
   */
  toMetadata?: (value: TValue) => unknown;
}

export function DesignerEditorWrapper<TValue = any>(
  props: DesignerEditorWrapperProps<TValue>,
) {
  return <DesignerEditorBody {...props} withChrome />;
}

/**
 * Embedded variant — same state machine, but no surrounding `PageShell`.
 * Used by `ResourceEditPage` to host the designer inside a tab alongside
 * the generic Form / Layers / References tabs. The action toolbar (Save /
 * Reset / Refresh) is rendered inline at the top of the panel so the tab
 * remains self-sufficient.
 */
export function DesignerEditorBody<TValue = any>({
  type,
  name,
  renderDesigner,
  fromMetadata,
  toMetadata,
  withChrome = false,
}: DesignerEditorWrapperProps<TValue> & { withChrome?: boolean }) {
  const navigate = useNavigate();
  const client = useMetadataClient();
  const { entries } = useMetadataTypes(client);
  const entry: RichMetadataTypeEntry | undefined = entries.find((t) => t.type === type);
  const resolved = resolveResourceConfig(type, entry);
  const writable = !!resolved.allowOrgOverride;
  const locale = detectLocale();

  const [value, setValue] = React.useState<TValue | null>(null);
  const [original, setOriginal] = React.useState<TValue | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [destructive, setDestructive] = React.useState<
    null | { issues: Array<{ kind?: string; path?: string; message?: string }>; pending: TValue }
  >(null);

  const dirty = React.useMemo(() => {
    try {
      return JSON.stringify(value) !== JSON.stringify(original);
    } catch {
      return true;
    }
  }, [value, original]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lay = await client.layered<any>(type, name);
      const raw = (lay.effective ?? lay.code ?? {}) as unknown;
      const v = (fromMetadata ? fromMetadata(raw) : (raw as TValue));
      setValue(v);
      setOriginal(v);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [client, type, name, fromMetadata]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function doSave(force: boolean, pending?: TValue) {
    const payload = pending ?? value;
    if (payload == null) return;
    setSaving(true);
    setError(null);
    try {
      const body = toMetadata ? toMetadata(payload) : (payload as unknown);
      // Ensure `name` is set — designers may not carry it.
      const finalBody: any =
        body && typeof body === 'object'
          ? { ...(body as object), name: (body as any).name ?? name }
          : body;
      await client.save<any>(type, name, finalBody, { force });
      await load();
      setDestructive(null);
    } catch (err: any) {
      if (err?.status === 409 && err?.code === 'destructive_change') {
        const issues = err?.body?.issues ?? [];
        setDestructive({ issues: Array.isArray(issues) ? issues : [], pending: payload });
      } else {
        setError(err?.message ?? String(err));
      }
    } finally {
      setSaving(false);
    }
  }

  async function doReset() {
    if (!confirm(t('engine.edit.resetConfirm', locale).replace('{type}', type).replace('{name}', name))) return;
    setSaving(true);
    try {
      await client.reset(type, name);
      await load();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading || value == null) {
    const loadingBody = (
      <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('engine.edit.loading', locale)} {type}/{name}…
      </div>
    );
    return withChrome ? (
      <PageShell entry={entry} itemName={name}>{loadingBody}</PageShell>
    ) : (
      loadingBody
    );
  }

  const toolbarButtons = (
    <>
      <Button variant="ghost" size="sm" onClick={load} disabled={saving}>
        <RefreshCw className="h-4 w-4 mr-1" /> {t('engine.list.refresh', locale)}
      </Button>
      {withChrome && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`./history`)}
        >
          <HistoryIcon className="h-4 w-4 mr-1" /> {t('engine.edit.history', locale)}
        </Button>
      )}
      {writable && (
        <Button variant="ghost" size="sm" onClick={doReset} disabled={saving}>
          <RotateCcw className="h-4 w-4 mr-1" /> {t('engine.edit.reset', locale)}
        </Button>
      )}
      {writable && (
        <Button size="sm" onClick={() => doSave(false)} disabled={saving || !dirty}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          {t('engine.edit.save', locale)}
        </Button>
      )}
    </>
  );

  const banners = (
    <>
      {!writable && (
        <div className="mx-6 mt-4 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {t('engine.edit.readOnlyHint', locale)}
        </div>
      )}
      {error && (
        <div className="mx-6 mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {dirty && writable && (
        <div className="mx-6 mt-3 flex items-center gap-2 rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 text-xs">
          <Badge variant="outline">{t('engine.edit.unsaved', locale)}</Badge>
          <span>{t('engine.edit.unsavedHint', locale)}</span>
        </div>
      )}
    </>
  );

  const designerArea = (
    <div className="flex-1 min-h-0 overflow-auto">
      {renderDesigner(value, (next) => setValue(next), !writable)}
    </div>
  );

  const destructiveDialog = (
    <Dialog open={!!destructive} onOpenChange={(open) => !open && setDestructive(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> {t('engine.edit.destructive', locale)}
          </DialogTitle>
          <DialogDescription>
            {t('engine.edit.destructiveHint', locale)}
          </DialogDescription>
        </DialogHeader>
        <ul className="text-sm space-y-1 max-h-64 overflow-auto">
          {destructive?.issues.map((i, idx) => (
            <li key={idx} className="border-l-2 border-amber-500 pl-2">
              {i.kind && <Badge variant="outline" className="mr-2">{i.kind}</Badge>}
              {i.message ?? JSON.stringify(i)}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDestructive(null)}>{t('engine.cancel', locale)}</Button>
          <Button
            variant="destructive"
            onClick={() => destructive && doSave(true, destructive.pending)}
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t('engine.edit.forceSave', locale)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!withChrome) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-end gap-1 px-6 pt-3">
          {toolbarButtons}
        </div>
        {banners}
        {designerArea}
        {destructiveDialog}
      </div>
    );
  }

  return (
    <PageShell
      entry={entry ?? { type, label: type }}
      itemName={name}
      subtitle={t('engine.edit.bespokeDesigner', locale)}
      actions={toolbarButtons}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {banners}
        {designerArea}
      </div>
      {destructiveDialog}
    </PageShell>
  );
}
