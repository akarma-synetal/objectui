/**
 * Approvals Inbox
 *
 * Front-end for `@objectstack/plugin-approvals` (M11.C15).
 *
 * Tabs:
 *   • My Pending      — requests where the signed-in user is in
 *                       `pending_approvers` (matched by id, email, or
 *                       `role:<name>` for each assigned role).
 *   • Submitted by me — requests where `submitter_id` is the user.
 *   • All             — every request (any status).
 *
 * Selecting a row opens a side sheet showing the action history and
 * Approve / Reject / Recall buttons (enabled based on actor + status).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
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
  Textarea,
  Label,
  Skeleton,
  Empty,
  EmptyTitle,
  EmptyDescription,
  Alert,
  AlertDescription,
  Separator,
} from '@object-ui/components';
import { toast } from 'sonner';
import { useAuth } from '@object-ui/auth';
import {
  CheckCircle2,
  XCircle,
  Undo2,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckSquare,
} from 'lucide-react';
import {
  approvalsApi,
  buildApproverIdentities,
  type ApprovalRequestRow,
  type ApprovalActionRow,
} from '../../services/approvalsApi';

type TabKey = 'pending' | 'submitted' | 'all';

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  pending:  { variant: 'secondary',   label: 'Pending'  },
  approved: { variant: 'default',     label: 'Approved' },
  rejected: { variant: 'destructive', label: 'Rejected' },
  recalled: { variant: 'outline',     label: 'Recalled' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { variant: 'outline' as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

export function ApprovalsInboxPage() {
  const { user } = useAuth();
  const identities = useMemo(() => buildApproverIdentities(user as any), [user]);

  const [tab, setTab] = useState<TabKey>('pending');
  const [rows, setRows] = useState<ApprovalRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApprovalRequestRow | null>(null);
  const [actions, setActions] = useState<ApprovalActionRow[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [actorOverride, setActorOverride] = useState('');
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | 'recall' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const requests: ApprovalRequestRow[] = [];
      if (tab === 'pending') {
        // Union of "approverId substring matches" across all identities.
        const seen = new Set<string>();
        if (identities.length === 0) {
          const res = await approvalsApi.listRequests({ status: 'pending' });
          for (const r of res.data) requests.push(r);
        } else {
          for (const id of identities) {
            const res = await approvalsApi.listRequests({ status: 'pending', approverId: id });
            for (const r of res.data) {
              if (!seen.has(r.id)) { seen.add(r.id); requests.push(r); }
            }
          }
        }
      } else if (tab === 'submitted') {
        const submitterId = user?.id;
        if (!submitterId) {
          setRows([]); setLoading(false); return;
        }
        const res = await approvalsApi.listRequests({ submitterId });
        requests.push(...res.data);
      } else {
        const res = await approvalsApi.listRequests({});
        requests.push(...res.data);
      }
      // Newest first.
      requests.sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));
      setRows(requests);
    } catch (err: any) {
      setError(err?.message || String(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, identities, user?.id]);

  useEffect(() => { void load(); }, [load]);

  const openDrawer = useCallback(async (id: string) => {
    setSelectedId(id);
    setDrawerLoading(true);
    setComment('');
    setActorOverride('');
    try {
      const [req, acts] = await Promise.all([
        approvalsApi.getRequest(id),
        approvalsApi.listActions(id),
      ]);
      setSelected(req.data);
      setActions(acts.data);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load request');
      setSelected(null);
      setActions([]);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const closeDrawer = () => {
    setSelectedId(null);
    setSelected(null);
    setActions([]);
    setComment('');
    setActorOverride('');
  };

  /**
   * Pick the actor id to send with approve/reject.
   *   1. Manual override (textbox), useful when impersonating a role
   *      like `role:sales_manager`.
   *   2. First identity that intersects `pending_approvers`.
   *   3. User id fallback.
   */
  const resolveActor = useCallback((req: ApprovalRequestRow | null): string => {
    if (actorOverride.trim()) return actorOverride.trim();
    if (!req) return user?.id || '';
    const pending = new Set(req.pending_approvers || []);
    for (const id of identities) if (pending.has(id)) return id;
    return user?.id || '';
  }, [actorOverride, identities, user?.id]);

  const doAction = useCallback(async (kind: 'approve' | 'reject' | 'recall') => {
    if (!selected) return;
    const actor = resolveActor(selected);
    if (!actor) {
      toast.error('Cannot determine actor id');
      return;
    }
    setSubmitting(kind);
    try {
      const body = { actor_id: actor, comment: comment.trim() || undefined };
      const fn = kind === 'approve' ? approvalsApi.approve
              : kind === 'reject'  ? approvalsApi.reject
              : approvalsApi.recall;
      const res = await fn(selected.id, body);
      toast.success(
        kind === 'approve' ? (res.finalized ? 'Approved (finalized)' : 'Approved — advanced to next step')
        : kind === 'reject' ? (res.finalized ? 'Rejected' : 'Rejected — returned to previous step')
        : 'Recalled',
      );
      setComment('');
      // Refresh drawer + list.
      const [req, acts] = await Promise.all([
        approvalsApi.getRequest(selected.id),
        approvalsApi.listActions(selected.id),
      ]);
      setSelected(req.data);
      setActions(acts.data);
      void load();
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${kind}`);
    } finally {
      setSubmitting(null);
    }
  }, [selected, resolveActor, comment, load]);

  const canApproveReject = useMemo(() => {
    if (!selected || selected.status !== 'pending') return false;
    const pending = new Set(selected.pending_approvers || []);
    return identities.some(id => pending.has(id)) || actorOverride.trim().length > 0;
  }, [selected, identities, actorOverride]);

  const canRecall = useMemo(() => {
    if (!selected || selected.status !== 'pending') return false;
    return selected.submitter_id === user?.id || actorOverride.trim().length > 0;
  }, [selected, user?.id, actorOverride]);

  const pendingCount = useMemo(() => rows.filter(r => r.status === 'pending').length, [rows]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 max-w-6xl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CheckSquare className="h-6 w-6" />
            Approvals Inbox
          </h1>
          <p className="text-sm text-muted-foreground">
            Review and act on multi-step approval requests.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="pending">
            My Pending
            {tab === 'pending' && pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="submitted">Submitted by me</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {tab === 'pending' && (
                  <span className="text-sm text-muted-foreground font-normal">
                    Matching identities: {identities.length === 0 ? '(none — showing all pending)' : identities.join(', ')}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : rows.length === 0 ? (
                <Empty>
                  <EmptyTitle>No requests</EmptyTitle>
                  <EmptyDescription>
                    {tab === 'pending' ? 'You have no pending approvals.' : 'Nothing here yet.'}
                  </EmptyDescription>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Process</TableHead>
                      <TableHead>Object</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Approvers</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => openDrawer(r.id)}
                      >
                        <TableCell className="font-medium">{r.process_name}</TableCell>
                        <TableCell>{r.object_name}</TableCell>
                        <TableCell className="font-mono text-xs">{r.record_id}</TableCell>
                        <TableCell>
                          {r.current_step ? (
                            <span className="text-xs">
                              {r.current_step}
                              {typeof r.current_step_index === 'number' && (
                                <span className="text-muted-foreground"> (#{r.current_step_index})</span>
                              )}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {(r.pending_approvers || []).join(', ') || '—'}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {formatDate(r.submitted_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={!!selectedId} onOpenChange={(open) => !open && closeDrawer()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Approval Request</SheetTitle>
            <SheetDescription>
              {selected ? `${selected.process_name} · ${selected.object_name}/${selected.record_id}` : ''}
            </SheetDescription>
          </SheetHeader>

          {drawerLoading ? (
            <div className="space-y-2 mt-6">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : selected ? (
            <div className="space-y-4 mt-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-muted-foreground text-xs">Status</div><StatusBadge status={selected.status} /></div>
                <div><div className="text-muted-foreground text-xs">Current Step</div>{selected.current_step || '—'}</div>
                <div><div className="text-muted-foreground text-xs">Step Index</div>{selected.current_step_index ?? '—'}</div>
                <div><div className="text-muted-foreground text-xs">Submitter</div><span className="font-mono text-xs">{selected.submitter_id || '—'}</span></div>
                <div><div className="text-muted-foreground text-xs">Submitted</div>{formatDate(selected.submitted_at)}</div>
                <div><div className="text-muted-foreground text-xs">Completed</div>{formatDate(selected.completed_at)}</div>
                <div className="col-span-2">
                  <div className="text-muted-foreground text-xs">Pending Approvers</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(selected.pending_approvers || []).length === 0 ? '—' :
                      (selected.pending_approvers || []).map((a, i) => (
                        <Badge key={i} variant="outline" className="font-mono text-[10px]">{a}</Badge>
                      ))}
                  </div>
                </div>
                {selected.payload && (
                  <div className="col-span-2">
                    <div className="text-muted-foreground text-xs">Payload</div>
                    <pre className="text-[11px] bg-muted/50 rounded p-2 overflow-auto max-h-32 mt-1">
                      {JSON.stringify(selected.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold mb-2">Action History</h3>
                <div className="space-y-2">
                  {actions.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No actions yet.</div>
                  ) : actions.map((a) => (
                    <div key={a.id} className="flex items-start gap-2 text-xs border-l-2 border-muted pl-3 py-1">
                      <Badge variant="outline" className="text-[10px]">{a.action}</Badge>
                      <div className="flex-1">
                        <div>
                          <span className="font-mono">{a.actor_id || '—'}</span>
                          {a.step_name && <span className="text-muted-foreground"> · {a.step_name} (#{a.step_index})</span>}
                        </div>
                        {a.comment && <div className="text-muted-foreground italic">"{a.comment}"</div>}
                        <div className="text-muted-foreground text-[10px]">{formatDate(a.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selected.status === 'pending' && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="actor-override" className="text-xs">
                        Actor (optional override)
                      </Label>
                      <input
                        id="actor-override"
                        type="text"
                        value={actorOverride}
                        onChange={(e) => setActorOverride(e.target.value)}
                        placeholder={`Auto: ${resolveActor(selected) || '(none)'}`}
                        className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                      />
                      <div className="text-[10px] text-muted-foreground mt-1">
                        e.g. <code>role:sales_manager</code>. Leave blank to use auto-detected.
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="comment" className="text-xs">Comment (optional)</Label>
                      <Textarea
                        id="comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => doAction('approve')}
                        disabled={!canApproveReject || submitting !== null}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        {submitting === 'approve' ? 'Approving…' : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => doAction('reject')}
                        disabled={!canApproveReject || submitting !== null}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        {submitting === 'reject' ? 'Rejecting…' : 'Reject'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => doAction('recall')}
                        disabled={!canRecall || submitting !== null}
                      >
                        <Undo2 className="h-4 w-4 mr-1" />
                        {submitting === 'recall' ? 'Recalling…' : 'Recall'}
                      </Button>
                    </div>
                    {!canApproveReject && !canRecall && (
                      <div className="text-xs text-muted-foreground">
                        You are not in the pending approvers list and did not submit this request.
                        Use the override above to act as another identity (e.g. <code>role:sales_manager</code>).
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
