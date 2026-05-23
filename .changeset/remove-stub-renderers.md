---
"@object-ui/app-shell": major
---

**Breaking change:** Remove unused stub renderers from `@object-ui/app-shell`:

- `ObjectRenderer` / `ObjectRendererProps`
- `DashboardRenderer` / `DashboardRendererProps`
- `PageRenderer` / `PageRendererProps`
- `FormRenderer` / `FormRendererProps`

These were placeholder components that never delegated to a real
SchemaRenderer — they rendered a "TODO" string and were not consumed
anywhere in the monorepo or in the official Console app. The real
renderers ship from the respective plugin packages:

- Dashboard → `@object-ui/plugin-dashboard` (`DashboardRenderer`)
- Page / Object / Form → `@object-ui/react` (`SchemaRenderer`) +
  `@object-ui/plugin-form` / `@object-ui/plugin-grid` etc.

If you were importing one of the removed stubs, replace it with the
plugin-package equivalent.
