---
"@object-ui/plugin-charts": minor
"@object-ui/plugin-dashboard": minor
"@object-ui/types": minor
---

feat(charts,dashboard): data-screen customization primitives

- object-metric `variant:'bare'` — big tinted number + label, no card chrome
  (data-screen KPIs that stay data-bound).
- object-chart `colors` prop overrides the theme `--chart-1..n` palette so a
  page/dashboard can brand its charts; compact metric formatting (`'0.0a'` →
  "1.1M").
- ObjectChartSchema.chartType widened to donut/horizontal-bar/column.
