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

fix(build): inline dynamic imports in library outputs

Library `vite build --lib` outputs were emitting separate code-split chunks
(`rolldown-runtime-*.js`, `LookupField-*.js`, etc.) when source files used
`React.lazy()` / dynamic `import()`. When consumer apps re-bundled these
multi-file dists, the library's per-chunk rolldown-runtime collided with the
consumer's own runtime, causing "TypeError: i is not a function" at runtime
when lazy components tried to register themselves (e.g. TextField in
`@object-ui/fields` after 4.0.4).

Adding `output.inlineDynamicImports: true` to all `@object-ui/*` library vite
configs forces a single `dist/index.js` per package, which lets consumer
bundlers handle the library as an opaque ESM module without identifier
mismatches across chunks.

Affected packages: components, fields, layout, plugin-aggrid, plugin-ai,
plugin-calendar, plugin-charts, plugin-chatbot, plugin-dashboard,
plugin-designer, plugin-detail, plugin-editor, plugin-form, plugin-gantt,
plugin-grid, plugin-kanban, plugin-list, plugin-map, plugin-markdown,
plugin-report, plugin-timeline, plugin-view, plugin-workflow.
