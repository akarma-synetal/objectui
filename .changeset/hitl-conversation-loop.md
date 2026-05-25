---
'@object-ui/plugin-chatbot': minor
'@object-ui/app-shell': patch
---

**HITL conversation loop:** `useHitlInChat` now accepts a
`continueConversation(prompt, ctx)` callback. After the operator approves
or rejects a tool call from inline chat buttons, the hook synthesises a
short follow-up user prompt (tagged `[HITL pa_xxx]`, with the executed
result or rejection reason) and invokes the callback so the LLM
continues the conversation with full awareness of the outcome.

`ConsoleFloatingChatbot` wires this callback to `useObjectChat`'s
`sendMessage`, closing the loop end-to-end. Execution failures stay
visible in the inline status badge but do NOT continue automatically —
the operator decides next steps.

No framework changes required. Internal `idMap` now also tracks the
tool name so the synthesised prompt is human-readable. New test suite
`useHitlInChat.test.tsx` covers approve/reject/failed/no-callback
branches.
