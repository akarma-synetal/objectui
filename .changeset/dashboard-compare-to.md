---
"@object-ui/core": minor
"@object-ui/plugin-dashboard": minor
"@object-ui/plugin-charts": minor
"@object-ui/types": minor
---

Add `compareTo` field to dashboard widgets for period-over-period
comparison. Supports `'previousPeriod'`, `'previousYear'`, and
`{ offset: '7d' | '4w' | '1M' | '1y' }`.

- **Metric / gauge widgets** now compute a delta percentage when `compareTo`
  is set and surface it as a derived `trend` (auto-labelled via
  `dashboard.trend.vsLast*` i18n keys sniffed from the filter macros).
- **Chart widgets** (line / area / bar / horizontal-bar / scatter / combo)
  overlay a muted comparison-period series (dashed line, lower fill opacity).
  Pie / donut / funnel ignore `compareTo`.
- New core utilities: `shiftFilterByCompareTo`, `compareToTrendLabelKey`,
  `computeMetricDelta`, and `CompareToConfig` type.
- `ChartSeries` now accepts `variant: 'comparison'`, `dashArray`, and
  `opacity` overrides for visual treatment.

See `packages/plugin-dashboard/SKILL.md` for usage examples.
