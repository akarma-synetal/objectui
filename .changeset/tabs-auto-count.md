---
'@object-ui/components': minor
---

`page:tabs` now auto-derives count badges from any descendant `record:related_list`.

For every tab item whose `count` is not set explicitly, the renderer walks the tab's children (depth-first) to find the first `record:related_list` schema node and issues a `limit:1` find through the active `dataSource` to read the matching `total`. The badge appears in the tab strip without spec authors having to wire counts manually.

Behavior:
- Explicit `count` in the spec always wins.
- Probe is filtered by the parent record id via `relationshipField` when present (skipped until the parent record is loaded).
- Best-effort: a failed probe just omits the badge — no error surface.
- Cancellable on unmount.
