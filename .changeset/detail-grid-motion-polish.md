---
'@object-ui/plugin-detail': patch
'@object-ui/plugin-grid': patch
---

feat(detail,grid): tab + selection motion polish

**plugin-detail**

- `DetailTabs` and the auto-tabs path in `DetailView` (5 inline
  `<TabsContent>` instances: details, related, activity, discussion,
  history) now fade in when their tab becomes active, eliminating
  the harsh flash when switching tabs.

**plugin-grid**

- `BulkActionBar` slides in from the bottom + fades in when a
  selection is made, instead of popping into existence.
- The "N items selected" counter re-animates on every count change
  (re-keyed on the count value with a small `zoom-in-90`), so users
  see clear feedback as they tick/untick rows. `tabular-nums` keeps
  the number from jittering during the animation.

All animations are wrapped in `motion-safe:` so prefers-reduced-motion
users keep the original instant UI. No new deps.

**Dialog / Sheet motion audit (informational, no code change)**

Verified `packages/components/src/ui/{dialog,alert-dialog,sheet}.tsx`:
Dialog + AlertDialog use a consistent `duration-200`. Sheet uses an
asymmetric `open:500ms / close:300ms` — this is the intentional
shadcn upstream default ("slower open feels purposeful"). No fixes
needed; these primitives live in the no-touch zone anyway.
