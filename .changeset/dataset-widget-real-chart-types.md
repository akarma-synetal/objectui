---
"@object-ui/plugin-dashboard": minor
---

Dataset-bound dashboard widgets now render their TRUE chart family instead of
always a bar chart.

`DatasetWidget` routes by `widget.type` to the shared advanced chart renderer:
pie/donut/line/area/scatter/radar/funnel/treemap/sankey/column/horizontal-bar
each draw distinctly (one series per measure, carrying the measure label).
`table`/`pivot` render a grouped table of dimensions + measures (formatted via
the measure `format`). `metric`/`kpi`/`gauge`/`solid-gauge`/`bullet` keep the
single-value KPI rendering. Families without a distinct renderer map to their
closest relative (e.g. `spline`→line, `stacked-area`→area, `pyramid`→funnel) so
a widget never renders as a silently-wrong bar.
