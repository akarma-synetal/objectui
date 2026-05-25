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

Also fix recursive `/home/home/home/...` URL accumulation: both the
console router basename (`apps/console/src/App.tsx`) and the
post-org-switch home URL resolver (`@object-ui/app-shell`'s
`resolveHomeUrl`) now read `<base href>` explicitly instead of
`document.baseURI`. When no `<base>` tag is present, `document.baseURI`
returns the current page URL, which leaked the SPA route back into
base-resolution and made every navigation append another `/home`
segment. Mirrors the studio fix in cf520c13.
