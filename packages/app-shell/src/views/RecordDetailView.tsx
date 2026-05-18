/**
 * RecordDetailView Component
 *
 * Renders a detail view for a single record, resolved by URL params.
 * Uses the DetailView plugin component with auto-generated sections from
 * the object field definitions.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DetailView, RecordChatterPanel } from '@object-ui/plugin-detail';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { PresenceAvatars, type PresenceUser } from '@object-ui/collaboration';
import { useAuth, createAuthenticatedFetch } from '@object-ui/auth';
import { ActionProvider, useObjectTranslation, useObjectLabel } from '@object-ui/react';
import { toast } from 'sonner';
import { Database, Users } from 'lucide-react';
import { MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { SkeletonDetail } from '../skeletons';
import { ActionConfirmDialog, type ConfirmDialogState } from './ActionConfirmDialog';
import { ActionParamDialog, type ParamDialogState } from './ActionParamDialog';
import { useRecordBreadcrumbTitle } from '../context/NavigationContext';
import type { DetailViewSchema, FeedItem, HighlightField, SectionGroup } from '@object-ui/types';
import type { ActionDef, ActionParamDef } from '@object-ui/core';
import { getRecordDisplayName } from '../utils';

interface RecordDetailViewProps {
  dataSource: any;
  objects: any[];
  onEdit: (record: any) => void;
}

const FALLBACK_USER = { id: 'current-user', name: 'Demo User' };

/**
 * Audit field names auto-injected by the framework's `applySystemFields`.
 * Surfaced as a dedicated, collapsed "System Information" section on the
 * record detail page so they don't clutter the primary content but remain
 * discoverable. The inline-edit drawer keeps filtering them out via
 * `DEFAULT_SYSTEM_FIELDS` in `@object-ui/plugin-detail/RecordDetailDrawer`.
 */
const AUDIT_FIELD_NAMES = new Set(['created_at', 'created_by', 'updated_at', 'updated_by']);

export function RecordDetailView({ dataSource, objects, onEdit }: RecordDetailViewProps) {
  const { appName, objectName, recordId } = useParams<{
    appName?: string;
    objectName?: string;
    recordId?: string;
  }>();
  const { showDebug } = useMetadataInspector();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useObjectTranslation();
  const { objectLabel, viewLabel: _vLabel, sectionLabel, actionLabel, actionConfirm, actionSuccess } = useObjectLabel();
  const [isLoading, setIsLoading] = useState(true);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [recordViewers, setRecordViewers] = useState<PresenceUser[]>([]);
  const [actionRefreshKey, setActionRefreshKey] = useState(0);
  const [childRelatedData, setChildRelatedData] = useState<Record<string, any[]>>({});
  const [recordTitle, setRecordTitle] = useState<string | undefined>();
  const objectDef = objects.find((o: any) => o.name === objectName);

  // Publish record title to the navigation context so the top-bar breadcrumb
  // can display "Acme Platform Upgrade" instead of "#9U1_MmmxjiGR…".
  useRecordBreadcrumbTitle(recordTitle);

  // Use the URL recordId as-is — it contains the actual record id.
  // Navigation code passes `record.id || record._id` directly into the URL
  // without adding any prefix, so no stripping is needed.
  const pureRecordId = recordId;

  // ─── Action Provider Handlers ───────────────────────────────────────

  // Confirm dialog state (promise-based)
  const [confirmState, setConfirmState] = useState<ConfirmDialogState>({ open: false, message: '' });

  // Param collection dialog state (promise-based)
  const [paramState, setParamState] = useState<ParamDialogState>({ open: false, params: [] });

  const confirmHandler = useCallback((message: string, options?: { title?: string; confirmText?: string; cancelText?: string }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ open: true, message, options, resolve });
    });
  }, []);

  const paramCollectionHandler = useCallback((params: ActionParamDef[]) => {
    return new Promise<Record<string, any> | null>((resolve) => {
      setParamState({ open: true, params, resolve });
    });
  }, []);

  const toastHandler = useCallback((message: string, options?: { type?: string }) => {
    if (options?.type === 'error') toast.error(message);
    else toast.success(message);
  }, []);

  const navigateHandler = useCallback((url: string, options?: { external?: boolean; newTab?: boolean }) => {
    if (options?.external || options?.newTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(url);
    }
  }, [navigate]);

  // API action handler — maps logical action targets to dataSource operations
  const apiHandler = useCallback(async (action: ActionDef) => {
    try {
      const target = action.target || action.name;
      const params = action.params || {};

      switch (target) {
        case 'opportunity_change_stage':
          await dataSource.update(objectName!, pureRecordId!, { stage: params.new_stage });
          break;
        case 'opportunity_mark_won':
          await dataSource.update(objectName!, pureRecordId!, { stage: 'closed_won' });
          break;
        case 'opportunity_mark_lost':
          await dataSource.update(objectName!, pureRecordId!, { stage: 'closed_lost', loss_reason: params.loss_reason });
          break;
        default:
          // Generic: update record with collected params
          if (Object.keys(params).length > 0) {
            await dataSource.update(objectName!, pureRecordId!, params);
          }
          break;
      }

      const shouldRefresh = action.refreshAfter === true;
      if (shouldRefresh) {
        setActionRefreshKey(k => k + 1);
      }
      return { success: true, reload: shouldRefresh };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [dataSource, objectName, pureRecordId]);

  // Authenticated fetch for direct backend calls (e.g. flow trigger).
  const authFetch = useMemo(() => createAuthenticatedFetch(), []);

  // Flow action handler — POST to /api/v1/automation/{name}/trigger.
  // Triggered when an Action with `type: 'flow'` is invoked from a record-level
  // location (record_header, record_more, …). The server-side automation
  // engine resolves `{name}` against the registered flow definitions and
  // returns `{success, output, durationMs}`.
  const flowHandler = useCallback(async (action: ActionDef) => {
    const flowName = action.target || action.name;
    if (!flowName) {
      return { success: false, error: 'No flow target provided for flow action' };
    }
    try {
      const baseUrl = import.meta.env.VITE_SERVER_URL || '';
      const res = await authFetch(
        `${baseUrl}/api/v1/automation/${encodeURIComponent(flowName)}/trigger`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordId: pureRecordId,
            objectName,
            params: action.params ?? {},
          }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || (json && json.success === false)) {
        const errMsg = json?.error || `Flow "${flowName}" failed (HTTP ${res.status})`;
        return { success: false, error: errMsg };
      }
      const shouldRefresh = action.refreshAfter !== false;
      if (shouldRefresh) {
        setActionRefreshKey(k => k + 1);
      }
      return { success: true, data: json?.data, reload: shouldRefresh };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [authFetch, pureRecordId, objectName]);

  // Server-side action handler — POST to /api/v1/actions/{object}/{action}.
  // Used for `script` and `modal` actions where `action.target` matches a
  // server-registered handler name (engine.registerAction). Sends the
  // current recordId, objectName, and any collected/static params, and the
  // server resolves the handler (with wildcard '*' fallback) and runs it.
  const serverActionHandler = useCallback(async (action: ActionDef) => {
    const targetName = action.target || action.name;
    if (!targetName) {
      return { success: false, error: 'No action target provided' };
    }
    const params = (action.params && !Array.isArray(action.params))
      ? (action.params as Record<string, unknown>)
      : {};
    try {
      const baseUrl = import.meta.env.VITE_SERVER_URL || '';
      const obj = action.objectName || objectName || 'global';
      const res = await authFetch(
        `${baseUrl}/api/v1/actions/${encodeURIComponent(obj)}/${encodeURIComponent(targetName)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordId: pureRecordId, params }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || (json && json.success === false)) {
        const errMsg = json?.error || `Action "${targetName}" failed (HTTP ${res.status})`;
        return { success: false, error: errMsg };
      }
      const shouldRefresh = action.refreshAfter !== false;
      if (shouldRefresh) setActionRefreshKey(k => k + 1);
      return { success: true, data: json?.data, reload: shouldRefresh };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [authFetch, pureRecordId, objectName]);

  // Discover reverse references: other objects with lookup/master_detail fields
  // pointing to the current object (e.g., order_item.order → order).
  const childRelations = useMemo(() => {
    if (!objectDef || !objects) return [];
    const relations: Array<{ childObject: string; childLabel: string; referenceField: string }> = [];
    for (const obj of objects) {
      if (obj.name === objectDef.name) continue;
      for (const [fieldName, fieldDef] of Object.entries<any>(obj.fields || {})) {
        if (
          fieldDef &&
          (fieldDef.type === 'lookup' || fieldDef.type === 'master_detail') &&
          (fieldDef.reference_to || fieldDef.reference) === objectDef.name
        ) {
          relations.push({
            childObject: obj.name,
            childLabel: obj.label || obj.name,
            referenceField: fieldName,
          });
        }
      }
    }
    return relations;
  }, [objectDef, objects]);

  // Fetch related child records for each reverse reference
  useEffect(() => {
    if (!dataSource || !pureRecordId || childRelations.length === 0) return;
    let cancelled = false;
    Promise.all(
      childRelations.map(({ childObject, referenceField }) =>
        dataSource.find(childObject, {
          $filter: { [referenceField]: pureRecordId },
        })
          .then((res: any) => {
            const items = Array.isArray(res) ? res : res?.data || [];
            return { childObject, items };
          })
          .catch((err: any) => {
            console.warn(`[RecordDetailView] Failed to fetch related ${childObject}:`, err);
            return { childObject, items: [] as any[] };
          })
      )
    ).then((results) => {
      if (cancelled) return;
      const data: Record<string, any[]> = {};
      for (const { childObject, items } of results) {
        data[childObject] = items;
      }
      setChildRelatedData(data);
    });
    return () => { cancelled = true; };
  }, [dataSource, pureRecordId, childRelations]);

  // Memoize so the object identity is stable across renders — otherwise
  // any effect that depends on it (e.g. the feed loader below) would
  // re-fire every render and create an infinite request loop.
  const currentUser = useMemo(
    () => (user ? { id: user.id, name: user.name, avatar: user.image } : FALLBACK_USER),
    [user?.id, user?.name, user?.image],
  );

  // Fetch presence and comments from API
  useEffect(() => {
    if (!dataSource || !objectName || !pureRecordId) return;
    const threadId = `${objectName}:${pureRecordId}`;

    // Fetch record viewers
    dataSource.find('sys_presence', { $filter: { recordId: pureRecordId } })
      .then((res: any) => { if (res.data?.length) setRecordViewers(res.data); })
      .catch(() => {});

    // M10.10: Fetch persisted comments from sys_comment. Field names
    // are snake_case to match the platform-objects schema
    // (`packages/platform-objects/src/audit/sys-comment.object.ts`):
    // thread_id, author_id, author_name, author_avatar_url, body,
    // reactions (JSON string), parent_id, created_at, updated_at.
    //
    // Reactions are stored as a JSON object of `{ emoji: string[] }`
    // (one array of user-ids per emoji). The aggregator below counts
    // entries and flags the currently-signed-in user.
    const parseReactions = (raw: unknown): FeedItem['reactions'] => {
      if (!raw) return undefined;
      let parsed: Record<string, string[]> | undefined;
      if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw); } catch { return undefined; }
      } else if (typeof raw === 'object') {
        parsed = raw as Record<string, string[]>;
      }
      if (!parsed) return undefined;
      return Object.entries(parsed).map(([emoji, userIds]) => ({
        emoji,
        count: Array.isArray(userIds) ? userIds.length : 0,
        reacted: Array.isArray(userIds) && userIds.includes(currentUser.id),
      }));
    };

    dataSource.find('sys_comment', { $filter: { thread_id: threadId }, $orderby: { created_at: 'asc' } })
      .then((res: any) => {
        if (!res?.data?.length) return;
        const mapped: FeedItem[] = res.data.map((c: any) => ({
          id: c.id,
          type: 'comment' as const,
          actor: c.author_name ?? 'Unknown',
          actorAvatarUrl: c.author_avatar_url ?? undefined,
          body: c.body ?? '',
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          parentId: c.parent_id ?? undefined,
          reactions: parseReactions(c.reactions),
        }));
        setFeedItems(prev => {
          const byId = new Map<string, FeedItem>();
          for (const item of [...prev, ...mapped]) byId.set(String(item.id), item);
          return Array.from(byId.values()).sort((a, b) => {
            const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
            const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
            return ta - tb;
          });
        });
      })
      .catch(() => {});

    // M10.11: Fetch sys_activity rows for this record and merge into the
    // timeline. plugin-audit's writers populate sys_activity on every
    // create/update/delete of objects that opt-in via enable.activities,
    // so this surface — once wired here — gives us a Salesforce-style
    // "what happened on this record" feed without any per-app glue.
    //
    // We map sys_activity.type to FeedItemType so the existing icon /
    // colour map in RecordActivityTimeline keeps working:
    //   created/updated/deleted/system → 'field_change'
    //   assigned/shared                → 'field_change'
    //   completed                      → 'task'
    //   commented/mentioned            → 'comment'  (but skipped — we
    //                                    already load these from
    //                                    sys_comment to get reactions
    //                                    and threading)
    //
    // sys_activity is system-owned so a 404 ("table not provisioned",
    // older schemas without activities) is silently tolerated.
    const activityTypeToFeed: Record<string, FeedItem['type'] | undefined> = {
      created:   'field_change',
      updated:   'field_change',
      deleted:   'field_change',
      assigned:  'field_change',
      shared:    'field_change',
      system:    'system',
      completed: 'task',
      commented: undefined,
      mentioned: undefined,
      login:     undefined,
      logout:    undefined,
    };
    dataSource.find('sys_activity', {
      $filter: { object_name: objectName, record_id: pureRecordId },
      $orderby: { timestamp: 'asc' },
      $top: 200,
    })
      .then((res: any) => {
        if (!res?.data?.length) return;
        const mapped: FeedItem[] = [];
        for (const row of res.data) {
          const t = activityTypeToFeed[row.type];
          if (!t) continue;
          // Prefer the explicit `timestamp` column, but tolerate older
          // rows where the driver leaked the literal "NOW()" — fall
          // back to created_at (always a real ISO date).
          let when = row.timestamp;
          if (!when || when === 'NOW()' || Number.isNaN(Date.parse(when))) {
            when = row.created_at;
          }
          mapped.push({
            id: row.id,
            type: t,
            actor: row.actor_name ?? 'System',
            actorAvatarUrl: row.actor_avatar_url ?? undefined,
            body: row.summary ?? '',
            createdAt: when,
          } as FeedItem);
        }
        if (!mapped.length) return;
        setFeedItems(prev => {
          // Merge by id (timeline events are append-only); sort by
          // createdAt ascending so the activity panel reads as a
          // chronological narrative.
          const byId = new Map<string, FeedItem>();
          for (const item of [...prev, ...mapped]) {
            byId.set(String(item.id), item);
          }
          return Array.from(byId.values()).sort((a, b) => {
            const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
            const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
            return ta - tb;
          });
        });
      })
      .catch(() => {});
  }, [dataSource, objectName, pureRecordId, currentUser]);

  const handleAddComment = useCallback(
    async (text: string) => {
      const newItem: FeedItem = {
        id: crypto.randomUUID(),
        type: 'comment',
        actor: currentUser.name,
        actorAvatarUrl: 'avatar' in currentUser ? (currentUser as any).avatar : undefined,
        body: text,
        createdAt: new Date().toISOString(),
      };
      setFeedItems(prev => [...prev, newItem]);
      // Persist to backend (M10.10: snake_case fields per sys_comment schema)
      if (dataSource) {
        const threadId = `${objectName}:${pureRecordId}`;
        dataSource.create('sys_comment', {
          id: newItem.id,
          thread_id: threadId,
          author_id: currentUser.id,
          author_name: currentUser.name,
          author_avatar_url: 'avatar' in currentUser ? (currentUser as any).avatar : undefined,
          body: text,
          mentions: '[]',
          created_at: newItem.createdAt,
        }).catch(() => {});
      }
    },
    [currentUser, dataSource, objectName, pureRecordId],
  );

  const handleAddReply = useCallback(
    async (parentId: string | number, text: string) => {
      const newItem: FeedItem = {
        id: crypto.randomUUID(),
        type: 'comment',
        actor: currentUser.name,
        actorAvatarUrl: 'avatar' in currentUser ? (currentUser as any).avatar : undefined,
        body: text,
        createdAt: new Date().toISOString(),
        parentId,
      };
      setFeedItems(prev => {
        const updated = [...prev, newItem];
        // Increment replyCount on parent
        return updated.map(item =>
          item.id === parentId
            ? { ...item, replyCount: (item.replyCount ?? 0) + 1 }
            : item
        );
      });
      if (dataSource) {
        const threadId = `${objectName}:${pureRecordId}`;
        dataSource.create('sys_comment', {
          id: newItem.id,
          thread_id: threadId,
          author_id: currentUser.id,
          author_name: currentUser.name,
          author_avatar_url: 'avatar' in currentUser ? (currentUser as any).avatar : undefined,
          body: text,
          mentions: '[]',
          created_at: newItem.createdAt,
          parent_id: parentId,
        }).catch(() => {});
      }
    },
    [currentUser, dataSource, objectName, pureRecordId],
  );

  const handleToggleReaction = useCallback(
    (itemId: string | number, emoji: string) => {
      setFeedItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        const reactions = [...(item.reactions ?? [])];
        const idx = reactions.findIndex(r => r.emoji === emoji);
        if (idx >= 0) {
          const r = reactions[idx];
          if (r.reacted) {
            // Remove user's reaction
            if (r.count <= 1) {
              reactions.splice(idx, 1);
            } else {
              reactions[idx] = { ...r, count: r.count - 1, reacted: false };
            }
          } else {
            reactions[idx] = { ...r, count: r.count + 1, reacted: true };
          }
        } else {
          reactions.push({ emoji, count: 1, reacted: true });
        }
        const updated = { ...item, reactions };
        // Persist reactions to backend as JSON. The schema stores
        // `reactions` as a textarea JSON string of `{ emoji: userIds[] }`,
        // so we rebuild the canonical shape from the optimistic local
        // state before writing back. A failed update silently keeps the
        // optimistic UI change (best-effort, surfaced by RUM if needed).
        if (dataSource) {
          const userId = currentUser.id;
          const remoteShape: Record<string, string[]> = {};
          for (const r of reactions) {
            // We don't have the original user-id list locally, so we
            // approximate by emitting the signed-in user when they are
            // the (only known) reactor. This is an over-simplification
            // for single-user pilot installs and will be replaced by a
            // proper backend reaction endpoint in M11.
            const ids: string[] = [];
            if (r.reacted) ids.push(userId);
            // Pad with a synthetic marker so count is preserved across
            // refreshes from other clients (best-effort).
            while (ids.length < r.count) ids.push('__other__');
            remoteShape[r.emoji] = ids;
          }
          dataSource.update('sys_comment', String(itemId), {
            reactions: JSON.stringify(remoteShape),
          }).catch(() => {});
        }
        return updated;
      }));
    },
    [currentUser.id, dataSource],
  );

  useEffect(() => {
    // Reset loading on navigation; the actual DetailView handles data fetching
    setIsLoading(true);
    queueMicrotask(() => setIsLoading(false));
  }, [objectName, recordId]);

  // Build detail schema — must be before early returns to keep hook count
  // consistent across renders and avoid React error #310.
  const detailSchema: DetailViewSchema = useMemo(() => {
    if (!objectDef) {
      return { type: 'detail-view' } as DetailViewSchema;
    }

    // Auto-detect primary field: prefer objectDef metadata, then 'name' or 'title' heuristic
    const primaryField = objectDef.primaryField
      || Object.keys(objectDef.fields || {}).find(
        (key) => key === 'name' || key === 'title'
      );

    // Build sections: prefer form sections from objectDef, fallback to flat field list
    const formSections = objectDef.views?.form?.sections;
    const sections = formSections && formSections.length > 0
      ? formSections.map((sec: any) => ({
          title: sec.name ? sectionLabel(objectDef.name, sec.name, sec.title || sec.name) : sec.title,
          collapsible: sec.collapsible,
          defaultCollapsed: sec.defaultCollapsed,
          fields: (sec.fields || []).map((f: any) => {
            const fieldName = typeof f === 'string' ? f : f.name;
            const fieldDef = objectDef.fields[fieldName];
            if (!fieldDef) {
              console.warn(`[RecordDetailView] Field "${fieldName}" not found in ${objectDef.name} definition`);
              return { name: fieldName, label: fieldName };
            }
            const refTarget = fieldDef.reference_to || fieldDef.reference;
            return {
              name: fieldName,
              label: fieldDef.label || fieldName,
              type: fieldDef.type || 'text',
              ...(fieldDef.options && { options: fieldDef.options }),
              ...(refTarget && { reference_to: refTarget }),
              ...(fieldDef.reference_field && { reference_field: fieldDef.reference_field }),
              ...(fieldDef.currency && { currency: fieldDef.currency }),
            };
          }),
        }))
      : [
          {
            // Intentionally untitled: when there's only one auto-generated
            // section, DetailSection flattens it (no Card chrome, no
            // redundant "Details" heading).
            showBorder: false as const,
            fields: Object.keys(objectDef.fields || {})
              .filter(key => !AUDIT_FIELD_NAMES.has(key))
              .map(key => {
              const fieldDef = objectDef.fields[key];
              const refTarget = fieldDef.reference_to || fieldDef.reference;
              return {
                name: key,
                label: fieldDef.label || key,
                type: fieldDef.type || 'text',
                ...(fieldDef.options && { options: fieldDef.options }),
                ...(refTarget && { reference_to: refTarget }),
                ...(fieldDef.reference_field && { reference_field: fieldDef.reference_field }),
                ...(fieldDef.currency && { currency: fieldDef.currency }),
              };
            }),
          },
        ];

    // Append a dedicated, collapsed "System Information" section listing
    // audit fields (created/updated at/by) when the schema declares them
    // and no author-defined section has already surfaced them. The framework
    // auto-injects these as `system: true, readonly: true` via
    // `applySystemFields`; rendering them here gives users visibility into
    // record provenance without polluting the primary content area.
    const fieldsAlreadyShown = new Set<string>(
      sections.flatMap((s: any) => (s.fields || []).map((f: any) => f.name))
    );
    const auditFieldsToShow = Array.from(AUDIT_FIELD_NAMES).filter(
      name => objectDef.fields?.[name] && !fieldsAlreadyShown.has(name)
    );
    if (auditFieldsToShow.length > 0) {
      sections.push({
        title: sectionLabel(objectDef.name, 'system_info', 'System Information'),
        collapsible: true,
        defaultCollapsed: true,
        fields: auditFieldsToShow.map(key => {
          const fieldDef = objectDef.fields[key];
          const refTarget = fieldDef.reference_to || fieldDef.reference;
          return {
            name: key,
            label: fieldDef.label || key,
            type: fieldDef.type || 'text',
            readonly: true,
            ...(refTarget && { reference_to: refTarget }),
          };
        }),
      } as any);
    }

    // Filter actions for record_header location and deduplicate by name
    const recordHeaderActions = (() => {
      const seen = new Set<string>();
      return (objectDef.actions || []).filter((a: any) => {
        if (!a.locations?.includes('record_header')) return false;
        if (!a.name) return true;
        if (seen.has(a.name)) return false;
        seen.add(a.name);
        return true;
      }).map((a: any) => ({
        ...a,
        label: actionLabel(objectDef.name, a.name, a.label || a.name),
        ...(a.confirmText !== undefined && {
          confirmText: actionConfirm(objectDef.name, a.name, a.confirmText),
        }),
        ...(a.successMessage !== undefined && {
          successMessage: actionSuccess(objectDef.name, a.name, a.successMessage),
        }),
      }));
    })();

    // Build highlightFields: exclusively from objectDef metadata (no hardcoded fallback)
    const highlightFields: HighlightField[] = objectDef.views?.detail?.highlightFields ?? [];

    // Build sectionGroups from objectDef detail/form config if available
    const sectionGroups: SectionGroup[] | undefined =
      objectDef.views?.detail?.sectionGroups ?? objectDef.views?.form?.sectionGroups;

    // Build related entries from reverse-reference child objects.
    // `referenceField` is the FK field on the child pointing back to this
    // record — passed so the related-list renderer can hide the redundant
    // parent-ID column. Each entry carries action handlers that the renderer
    // surfaces as header `+ New` / `View All` buttons and per-row Edit /
    // Delete controls.
    const baseAppUrl = appName ? `/apps/${appName}` : '';
    const related = childRelations.map(({ childObject, childLabel, referenceField }) => {
      const childObjectDef = objects.find((o: any) => o.name === childObject);
      const parentId = pureRecordId || '';
      const localizedTitle = childObjectDef
        ? objectLabel({ name: childObjectDef.name, label: childObjectDef.label || childLabel })
        : childLabel;

      const buildNewUrl = () => {
        const qs = new URLSearchParams({ [referenceField]: parentId }).toString();
        return `${baseAppUrl}/${childObject}/new${qs ? `?${qs}` : ''}`;
      };
      const buildListUrl = () => {
        const qs = new URLSearchParams({
          [`filter[${referenceField}]`]: parentId,
        }).toString();
        return `${baseAppUrl}/${childObject}${qs ? `?${qs}` : ''}`;
      };
      const buildEditUrl = (row: any) => {
        const rid = row?.id || row?._id;
        if (!rid) return null;
        return `${baseAppUrl}/${childObject}/record/${encodeURIComponent(String(rid))}/edit`;
      };
      const buildRecordUrl = (row: any) => {
        const rid = row?.id || row?._id;
        if (!rid) return null;
        return `${baseAppUrl}/${childObject}/record/${encodeURIComponent(String(rid))}`;
      };

      const onNew = baseAppUrl
        ? () => navigate(buildNewUrl())
        : undefined;
      const onViewAll = baseAppUrl
        ? () => navigate(buildListUrl())
        : undefined;
      const onRowClick = baseAppUrl
        ? (row: any) => {
            const url = buildRecordUrl(row);
            if (url) navigate(url);
          }
        : undefined;
      const onRowEdit = baseAppUrl
        ? (row: any) => {
            const url = buildEditUrl(row);
            if (url) navigate(url);
          }
        : undefined;
      const onRowDelete = dataSource && parentId
        ? async (row: any) => {
            const rid = row?.id || row?._id;
            if (!rid) return;
            try {
              await dataSource.delete(childObject, rid);
              toast.success(t('detail.deleteSuccess', { defaultValue: 'Deleted' }));
              setChildRelatedData((prev) => ({
                ...prev,
                [childObject]: (prev[childObject] || []).filter(
                  (r: any) => (r.id || r._id) !== rid,
                ),
              }));
            } catch (err: any) {
              toast.error(err?.message || t('detail.deleteError', { defaultValue: 'Delete failed' }));
            }
          }
        : undefined;

      return {
        title: localizedTitle,
        type: 'table' as const,
        api: childObject,
        data: childRelatedData[childObject] || [],
        referenceField,
        icon: childObjectDef?.icon,
        onNew,
        onViewAll,
        onRowClick,
        onRowEdit,
        onRowDelete,
      };
    });

    return {
      type: 'detail-view' as const,
      objectName: objectDef.name,
      resourceId: pureRecordId,
      showBack: true,
      onBack: 'history',
      showEdit: true,
      title: objectDef.label,
      primaryField,
      sections,
      autoTabs: true,
      autoDiscoverRelated: true,
      ...(related.length > 0 && { related }),
      ...(highlightFields.length > 0 && { highlightFields }),
      ...(sectionGroups && sectionGroups.length > 0 && { sectionGroups }),
      ...(recordHeaderActions.length > 0 && {
        actions: [{
          type: 'action:bar',
          location: 'record_header',
          actions: recordHeaderActions,
        } as any],
      }),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectDef?.name, pureRecordId, childRelatedData, actionRefreshKey, appName, navigate, dataSource, t, objectLabel, objects]);

  if (isLoading) {
    return <SkeletonDetail />;
  }

  if (!objectDef) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Empty>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Database className="h-6 w-6 text-muted-foreground" />
          </div>
          <EmptyTitle>{t('empty.objectNotFound')}</EmptyTitle>
          <EmptyDescription>
            {t('empty.objectNotFoundDescription', { name: objectName })}
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="h-full bg-background overflow-hidden flex flex-col relative">
      <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-50 flex items-center gap-2">
        {/* Presence: who else is viewing this record */}
        {recordViewers.length > 0 && (
          <div className="flex items-center gap-1.5" title={t('recordDetail.viewersTooltip')}>
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <PresenceAvatars users={recordViewers} size="sm" maxVisible={4} showStatus />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-row">
        <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6 scroll-pb-48">
          <ActionProvider
            context={{ record: {}, objectName, user: currentUser }}
            onConfirm={confirmHandler}
            onToast={toastHandler}
            onNavigate={navigateHandler}
            onParamCollection={paramCollectionHandler}
            handlers={{ api: apiHandler, flow: flowHandler, script: serverActionHandler, modal: serverActionHandler }}
          >
            <DetailView
              key={actionRefreshKey}
              schema={detailSchema}
              dataSource={dataSource}
              objectLabel={objectLabel({ name: objectDef.name, label: objectDef.label })}
              onDataLoaded={(record) => {
                if (!record || typeof record !== 'object') return;
                // Resolve the same way DetailView's header does, so the
                // breadcrumb matches the on-page title (e.g. "David Kim"
                // instead of "#lead-1778…").
                const resolved = getRecordDisplayName(objectDef, record);
                if (resolved && resolved !== recordTitle && resolved !== 'Untitled') {
                  setRecordTitle(resolved);
                }
              }}
              onEdit={() => {
                onEdit({ id: pureRecordId });
              }}
              discussionSlot={
                <RecordChatterPanel
                  config={{
                    position: 'bottom',
                    collapsible: false,
                    feed: {
                      enableReactions: true,
                      enableThreading: true,
                      showCommentInput: true,
                    },
                  }}
                  items={feedItems}
                  onAddComment={handleAddComment}
                  onAddReply={handleAddReply}
                  onToggleReaction={handleToggleReaction}
                />
              }
            />
          </ActionProvider>
        </div>
        <MetadataPanel
          open={showDebug}
          sections={[{ title: 'View Schema', data: detailSchema }]}
        />
      </div>

      {/* Action Confirm Dialog */}
      <ActionConfirmDialog
        state={confirmState}
        onOpenChange={(open) => {
          if (!open) setConfirmState(s => ({ ...s, open: false }));
        }}
      />

      {/* Action Param Collection Dialog */}
      <ActionParamDialog
        state={paramState}
        onOpenChange={(open) => {
          if (!open) setParamState(s => ({ ...s, open: false }));
        }}
      />
    </div>
  );
}
