---
"@object-ui/app-shell": patch
---

Remove unused stub renderers from `@object-ui/app-shell`:

- `ObjectRenderer` / `ObjectRendererProps`
- `DashboardRenderer` / `DashboardRendererProps`
- `PageRenderer` / `PageRendererProps`
- `FormRenderer` / `FormRendererProps`

These were placeholder components that never delegated to a real
SchemaRenderer — they rendered a literal `"TODO"` string and were not
consumed anywhere in the monorepo or in the official Console app.
Because they were non-functional, no working production code could
have depended on them; this is treated as a patch-level cleanup rather
than a semver-major break.

If you were importing one of the removed stubs (and somehow got past
the "TODO" placeholder render), the real renderers ship from the
respective plugin packages:

- Dashboard → `@object-ui/plugin-dashboard` (`DashboardRenderer`)
- Page / Object / Form → `@object-ui/react` (`SchemaRenderer`) +
  `@object-ui/plugin-form` / `@object-ui/plugin-grid` etc.
