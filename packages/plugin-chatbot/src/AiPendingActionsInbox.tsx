/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * AiPendingActionsInbox — workspace UI for the AI HITL approval queue.
 *
 * Wires `usePendingActions` to a Card/Table layout with an in-place
 * detail drawer and approve / reject buttons. Designed to drop into both
 * Console (`system/ai/pending-actions`) and Studio (assistant builder
 * traces panel) without further glue — pass `apiBase` + `headers` and you
 * get the whole flow.
 *
 * Stays inside `@object-ui/plugin-chatbot` so the AI bundle (already
 * loaded when a chatbot mounts) holds the inbox too. No extra route-
 * level code-split needed.
 *
 * @module
 */

import * as React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Skeleton,
  Alert,
  AlertDescription,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  Label,
  Empty,
  EmptyTitle,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from '@object-ui/components';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Inbox,
  Eye,
  Clock,
  Bot,
} from 'lucide-react';
import {
  usePendingActions,
  type PendingActionRow,
  type PendingActionStatus,
  type UsePendingActionsOptions,
} from './usePendingActions';

export interface AiPendingActionsInboxProps {
  /**
   * AI service base URL, e.g. `http://localhost:3004/api/v1/ai`.
   * Defaults to same-origin `/api/v1/ai`.
   */
  apiBase?: string;
  /** Extra headers (`X-Environment-Id`, `Authorization`, ...). */
  headers?: Record<string, string>;
  /** Polling interval in ms. Default 5000; pass 0 to disable. */
  pollInterval?: number;
  /**
   * Forwarded to the AI service as `?conversationId=` — useful for
   * scoping the inbox to a single chat thread.
   */
  conversationId?: string;
  /** Visual style. `card` (default) wraps in a Card; `bare` renders without. */
  variant?: 'card' | 'bare';
  /** Optional title shown in the card header. */
  title?: string;
  /** Optional description shown in the card header. */
  description?: string;
  /** Class name applied to the outer wrapper. */
  className?: string;
}

type TabKey = 'pending' | 'decided' | 'all';

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  pending:  { variant: 'secondary',   label: 'Pending'  },
  approved: { variant: 'default',     label: 'Approved' },
  executed: { variant: 'default',     label: 'Executed' },
  failed:   { variant: 'destructive', label: 'Failed'   },
  rejected: { variant: 'outline',     label: 'Rejected' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { variant: 'outline' as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function formatRelative(s: string | null | undefined): string {
  if (!s) return '—';
  const t = Date.parse(s);
  if (Number.isNaN(t)) return s;
  const diffMs = Date.now() - t;
  const sec = Math.round(diffMs / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}

function safeParseJson(input: string | null | undefined): unknown {
  if (!input) return null;
  try { return JSON.parse(input); } catch { return input; }
}

function JsonBlock({ value, max = 320 }: { value: unknown; max?: number }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (text == null || text === '') return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <pre
      className="bg-muted/40 rounded text-xs p-2 overflow-auto whitespace-pre-wrap break-all"
      style={{ maxHeight: max }}
    >{text}</pre>
  );
}

function statusesForTab(tab: TabKey): PendingActionStatus | 'all' {
  switch (tab) {
    case 'pending': return 'pending';
    case 'all':     return 'all';
    case 'decided': return 'all'; // filtered client-side below
  }
}

/**
 * Render the AI HITL inbox. Polls the framework's pending-actions queue,
 * renders rows in a table, and exposes Approve / Reject buttons plus a
 * detail drawer with raw `tool_input` / result / error.
 */
export function AiPendingActionsInbox({
  apiBase,
  headers,
  pollInterval = 5000,
  conversationId,
  variant = 'card',
  title = 'AI Approvals',
  description = 'Actions an AI agent proposed that need a human review before execution.',
  className,
}: AiPendingActionsInboxProps) {
  const [tab, setTab] = React.useState<TabKey>('pending');
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [rejectFor, setRejectFor] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [mutationError, setMutationError] = React.useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = React.useState<{ id: string; kind: 'approve' | 'reject'; ok: boolean; message?: string } | null>(null);

  const hookOptions: UsePendingActionsOptions = {
    apiBase,
    headers,
    pollInterval,
    conversationId,
    status: statusesForTab(tab),
  };

  const { items, isLoading, error, refresh, approve, reject } = usePendingActions(hookOptions);

  const rows = React.useMemo(() => {
    if (tab !== 'decided') return items;
    return items.filter(r => r.status !== 'pending');
  }, [items, tab]);

  const selected = React.useMemo<PendingActionRow | null>(
    () => (openId ? items.find(r => r.id === openId) ?? null : null),
    [openId, items],
  );

  const handleApprove = React.useCallback(async (id: string) => {
    setBusyId(id);
    setMutationError(null);
    try {
      const out = await approve(id);
      const ok = out.status === 'executed';
      setLastOutcome({ id, kind: 'approve', ok, message: ok ? 'Executed' : (out.error ?? 'Action failed during execution') });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMutationError(msg);
      setLastOutcome({ id, kind: 'approve', ok: false, message: msg });
    } finally {
      setBusyId(null);
    }
  }, [approve]);

  const handleReject = React.useCallback(async (id: string, reason: string) => {
    setBusyId(id);
    setMutationError(null);
    try {
      await reject(id, reason.trim() || undefined);
      setLastOutcome({ id, kind: 'reject', ok: true, message: 'Rejected' });
      setRejectFor(null);
      setRejectReason('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMutationError(msg);
      setLastOutcome({ id, kind: 'reject', ok: false, message: msg });
    } finally {
      setBusyId(null);
    }
  }, [reject]);

  const body = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="decided">Decided</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={isLoading}
          data-testid="ai-inbox-refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      {mutationError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{mutationError}</AlertDescription>
        </Alert>
      ) : null}

      {lastOutcome && !mutationError ? (
        <Alert variant={lastOutcome.ok ? 'default' : 'destructive'}>
          {lastOutcome.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <AlertDescription>
            {lastOutcome.kind === 'approve' ? 'Approve' : 'Reject'} for{' '}
            <code className="text-xs">{lastOutcome.id.slice(0, 8)}…</code>:{' '}
            {lastOutcome.message ?? (lastOutcome.ok ? 'OK' : 'Failed')}
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading && rows.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>No actions waiting</EmptyTitle>
            <EmptyDescription>
              When the AI proposes a sensitive action it will appear here for review.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Tool</TableHead>
                <TableHead className="w-[140px]">Action</TableHead>
                <TableHead className="w-[120px]">Object</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[110px]">Proposed</TableHead>
                <TableHead className="w-[260px] text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isPending = row.status === 'pending';
                const isBusy = busyId === row.id;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.tool_name}</TableCell>
                    <TableCell className="text-sm">{row.action_name}</TableCell>
                    <TableCell className="text-sm">{row.object_name}</TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatRelative(row.proposed_at)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOpenId(row.id)}
                          data-testid={`ai-inbox-view-${row.id}`}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                        {isPending ? (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              disabled={isBusy}
                              onClick={() => void handleApprove(row.id)}
                              data-testid={`ai-inbox-approve-${row.id}`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              {isBusy ? 'Working…' : 'Approve'}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isBusy}
                              onClick={() => { setRejectFor(row.id); setRejectReason(''); }}
                              data-testid={`ai-inbox-reject-${row.id}`}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Reject
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  const wrapped = variant === 'card' ? (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-4 w-4" /> {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  ) : (
    <div className={className}>{body}</div>
  );

  return (
    <>
      {wrapped}

      {/* Detail drawer */}
      <Sheet open={!!openId} onOpenChange={(o) => { if (!o) setOpenId(null); }}>
        <SheetContent className="sm:max-w-[560px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              {selected ? selected.action_name : 'Pending action'}
            </SheetTitle>
            <SheetDescription>
              {selected ? (
                <>
                  Tool <code className="text-xs">{selected.tool_name}</code> on{' '}
                  <code className="text-xs">{selected.object_name}</code>
                </>
              ) : 'Loading…'}
            </SheetDescription>
          </SheetHeader>

          {selected ? (
            <div className="px-4 space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="mt-1"><StatusBadge status={selected.status} /></div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Proposed</Label>
                  <div className="mt-1 text-xs">{formatRelative(selected.proposed_at)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Proposed by</Label>
                  <div className="mt-1 text-xs font-mono break-all">{selected.proposed_by ?? '—'}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Decided by</Label>
                  <div className="mt-1 text-xs font-mono break-all">{selected.decided_by ?? '—'}</div>
                </div>
                {selected.conversation_id ? (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Conversation</Label>
                    <div className="mt-1 text-xs font-mono break-all">{selected.conversation_id}</div>
                  </div>
                ) : null}
              </div>

              <Separator />

              <div>
                <Label className="text-xs">Tool input</Label>
                <div className="mt-1.5"><JsonBlock value={safeParseJson(selected.tool_input)} /></div>
              </div>

              {selected.result ? (
                <div>
                  <Label className="text-xs">Result</Label>
                  <div className="mt-1.5"><JsonBlock value={safeParseJson(selected.result)} /></div>
                </div>
              ) : null}

              {selected.error ? (
                <div>
                  <Label className="text-xs text-destructive">Error</Label>
                  <div className="mt-1.5"><JsonBlock value={selected.error} /></div>
                </div>
              ) : null}

              {selected.rejection_reason ? (
                <div>
                  <Label className="text-xs">Rejection reason</Label>
                  <div className="mt-1.5 text-sm">{selected.rejection_reason}</div>
                </div>
              ) : null}

              {selected.status === 'pending' ? (
                <div className="pt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void handleApprove(selected.id)}
                    disabled={busyId === selected.id}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Approve & Execute
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { setRejectFor(selected.id); setRejectReason(''); }}
                    disabled={busyId === selected.id}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Reject
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Reject reason dialog (re-uses Sheet for portability) */}
      <Sheet open={!!rejectFor} onOpenChange={(o) => { if (!o) { setRejectFor(null); setRejectReason(''); } }}>
        <SheetContent side="bottom" className="max-h-[40vh]">
          <SheetHeader>
            <SheetTitle>Reject this action?</SheetTitle>
            <SheetDescription>
              The reason is shown back to the AI so it can adjust its next response.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 mt-3 space-y-3">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Optional reason (e.g. 'Wrong record id — please confirm with the user first.')"
              rows={4}
              data-testid="ai-inbox-reject-reason"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setRejectFor(null); setRejectReason(''); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => rejectFor && void handleReject(rejectFor, rejectReason)}
                disabled={!rejectFor || busyId === rejectFor}
                data-testid="ai-inbox-reject-confirm"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Reject
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
