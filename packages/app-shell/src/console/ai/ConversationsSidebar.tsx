// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Left sidebar listing the signed-in user's AI conversations. Active row is
 * derived from `useParams<{ conversationId }>()`; clicking a row navigates to
 * `/ai/:id`, the "New chat" button navigates to `/ai`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Pencil, MessageSquare, Search, Check, X } from 'lucide-react';
import {
  Button,
  Input,
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
  const { conversations, isLoading, error, remove, rename } = useConversationList({
    userId,
    apiBase,
    refreshKey,
  });

  const [filter, setFilter] = useState('');
  const [renamingId, setRenamingId] = useState<string | undefined>(undefined);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const hay = `${c.title ?? ''} ${c.preview ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, filter]);

  const handleNew = useCallback(() => navigate('/ai'), [navigate]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      await remove(id);
      if (id === activeId) navigate('/ai', { replace: true });
    },
    [remove, activeId, navigate],
  );

  const handleRenameSubmit = useCallback(
    async (id: string, title: string) => {
      setRenamingId(undefined);
      try {
        await rename(id, title);
      } catch {
        // optimistic update already rolled back via refetch in the hook
      }
    },
    [rename],
  );

  return (
    <aside
      className={cn('flex h-full min-h-0 flex-col bg-muted/30', className)}
      data-testid="ai-conversations-sidebar"
    >
      <div className="flex shrink-0 flex-col gap-2 border-b px-3 py-2">
        <div className="flex items-center justify-between gap-2">
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
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search chats..."
            className="h-7 pl-7 text-xs"
            data-testid="ai-conversations-search"
          />
        </div>
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
        ) : visible.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">No matching chats.</div>
        ) : (
          <ul className="flex flex-col py-1">
            {visible.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                active={c.id === activeId}
                renaming={c.id === renamingId}
                onSelect={() => navigate(`/ai/${c.id}`)}
                onDelete={(e) => handleDelete(e, c.id)}
                onStartRename={() => setRenamingId(c.id)}
                onCancelRename={() => setRenamingId(undefined)}
                onSubmitRename={(title) => handleRenameSubmit(c.id, title)}
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
  renaming: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onSubmitRename: (title: string) => void;
}

function ConversationRow({
  conversation,
  active,
  renaming,
  onSelect,
  onDelete,
  onStartRename,
  onCancelRename,
  onSubmitRename,
}: RowProps) {
  const title = conversation.title?.trim() || conversation.preview?.trim() || 'New conversation';
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      setDraft(conversation.title?.trim() || conversation.preview?.trim() || '');
      // Focus the input on next paint so the click that opened it doesn't blur immediately.
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [renaming, conversation.title, conversation.preview]);

  if (renaming) {
    return (
      <li>
        <div
          className={cn(
            'flex w-full items-center gap-1 border-l-2 px-3 py-2',
            active ? 'border-primary bg-accent' : 'border-transparent',
          )}
          data-testid={`ai-conversation-rename-row-${conversation.id}`}
        >
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSubmitRename(draft);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancelRename();
              }
            }}
            className="h-7 flex-1 text-sm"
            data-testid={`ai-conversation-rename-input-${conversation.id}`}
            aria-label="Rename conversation"
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => onSubmitRename(draft)}
            data-testid={`ai-conversation-rename-confirm-${conversation.id}`}
            aria-label="Save rename"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onCancelRename}
            aria-label="Cancel rename"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </li>
    );
  }

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
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onStartRename();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onStartRename();
                }
              }}
              className="hover:text-primary"
              data-testid={`ai-conversation-rename-${conversation.id}`}
              aria-label="Rename conversation"
            >
              <Pencil className="h-3.5 w-3.5" />
            </span>
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
              className="hover:text-destructive"
              data-testid={`ai-conversation-delete-${conversation.id}`}
              aria-label="Delete conversation"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </span>
          </div>
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
