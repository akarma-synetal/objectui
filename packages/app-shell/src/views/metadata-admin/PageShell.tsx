// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PageShell — common hero / breadcrumb / action bar for every metadata
 * admin page (Phase 3c).
 *
 * Layout (top → bottom):
 *   1. Breadcrumb: All Metadata Types › <type> [ › <item> ]
 *   2. Hero: icon + label + writable badge + count chip
 *   3. Description (one line)
 *   4. Action toolbar (Create / Refresh / Reset / Delete)
 *   5. Child content (list / form / history)
 *
 * Keeping the chrome here means every page looks consistent and
 * page bodies stay focused on their domain logic.
 */

import * as React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@object-ui/components';
import { Button } from '@object-ui/components';
import { ChevronRight } from 'lucide-react';
import type { RichMetadataTypeEntry } from './useMetadata';
import { detectLocale, t, translateMetadataType } from './i18n';

export interface PageShellProps {
  /** The type entry from `/meta/types` (or a synthesized stub). */
  entry: RichMetadataTypeEntry | undefined;
  /** Optional item name (shown in breadcrumb on edit/history). */
  itemName?: string;
  /** Sub-label below the title — e.g. "Edit overlay" / "Version history". */
  subtitle?: string;
  /** Right-side stat chips. */
  stats?: Array<{ label: string; value: React.ReactNode }>;
  /** Right-side action buttons. */
  actions?: React.ReactNode;
  /** Page body. */
  children: React.ReactNode;
}

export function PageShell({
  entry,
  itemName,
  subtitle,
  stats,
  actions,
  children,
}: PageShellProps) {
  const type = entry?.type ?? '';
  const locale = React.useMemo(() => detectLocale(), []);
  // Prefer locale-table translation over server's English label.
  const label = translateMetadataType(type, locale, entry?.label);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b bg-background">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <Link to="../component/metadata/directory" className="hover:text-foreground">
            {t('engine.breadcrumb.allTypes', locale)}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link
            to={`../component/metadata/resource?type=${encodeURIComponent(type)}`}
            className="hover:text-foreground"
          >
            {label}
          </Link>
          {itemName && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium font-mono">{itemName}</span>
            </>
          )}
        </nav>

        {/* Title row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold truncate">{label}</h1>
              <code className="text-xs font-mono text-muted-foreground">
                {type}
              </code>
              {entry?.domain && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  {entry.domain}
                </Badge>
              )}
              {entry?.allowOrgOverride ? (
                <Badge
                  className={
                    'text-[10px] ' +
                    (entry.overrideSource === 'env'
                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                      : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100')
                  }
                  title={
                    entry.overrideSource === 'env'
                      ? 'Writable via OBJECTSTACK_METADATA_WRITABLE env var'
                      : 'Writable per ADR-0005 overlay opt-in'
                  }
                >
                  writable
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  read-only
                </Badge>
              )}
            </div>
            {subtitle && (
              <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>
            )}
            {!subtitle && entry?.description && (
              <div className="text-sm text-muted-foreground mt-1 max-w-3xl">
                {entry.description}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {stats?.map((s, i) => (
              <div
                key={i}
                className="flex flex-col items-end px-3 py-1 rounded border bg-muted/30 min-w-[64px]"
              >
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </span>
                <span className="text-sm font-semibold tabular-nums">{s.value}</span>
              </div>
            ))}
            {actions}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
