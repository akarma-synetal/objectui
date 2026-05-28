/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * `record:reference_rail` — Compact reference panel for the record's
 * related collections. Lives in the page schema's `aside` region and
 * gives users a HubSpot/Dynamics-style "Reference Panel" snapshot of
 * related data without leaving the Details tab.
 *
 * Each entry renders a tight card with:
 *   - object icon + localized label
 *   - total related count (badge)
 *   - the top N related records (name only, truncated)
 *
 * Data is fetched per entry via the host `DataSource` exposed through
 * `RecordContext`. We deliberately query with `$top` only — this rail is
 * a snapshot, not a paginated list — and silently degrade to "—" on
 * failure so a misconfigured entry never blanks the whole rail.
 */

import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRecordContext, useSafeFieldLabel } from '@object-ui/react';
import { cn, Card, CardHeader, CardTitle, CardContent, Badge, Skeleton } from '@object-ui/components';
import { ChevronRight } from 'lucide-react';
import { useDetailTranslation } from '../useDetailTranslation';

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface ReferenceRailEntry {
  /** Related object's API name (e.g. 'opportunity_quote'). */
  objectName: string;
  /** FK field on the related object pointing back to the host record. */
  relationshipField: string;
  /** Optional override for the rail card title. */
  title?: string;
  /** Lucide icon name (defaults vary by object). */
  icon?: string;
  /** Top-N preview cap. Defaults to 3. */
  limit?: number;
  /**
   * Canonical field on the related object to render in each preview row.
   * Falls back to `name / title / subject / label / id` when omitted.
   */
  displayField?: string;
}

export interface RecordReferenceRailRendererProps {
  schema?: {
    entries?: ReferenceRailEntry[];
    className?: string;
    /**
     * When true (default), entries with `total === 0` are folded into a
     * single "+ N more (empty)" footer chip instead of rendering full empty
     * cards. Users can click the chip to expand them inline. Setting
     * `hideEmpty: false` restores the legacy "always render every entry"
     * behavior.
     */
    hideEmpty?: boolean;
    [k: string]: any;
  };
  className?: string;
  [k: string]: any;
}

interface EntryState {
  loading: boolean;
  total: number;
  items: any[];
  error?: string;
}

const humanize = (s: string) =>
  s
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const pickDisplayName = (row: any, displayField?: string): string => {
  if (displayField && row?.[displayField] != null && row[displayField] !== '') {
    return String(row[displayField]);
  }
  return (
    row?.name ||
    row?.title ||
    row?.subject ||
    row?.label ||
    row?.email ||
    row?.username ||
    row?.code ||
    row?.slug ||
    row?.provider_id ||
    row?.user_agent ||
    row?.ip_address ||
    row?.id ||
    '—'
  );
};

export const RecordReferenceRailRenderer: React.FC<RecordReferenceRailRendererProps> = ({
  schema = {},
  className,
  ...props
}) => {
  const ctx = useRecordContext();
  const i18n = useSafeFieldLabel() as any;
  const { t } = useDetailTranslation();
  const { designer } = splitDesigner(props);
  const routeParams = useParams<{ appName?: string }>();
  const appName = routeParams.appName;

  const entries: ReferenceRailEntry[] = Array.isArray(schema.entries)
    ? schema.entries
    : Array.isArray((schema as any).properties?.entries)
      ? ((schema as any).properties.entries as ReferenceRailEntry[])
      : [];
  const parentId = ctx?.recordId;
  const dataSource: any = (ctx as any)?.dataSource;

  const [states, setStates] = React.useState<Record<string, EntryState>>({});

  React.useEffect(() => {
    if (!dataSource?.find || !parentId || entries.length === 0) return;
    let cancelled = false;
    entries.forEach((entry) => {
      const key = entry.objectName;
      setStates((prev) => ({
        ...prev,
        [key]: { loading: true, total: 0, items: prev[key]?.items || [] },
      }));
      dataSource
        .find(entry.objectName, {
          $filter: { [entry.relationshipField]: parentId },
          $top: entry.limit ?? 3,
          $count: true,
        })
        .then((res: any) => {
          if (cancelled) return;
          const items = Array.isArray(res) ? res : res?.data || [];
          const total =
            typeof res?.total === 'number'
              ? res.total
              : typeof res?.count === 'number'
                ? res.count
                : items.length;
          setStates((prev) => ({
            ...prev,
            [key]: { loading: false, total, items },
          }));
        })
        .catch((err: any) => {
          if (cancelled) return;
          setStates((prev) => ({
            ...prev,
            [key]: { loading: false, total: 0, items: [], error: String(err?.message || err) },
          }));
        });
    });
    return () => {
      cancelled = true;
    };
  }, [dataSource, parentId, JSON.stringify(entries.map((e) => `${e.objectName}:${e.relationshipField}:${e.limit ?? 3}`))]);

  if (entries.length === 0) return null;

  const hideEmpty = schema.hideEmpty !== false;
  const [showEmpty, setShowEmpty] = React.useState(false);

  // Stable partition: an entry is "empty" only once it has finished loading
  // with total === 0. While loading or on error, we render it so users
  // don't see flicker / disappearing cards.
  const emptyKeys = new Set(
    entries
      .filter((e) => {
        const s = states[e.objectName];
        return hideEmpty && s && !s.loading && !s.error && s.total === 0;
      })
      .map((e) => e.objectName),
  );

  const visibleEntries = entries.filter(
    (e) => showEmpty || !emptyKeys.has(e.objectName),
  );
  const emptyTitles = entries
    .filter((e) => emptyKeys.has(e.objectName))
    .map(
      (e) =>
        e.title ||
        (i18n?.objectLabel
          ? i18n.objectLabel({ name: e.objectName, label: humanize(e.objectName) })
          : humanize(e.objectName)),
    );

  return (
    <div className={cn('flex flex-col gap-3', schema.className, className)} {...designer}>
      {visibleEntries.map((entry) => {
        const key = entry.objectName;
        const state = states[key] || { loading: true, total: 0, items: [] };
        const title =
          entry.title ||
          (i18n?.objectLabel
            ? i18n.objectLabel({ name: entry.objectName, label: humanize(entry.objectName) })
            : humanize(entry.objectName));

        return (
          <Card key={key} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-2 py-3 px-4 space-y-0 border-b">
              <CardTitle className="text-sm font-semibold tracking-tight truncate">
                {title}
              </CardTitle>
              <div className="flex items-center gap-2 shrink-0">
                {!state.loading && (
                  <Badge variant="secondary" className="tabular-nums">
                    {state.total}
                  </Badge>
                )}
                {appName && parentId && (
                  <Link
                    to={`/apps/${appName}/${entry.objectName}?filter%5B${entry.relationshipField}%5D=${encodeURIComponent(String(parentId))}`}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    title={t('detail.viewAll', { defaultValue: 'View all' })}
                  >
                    {t('detail.viewAll', { defaultValue: 'View all' })}
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {state.loading ? (
                <div className="space-y-1.5 p-3">
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-3.5 w-3/5" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              ) : state.items.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">
                  {t('detail.noRecords')}
                </p>
              ) : (
                <ul className="divide-y">
                  {state.items.map((item) => {
                    const id = item.id || item._id;
                    const name = pickDisplayName(item, entry.displayField);
                    const href = id
                      ? `../${entry.objectName}/record/${encodeURIComponent(String(id))}`
                      : undefined;
                    return (
                      <li key={String(id || name)} className="px-4 py-2">
                        {href ? (
                          <Link
                            to={href}
                            className="group flex items-center justify-between gap-2 text-xs hover:text-foreground text-muted-foreground transition-colors"
                          >
                            <span className="truncate">{name}</span>
                            <ChevronRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        ) : (
                          <span className="block truncate text-xs text-muted-foreground">{name}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
      {!showEmpty && emptyTitles.length > 0 && (
        <button
          type="button"
          onClick={() => setShowEmpty(true)}
          className="self-start inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1 rounded-md border border-dashed border-border/60 hover:border-border bg-background"
          title={emptyTitles.join(' · ')}
        >
          <span>
            {t('detail.showEmptyRelated', {
              defaultValue: '+ {{count}} empty',
              count: emptyTitles.length,
            })}
          </span>
          <span className="truncate max-w-[180px] text-muted-foreground/70">
            ({emptyTitles.join(' · ')})
          </span>
        </button>
      )}
    </div>
  );
};

export default RecordReferenceRailRenderer;
