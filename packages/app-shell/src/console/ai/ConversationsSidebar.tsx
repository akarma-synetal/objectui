// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Left sidebar listing the signed-in user's AI conversations. Active row is
 * derived from `useParams<{ conversationId }>()`; clicking a row navigates to
 * `/ai/:id`, the "New chat" button navigates to `/ai`.
 */

import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import {
  Button,
  ScrollArea,
  Empty,
  EmptyTitle,
  EmptyDescription,
  cn,
} from '@object-ui/components';
import { useConversationList, type ConversationSummary } from '../../hooks/useConversationList';

export interface ConversationsSidebarProps {
  userId: string | undefined;
  apiBase: string;
  className?: string;
  refreshKey?: number | string;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return 'just now';
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString();
}

export function ConversationsSidebar({
  userId,
  apiBase,
  className,
  refreshKey,
}: ConversationsSidebarProps) {
  const navigate = useNavigate();
  const { conversationId: activeId } = useParams<{ conversationId?: string }>();
  const { conversations, isLoading, error, remove } = useConversationList({
    userId,
    apiBase,
    refreshKey,
  });

  const handleNew = useCallback(() => navigate('/ai'), [navigate]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      await remove(id);
      if (id === activeId) navigate('/ai', { replace: true });
    },
    [remove, activeId, navigate],
  );

  return (
    <aside
      className={cn('flex h-full min-h-0 flex-col bg-muted/30', className)}
      data-testid="ai-conversations-sidebar"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-sm font-medium">Chats</span>
        <Button
          size="sm"
          variant="outline"
          onClick={handleNew}
          data-testid="ai-new-chat"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        {isLoading && conversations.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="px-3 py-4 text-xs text-destructive">
            {error.message}
          </div>
        ) : conversations.length === 0 ? (
          <Empty className="px-3 py-8">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
            <EmptyTitle>No chats yet</EmptyTitle>
            <EmptyDescription>Start a new conversation to see it here.</EmptyDescription>
          </Empty>
        ) : (
          <ul className="flex flex-col py-1">
            {conversations.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                active={c.id === activeId}
                onSelect={() => navigate(`/ai/${c.id}`)}
                onDelete={(e) => handleDelete(e, c.id)}
              />
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}

interface RowProps {
  conversation: ConversationSummary;
  active: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function ConversationRow({ conversation, active, onSelect, onDelete }: RowProps) {
  const title = conversation.title?.trim() || conversation.preview?.trim() || 'New conversation';
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'group flex w-full flex-col gap-0.5 border-l-2 border-transparent px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50',
          active && 'border-primary bg-accent',
        )}
        data-testid={`ai-conversation-row-${conversation.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-1 flex-1 font-medium">{title}</span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onDelete(e as unknown as React.MouseEvent);
              }
            }}
            className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            data-testid={`ai-conversation-delete-${conversation.id}`}
            aria-label="Delete conversation"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </span>
        </div>
        {conversation.preview && conversation.preview !== title ? (
          <span className="line-clamp-1 text-xs text-muted-foreground">
            {conversation.preview}
          </span>
        ) : null}
        <span className="text-[10px] text-muted-foreground">
          {formatTimestamp(conversation.updatedAt ?? conversation.createdAt)}
        </span>
      </button>
    </li>
  );
}
