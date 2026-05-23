---
"@object-ui/collaboration": minor
"@object-ui/app-shell": minor
---

Add `<PresenceProvider>` abstraction with `useTenantPresence()` and
`useRecordPresence(objectName, recordId)` hooks. The default source is a
no-op so hooks return `[]` until a host app wires in a realtime
transport (WebSocket / SSE). Replaces the two architectural TODOs in
`AppHeader` (tenant scope) and `RecordDetailView` (record scope) that
were waiting on this abstraction.

`AppHeader` now falls back to `useTenantPresence()` when the
`presenceUsers` prop is omitted, and `RecordDetailView` renders
`<PresenceAvatars>` next to the lifecycle badge when other users are
viewing the same record. Both code paths render exactly as before when
no provider is mounted, so this change is non-visual for existing
consumers.
