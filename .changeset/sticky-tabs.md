---
'@object-ui/layout': patch
'@object-ui/app-shell': patch
'@object-ui/components': patch
---

feat(shell): main becomes the scroll container; record tabs are sticky

- `AppShell`'s SidebarProvider wrapper is now constrained to viewport
  height (`h-svh overflow-hidden`) instead of expanding with content via
  the default `min-h-svh`. This makes the inner `<main>` (which is
  `overflow-auto`) the actual scroll container instead of the window.
- `RecordDetailView` page-mode container drops the redundant
  `h-full overflow-auto` (avoids nested scrollers; main owns scroll now).
- `page:tabs` (horizontal) gets `sticky top-0 z-20` with a translucent
  backdrop so the tab strip stays visible while users scroll through
  long record pages — the Salesforce Lightning behaviour our schemas
  were already implying.
