/**
 * Approvals Inbox
 *
 * Front-end for `@objectstack/plugin-approvals` (M11.C15 / ADR-0019).
 *
 * Tabs:
 *   • My Pending      — requests where the signed-in user is in
 *                       `pending_approvers` (matched by id, email, or
 *                       `role:<name>` for each assigned role).
 *   • Submitted by me — requests where `submitter_id` is the user.
 *   • All             — every request (any status).
 *
 * Business-first information architecture: rows lead with the flow's display
 * label and the target record's title (server-enriched `process_label` /
 * `record_title` / `submitter_name`), not machine names and opaque ids. The
 * side sheet shows a structured summary of the record snapshot, the action
 * timeline, and Approve / Reject / Recall (enabled based on actor + status,
 * with the reason inline when disabled).
 *
 * Keyboard: j/k move row focus · Enter opens · x toggles selection ·
 * a approves · r rejects (with confirm). Disabled while a dialog is open or
 * an input is focused.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
  cn,
} from '@object-ui/components';
import { toast } from 'sonner';
import { useAuth, useIsWorkspaceAdmin } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
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
  ExternalLink,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  approvalsApi,
  buildApproverIdentities,
  type ApprovalRequestRow,
  type ApprovalActionRow,
} from '../../services/approvalsApi';

type TabKey = 'pending' | 'submitted' | 'all';

/**
 * Semantic status colors (green = approved, amber = waiting, red = rejected,
 * slate = recalled) — variant-based Badge colors read as monochrome chrome,
 * not as state.
 */
const STATUS_CLASSES: Record<string, string> = {
  pending:  'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
  rejected: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400',
  recalled: 'border-border bg-muted text-muted-foreground',
};

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
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

/** `manager_review` → "Manager Review" (display fallback for legacy rows). */
function prettifyMachineName(raw: string | null | undefined): string {
  if (!raw) return '—';
  const base = String(raw).replace(/^flow:/, '').trim();
  return base.split(/[_\-\s]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || '—';
}

function processLabel(r: ApprovalRequestRow): string {
  return r.process_label || prettifyMachineName(r.process_name);
}
function stepLabel(r: ApprovalRequestRow): string | null {
  if (r.step_label) return r.step_label;
  return r.current_step ? prettifyMachineName(r.current_step) : null;
}
function submitterDisplay(r: ApprovalRequestRow): string {
  return r.submitter_name || formatIdentity(r.submitter_id);
}
/** Approver chip text: server-resolved display name, else readable identity. */
function approverDisplay(a: string, r: ApprovalRequestRow): string {
  return r.pending_approver_names?.[a] || formatIdentity(a);
}
/** Object subtitle: schema label when resolved, else the machine name. */
function objectDisplay(r: ApprovalRequestRow): string {
  return r.object_label || r.object_name;
}
function submittedAt(r: ApprovalRequestRow): string | undefined {
  return r.submitted_at || r.created_at || undefined;
}

/** Hours a pending request has been waiting; null when no timestamp. */
function waitingHours(r: ApprovalRequestRow): number | null {
  const s = submittedAt(r);
  if (!s) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 36e5;
}

/** Aging tint: quiet under a day, amber 1–3 days, red beyond 3 days. */
function agingClass(r: ApprovalRequestRow): string {
  if (r.status !== 'pending') return 'text-muted-foreground';
  const h = waitingHours(r);
  if (h == null) return 'text-muted-foreground';
  if (h > 72) return 'text-red-600 dark:text-red-400 font-medium';
  if (h > 24) return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}

const PAYLOAD_SYSTEM_KEYS = new Set([
  'id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'organization_id',
]);

function prettifyKey(k: string): string {
  return k.split('_').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatPayloadValue(key: string, v: unknown): string {
  if (typeof v === 'boolean') return v ? '✓' : '—';
  if (typeof v === 'number') {
    // Epoch-ms timestamps read as dates; everything else as a localized number.
    if (v > 1e12 && /(_at$|_date$|^date_|_time$)/.test(key)) {
      try { return new Date(v).toLocaleDateString(); } catch { /* fall through */ }
    }
    return v.toLocaleString();
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}/.test(s)) {
    try { return new Date(s).toLocaleString(); } catch { /* fall through */ }
  }
  return s;
}

/** Opaque foreign-key shape: long unbroken alphanumeric token, not a number. */
const OPAQUE_ID_RE = /^[A-Za-z0-9_-]{15,}$/;

/**
 * First N scalar business fields of the record snapshot, for the summary
 * card. Lookup foreign keys render their server-resolved record title
 * (`payload_display`); an unresolved opaque id is dropped rather than shown —
 * a business reader gets nothing from `dpOfPMy7cbeEL1jk`.
 */
function payloadSummary(
  payload: unknown,
  display?: Record<string, string>,
  max = 6,
): Array<[string, string]> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (PAYLOAD_SYSTEM_KEYS.has(k)) continue;
    if (v == null || typeof v === 'object') continue;
    if (String(v).trim() === '') continue;
    const resolved = display?.[k];
    if (!resolved && typeof v === 'string' && OPAQUE_ID_RE.test(v.trim()) && !/^\d+$/.test(v.trim())) {
      continue;
    }
    out.push([prettifyKey(k), resolved ?? formatPayloadValue(k, v)]);
    if (out.length >= max) break;
  }
  return out;
}

export function ApprovalsInboxPage() {
  const { t, language } = useObjectTranslation();
  const { user } = useAuth();
  const isAdmin = useIsWorkspaceAdmin();
  const { appName } = useParams<{ appName?: string }>();
  const identities = useMemo(() => buildApproverIdentities(user as any), [user]);

  const tr = useCallback(
    (key: string, defaultValue: string, opts?: Record<string, unknown>) =>
      String(t(`approvalsInbox.${key}`, { defaultValue, ...opts })),
    [t],
  );

  /** Localized relative time, e.g. "5m ago" / "5 分钟前". */
  const formatRelative = useCallback((s: string | null | undefined): string => {
    if (!s) return '—';
    const ts = Date.parse(s);
    if (Number.isNaN(ts)) return s;
    const sec = Math.round((Date.now() - ts) / 1000);
    if (sec < 45) return tr('justNow', 'just now');
    const min = Math.round(sec / 60);
    if (min < 60) return tr('minutesAgo', '{{count}}m ago', { count: min });
    const hr = Math.round(min / 60);
    if (hr < 24) return tr('hoursAgo', '{{count}}h ago', { count: hr });
    const day = Math.round(hr / 24);
    if (day < 30) return tr('daysAgo', '{{count}}d ago', { count: day });
    try { return new Date(s).toLocaleDateString(language); } catch { return s; }
  }, [tr, language]);

  const statusLabel = useCallback((status: string): string => {
    switch (status) {
      case 'pending': return tr('statusPending', 'Pending');
      case 'approved': return tr('statusApproved', 'Approved');
      case 'rejected': return tr('statusRejected', 'Rejected');
      case 'recalled': return tr('statusRecalled', 'Recalled');
      default: return status;
    }
  }, [tr]);

  /** Map raw API errors to business-readable toasts (no `HTTP_404: Not found`). */
  const humanizeError = useCallback((err: any, fallback: string): string => {
    const code = err?.code ?? '';
    const status = err?.status ?? 0;
    if (code === 'NOT_IMPLEMENTED' || status === 501) {
      return tr('recallUnavailable', 'Recall is not available on this deployment.');
    }
    if (status === 404) return tr('requestGone', 'This request no longer exists. Refresh the list.');
    if (code === 'FORBIDDEN' || status === 403) return tr('notAllowed', 'You are not allowed to perform this action.');
    if (code === 'INVALID_STATE' || status === 409) return tr('alreadyDecided', 'This request was already decided. Refresh the list.');
    return err?.message || fallback;
  }, [tr]);

  function StatusBadge({ status }: { status: string }) {
    return (
      <Badge variant="outline" className={cn('font-medium', STATUS_CLASSES[status] ?? '')}>
        {statusLabel(status)}
      </Badge>
    );
  }

  const recordHref = useCallback((r: ApprovalRequestRow): string => {
    const app = appName || 'setup';
    return `/apps/${app}/${encodeURIComponent(r.object_name)}/record/${encodeURIComponent(r.record_id)}`;
  }, [appName]);

  const [tab, setTab] = useState<TabKey>('pending');
  const [rows, setRows] = useState<ApprovalRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** "My pending" count, independent of the active tab (badge + bell parity). */
  const [myPendingCount, setMyPendingCount] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApprovalRequestRow | null>(null);
  const [actions, setActions] = useState<ApprovalActionRow[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [actorOverride, setActorOverride] = useState('');
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | 'recall' | null>(null);

  // Search + filters (client-side; lists are capped server-side)
  const [query, setQuery] = useState('');
  const [processFilter, setProcessFilter] = useState<string>('all');
  const [objectFilter, setObjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Bulk selection (only meaningful on "pending" tab where the user can act)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  // Inline reject confirmation target (row-level quick action / keyboard)
  const [rejectTarget, setRejectTarget] = useState<ApprovalRequestRow | null>(null);
  const [inlineActing, setInlineActing] = useState<string | null>(null);

  // Keyboard row focus
  const [focusIndex, setFocusIndex] = useState<number>(-1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let requests: ApprovalRequestRow[] = [];
      if (tab === 'pending') {
        // ONE request with every identity — the server matches ANY of them.
        requests = identities.length
          ? (await approvalsApi.listRequests({ status: 'pending', approverId: identities })).data
          : [];
        setMyPendingCount(requests.length);
      } else {
        if (tab === 'submitted') {
          const submitterId = user?.id;
          requests = submitterId
            ? (await approvalsApi.listRequests({ submitterId })).data
            : [];
        } else {
          requests = (await approvalsApi.listRequests({})).data;
        }
        // Keep the badge honest while browsing other tabs.
        if (identities.length) {
          approvalsApi.listRequests({ status: 'pending', approverId: identities })
            .then(res => setMyPendingCount(res.data.length))
            .catch(() => { /* badge refresh is best-effort */ });
        }
      }
      // Newest first — submitted_at falls back to created_at for legacy rows.
      requests.sort((a, b) => (submittedAt(b) || '').localeCompare(submittedAt(a) || ''));
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
      toast.error(humanizeError(err, tr('loadFailed', 'Failed to load request')));
      setSelected(null);
      setActions([]);
    } finally {
      setDrawerLoading(false);
    }
  }, [humanizeError, tr]);

  const closeDrawer = () => {
    setSelectedId(null);
    setSelected(null);
    setActions([]);
    setComment('');
    setActorOverride('');
  };

  /**
   * Pick the actor id to send with approve/reject.
   *   1. Manual override (admin-only textbox), useful when acting as a role
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

  const refreshBadge = useCallback(() => {
    if (!identities.length) return;
    approvalsApi.listRequests({ status: 'pending', approverId: identities })
      .then(res => setMyPendingCount(res.data.length))
      .catch(() => { /* best-effort */ });
  }, [identities]);

  const doAction = useCallback(async (kind: 'approve' | 'reject' | 'recall') => {
    if (!selected) return;
    const actor = kind === 'recall' ? (user?.id || resolveActor(selected)) : resolveActor(selected);
    if (!actor) {
      toast.error(tr('noActor', 'Cannot determine the acting identity'));
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
        kind === 'approve'
          ? (res.finalized ? tr('approvedFinal', 'Approved') : tr('approvedWaiting', 'Approved — waiting on the remaining approvers'))
          : kind === 'reject' ? tr('rejectedToast', 'Rejected')
          : tr('recalledToast', 'Request recalled'),
      );
      setComment('');
      // Queue processing (Fiori "My Inbox" pattern): a decision on the
      // pending tab advances straight to the next waiting item instead of
      // parking on the finished one. Recall keeps the drawer for review.
      if (kind !== 'recall' && tab === 'pending') {
        const list = filteredRef.current;
        const idx = list.findIndex(r => r.id === selected.id);
        const next = list[idx + 1] ?? list[idx - 1];
        void load();
        if (next && next.id !== selected.id) void openDrawer(next.id);
        else closeDrawer();
        return;
      }
      // Refresh drawer + list.
      const [req, acts] = await Promise.all([
        approvalsApi.getRequest(selected.id),
        approvalsApi.listActions(selected.id),
      ]);
      setSelected(req.data);
      setActions(acts.data);
      void load();
    } catch (err: any) {
      toast.error(humanizeError(err, tr('actionFailed', 'Action failed')));
    } finally {
      setSubmitting(null);
    }
  }, [selected, resolveActor, comment, load, user?.id, humanizeError, tr, tab, openDrawer]);

  const canApproveReject = useMemo(() => {
    if (!selected || selected.status !== 'pending') return false;
    const pending = new Set(selected.pending_approvers || []);
    return identities.some(id => pending.has(id)) || actorOverride.trim().length > 0;
  }, [selected, identities, actorOverride]);

  const canRecall = useMemo(() => {
    if (!selected || selected.status !== 'pending') return false;
    return selected.submitter_id === user?.id || actorOverride.trim().length > 0;
  }, [selected, user?.id, actorOverride]);


  /** Unique process labels present in current rows (for filter dropdown). */
  const processOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(processLabel(r));
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
      if (processFilter !== 'all' && processLabel(r) !== processFilter) return false;
      if (objectFilter !== 'all' && r.object_name !== objectFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        r.process_name, r.process_label, r.step_label, r.object_name,
        r.record_id, r.record_title, r.submitter_id, r.submitter_name,
        ...(r.pending_approvers || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, processFilter, objectFilter, statusFilter]);
  /** Position of the open request within the visible list (drawer prev/next). */
  const drawerIndex = useMemo(
    () => (selectedId ? filteredRows.findIndex(r => r.id === selectedId) : -1),
    [filteredRows, selectedId],
  );

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

  // Clamp keyboard focus to the visible list.
  useEffect(() => {
    if (focusIndex >= filteredRows.length) setFocusIndex(filteredRows.length - 1);
  }, [filteredRows.length, focusIndex]);

  const isActionable = useCallback((r: ApprovalRequestRow): boolean => {
    if (r.status !== 'pending') return false;
    const idSet = new Set(identities);
    return (r.pending_approvers || []).some(a => idSet.has(a));
  }, [identities]);

  /**
   * Rows the user is actually allowed to bulk-act on:
   * status=pending AND one of the user's identities is in pending_approvers.
   */
  const actionableSelectedRows = useMemo(
    () => filteredRows.filter(r => selectedRowIds.has(r.id) && isActionable(r)),
    [filteredRows, selectedRowIds, isActionable],
  );

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

  /**
   * Bulk approve / reject the actionable selection. Runs sequentially for
   * clear progress; failures are reported per record, not just as a count.
   */
  const runBulk = useCallback(async (kind: 'approve' | 'reject') => {
    const targets = actionableSelectedRows;
    if (targets.length === 0) return;
    setBulkRunning(true);
    let ok = 0;
    const failures: string[] = [];
    for (const r of targets) {
      const pending = new Set(r.pending_approvers || []);
      const actor = identities.find(i => pending.has(i)) || user?.id || '';
      try {
        const fn = kind === 'approve' ? approvalsApi.approve : approvalsApi.reject;
        await fn(r.id, { actor_id: actor });
        ok++;
      } catch {
        failures.push(r.record_title || formatIdentity(r.record_id));
      }
    }
    setBulkRunning(false);
    setSelectedRowIds(new Set());
    if (failures.length === 0) {
      toast.success(kind === 'approve'
        ? tr('bulkApproved', 'Approved {{count}} requests', { count: ok })
        : tr('bulkRejected', 'Rejected {{count}} requests', { count: ok }));
    } else {
      const shown = failures.slice(0, 3).join(', ');
      toast.error(tr('bulkPartial', '{{ok}} succeeded, {{fail}} failed: {{which}}', {
        ok, fail: failures.length, which: shown + (failures.length > 3 ? '…' : ''),
      }));
    }
    void load();
    refreshBadge();
  }, [actionableSelectedRows, identities, user?.id, load, refreshBadge, tr]);

  /** Row-level quick approve (hover button / `a` key). */
  const inlineApprove = useCallback(async (r: ApprovalRequestRow) => {
    if (!isActionable(r) || inlineActing) return;
    const pending = new Set(r.pending_approvers || []);
    const actor = identities.find(i => pending.has(i)) || user?.id || '';
    setInlineActing(r.id);
    try {
      const res = await approvalsApi.approve(r.id, { actor_id: actor });
      toast.success(res.finalized
        ? tr('inlineApproved', 'Approved "{{title}}"', { title: r.record_title || formatIdentity(r.record_id) })
        : tr('approvedWaiting', 'Approved — waiting on the remaining approvers'));
      void load();
      refreshBadge();
    } catch (err: any) {
      toast.error(humanizeError(err, tr('actionFailed', 'Action failed')));
    } finally {
      setInlineActing(null);
    }
  }, [isActionable, inlineActing, identities, user?.id, load, refreshBadge, humanizeError, tr]);

  /** Confirmed row-level reject (from the shared dialog). */
  const inlineReject = useCallback(async () => {
    const r = rejectTarget;
    if (!r) return;
    const pending = new Set(r.pending_approvers || []);
    const actor = identities.find(i => pending.has(i)) || user?.id || '';
    setInlineActing(r.id);
    setRejectTarget(null);
    try {
      await approvalsApi.reject(r.id, { actor_id: actor });
      toast.success(tr('inlineRejected', 'Rejected "{{title}}"', { title: r.record_title || formatIdentity(r.record_id) }));
      void load();
      refreshBadge();
    } catch (err: any) {
      toast.error(humanizeError(err, tr('actionFailed', 'Action failed')));
    } finally {
      setInlineActing(null);
    }
  }, [rejectTarget, identities, user?.id, load, refreshBadge, humanizeError, tr]);

  // ── Keyboard flow: j/k move · Enter open · x select · a approve · r reject ──
  const filteredRef = useRef(filteredRows);
  filteredRef.current = filteredRows;
  const focusRef = useRef(focusIndex);
  focusRef.current = focusIndex;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selectedId || rejectTarget) return; // a sheet/dialog owns the keyboard
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (document.querySelector('[role="alertdialog"]')) return;
      const list = filteredRef.current;
      if (!list.length) return;
      const idx = focusRef.current;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex(Math.min(idx + 1, list.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex(Math.max(idx - 1, 0));
      } else if (e.key === 'Enter' && idx >= 0 && list[idx]) {
        e.preventDefault();
        void openDrawer(list[idx].id);
      } else if ((e.key === 'x' || e.key === ' ') && idx >= 0 && list[idx] && tab === 'pending') {
        e.preventDefault();
        toggleRow(list[idx].id);
      } else if (e.key === 'a' && idx >= 0 && list[idx]) {
        e.preventDefault();
        void inlineApprove(list[idx]);
      } else if (e.key === 'r' && idx >= 0 && list[idx] && isActionable(list[idx])) {
        e.preventDefault();
        setRejectTarget(list[idx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, rejectTarget, tab, openDrawer, toggleRow, inlineApprove, isActionable]);

  // Drawer keyboard: ←/→ walk the visible list without going back to it.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (document.querySelector('[role="alertdialog"]')) return;
      const list = filteredRef.current;
      const idx = list.findIndex(r => r.id === selectedId);
      if (idx < 0) return;
      const target = e.key === 'ArrowLeft' ? list[idx - 1] : list[idx + 1];
      if (target) { e.preventDefault(); void openDrawer(target.id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, openDrawer]);

  const hasFilters = !!query || processFilter !== 'all' || objectFilter !== 'all' || statusFilter !== 'all';

  const onTabChange = (v: string) => {
    setTab(v as TabKey);
    setStatusFilter('all');
    setProcessFilter('all');
    setObjectFilter('all');
    setQuery('');
    setFocusIndex(-1);
  };

  // ── Shared row fragments ─────────────────────────────────────────

  function RequestCell({ r }: { r: ApprovalRequestRow }) {
    return (
      <div className="min-w-0">
        <div className="font-medium truncate">{processLabel(r)}</div>
        <div className="text-xs text-muted-foreground truncate">
          {stepLabel(r) || '—'}
        </div>
      </div>
    );
  }

  function RecordCell({ r }: { r: ApprovalRequestRow }) {
    return (
      <div className="min-w-0">
        <Link
          to={recordHref(r)}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-sm hover:underline truncate max-w-full"
          title={r.record_id}
        >
          <span className="truncate">{r.record_title || formatIdentity(r.record_id)}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
        </Link>
        <div className="text-xs text-muted-foreground truncate">{objectDisplay(r)}</div>
      </div>
    );
  }

  function InlineActions({ r }: { r: ApprovalRequestRow }) {
    if (!isActionable(r)) return null;
    const busy = inlineActing === r.id;
    return (
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400"
          disabled={busy}
          onClick={() => void inlineApprove(r)}
          aria-label={tr('approve', 'Approve')}
        >
          <CheckCircle2 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400"
          disabled={busy}
          onClick={() => setRejectTarget(r)}
          aria-label={tr('reject', 'Reject')}
        >
          <XCircle className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 max-w-6xl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CheckSquare className="h-6 w-6" />
            {tr('title', 'Approvals Inbox')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tr('subtitle', 'Review and act on approval requests.')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="self-start sm:self-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {tr('refresh', 'Refresh')}
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="pending">
            {tr('tabMyPending', 'My Pending')}
            {myPendingCount > 0 && (
              <Badge variant="secondary" className="ml-2">{myPendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="submitted">{tr('tabSubmitted', 'Submitted by me')}</TabsTrigger>
          <TabsTrigger value="all">{tr('tabAll', 'All')}</TabsTrigger>
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
                  placeholder={tr('searchPlaceholder', 'Search record, process, requester…')}
                  className="pl-8 h-8 text-sm"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={tr('clearSearch', 'Clear search')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {tab !== 'pending' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-auto min-w-[130px] text-sm">
                    <SelectValue placeholder={tr('statusFilter', 'Status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr('allStatuses', 'All statuses')}</SelectItem>
                    <SelectItem value="pending">{statusLabel('pending')}</SelectItem>
                    <SelectItem value="approved">{statusLabel('approved')}</SelectItem>
                    <SelectItem value="rejected">{statusLabel('rejected')}</SelectItem>
                    <SelectItem value="recalled">{statusLabel('recalled')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {processOptions.length > 1 && (
                <Select value={processFilter} onValueChange={setProcessFilter}>
                  <SelectTrigger className="h-8 w-auto min-w-[140px] text-sm">
                    <SelectValue placeholder={tr('processFilter', 'Process')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr('allProcesses', 'All processes')}</SelectItem>
                    {processOptions.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {objectOptions.length > 1 && (
                <Select value={objectFilter} onValueChange={setObjectFilter}>
                  <SelectTrigger className="h-8 w-auto min-w-[140px] text-sm">
                    <SelectValue placeholder={tr('objectFilter', 'Object')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr('allObjects', 'All objects')}</SelectItem>
                    {objectOptions.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {hasFilters && (
                <span className="text-xs text-muted-foreground">
                  {tr('filterCount', '{{shown}} of {{total}}', { shown: filteredRows.length, total: rows.length })}
                </span>
              )}
            </div>
          )}

          {/* Bulk action bar (visible when ≥1 row selected on pending tab) */}
          {tab === 'pending' && selectedRowIds.size > 0 && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-accent/30 text-sm">
              <span>
                <strong>{selectedRowIds.size}</strong> {tr('selected', 'selected')}
                {actionableSelectedRows.length !== selectedRowIds.size && (
                  <span className="text-muted-foreground ml-1">
                    {tr('actionableCount', '({{count}} actionable)', { count: actionableSelectedRows.length })}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" disabled={bulkRunning || actionableSelectedRows.length === 0}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      {tr('approveN', 'Approve {{count}}', { count: actionableSelectedRows.length || '' })}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {tr('bulkApproveTitle', 'Approve {{count}} requests?', { count: actionableSelectedRows.length })}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {tr('bulkApproveBody', 'Each request is approved with your identity and its flow continues down the approve branch.')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tr('cancel', 'Cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => runBulk('approve')}>
                        {tr('approveN', 'Approve {{count}}', { count: actionableSelectedRows.length })}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={bulkRunning || actionableSelectedRows.length === 0}
                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      {tr('rejectN', 'Reject {{count}}', { count: actionableSelectedRows.length || '' })}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {tr('bulkRejectTitle', 'Reject {{count}} requests?', { count: actionableSelectedRows.length })}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {tr('bulkRejectBody', 'This rejects the selected requests and notifies their submitters.')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tr('cancel', 'Cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => runBulk('reject')}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {tr('rejectN', 'Reject {{count}}', { count: actionableSelectedRows.length })}
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
                  {tr('clear', 'Clear')}
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
                <EmptyTitle>{tr('emptyTitle', 'No requests')}</EmptyTitle>
                <EmptyDescription>
                  {tab === 'pending'
                    ? tr('emptyPending', "You're all caught up — nothing is waiting on you.")
                    : tr('emptyOther', 'Nothing here yet.')}
                </EmptyDescription>
                {tab === 'pending' && (
                  <Button variant="link" size="sm" className="mt-1" onClick={() => onTabChange('all')}>
                    {tr('emptyViewAll', 'Browse all requests')}
                  </Button>
                )}
              </Empty>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex items-center justify-center min-h-[160px] rounded-md border border-dashed text-sm text-muted-foreground">
              {tr('noMatches', 'No matches for current filters.')}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {tab === 'pending' && (
                          <TableHead className="w-10">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={toggleAll}
                              aria-label={tr('selectAll', 'Select all')}
                              disabled={allFilteredSelectable.length === 0}
                            />
                          </TableHead>
                        )}
                        <TableHead>{tr('colRequest', 'Request')}</TableHead>
                        <TableHead>{tr('colRecord', 'Record')}</TableHead>
                        <TableHead>{tr('colRequester', 'Requester')}</TableHead>
                        <TableHead>{tr('colStatus', 'Status')}</TableHead>
                        <TableHead>{tr('colWaiting', 'Submitted')}</TableHead>
                        <TableHead className="w-20" aria-label={tr('colActions', 'Actions')} />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((r, i) => (
                        <TableRow
                          key={r.id}
                          className={cn(
                            'group cursor-pointer hover:bg-accent/50',
                            focusIndex === i && 'ring-2 ring-inset ring-ring bg-accent/30',
                          )}
                          onClick={() => { setFocusIndex(i); void openDrawer(r.id); }}
                        >
                          {tab === 'pending' && (
                            <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedRowIds.has(r.id)}
                                onCheckedChange={() => toggleRow(r.id)}
                                disabled={r.status !== 'pending'}
                                aria-label={tr('selectRow', 'Select request')}
                              />
                            </TableCell>
                          )}
                          <TableCell><RequestCell r={r} /></TableCell>
                          <TableCell><RecordCell r={r} /></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm">
                              <UserIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate" title={r.submitter_id || ''}>{submitterDisplay(r)}</span>
                            </div>
                          </TableCell>
                          <TableCell><StatusBadge status={r.status} /></TableCell>
                          <TableCell
                            className={cn('text-xs whitespace-nowrap', agingClass(r))}
                            title={formatDate(submittedAt(r))}
                          >
                            <Clock className="h-3 w-3 inline mr-1" />
                            {formatRelative(submittedAt(r))}
                          </TableCell>
                          <TableCell className="w-20"><InlineActions r={r} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {filteredRows.map((r) => (
                  <Card key={r.id} className="cursor-pointer active:bg-accent/50" onClick={() => void openDrawer(r.id)}>
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm truncate">{processLabel(r)}</div>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="text-sm truncate">
                        {r.record_title || formatIdentity(r.record_id)}
                        <span className="text-muted-foreground text-xs ml-1.5">{objectDisplay(r)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 truncate">
                          <UserIcon className="h-3 w-3" />{submitterDisplay(r)}
                        </span>
                        <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', agingClass(r))}>
                          <Clock className="h-3 w-3" />{formatRelative(submittedAt(r))}
                        </span>
                      </div>
                      {isActionable(r) && (
                        <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" className="h-7 flex-1" disabled={inlineActing === r.id} onClick={() => void inlineApprove(r)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{tr('approve', 'Approve')}
                          </Button>
                          <Button
                            size="sm" variant="outline" className="h-7 flex-1 border-destructive text-destructive"
                            disabled={inlineActing === r.id} onClick={() => setRejectTarget(r)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />{tr('reject', 'Reject')}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="hidden md:block text-[11px] text-muted-foreground">
                {tr('keyboardHint', 'Keyboard: j/k move · Enter open · x select · a approve · r reject')}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Shared inline-reject confirmation */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tr('rejectOneTitle', 'Reject "{{title}}"?', {
                title: rejectTarget ? (rejectTarget.record_title || formatIdentity(rejectTarget.record_id)) : '',
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tr('rejectOneBody', 'This rejects the request and notifies the submitter.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void inlineReject()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tr('reject', 'Reject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!selectedId} onOpenChange={(open) => !open && closeDrawer()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selected ? processLabel(selected) : tr('drawerTitle', 'Approval Request')}
            </SheetTitle>
            <SheetDescription>
              {selected ? (stepLabel(selected) || objectDisplay(selected)) : ''}
            </SheetDescription>
          </SheetHeader>

          {selected && drawerIndex >= 0 && filteredRows.length > 1 && (
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <Button
                variant="ghost" size="sm" className="h-7 px-2"
                disabled={drawerIndex <= 0}
                onClick={() => { const prev = filteredRows[drawerIndex - 1]; if (prev) void openDrawer(prev.id); }}
              >
                <ChevronLeft className="h-4 w-4 mr-0.5" />
                {tr('prevRequest', 'Previous')}
              </Button>
              <span>{tr('positionOf', '{{index}} of {{total}}', { index: drawerIndex + 1, total: filteredRows.length })}</span>
              <Button
                variant="ghost" size="sm" className="h-7 px-2"
                disabled={drawerIndex >= filteredRows.length - 1}
                onClick={() => { const next = filteredRows[drawerIndex + 1]; if (next) void openDrawer(next.id); }}
              >
                {tr('nextRequest', 'Next')}
                <ChevronRight className="h-4 w-4 ml-0.5" />
              </Button>
            </div>
          )}

          {drawerLoading ? (
            <div className="space-y-2 mt-6">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : selected ? (
            <div className="space-y-4 mt-6">
              {/* Status strip */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={selected.status} />
                <span className="inline-flex items-center gap-1" title={formatDate(submittedAt(selected))}>
                  <Clock className="h-3 w-3" />
                  {tr('submittedAgo', 'Submitted {{when}}', { when: formatRelative(submittedAt(selected)) })}
                </span>
                {selected.completed_at && (
                  <span>· {tr('completedAt', 'Completed {{when}}', { when: formatRelative(selected.completed_at) })}</span>
                )}
              </div>

              {/* Business summary card */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={recordHref(selected)}
                        className="text-base font-semibold hover:underline inline-flex items-center gap-1.5"
                      >
                        <span className="truncate">{selected.record_title || formatIdentity(selected.record_id)}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                      <div className="text-xs text-muted-foreground">{objectDisplay(selected)}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      <div className="inline-flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        <span title={selected.submitter_id || ''}>{submitterDisplay(selected)}</span>
                      </div>
                    </div>
                  </div>
                  {payloadSummary(selected.payload, selected.payload_display).length > 0 && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t pt-3">
                      {payloadSummary(selected.payload, selected.payload_display).map(([k, v]) => (
                        <div key={k} className="min-w-0">
                          <div className="text-[11px] text-muted-foreground">{k}</div>
                          <div className="truncate" title={v}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selected.status === 'pending' && (selected.pending_approvers || []).length > 0 && (
                    <div className="border-t pt-3">
                      <div className="text-[11px] text-muted-foreground mb-1">
                        {tr('waitingOn', 'Waiting on')}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(selected.pending_approvers || []).map((a, i) => (
                          <Badge key={i} variant="outline" className="text-[11px]" title={a}>
                            {approverDisplay(a, selected)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div>
                <h3 className="text-sm font-semibold mb-3">{tr('history', 'Activity')}</h3>
                {actions.length === 0 ? (
                  <div className="text-xs text-muted-foreground">{tr('noActions', 'No actions yet.')}</div>
                ) : (
                  <ol className="relative space-y-3 pl-5 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-border">
                    {actions.map((a) => {
                      const color = a.action === 'approve' ? 'bg-emerald-500'
                                  : a.action === 'reject'  ? 'bg-destructive'
                                  : a.action === 'submit'  ? 'bg-blue-500'
                                  : 'bg-muted-foreground';
                      const actorName = a.actor_name
                        ?? (a.actor_id && a.actor_id === selected.submitter_id
                          ? submitterDisplay(selected)
                          : formatIdentity(a.actor_id));
                      const actionText = a.action === 'submit' ? tr('actSubmit', 'Submitted')
                        : a.action === 'approve' ? tr('actApprove', 'Approved')
                        : a.action === 'reject' ? tr('actReject', 'Rejected')
                        : a.action === 'recall' ? tr('actRecall', 'Recalled')
                        : a.action;
                      return (
                        <li key={a.id} className="relative text-xs">
                          <span
                            className={`absolute -left-[18px] top-1 h-3 w-3 rounded-full ring-2 ring-background ${color}`}
                            aria-hidden
                          />
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="font-medium">{actionText}</span>
                            <span className="text-muted-foreground">·</span>
                            <span title={a.actor_id || ''}>{actorName}</span>
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

              {/* Raw snapshot, collapsed by default — for debugging, not the read path */}
              {selected.payload != null && (
                <details className="group">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
                    {tr('rawData', 'Raw data (JSON)')}
                  </summary>
                  <div className="mt-2">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(JSON.stringify(selected.payload, null, 2));
                            toast.success(tr('copied', 'Copied'));
                          } catch {
                            toast.error(tr('copyFailed', 'Copy failed'));
                          }
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        {tr('copy', 'Copy')}
                      </button>
                    </div>
                    <pre className="text-[11px] bg-muted/50 rounded p-2 overflow-auto max-h-48 mt-1">
                      {JSON.stringify(selected.payload, null, 2)}
                    </pre>
                  </div>
                </details>
              )}

              {selected.status === 'pending' && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    {isAdmin && (
                      <details className="group">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
                          {tr('overrideActor', 'Act as another identity (admin)')}
                        </summary>
                        <div className="mt-2">
                          <Label htmlFor="actor-override" className="text-xs">
                            {tr('actor', 'Actor')}
                          </Label>
                          <input
                            id="actor-override"
                            type="text"
                            value={actorOverride}
                            onChange={(e) => setActorOverride(e.target.value)}
                            placeholder={`${tr('auto', 'Auto')}: ${resolveActor(selected) || '—'}`}
                            className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                          />
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {tr('overrideHint', 'e.g. role:sales_manager. Leave blank to use the auto-detected identity.')}
                          </div>
                        </div>
                      </details>
                    )}
                    <div>
                      <Label htmlFor="comment" className="text-xs">{tr('comment', 'Comment (optional)')}</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {[
                          tr('quickPhrase1', 'Approved — meets requirements.'),
                          tr('quickPhrase2', 'Approved with conditions — please monitor execution.'),
                          tr('quickPhrase3', 'Please add supporting material and resubmit.'),
                        ].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setComment(p)}
                            className="text-[11px] px-2 py-0.5 rounded-full border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
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
                        {submitting === 'approve' ? tr('approving', 'Approving…') : tr('approve', 'Approve')}
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
                            {submitting === 'reject' ? tr('rejecting', 'Rejecting…') : tr('reject', 'Reject')}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{tr('rejectTitle', 'Reject this request?')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {tr('rejectBody', 'This marks the request as rejected and notifies the submitter.')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{tr('cancel', 'Cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => doAction('reject')}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {tr('reject', 'Reject')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {canRecall && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" disabled={submitting !== null}>
                              <Undo2 className="h-4 w-4 mr-1" />
                              {submitting === 'recall' ? tr('recalling', 'Recalling…') : tr('recall', 'Recall')}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{tr('recallTitle', 'Recall this request?')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {tr('recallBody', 'This withdraws your request. Approvers can no longer act on it, and the record is unlocked.')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{tr('cancel', 'Cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => doAction('recall')}>
                                {tr('recall', 'Recall')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                    {!canApproveReject && (
                      <div className="text-xs text-muted-foreground">
                        {canRecall
                          ? tr('whyDisabledSubmitter', 'You submitted this request, so you can recall it — but only the assigned approvers can approve or reject.')
                          : tr('whyDisabled', 'Only the assigned approvers can act on this request. It is waiting on: {{who}}.', {
                              who: (selected.pending_approvers || []).map(a => approverDisplay(a, selected)).join(', ') || '—',
                            })}
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
