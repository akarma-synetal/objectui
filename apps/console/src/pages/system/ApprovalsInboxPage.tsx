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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Input,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  Search,
  Copy,
  X,
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

/** Relative time, e.g. "2m ago", "3h ago", "5d ago", or absolute date for older. */
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
  // > 30 days — fall back to short date
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}

/**
 * Render an actor/approver identifier in a friendly form.
 *  - emails → shown as-is
 *  - `role:<name>` → shown as "Role: name"
 *  - opaque 16+ char IDs → truncated middle (e.g. `5aF9BX3J…wTk`)
 */
function formatIdentity(id: string | null | undefined): string {
  if (!id) return '—';
  if (id.includes('@')) return id;
  if (id.startsWith('role:')) return `Role: ${id.slice(5)}`;
  if (id.length > 14) return `${id.slice(0, 6)}…${id.slice(-4)}`;
  return id;
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

  // Search + filters (client-side; lists are typically small)
  const [query, setQuery] = useState('');
  const [processFilter, setProcessFilter] = useState<string>('all');
  const [objectFilter, setObjectFilter] = useState<string>('all');

  // Bulk selection (only meaningful on "pending" tab where the user can act)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

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

  /** Unique process names present in current rows (for filter dropdown). */
  const processOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.process_name) set.add(r.process_name);
    return Array.from(set).sort();
  }, [rows]);

  /** Unique object names present in current rows (for filter dropdown). */
  const objectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.object_name) set.add(r.object_name);
    return Array.from(set).sort();
  }, [rows]);

  /** Client-side filtered rows shown in table. */
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (processFilter !== 'all' && r.process_name !== processFilter) return false;
      if (objectFilter !== 'all' && r.object_name !== objectFilter) return false;
      if (!q) return true;
      const hay = [
        r.process_name, r.object_name, r.record_id, r.submitter_id,
        ...(r.pending_approvers || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, processFilter, objectFilter]);

  // Reset selection when underlying filtered list changes (avoid acting on hidden rows).
  useEffect(() => {
    if (selectedRowIds.size === 0) return;
    const visible = new Set(filteredRows.map(r => r.id));
    let changed = false;
    const next = new Set<string>();
    for (const id of selectedRowIds) {
      if (visible.has(id)) next.add(id);
      else changed = true;
    }
    if (changed) setSelectedRowIds(next);
  }, [filteredRows, selectedRowIds]);

  /**
   * Rows the user is actually allowed to bulk-act on:
   * status=pending AND one of the user's identities is in pending_approvers.
   */
  const actionableSelectedRows = useMemo(() => {
    const idSet = new Set(identities);
    return filteredRows.filter(r =>
      selectedRowIds.has(r.id) &&
      r.status === 'pending' &&
      (r.pending_approvers || []).some(a => idSet.has(a)),
    );
  }, [filteredRows, selectedRowIds, identities]);

  const allFilteredSelectable = filteredRows.filter(r => r.status === 'pending');
  const allSelected =
    allFilteredSelectable.length > 0 &&
    allFilteredSelectable.every(r => selectedRowIds.has(r.id));

  const toggleAll = useCallback(() => {
    setSelectedRowIds(prev => {
      if (allSelected) return new Set();
      const next = new Set(prev);
      for (const r of allFilteredSelectable) next.add(r.id);
      return next;
    });
  }, [allSelected, allFilteredSelectable]);

  const toggleRow = useCallback((id: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  /** Bulk approve / reject the actionable selection. Runs sequentially for clear progress. */
  const runBulk = useCallback(async (kind: 'approve' | 'reject') => {
    const targets = actionableSelectedRows;
    if (targets.length === 0) return;
    setBulkRunning(true);
    let ok = 0;
    let fail = 0;
    for (const r of targets) {
      const pending = new Set(r.pending_approvers || []);
      const actor = identities.find(i => pending.has(i)) || user?.id || '';
      try {
        const fn = kind === 'approve' ? approvalsApi.approve : approvalsApi.reject;
        await fn(r.id, { actor_id: actor });
        ok++;
      } catch {
        fail++;
      }
    }
    setBulkRunning(false);
    setSelectedRowIds(new Set());
    if (fail === 0) toast.success(`${kind === 'approve' ? 'Approved' : 'Rejected'} ${ok} request${ok === 1 ? '' : 's'}`);
    else toast.error(`${ok} succeeded, ${fail} failed`);
    void load();
  }, [actionableSelectedRows, identities, user?.id, load]);

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
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="submitted">Submitted by me</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {/* Toolbar: search + filters */}
          {!loading && rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search process, record, approver…"
                  className="pl-8 h-8 text-sm"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {processOptions.length > 1 && (
                <Select value={processFilter} onValueChange={setProcessFilter}>
                  <SelectTrigger className="h-8 w-auto min-w-[140px] text-sm">
                    <SelectValue placeholder="Process" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All processes</SelectItem>
                    {processOptions.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {objectOptions.length > 1 && (
                <Select value={objectFilter} onValueChange={setObjectFilter}>
                  <SelectTrigger className="h-8 w-auto min-w-[140px] text-sm">
                    <SelectValue placeholder="Object" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All objects</SelectItem>
                    {objectOptions.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {(query || processFilter !== 'all' || objectFilter !== 'all') && (
                <span className="text-xs text-muted-foreground">
                  {filteredRows.length} of {rows.length}
                </span>
              )}
            </div>
          )}

          {/* Bulk action bar (visible when ≥1 row selected on pending tab) */}
          {tab === 'pending' && selectedRowIds.size > 0 && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-accent/30 text-sm">
              <span>
                <strong>{selectedRowIds.size}</strong> selected
                {actionableSelectedRows.length !== selectedRowIds.size && (
                  <span className="text-muted-foreground ml-1">
                    ({actionableSelectedRows.length} actionable)
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => runBulk('approve')}
                  disabled={bulkRunning || actionableSelectedRows.length === 0}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Approve {actionableSelectedRows.length || ''}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={bulkRunning || actionableSelectedRows.length === 0}
                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Reject {actionableSelectedRows.length || ''}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reject {actionableSelectedRows.length} requests?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will reject the selected requests and notify their submitters.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => runBulk('reject')}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Reject {actionableSelectedRows.length}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedRowIds(new Set())}
                  disabled={bulkRunning}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center min-h-[240px] rounded-md border border-dashed">
              <Empty>
                <EmptyTitle>No requests</EmptyTitle>
                <EmptyDescription>
                  {tab === 'pending' ? 'You have no pending approvals.' : 'Nothing here yet.'}
                </EmptyDescription>
              </Empty>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex items-center justify-center min-h-[160px] rounded-md border border-dashed text-sm text-muted-foreground">
              No matches for current filters.
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {tab === 'pending' && (
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={toggleAll}
                            aria-label="Select all"
                            disabled={allFilteredSelectable.length === 0}
                          />
                        </TableHead>
                      )}
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
                    {filteredRows.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => openDrawer(r.id)}
                      >
                        {tab === 'pending' && (
                          <TableCell
                            className="w-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={selectedRowIds.has(r.id)}
                              onCheckedChange={() => toggleRow(r.id)}
                              disabled={r.status !== 'pending'}
                              aria-label={`Select request ${r.id}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-medium">{r.process_name}</TableCell>
                        <TableCell>{r.object_name}</TableCell>
                        <TableCell className="font-mono text-xs" title={r.record_id}>
                          {formatIdentity(r.record_id)}
                        </TableCell>
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
                        <TableCell
                          className="max-w-[220px] truncate text-xs text-muted-foreground"
                          title={(r.pending_approvers || []).join(', ')}
                        >
                          {(r.pending_approvers || []).map(formatIdentity).join(', ') || '—'}
                        </TableCell>
                        <TableCell
                          className="text-xs whitespace-nowrap text-muted-foreground"
                          title={formatDate(r.submitted_at)}
                        >
                          <Clock className="h-3 w-3 inline mr-1" />
                          {formatRelative(r.submitted_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
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
                <div><div className="text-muted-foreground text-xs">Submitter</div><span className="font-mono text-xs" title={selected.submitter_id || ''}>{formatIdentity(selected.submitter_id)}</span></div>
                <div><div className="text-muted-foreground text-xs">Submitted</div>{formatDate(selected.submitted_at)}</div>
                <div><div className="text-muted-foreground text-xs">Completed</div>{formatDate(selected.completed_at)}</div>
                <div className="col-span-2">
                  <div className="text-muted-foreground text-xs">Pending Approvers</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(selected.pending_approvers || []).length === 0 ? '—' :
                      (selected.pending_approvers || []).map((a, i) => (
                        <Badge key={i} variant="outline" className="font-mono text-[10px]" title={a}>{formatIdentity(a)}</Badge>
                      ))}
                  </div>
                </div>
                {selected.payload && (
                  <div className="col-span-2">
                    <div className="flex items-center justify-between">
                      <div className="text-muted-foreground text-xs">Payload</div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(JSON.stringify(selected.payload, null, 2));
                            toast.success('Payload copied');
                          } catch {
                            toast.error('Copy failed');
                          }
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </button>
                    </div>
                    <pre className="text-[11px] bg-muted/50 rounded p-2 overflow-auto max-h-32 mt-1">
                      {JSON.stringify(selected.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold mb-3">Action History</h3>
                {actions.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No actions yet.</div>
                ) : (
                  <ol className="relative space-y-3 pl-5 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-border">
                    {actions.map((a) => {
                      const color = a.action === 'approve' ? 'bg-emerald-500'
                                  : a.action === 'reject'  ? 'bg-destructive'
                                  : a.action === 'submit'  ? 'bg-blue-500'
                                  : a.action === 'recall'  ? 'bg-muted-foreground'
                                  : 'bg-muted-foreground';
                      return (
                        <li key={a.id} className="relative text-xs">
                          <span
                            className={`absolute -left-[18px] top-1 h-3 w-3 rounded-full ring-2 ring-background ${color}`}
                            aria-hidden
                          />
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="font-medium capitalize">{a.action}</span>
                            <span className="text-muted-foreground">by</span>
                            <span className="font-mono" title={a.actor_id || ''}>{formatIdentity(a.actor_id)}</span>
                            {a.step_name && (
                              <span className="text-muted-foreground">· {a.step_name} (#{a.step_index})</span>
                            )}
                            <span
                              className="ml-auto text-muted-foreground text-[10px]"
                              title={formatDate(a.created_at)}
                            >
                              {formatRelative(a.created_at)}
                            </span>
                          </div>
                          {a.comment && (
                            <div className="text-muted-foreground italic mt-0.5">"{a.comment}"</div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>

              {selected.status === 'pending' && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <details className="group">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
                        Override actor (advanced)
                      </summary>
                      <div className="mt-2">
                        <Label htmlFor="actor-override" className="text-xs">
                          Actor
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
                    </details>
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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canApproveReject || submitting !== null}
                            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            {submitting === 'reject' ? 'Rejecting…' : 'Reject'}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reject this request?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will mark the request as rejected and notify the submitter.
                              {selected.current_step_index != null && selected.current_step_index > 0
                                ? ' If the process is multi-step, it returns to the previous step.'
                                : ''}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => doAction('reject')}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Reject
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
