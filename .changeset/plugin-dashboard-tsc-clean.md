---
'@object-ui/plugin-dashboard': patch
---

Clean up TypeScript errors in `plugin-dashboard`:
- `DashboardGridLayout.tsx`: replace bare `process.env.NODE_ENV` with `globalThis` cast (package doesn't include `@types/node`, and the dev-mode warning shouldn't pull it in)
- `DashboardRenderer.tsx`: annotate widget callback params explicitly so `noImplicitAny` is happy; guard `widgetType` before indexing
- `ObjectDataTable.tsx`: cast normalised column return value to the narrow `NormalizedColumn` shape
- `ObjectMetricWidget.tsx`: fix stale `target === 'modal'` check — the type allows `'dialog'`, never `'modal'`
