---
'@object-ui/i18n': patch
'@object-ui/app-shell': patch
'@object-ui/plugin-grid': patch
'@object-ui/cli': patch
---

Comprehensive i18n refactor + CI test fix.

**i18n (`@object-ui/i18n`)**
- Added ~130 new keys under 12 new top-level namespaces: `layout`, `search`,
  `empty`, `renderer`, `actionDialog`, `rowAction`, `navigationSync`,
  `objectActions`, `objectViewActions`, `dashboardActions`, `recordDetail`,
  `cellRender`, plus `grid.{empty,yes,no,systemFields,openMenu}`.
- Mirrored all new top-level namespaces to all 10 built-in locales
  (en, zh, ja, ko, de, fr, es, pt, ru, ar) to maintain key parity required
  by the locale-structure test. Non-en/zh locales seed with English values
  and rely on `fallbackLng: 'en'` until human translation lands.

**App shell (`@object-ui/app-shell`)** — replaced hardcoded English in 14
files with `useObjectTranslation`:
- Layout: `AppSidebar`, `ActivityFeed` (locale-aware relative time),
  `MetadataInspector`.
- Views: `SearchResultsPage`, `ActionParamDialog`, `RecordFormPage`,
  `RecordDetailView`, `PageView`, `DashboardView` (PDF / forecast toasts),
  `ReportView`, `ObjectView` (rename / delete view toasts).
- Console: `AppContent` (no-apps empty state).
- Components: `PageRenderer`, `FormRenderer`, `DashboardRenderer`.
- Hooks: `useNavigationSync` (16 toasts incl. Undo label),
  `useObjectActions` (delete confirm + success / failure toasts).

**Plugin grid (`@object-ui/plugin-grid`)**
- `ObjectGrid` record-detail panel now translates Empty / Yes / No / System
  via the existing `useGridTranslation` safe-fallback wrapper.
- `RowActionMenu` adopts a local safe-fallback i18n wrapper for
  `Open menu` / `Edit` / `Delete`, preserving standalone-usage guarantees.

**CLI test fix (`@object-ui/cli`)**
- `cli-bin.test.ts` auto-builds the package on first run when `dist/cli.js`
  is missing, instead of throwing. This unbreaks `pnpm test:coverage` in CI
  (root vitest run does not honor turbo's `^build` deps) and removes the
  manual `pnpm --filter @object-ui/cli build` requirement for local dev.
