---
"@object-ui/app-shell": patch
---

Fix: floating chatbot now replays persisted conversation history on mount.

The right-corner floating chatbot (`ConsoleFloatingChatbot`) was passing only
`conversationId` to its inner `useObjectChat`, dropping the `initialMessages`
returned by `useChatConversation`. Backend persistence already worked — the
server-side `ai_conversation` + `ai_message` rows were created and survived a
page refresh — but the UI started each session with just the static "welcome"
bubble, making users believe their history had been lost.

Now matches the `/ai/:conversationId` full-page chat: history is hydrated
into the chat surface, and the welcome bubble is suppressed when prior turns
exist (showing it above real user/assistant turns is confusing).
