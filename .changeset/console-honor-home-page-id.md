---
"@object-ui/app-shell": minor
---

Console now honors `App.homePageId` for the bare `/console/apps/:appName`
landing route. Previously it always redirected to the first reachable nav
item, so CRM-style apps with KPI dashboards still landed users on the
first object list (e.g. Leads) rather than the configured home page.

The new `resolveLandingRoute` looks up the `homePageId` nav item, builds
its route (object / view / page / dashboard / report), and falls back to
the existing `findFirstRoute` only when no `homePageId` is set or it
resolves to a routeless item type.
