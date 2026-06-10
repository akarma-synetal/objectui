---
"@object-ui/plugin-dashboard": minor
---

Dataset-bound dashboard widgets now use the measure's display label + format and
render metric widgets with a consistent card.

- KPI value and chart legend use the measure `label` (carried on the analytics
  result `fields`) instead of the raw measure name — "Tasks" not "task_count".
- The KPI value is formatted via the measure `format` hint ("$0,0" → "$616,000").
- A dataset-bound `metric` widget takes the shared Card wrapper (title + border)
  like kpi/gauge, instead of rendering as bare untitled text.

Requires `AnalyticsResult.fields[].label`/`format` (objectstack-ai/framework#1683).
