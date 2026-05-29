// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AppPreview — visual summary of an App metadata record's nav and
 * landing route, since rendering a full nested AppShell inside the
 * admin would be confusing (nav-within-nav).
 *
 * Shows:
 *   • App label/icon + landing route
 *   • Top-level navigation items (tabs/menu) as a clickable list —
 *     each link opens the runtime app in a new tab so authors can
 *     test the configured nav without leaving the editor.
 *
 * If the App schema doesn't follow the expected shape we degrade to
 * a "no preview" hint rather than throw.
 */

import * as React from 'react';
import { Compass, ExternalLink, LayoutDashboard, FileText, Database, BarChart3, Plus } from 'lucide-react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';
import { appendArray } from '../inspectors/_shared';
import { t as tr } from '../i18n';

interface NavItem {
  label: string;
  path?: string;
  kind?: 'object' | 'page' | 'dashboard' | 'report' | 'link' | 'group';
  children?: NavItem[];
}

function normalizeNav(raw: unknown): NavItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it: any): NavItem | null => {
      if (!it || typeof it !== 'object') return null;
      const label = String(it.label ?? it.title ?? it.name ?? it.path ?? '').trim();
      if (!label && !it.children) return null;
      const path: string | undefined = it.path ?? it.href ?? it.route ?? it.url ?? undefined;
      // Best-effort kind inference for icon selection.
      let kind: NavItem['kind'];
      if (it.object || it.objectName) kind = 'object';
      else if (it.page || it.pageName) kind = 'page';
      else if (it.dashboard) kind = 'dashboard';
      else if (it.report) kind = 'report';
      else if (typeof path === 'string' && /^https?:/i.test(path)) kind = 'link';
      else if (Array.isArray(it.children) && it.children.length) kind = 'group';
      const children = Array.isArray(it.children) ? normalizeNav(it.children) : undefined;
      return { label: label || '(unnamed)', path, kind, children };
    })
    .filter((x): x is NavItem => x !== null);
}

function kindIcon(kind?: NavItem['kind']) {
  switch (kind) {
    case 'object':
      return Database;
    case 'page':
      return FileText;
    case 'dashboard':
      return LayoutDashboard;
    case 'report':
      return BarChart3;
    default:
      return Compass;
  }
}

export function AppPreview({ name, draft, editing, selection, onSelectionChange, onPatch, locale }: MetadataPreviewProps) {
  const appName = String((draft as any).name ?? name ?? '');
  const label = (draft as any).label ?? appName;
  const landing = (draft as any).landingRoute ?? (draft as any).landing ?? (draft as any).defaultRoute ?? '/';
  const { rootKey, navItems } = React.useMemo<{ rootKey: string | null; navItems: NavItem[] }>(() => {
    const candidates: Array<[string, unknown]> = [
      ['nav', (draft as any).nav],
      ['navigation', (draft as any).navigation],
      ['tabs', (draft as any).tabs],
      ['items', (draft as any).items],
      ['menu', (draft as any).menu],
    ];
    for (const [k, c] of candidates) {
      if (Array.isArray(c) && c.length) return { rootKey: k, navItems: normalizeNav(c) };
    }
    return { rootKey: null, navItems: [] };
  }, [draft]);

  // For Add we need a root key even when empty — default to "nav".
  const addRootKey = rootKey ?? 'nav';

  const designModeAny = !!(editing && onSelectionChange);
  const designMode = designModeAny && !!rootKey;
  const canEdit = designModeAny && !!onPatch;
  const selectedId = selection && selection.kind === 'nav' ? selection.id : null;
  const onSelect = designMode
    ? (path: string, item: NavItem) => onSelectionChange!({ kind: 'nav', id: path, label: item.label })
    : undefined;

  const handleAddNav = React.useCallback(() => {
    if (!canEdit) return;
    const current = ((draft as any)[addRootKey] as Array<Record<string, unknown>> | undefined) ?? [];
    const newItem = { label: 'New item', path: '' };
    const next = appendArray(current, newItem);
    onPatch!({ [addRootKey]: next });
    onSelectionChange?.({ kind: 'nav', id: `${addRootKey}[${next.length - 1}]`, label: newItem.label });
  }, [canEdit, addRootKey, draft, onPatch, onSelectionChange]);

  const baseRuntimeUrl = appName ? `/apps/${encodeURIComponent(appName)}/` : null;

  return (
    <PreviewShell
      hint="app"
      toolbar={
        baseRuntimeUrl && (
          <a
            href={baseRuntimeUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            title="Open this app in a new tab"
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>
        )
      }
    >
      <PreviewErrorBoundary>
        <div className="p-3 space-y-3">
          <div className="rounded border bg-muted/30 p-3">
            <div className="text-sm font-medium text-foreground">{String(label)}</div>
            <div className="text-xs text-muted-foreground font-mono mt-0.5">{appName}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Landing: <code className="font-mono">{String(landing)}</code>
            </div>
          </div>

          {navItems.length === 0 ? (
            <>
              <PreviewMessage>
                No top-level nav items. Add <code>nav</code> / <code>tabs</code> entries in the Form tab to populate the app's navigation.
              </PreviewMessage>
              {canEdit && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  onClick={handleAddNav}
                >
                  <Plus className="h-3 w-3" />
                  {tr('engine.inspector.add.nav', locale)}
                </button>
              )}
            </>
          ) : (
            <>
              <div className="border rounded divide-y">
                {navItems.map((item, i) => (
                  <NavRow
                    key={i}
                    item={item}
                    appName={appName}
                    depth={0}
                    path={`${rootKey}[${i}]`}
                    onSelect={onSelect}
                    selectedId={selectedId}
                  />
                ))}
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  onClick={handleAddNav}
                >
                  <Plus className="h-3 w-3" />
                  {tr('engine.inspector.add.nav', locale)}
                </button>
              )}
            </>
          )}
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function NavRow({
  item,
  appName,
  depth,
  path,
  onSelect,
  selectedId,
}: {
  item: NavItem;
  appName: string;
  depth: number;
  path: string;
  onSelect?: (path: string, item: NavItem) => void;
  selectedId: string | null;
}) {
  const Icon = kindIcon(item.kind);
  const url = buildUrl(appName, item.path);
  const selected = selectedId === path;
  return (
    <>
      <div
        className={`flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent/40 ${onSelect ? 'cursor-pointer' : ''} ${selected ? 'bg-primary/5 ring-1 ring-primary' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(path, item); } : undefined}
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium truncate">{item.label}</span>
        {item.kind && (
          <span className="text-[10px] uppercase tracking-wider opacity-60">{item.kind}</span>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto font-mono text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            {item.path} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {item.children?.map((c, i) => (
        <NavRow
          key={i}
          item={c}
          appName={appName}
          depth={depth + 1}
          path={`${path}.children[${i}]`}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      ))}
    </>
  );
}

function buildUrl(appName: string, path?: string): string | null {
  if (!path) return null;
  if (/^https?:/i.test(path)) return path;
  if (!appName) return null;
  // Treat path as relative to /apps/<appName>/ by default.
  const trimmed = path.startsWith('/') ? path.slice(1) : path;
  return `/apps/${encodeURIComponent(appName)}/${trimmed}`;
}
