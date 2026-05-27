---
'@object-ui/plugin-chatbot': minor
'@object-ui/app-shell': minor
---

Polish the AI chat surface based on real-world dogfooding feedback.

**`@object-ui/plugin-chatbot`** — new display helpers shared by `ChatbotEnhanced`:

- `unwrapToolResult(value)` peels the MCP-style `{ type: 'text', value: '<json>' }`
  envelope that backend tools emit (`@objectstack/service-ai`'s data/metadata
  tools, in particular), and JSON-parses the inner payload. The result panel
  now renders a structured object tree instead of a doubly-escaped wall of
  `\\\"objects\\\":[…]`.
- `humanizeToolName(name)` converts snake_case / kebab-case / camelCase tool
  ids into sentence case ("list_objects" → "List objects"), preserving known
  acronyms (API, ID, SQL, …). Tool-call cards now show the friendly title with
  the raw id as a small monospace badge for power users.
- `summarizeChatError(err)` strips the AI SDK's
  `"Failed after N attempts. Last error: "` prefix and keeps the first
  sentence as a headline; the full text is exposed via an optional `details`
  field so the new error banner can render a "Details" disclosure plus a
  prominent Retry button instead of a 300-character single-line wall.

A new `⌘⏎ to send` hint is shown in the prompt footer (hidden on narrow
screens). `ToolHeader.title` now accepts `ReactNode` (previously `string`)
so wrappers can compose richer titles.

**`@object-ui/app-shell`** — `AiChatPage`:

- Removes the fake "Hello! I'm X" assistant welcome bubble so the empty-state
  suggestion chips can actually render.
- Adds per-agent default suggestion sets (`data_chat`, `metadata_assistant`)
  with a generic fallback. New conversations open with three actionable
  starter prompts tailored to the selected agent.
- Surfaces agent-fetch failures as an inline warning on the agent picker
  instead of hijacking the welcome message.
- Placeholder text now hints at the first suggestion (e.g. `Ask Data
  Assistant…  (try "系统里有多少个用户？")`).
