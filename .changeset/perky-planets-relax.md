---
'@object-ui/app-shell': minor
---

Add ChatGPT-style AI chat history surface at `/ai` and `/ai/:conversationId`.

- New `DefaultAiChatPage` with conversations sidebar (list, create, select, delete) and chat pane on the right.
- New `ConversationsSidebar` component and `useConversationList` hook for listing and managing `ai_conversations`.
- `useChatConversation` now accepts an optional `activeId` to hydrate a specific conversation (bypassing the localStorage cache), and guards against duplicate conversation creation when sibling state (e.g. selected agent / scope) changes during the same visit.
- Deleting the active conversation navigates back to `/ai` so the URL doesn't reference a stale id.
