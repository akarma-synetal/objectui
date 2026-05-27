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
import { Compass, ExternalLink, LayoutDashboard, FileText, Database, BarChart3 } from 'lucide-react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';

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

export function AppPreview({ name, draft }: MetadataPreviewProps) {
  const appName = String((draft as any).name ?? name ?? '');
  const label = (draft as any).label ?? appName;
  const landing = (draft as any).landingRoute ?? (draft as any).landing ?? (draft as any).defaultRoute ?? '/';
  const navItems = React.useMemo<NavItem[]>(() => {
    // Accept the most common shapes used by app schemas in the wild.
    const candidates = [
      (draft as any).nav,
      (draft as any).navigation,
      (draft as any).tabs,
      (draft as any).items,
      (draft as any).menu,
    ];
    for (const c of candidates) {
      if (Array.isArray(c) && c.length) return normalizeNav(c);
    }
    return [];
  }, [draft]);

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
            <PreviewMessage>
              No top-level nav items. Add <code>nav</code> / <code>tabs</code> entries in the Form tab to populate the app's navigation.
            </PreviewMessage>
          ) : (
            <div className="border rounded divide-y">
              {navItems.map((item, i) => (
                <NavRow key={i} item={item} appName={appName} depth={0} />
              ))}
            </div>
          )}
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function NavRow({ item, appName, depth }: { item: NavItem; appName: string; depth: number }) {
  const Icon = kindIcon(item.kind);
  const url = buildUrl(appName, item.path);
  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent/40"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
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
            className="ml-auto font-mono text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            {item.path} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {item.children?.map((c, i) => (
        <NavRow key={i} item={c} appName={appName} depth={depth + 1} />
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
