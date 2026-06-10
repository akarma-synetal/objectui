---
"@object-ui/plugin-charts": patch
---

Bar-chart X-axis labels no longer overlap on narrow widgets. When a chart has
many categories (>4) or any long label (>8 chars), the tick labels are angled
(-32°) and truncated with a hover `title`; few short labels stay horizontal.
