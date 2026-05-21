/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * DiscussionContext — shared chatter / discussion feed for the current
 * record. Mounted alongside RecordContext by the host record page (see
 * `RecordDetailView` in `@object-ui/app-shell`) so that any `record:chatter`
 * or `record:discussion` renderer placed inside the schema tree picks up
 * the same feed items / mutation handlers without a parallel fetch.
 *
 * Why this is separate from RecordContext: chatter feeds are commonly
 * absent (e.g. settings pages, dashboards), and many record pages opt in
 * via schema rather than always paying the fetch cost. Keeping the
 * discussion data in its own context lets non-record pages provide it
 * cheaply and lets record pages omit it without affecting unrelated
 * record-aware renderers.
 */

import React from 'react';

export interface DiscussionFeedItem {
  id: string;
  /** Generic discriminator — chatter renderers may switch on this. */
  type?: string;
  [k: string]: any;
}

export interface DiscussionContextValue {
  items: DiscussionFeedItem[];
  onAddComment?: (text: string, attachments?: any[]) => void | Promise<void>;
  onAddReply?: (parentId: string, text: string) => void | Promise<void>;
  onToggleReaction?: (itemId: string, reaction: string) => void | Promise<void>;
  loading?: boolean;
  error?: Error | null;
}

const DiscussionContext = React.createContext<DiscussionContextValue | null>(null);

export interface DiscussionContextProviderProps extends DiscussionContextValue {
  children: React.ReactNode;
}

export const DiscussionContextProvider: React.FC<DiscussionContextProviderProps> = ({
  children,
  ...value
}) => {
  const memo = React.useMemo<DiscussionContextValue>(() => value, [
    value.items,
    value.onAddComment,
    value.onAddReply,
    value.onToggleReaction,
    value.loading,
    value.error,
  ]);
  return (
    <DiscussionContext.Provider value={memo}>{children}</DiscussionContext.Provider>
  );
};

export function useDiscussionContext(): DiscussionContextValue | null {
  return React.useContext(DiscussionContext);
}
