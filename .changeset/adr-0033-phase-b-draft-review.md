---
'@object-ui/plugin-chatbot': minor
'@object-ui/app-shell': minor
---

feat(studio): ADR-0033 Phase B — draft review surface (chat → designer → generic diff)

Closes the AI metadata-authoring loop in Studio. The framework (ADR-0033 Phases A + C) makes the assistant stage every change as a DRAFT; this lets a human see and review those drafts.

**`@object-ui/plugin-chatbot`**

- `mapMessages` now detects the framework's draft envelopes — `{ status:'drafted', type, name, … }` (single) and `{ status:'drafted', drafted:[{type,name}] }` (apply_blueprint batch) — and lifts the reviewable targets onto `ChatToolInvocation.draftReview` (mirrors the existing HITL `pendingActionId` path; the Vercel `{type:'text',value}` wrapper is peeled). `blueprint_proposed` is intentionally not surfaced (no draft yet).
- `ChatbotEnhanced` renders a **"Review N change(s)"** button on drafted tool results, driven by a new `onReviewDraft` callback prop.

**`@object-ui/app-shell`**

- `assistantBus` gains a review channel (`requestReview` / `requestAssistantReview`); `ConsoleFloatingChatbot` wires the chat button to it; a small navigator inside `AppContent` (which knows the app base) routes to `/apps/:appName/metadata/:type/:name?review=1`.
- `ResourceEditPage` honours `?review=1`: it force-reloads the pending draft (covers the case where the AI drafted the item after the page mounted) and opens the review/diff.
- New **`DraftReviewPanel`** — a generic, type-agnostic draft↔published structural diff (added / changed / removed by key), reusing `LayeredDiff`'s `computeDiffRows`. It gives **every** metadata type (view, dashboard, flow, …) a real "what will publishing change" review, surfaced as a toolbar affordance + sheet whenever a draft exists. The object designer keeps its richer per-field review.

Nothing is published by any of this — the human still clicks Publish.
