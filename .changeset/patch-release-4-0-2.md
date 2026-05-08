---
"@object-ui/types": patch
"@object-ui/core": patch
"@object-ui/i18n": patch
"@object-ui/react": patch
"@object-ui/components": patch
"@object-ui/fields": patch
"@object-ui/layout": patch
"@object-ui/data-objectstack": patch
"@objectstack/plugin-ui": patch
"@object-ui/create-plugin": patch
"@object-ui/runner": patch
"@object-ui/auth": patch
"@object-ui/tenant": patch
"@object-ui/permissions": patch
"@object-ui/mobile": patch
"@object-ui/plugin-aggrid": patch
"@object-ui/plugin-ai": patch
"@object-ui/plugin-calendar": patch
"@object-ui/plugin-charts": patch
"@object-ui/plugin-chatbot": patch
"@object-ui/plugin-dashboard": patch
"@object-ui/plugin-designer": patch
"@object-ui/plugin-detail": patch
"@object-ui/plugin-editor": patch
"@object-ui/plugin-form": patch
"@object-ui/plugin-gantt": patch
"@object-ui/plugin-grid": patch
"@object-ui/plugin-kanban": patch
"@object-ui/plugin-list": patch
"@object-ui/plugin-map": patch
"@object-ui/plugin-markdown": patch
"@object-ui/plugin-report": patch
"@object-ui/plugin-timeline": patch
"@object-ui/plugin-view": patch
"@object-ui/plugin-workflow": patch
"@object-ui/collaboration": patch
"@object-ui/app-shell": patch
"@object-ui/providers": patch
"object-ui": patch
---

**Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

**`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

**`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

**CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).
