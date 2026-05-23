---
"@object-ui/fields": patch
"@object-ui/i18n": patch
"@object-ui/plugin-grid": patch
"@object-ui/plugin-detail": patch
"@object-ui/plugin-dashboard": patch
---

Stop silently assuming USD when a currency field has no `currency`
configured. For non-USD orgs (e.g. a CNY-based CRM seeded without an
explicit currency) the cells now render as plain locale-formatted
numbers (`150,000.00`) instead of `$150,000.00` — which was the #1
"why is my RMB showing as dollars?" bug.

Behavior change is opt-in via omission: when `currency` /
`defaultCurrency` is set on the field/column, formatting is unchanged.

Fixed call sites:
- `@object-ui/fields`: `formatCurrency`, `formatCompactCurrency`, and
  `CurrencyCellRenderer` no longer default-param `'USD'`.
- `@object-ui/i18n`: `formatCurrency()` falls back to `formatNumber`
  semantics when `currency` is omitted.
- `@object-ui/plugin-grid`: column-summary formatter (`Sum: 5,000,000`
  instead of `Sum: $5,000,000.00`).
- `@object-ui/plugin-detail`: header-highlight currency formatter.
- `@object-ui/plugin-dashboard`: `ObjectMetricWidget` inferred
  currency now resolves to `undefined` (not `'USD'`) for un-tagged
  fields, so `MetricWidget`'s `isCurrency` heuristic falls through
  to plain number formatting.
