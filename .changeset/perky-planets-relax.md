---
'@object-ui/app-shell': patch
'@object-ui/studio': patch
'@object-ui/console': patch
---

Migrate AI chat history from localStorage to the server-backed
`ai_conversations` / `ai_messages` REST API. The studio `AiChatPanel`,
the console `ConsoleFloatingChatbot`, and any other consumer of the new
`useChatConversation` hook (in `@object-ui/app-shell`) now resolve a
durable conversation id per signed-in user, hydrate prior messages on
mount, and rotate the conversation on reset. The previous
`objectstack:ai-chat-messages` localStorage entries are no longer read
or written.
