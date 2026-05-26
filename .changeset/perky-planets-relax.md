---
'@object-ui/app-shell': minor
---

Add ChatGPT-style AI chat history surface at `/ai` and `/ai/:conversationId`.

- New `DefaultAiChatPage` with conversations sidebar (list, create, select, delete) and chat pane on the right.
- New `ConversationsSidebar` component and `useConversationList` hook for listing and managing `ai_conversations`.
- `useChatConversation` now accepts an optional `activeId` to hydrate a specific conversation (bypassing the localStorage cache), and guards against duplicate conversation creation when sibling state (e.g. selected agent / scope) changes during the same visit.
- Deleting the active conversation navigates back to `/ai` so the URL doesn't reference a stale id.
- Auto-title new conversations from the first user message (truncated to 40 chars) via `PATCH /api/v1/ai/conversations/:id`; resumed conversations are left alone.
- Manual rename in the sidebar: pencil icon opens an inline editor with optimistic update and rollback on server error.
- Client-side search input filters the sidebar by title/preview substring.
