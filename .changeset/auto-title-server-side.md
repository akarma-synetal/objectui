---
"@object-ui/app-shell": patch
---

`AiChatPage` no longer PATCHes a client-side title-from-first-message
on the freshly-created conversation. The server (`@objectstack/service-ai`
≥ next minor) now generates a concise LLM-summarised title fire-and-forget
after the first assistant turn lands, and a client-side truncated title
would race that and win — pinning every conversation row to a 40-char
substring of the first user message instead of a real summary.

Drop the PATCH; bump the sidebar list a couple of times (2.5 s + 6 s)
to pick up the LLM title whenever the model finally responds.
