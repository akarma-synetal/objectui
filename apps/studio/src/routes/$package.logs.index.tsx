// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Logs — live operator dashboard for "what is my runtime doing right now?"
 *
 * Three tabs, all backed by real metadata-driven objects rendered with the
 * mature `@object-ui/plugin-grid` ObjectGrid — same component the rest of
 * Studio uses for tabular data so filter/sort/group/density work
 * out-of-the-box:
 *
 *   - **Audit trail** (default) — every metadata + record mutation
 *     persisted to `sys_audit_log`, the canonical who-changed-what-when
 *     surface.
 *   - **Background jobs** — every queued/scheduled job run (`sys_job_run`),
 *     with status, attempt, latency, trigger source, and error.
 *   - **Approvals** — every approval request in flight (`sys_approval_request`)
 *     so operators can see what's blocked on a human decision.
 *
 * Earlier versions of this page had "Coming soon" placeholders for a
 * Request log and an Event log. The runtime doesn't ring-buffer those
 * to the database today, and an empty card with the words "Coming soon"
 * is strictly worse than a working table — so they're removed. When the
 * runtime starts persisting requests/events the matching tab can be
 * added here without touching the rest of the IA.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ObjectGrid } from '@object-ui/plugin-grid';
import { ScrollText, Webhook, ShieldAlert } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useObjectUiDataSource } from '@/hooks/useObjectUiDataSource';

type LogTab = 'audit' | 'jobs' | 'approvals';

interface LogTabSpec {
  key: LogTab;
  label: string;
  icon: typeof ScrollText;
  objectName: string;
  columns: string[];
  description: string;
}

const TABS: LogTabSpec[] = [
  {
    key: 'audit',
    label: 'Audit trail',
    icon: ShieldAlert,
    objectName: 'sys_audit_log',
    columns: ['created_at', 'action', 'object_name', 'record_id', 'user_id', 'ip_address'],
    description:
      'Every metadata mutation and record write persisted to sys_audit_log — who changed what, when, and from where.',
  },
  {
    key: 'jobs',
    label: 'Background jobs',
    icon: Webhook,
    objectName: 'sys_job_run',
    columns: ['started_at', 'job_name', 'status', 'trigger', 'attempt', 'duration_ms', 'error'],
    description:
      'Every queued or scheduled job the runtime executed — its status, attempt count, trigger, latency, and error if any.',
  },
  {
    key: 'approvals',
    label: 'Approvals',
    icon: ScrollText,
    objectName: 'sys_approval_request',
    columns: ['created_at', 'object_name', 'record_id', 'status', 'process_name', 'current_step', 'submitter_id'],
    description:
      'Every approval process in flight or recently resolved — surfaces what is currently blocked on a human decision.',
  },
];

function LogsPage() {
  const dataSource = useObjectUiDataSource();
  const [active, setActive] = useState<LogTab>('audit');
  const current = TABS.find((t) => t.key === active) ?? TABS[0];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b px-6 py-4">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <ScrollText className="h-5 w-5" /> Logs
        </h1>
        <p className="text-sm text-muted-foreground">
          See what your runtime is doing right now — every write, every job run, every approval.
        </p>
      </div>
      <Tabs
        value={active}
        onValueChange={(v) => setActive(v as LogTab)}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="border-b px-6 pt-3">
          <TabsList>
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <p className="pb-3 pt-2 text-xs text-muted-foreground">{current.description}</p>
        </div>
        {TABS.map((t) => (
          <TabsContent
            key={t.key}
            value={t.key}
            className="m-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          >
            <ObjectGrid
              schema={{
                type: 'object-grid',
                objectName: t.objectName,
                columns: t.columns,
                sort: [{ field: t.columns[0], direction: 'desc' }],
              }}
              dataSource={dataSource}
              className="h-full"
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export const Route = createFileRoute('/$package/logs/')({
  component: LogsPage,
});
