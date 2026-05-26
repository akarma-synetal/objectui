---
'@object-ui/app-shell': minor
'@object-ui/plugin-designer': minor
'@object-ui/data-objectstack': patch
---

Metadata Admin engine — unified UI for all 27 metadata types.

A generic, schema-driven admin shell that replaces the old per-type
bespoke pages with a single registry-driven engine. Admins can now browse,
create, override, diff, and roll back every registered metadata type from
the Setup app → *All Metadata Types*.

### New: `@object-ui/app-shell` views/metadata-admin

- **`MetadataDirectoryPage`** — auto-grouped tile directory by domain, with
  free-text search, domain chips, and a *Writable only* filter.
- **`MetadataResourceListPage` / `MetadataResourceEditPage` / `…CreatePage` / `…HistoryPage`** —
  generic CRUD shell. Uses the new `/meta/types` schema field to render
  SchemaForm; uses `?layers=code,overlay,effective` to power a 3-state diff
  tab; uses `/references` to warn before destructive deletes.
- **`MetadataQuickFind`** — Cmd+Shift+M palette searching across types and
  items.
- **`PermissionMatrixEditor`** — Salesforce-style matrix custom editor for
  `type=permission`. Objects × CRUD/VAMA/lifecycle columns with cascade
  rules (viewAllRecords ⟹ allowRead, etc.), expandable per-object field
  R/W subtable, bulk-set (R / CRUD / All / None), filter, *only granted*
  toggle, destructive-change confirmation, profile switch.
- **`DesignerEditorWrapper`** — generic load–edit–save shell that hosts any
  bespoke designer (`ObjectViewConfigurator`, `DashboardEditor`,
  `PageCanvasEditor`, …). Handles dirty tracking, Save / Reset / Refresh /
  History buttons, and the read-only fallback when `allowOrgOverride` is
  false.
- **`i18n.ts`** — bilingual (`en-US`, `zh-CN`) bundle for built-in type
  labels, domain labels, and engine UI strings, with `detectLocale()` and a
  `t(key)` helper.

### New routing variant

- App nav now supports `{ type: 'component', componentRef, params? }` items.
  `AppContent` resolves them through the existing `ComponentRegistry`.
- Built-in components registered: `metadata:directory`, `metadata:resource`,
  `metadata:object/edit` (FieldsPage), `metadata:permission/edit`
  (PermissionMatrixEditor), and lazy designer wrappers for view / dashboard
  / page.

### Plugin-designer

- Lazy-exported `ObjectManager`, `FieldDesigner`, `ObjectViewConfigurator`,
  `DashboardEditor`, `PageCanvasEditor`, `MetadataObjectsPage`, and
  `MetadataFieldsPage` so the engine can mount them on demand.

The temporary `/dev/meta` route is removed. Setup app navigation flows
through the new component routes.
