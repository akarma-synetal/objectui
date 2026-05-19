---
"@object-ui/plugin-dashboard": minor
---

Gauge widgets bound to an object (`type: 'gauge' | 'solid-gauge'` + `object`) now honor display options that were previously dropped on the floor when the renderer fell back to `object-metric`:

- `format` (e.g. `'0%'`), `currency`, `prefix`, `suffix` are now forwarded to the underlying metric widget.
- New `invert` option on `ObjectMetricWidget`: when the aggregated value is a rate in `[0, 1]`, displays `1 - value`. Useful for "compliance" / "uptime" gauges that aggregate the opposite signal (e.g. `avg(is_sla_violated)` → display the SLA compliance rate).
