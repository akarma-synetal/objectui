// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MetadataResourceListPage — generic list of items for a metadata type
 * (Phase 3c).
 *
 * Reads `/meta/:type`, applies registry-driven columns + search +
 * source/overlay filters, and renders an ObjectGrid-like table.
 * Each row links to its EditPage at `./:name?type=…`.
 *
 * No virtualisation in MVP — metadata lists are typically < 200 items
 * per type, well under the threshold where it'd matter.
 */

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { Button } from '@object-ui/components';
import { Input } from '@object-ui/components';
import { Badge } from '@object-ui/components';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@object-ui/components';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { PageShell } from './PageShell';
import {
  useMetadataClient,
  useMetadataTypes,
  matchesQuery,
  type RichMetadataTypeEntry,
} from './useMetadata';
import {
  getMetadataResource,
  resolveResourceConfig,
} from './registry';
import { t, tFormat, translateMetadataType, detectLocale } from './i18n';

export interface MetadataResourceListPageProps {
  type?: string;
}

type ItemRow = {
  /** Raw row from server — may be wrapped in `{ item, source, … }`. */
  raw: any;
  /** Flattened item content for display. */
  item: Record<string, unknown>;
  /**
   * Provenance classification derived from `_packageId` tag:
   *   - 'artifact' = shipped by a real code package
   *   - 'runtime'  = authored at runtime (DB-only, no packageId or sentinel)
   *
   * Server may also pre-classify via a top-level `source` field
   * ('code' / 'overlay' / 'effective'); we honor that when present
   * and fall back to packageId-derived inference otherwise.
   */
  source: 'artifact' | 'runtime';
};

/**
 * Derive provenance from item._packageId. The `loadMetaFromDb` path
 * tags objects with the synthetic packageId 'sys_metadata' (see
 * framework protocol.ts:3092); treat that sentinel as runtime-authored.
 */
function classifyProvenance(item: Record<string, unknown>, rawSource?: string): 'artifact' | 'runtime' {
  if (rawSource === 'overlay' || rawSource === 'runtime') return 'runtime';
  if (rawSource === 'code' || rawSource === 'artifact') return 'artifact';
  const pkg = item._packageId as string | undefined;
  if (!pkg || pkg === 'sys_metadata') return 'runtime';
  return 'artifact';
}

export function MetadataResourceListPage({ type: typeProp }: MetadataResourceListPageProps) {
  const params = useParams<{ type?: string }>();
  const type = typeProp ?? params.type ?? '';

  // If a fully custom ListPage is registered, render it and bail.
  // Done before any other hooks so hook count stays stable across type
  // switches between custom and default list pages.
  const customConfig = getMetadataResource(type);
  if (customConfig?.ListPage) {
    const Custom = customConfig.ListPage;
    return <Custom type={type} />;
  }

  return <DefaultMetadataList type={type} />;
}

function DefaultMetadataList({ type }: { type: string }) {
  const navigate = useNavigate();
  const client = useMetadataClient();
  const { entries: typesEntries } = useMetadataTypes(client);
  const entry: RichMetadataTypeEntry | undefined = typesEntries.find((t) => t.type === type);
  const config = resolveResourceConfig(type, entry);

  const [items, setItems] = React.useState<ItemRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [sourceFilter, setSourceFilter] = React.useState<string>('all');
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = await client.list<any>(type);
        if (cancelled) return;
        const rows: ItemRow[] = (list ?? []).map((raw) => {
          const item = (raw && typeof raw === 'object' && 'item' in raw ? raw.item : raw) ?? {};
          return {
            raw,
            item,
            source: classifyProvenance(item, raw?.source),
          };
        });
        setItems(rows);
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
  }, [client, type, refreshKey]);

  const searchableFields = config.searchableFields ?? ['name', 'label', 'description'];
  const filtered = items.filter((row) => {
    if (!matchesQuery(row.item, query, searchableFields)) return false;
    if (sourceFilter !== 'all' && row.source !== sourceFilter) return false;
    return true;
  });

  // Compute source counts for the filter dropdown.
  const sourceCounts = React.useMemo(() => {
    const c = { all: items.length, artifact: 0, runtime: 0 };
    for (const r of items) {
      c[r.source]++;
    }
    return c;
  }, [items]);

  const columns = config.listColumns ?? defaultColumns(config.primaryKey ?? 'name');
  const locale = detectLocale();
  const typeLabel = translateMetadataType(type, locale, entry?.label ?? type);

  // Localise default column labels — registered columns keep their
  // hand-authored labels (consumers may want bespoke wording).
  const localizeColumnLabel = (col: { key: string; label: string }) => {
    const tryKey = `engine.list.col.${col.key}`;
    const translated = t(tryKey, locale);
    return translated === tryKey ? col.label : translated;
  };

  return (
    <PageShell
      entry={entry ?? { type, label: type }}
      stats={[
        { label: t('engine.list.items', locale), value: items.length },
        { label: t('engine.list.filtered', locale), value: filtered.length },
      ]}
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            title={t('engine.list.refresh', locale)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {(entry?.allowOrgOverride || entry?.allowRuntimeCreate) && (
            <Button
              size="sm"
              onClick={() => navigate(`./new`)}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('engine.list.create', locale)}
            </Button>
          )}
        </>
      }
    >
      <div className="p-6 space-y-4">
        {/* Filter row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t('engine.list.search', locale)}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('engine.list.allSources', locale)} ({sourceCounts.all})</SelectItem>
              <SelectItem value="artifact">{t('engine.list.source.artifact', locale)} ({sourceCounts.artifact})</SelectItem>
              <SelectItem value="runtime">{t('engine.list.source.runtime', locale)} ({sourceCounts.runtime})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Body */}
        {loading && (
          <div className="text-sm text-muted-foreground">{t('engine.edit.loading', locale)} {type}…</div>
        )}
        {error && (
          <div className="text-sm text-destructive border border-destructive/30 rounded p-3 bg-destructive/5">
            {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <Empty>
            <EmptyTitle>
              {items.length === 0
                ? tFormat('engine.list.emptyType', locale, { type: typeLabel })
                : tFormat('engine.list.emptyQuery', locale, { query })}
            </EmptyTitle>
            <EmptyDescription>
              {config.emptyStateHint ??
                (entry?.allowOrgOverride || entry?.allowRuntimeCreate
                  ? tFormat('engine.list.createHint', locale, { type: typeLabel })
                  : t('engine.list.readOnlyHint', locale))}
            </EmptyDescription>
          </Empty>
        )}
        {!loading && filtered.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className="px-3 py-2 text-left font-medium"
                      style={c.width ? { width: c.width } : undefined}
                    >
                      {localizeColumnLabel(c)}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium w-[80px]">{t('engine.list.col.source', locale)}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((row, i) => {
                  const pk = config.primaryKey ?? 'name';
                  const name = String(row.item[pk] ?? `(unnamed-${i})`);
                  return (
                    <tr key={name + i} className="hover:bg-accent/50">
                      {columns.map((c, ci) => {
                        const value = row.item[c.key];
                        const cell = c.render ? c.render(value, row.item) : defaultCell(value);
                        return (
                          <td key={c.key} className="px-3 py-2 align-top">
                            {ci === 0 ? (
                              <Link
                                to={`./${encodeURIComponent(name)}`}
                                className="text-primary hover:underline font-mono"
                              >
                                {cell}
                              </Link>
                            ) : (
                              cell
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right align-top">
                        <Badge
                          variant="outline"
                          className={
                            'text-[10px] ' +
                            (row.source === 'artifact'
                              ? 'border-sky-500/50 text-sky-700 dark:text-sky-300'
                              : 'border-emerald-500/50 text-emerald-700 dark:text-emerald-300')
                          }
                          title={
                            row.source === 'artifact'
                              ? `${t('engine.list.source.artifactDesc', locale)}${row.item._packageId ? ` (${row.item._packageId})` : ''}`
                              : t('engine.list.source.runtimeDesc', locale)
                          }
                        >
                          {t(`engine.list.source.${row.source}`, locale)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function defaultColumns(primaryKey: string): NonNullable<import('./registry').MetadataResourceConfig['listColumns']> {
  return [
    { key: primaryKey, label: primaryKey, width: '30%' },
    { key: 'label', label: 'Label', width: '30%' },
    { key: 'description', label: 'Description' },
  ];
}

function defaultCell(value: unknown): React.ReactNode {
  if (value == null || value === '') {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (typeof value === 'object') {
    try {
      return (
        <code className="font-mono text-xs">
          {JSON.stringify(value).slice(0, 60)}
        </code>
      );
    } catch {
      return String(value);
    }
  }
  return String(value);
}
