---
"@object-ui/components": patch
"@object-ui/fields": patch
"@object-ui/layout": patch
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
---

fix: externalize all bare imports in library builds

Library builds (vite lib mode) now externalize every non-relative import instead of bundling third-party CJS dependencies into the published dist. This avoids inlined `require("react")` / `require("react-dom")` calls that cause `Calling \`require\` for "react" in an environment that doesn't expose the \`require\` function` runtime errors when consumer apps re-bundle the published dist.

Specifically fixes:
- `@object-ui/plugin-dashboard` no longer inlines `react-grid-layout` (and its transitive `react-draggable` / `react-resizable` CJS bundles). `react-grid-layout` is now declared as a peer dependency so consumers install a single ESM-friendly copy.
- `@object-ui/components`, `@object-ui/plugin-calendar`, `@object-ui/plugin-charts`, `@object-ui/plugin-designer` no longer inline `react-i18next` / `i18next` / `use-sync-external-store` CJS shims.
- All plugin packages now use a unified `external: (id) => !/^[./]/.test(id) && !id.startsWith(__dirname)` rule, ensuring future additions of CJS deps are automatically externalized.
