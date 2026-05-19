/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * HistoryTimeline — compact, read-only renderer for record audit history.
 * Designed to be safe-by-default: it never re-fetches data on its own and
 * relies on the caller to redact sensitive fields before passing entries in.
 */
import * as React from 'react';
import { Badge, Skeleton, cn } from '@object-ui/components';

export interface HistoryEntry {
  id?: string | number;
  created_at?: string | number | Date;
  action?: string;
  user_id?: string | number | null;
  user_name?: string | null;
  summary?: string | null;
  [extra: string]: unknown;
}

export interface HistoryTimelineProps {
  entries: HistoryEntry[];
  loading?: boolean;
  emptyText?: string;
  className?: string;
}

const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  create: 'default',
  update: 'secondary',
  delete: 'destructive',
  restore: 'outline',
  login: 'outline',
  logout: 'outline',
  permission_change: 'secondary',
  config_change: 'secondary',
  export: 'outline',
  import: 'outline',
};

function formatTimestamp(value: HistoryEntry['created_at']): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function HistoryTimeline({
  entries,
  loading,
  emptyText,
  className,
}: HistoryTimelineProps) {
  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-2 w-2 mt-2 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md border border-dashed py-10 text-sm text-muted-foreground',
          className,
        )}
      >
        {emptyText ?? 'No history yet'}
      </div>
    );
  }

  return (
    <ol className={cn('relative space-y-4 border-l border-border pl-5', className)}>
      {entries.map((entry, idx) => {
        const action = (entry.action ?? '').toLowerCase();
        const variant = ACTION_VARIANT[action] ?? 'outline';
        const who = entry.user_name || entry.user_id || 'System';
        const when = formatTimestamp(entry.created_at);
        return (
          <li
            key={(entry.id as React.Key) ?? idx}
            className="relative"
          >
            <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
            <div className="flex flex-wrap items-baseline gap-2">
              {entry.action && (
                <Badge variant={variant} className="text-xs uppercase tracking-wide">
                  {entry.action}
                </Badge>
              )}
              <span className="text-sm font-medium text-foreground">{who}</span>
              {when && (
                <span className="text-xs text-muted-foreground">{when}</span>
              )}
            </div>
            {entry.summary && (
              <p className="mt-1 text-sm text-muted-foreground">{entry.summary}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
