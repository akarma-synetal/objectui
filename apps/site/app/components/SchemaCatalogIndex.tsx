'use client';

/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useMemo, useState } from 'react';
import {
  allExamples,
  type Example,
} from '@object-ui/example-schema-catalog';

/**
 * Browseable index of every schema in `@object-ui/example-schema-catalog`.
 * Grouped by category, with a search box and copy-id buttons. The page is
 * fully client-side and renders ~415 entries; we keep DOM cheap by
 * rendering a flat list (no per-entry preview).
 */
export function SchemaCatalogIndex() {
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const all = allExamples();
    const q = query.trim().toLowerCase();
    const filtered = q
      ? all.filter((e) =>
          (
            e.id +
            ' ' +
            e.meta.title +
            ' ' +
            e.meta.description +
            ' ' +
            (e.meta.tags?.join(' ') ?? '')
          )
            .toLowerCase()
            .includes(q),
        )
      : all;

    const map = new Map<string, Example[]>();
    for (const e of filtered) {
      const arr = map.get(e.meta.category) ?? [];
      arr.push(e);
      map.set(e.meta.category, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [query]);

  const totalFiltered = grouped.reduce((acc, [, list]) => acc + list.length, 0);
  const totalAll = allExamples().length;

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1200);
    } catch {
      // Clipboard permission denied — best-effort only.
    }
  };

  return (
    <div className="not-prose flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by id, title, description, tag…"
          className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-fd-ring sm:max-w-md"
          aria-label="Filter schema catalog"
        />
        <span className="text-xs text-fd-muted-foreground">
          {query
            ? `${totalFiltered} / ${totalAll} examples`
            : `${totalAll} examples across ${grouped.length} categories`}
        </span>
      </div>

      {grouped.length === 0 && (
        <div className="rounded-md border border-dashed border-fd-border p-6 text-center text-sm text-fd-muted-foreground">
          No examples match <code className="font-mono">{query}</code>.
        </div>
      )}

      {grouped.map(([category, items]) => (
        <section key={category} className="flex flex-col gap-2">
          <h3
            id={`cat-${category}`}
            className="text-sm font-semibold uppercase tracking-wide text-fd-muted-foreground"
          >
            {category}{' '}
            <span className="font-normal text-fd-muted-foreground">
              ({items.length})
            </span>
          </h3>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {items.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-1 rounded-md border border-fd-border bg-fd-card p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-fd-foreground">
                    {e.meta.title}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyId(e.id)}
                    className="shrink-0 rounded border border-fd-border px-2 py-0.5 font-mono text-xs text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground"
                    title="Copy catalog id"
                  >
                    {copiedId === e.id ? '✓ copied' : 'copy id'}
                  </button>
                </div>
                <code className="break-all text-xs text-fd-muted-foreground">
                  {e.id}
                </code>
                {e.meta.description && (
                  <p className="text-xs text-fd-muted-foreground">
                    {e.meta.description}
                  </p>
                )}
                {e.meta.tags && e.meta.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {e.meta.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-fd-muted px-1.5 py-0.5 font-mono text-[10px] text-fd-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
