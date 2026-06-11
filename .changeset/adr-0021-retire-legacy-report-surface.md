---
"@object-ui/plugin-report": major
"@object-ui/app-shell": minor
---

ADR-0021 single-form: dataset-native report editing + legacy report surface retired.

- The Studio/runtime report inspector now edits the 9.0 dataset binding (dataset picker + values/rows selectors sourced from the dataset's semantic layer) instead of the removed objectName/columns query form.
- plugin-report: the pre-9.0 query-form renderers (SpecReportGrid, MatrixRenderer, JoinedReportRenderer), the drill helpers, and the legacy authoring components (ReportBuilder, ReportConfigPanel, ColumnsEditor, GroupingsBuilder, JoinedBlocksEditor, FieldPickerDialog, ChartConfig, ScheduleConfig) are removed. ReportRenderer dispatches dataset-bound reports to DatasetReportRenderer; stored pre-9.0 spec JSON renders through the lossy specReportToPresentation → ReportViewer bridge until migrated.
