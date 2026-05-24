---
"@object-ui/plugin-chatbot": minor
"@object-ui/types": minor
---

Rebuilt the chatbot UI on top of **Vercel AI Elements** (MIT) and wired in
the v1 capabilities exposed by `@objectstack/service-ai` (tracing,
`generateObject`, `query_data` tool, `ModelRegistry`).

- **What's new**
  - `ChatbotEnhanced` is now composed from `Conversation`, `Message`,
    `PromptInput`, `Suggestion`, `Tool`, `Reasoning`, `Sources`, and friends.
    Sticky-to-bottom scrolling, keyboard-aware textarea, file pill chips,
    copy/retry actions, and the streaming/error banners now match the
    shadcn-style AI surface used across the ecosystem.
  - **Tool / reasoning / sources rendering**: assistant messages with
    `toolInvocations`, `reasoning`, or `sources` automatically render the
    collapsible tool panels, the chain-of-thought block, and the citation
    pill. `useObjectChat` parses these directly from `vercel/ai`'s
    `UIMessage.parts` stream — no extra wiring needed at the call site.
  - **Model picker**: optional `models` + `selectedModelId` + `onModelChange`
    props render an inline `<select>` in the prompt-input toolbar. Designed
    to be fed straight from `GET /api/v1/ai/models` (new in service-ai
    v1).
  - **Trace links**: new optional `traceId` on `ChatMessage` surfaces a
    small "trace" link on assistant messages — pair with the `ai_traces`
    object exposed by service-ai's auto-tracing.
  - New optional `suggestions?: string[]` prop renders a chip row in the
    empty state and forwards the picked suggestion to `onSendMessage`.
  - All vendored AI Elements (10 components) plus two missing shadcn
    primitives (`button-group`, `input-group`) are exported as a namespace —
    `import { AIElements } from '@object-ui/plugin-chatbot'` — so apps can
    compose bespoke chat surfaces without dropping back to the legacy
    primitives.

- **Type-level changes**
  - `@object-ui/types` `ChatMessage` gains optional `reasoning`, `sources`,
    `traceId` fields, and a new `ChatMessageSource` interface.
  - `ChatToolInvocation` accepts the AI SDK v6 lifecycle states
    (`input-streaming`/`input-available`/`output-available`/`output-error`/
    …) in addition to the legacy `partial-call`/`call`/`result`. `args`
    is now optional and accepts arbitrary shapes; new optional `errorText`
    field.

- **What hasn't changed**
  - Public prop signature on `FloatingChatbot`, `FloatingChatbotPanel`, and
    the SDUI `"chatbot"` renderer.
  - Hook contracts: `useObjectChat`, `useAgents`,
    `useFloatingChatbot`.
  - SSR / Tailwind 4 / React 18+19 support.

- **Under the hood**
  - New deps: `streamdown`, `use-stick-to-bottom`, `shiki`, `motion`,
    `nanoid`, `@radix-ui/react-use-controllable-state`,
    `@radix-ui/react-slot`, `class-variance-authority`.
  - Vendored sources live under `src/elements/` with header comments pointing
    back to `registry.ai-sdk.dev`. Rule #7 No-Touch Zones are respected —
    `packages/components/src/ui/**` was not modified.

