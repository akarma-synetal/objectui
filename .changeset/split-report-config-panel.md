---
'@object-ui/plugin-report': patch
---

refactor(plugin-report): split ReportConfigPanel.tsx (~1200 lines) into per-builder modules. The orchestrator file now only hosts `buildReportSchema`, `ValidationBanner`, and the public `ReportConfigPanel` component; each sub-editor (`SpecFilterAdapter`, `ColumnsEditor`, `GroupingsBuilder`, `ChartConfig`) lives in its own file alongside `editorTypes.ts` for shared types/constants. All existing exports are re-exported from `ReportConfigPanel` so test files and downstream consumers (`JoinedBlocksEditor`, `app-shell`) keep their current import paths. Pure refactor — no behavior change, 111 tests green.
