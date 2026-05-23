---
"@object-ui/types": minor
"@object-ui/data-objectstack": minor
"@object-ui/app-shell": patch
---

DataSource: add optional `bulkUpdate(resource, ids, patch)` for "same patch, many rows" interactions (Slack "mark all as read", Linear "archive selected"). The ObjectStack adapter routes to `POST /api/v1/data/:object/updateMany` so the client pays one HTTP/auth/RLS round-trip instead of N parallel PATCHes, eliminating mark-all-read jank on inboxes with 50+ unread.

AppHeader's `markAllRead` now prefers `bulkUpdate`, with a transparent fallback to the per-id loop for adapters that don't implement the helper.
