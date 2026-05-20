/**
 * InboxPopover
 *
 * UX P0-2: a single "inbox" surface that bundles the three things that
 * used to occupy separate top-bar buttons:
 *   - Notifications (mentions, assignments, system alerts)
 *   - Approvals (pending approval requests for the user)
 *   - Activity (recent activity feed across the org)
 *
 * Rendered as a single bell button + popover with a tabbed body. The badge
 * shows the combined unread count (notifications + approvals) so users
 * still see at-a-glance pressure.
 *
 * @module
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@object-ui/components';
import { Bell, CheckSquare, Activity as ActivityIcon } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import type { ActivityItem } from './ActivityFeed';
import { useNavigationContext } from '../context/NavigationContext';

export interface InboxNotification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  source_object?: string | null;
  source_id?: string | null;
  actor_name?: string | null;
  is_read?: boolean;
  created_at?: string;
}

export interface InboxPopoverProps {
  notifications: InboxNotification[];
  unreadCount: number;
  pendingApprovalsCount: number;
  activities: ActivityItem[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60) return `${Math.max(1, Math.floor(diff))}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function InboxPopover({
  notifications,
  unreadCount,
  pendingApprovalsCount,
  activities,
  onMarkAllRead,
  onMarkRead,
}: InboxPopoverProps) {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const { currentAppName } = useNavigationContext();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'notifications' | 'approvals' | 'activity'>('notifications');

  const totalBadge = unreadCount + pendingApprovalsCount;
  const ariaLabel = t('sidebar.inboxAriaLabel', { defaultValue: 'Open inbox' }) as string;

  const goToApprovals = () => {
    setOpen(false);
    const app = currentAppName ?? params.appName;
    navigate(app ? `/apps/${app}/system/approvals` : '/apps/setup/system/approvals');
  };

  const goToAllNotifications = () => {
    setOpen(false);
    // Always route through the setup app's sys_notification list view —
    // it's the canonical full-page inbox and lives outside per-app sidebars.
    // The `?view=mine` query selects the "Mine" tab so the user sees their
    // own notifications by default (matching the popover scope).
    navigate('/apps/setup/sys_notification?view=mine');
  };

  const handleNotificationClick = (n: InboxNotification) => {
    onMarkRead(n.id);
    if (n.source_object && n.source_id) {
      setOpen(false);
      const app = currentAppName ?? params.appName;
      const target = app
        ? `/apps/${app}/${n.source_object}/${n.source_id}`
        : `/objects/${n.source_object}/${n.source_id}`;
      navigate(target);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 relative shrink-0"
          aria-label={ariaLabel}
          title={t('sidebar.inbox', { defaultValue: 'Inbox' }) as string}
        >
          <Bell className="h-4 w-4" />
          {totalBadge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-red-500 text-[10px] leading-4 text-white text-center px-1">
              {totalBadge > 9 ? '9+' : totalBadge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-96 p-0">
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <div className="text-sm font-semibold">
            {t('sidebar.inbox', { defaultValue: 'Inbox' })}
          </div>
          {tab === 'notifications' && unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t('notifications.markAllRead', { defaultValue: 'Mark all read' })}
            </button>
          )}
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-1 h-9">
            <TabsTrigger value="notifications" className="text-xs gap-1.5 data-[state=active]:bg-transparent">
              <Bell className="h-3.5 w-3.5" />
              {t('sidebar.notifications', { defaultValue: 'Notifications' })}
              {unreadCount > 0 && (
                <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approvals" className="text-xs gap-1.5 data-[state=active]:bg-transparent">
              <CheckSquare className="h-3.5 w-3.5" />
              {t('sidebar.approvals', { defaultValue: 'Approvals' })}
              {pendingApprovalsCount > 0 && (
                <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] text-white">
                  {pendingApprovalsCount > 9 ? '9+' : pendingApprovalsCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1.5 data-[state=active]:bg-transparent">
              <ActivityIcon className="h-3.5 w-3.5" />
              {t('sidebar.activityFeed', { defaultValue: 'Activity' })}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="m-0 max-h-80 overflow-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-8 text-sm text-muted-foreground text-center">
                {t('notifications.empty', { defaultValue: 'No notifications' })}
              </div>
            ) : (
              <ul className="divide-y">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-accent transition-colors ${n.is_read ? '' : 'bg-accent/40'}`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.is_read && (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium leading-tight truncate">{n.title}</div>
                          {n.body && (
                            <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {timeAgo(n.created_at)}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {/* Footer link to dedicated /sys_notification list. The popover
                only shows the 20 most-recent rows; users need a path to the
                full inbox for bulk operations and older history. */}
            <div className="border-t px-3 py-2 text-center">
              <button
                type="button"
                onClick={goToAllNotifications}
                className="text-xs text-primary hover:underline"
              >
                {t('notifications.viewAll', { defaultValue: 'View all notifications' })}
              </button>
            </div>
          </TabsContent>

          <TabsContent value="approvals" className="m-0 max-h-80 overflow-auto">
            <div className="px-3 py-6 text-center">
              {pendingApprovalsCount > 0 ? (
                <>
                  <CheckSquare className="mx-auto h-6 w-6 text-amber-500" />
                  <div className="mt-2 text-sm font-medium">
                    {t('notifications.approvalsPending', {
                      defaultValue: '{{count}} pending approvals',
                      count: pendingApprovalsCount,
                    })}
                  </div>
                  <Button size="sm" className="mt-3" onClick={goToApprovals}>
                    {t('notifications.viewApprovals', { defaultValue: 'View approvals' })}
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground">
                    {t('notifications.noPendingApprovals', {
                      defaultValue: 'No pending approvals',
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={goToApprovals}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    {t('notifications.openApprovalsInbox', { defaultValue: 'Open Approvals Inbox' })}
                  </button>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="m-0 max-h-80 overflow-auto">
            {activities.length === 0 ? (
              <div className="px-3 py-8 text-sm text-muted-foreground text-center">
                {t('layout.activityFeed.empty', { defaultValue: 'No recent activity' })}
              </div>
            ) : (
              <ul className="divide-y">
                {activities.slice(0, 20).map((a) => (
                  <li key={a.id} className="px-3 py-2.5">
                    <div className="text-sm leading-tight truncate">
                      <span className="font-medium">{a.user}</span>{' '}
                      <span className="text-muted-foreground">{a.description}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {timeAgo(a.timestamp)} · {a.objectName}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
