---
"@object-ui/plugin-report": minor
---

Simplify report identity: replace the dashboard-style KPI grid with a compact "Totals" strip so reports look like reports (table-first with a grand total), not like mini-dashboards.

- `SpecReportGrid` now renders one inline `Totals: Label1: value Label2: value …` strip above the chart and table, styled as a muted single-line band — clearly subordinate to the data grid below.
- The Totals strip is now also shown for `tabular` reports when they declare aggregating columns (matches Salesforce's "Grand Total" convention).
- Drop the duplicate chart title `<div>`: the chart component already renders its own title from `report.chart.title`.
- Test ids renamed: `spec-report-kpis` → `spec-report-totals`, `spec-report-kpi-${key}` → `spec-report-total-${key}`.

Visual distinction from dashboards is now intentional: dashboard widgets use prominent floating KPI cards to convey "headline numbers"; report Totals describe the single dataset on the page and are intentionally compact.
