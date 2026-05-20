---
"@object-ui/plugin-list": minor
"@object-ui/app-shell": minor
---

Mobile UX cleanup:

- `app-shell/AppHeader`: hide the platform-logo, app-switcher pill, and
  intermediate path separators on mobile when inside an app route. The
  sidebar already exposes those affordances; the topbar now reads
  `☰ + page title + Search + Inbox + Avatar`.
- `plugin-list`: replace the hidden mobile TabBar with a new compact
  `TabBarSelect` dropdown (current view name + chevron → menu of every
  view). Phone users keep view-switching without burning a row on chip
  pills. Desktop continues to render the inline TabBar.
