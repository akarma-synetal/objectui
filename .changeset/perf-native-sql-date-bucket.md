---
"@object-ui/plugin-report": minor
---

Server-side `dateGranularity` pushdown.

`useReportData()` reports with `{ groupBy: [{ field, dateGranularity }] }`
are now aggregated directly in the database via native SQL (`strftime` /
`to_char` / `date_format`) instead of fetching raw rows and bucketing in
Node. The framework's `driver-sql` advertises per-granularity support via
`IDataDriver.supports.queryDateGranularity` and the engine transparently
falls back to in-memory bucketing only when the dialect can't express a
given granularity (notably SQLite `week`, which needs `strftime('%V')`
added in SQLite 3.46). Output bucket labels (`2026-Q2`, `2026-01-15`,
`2026-W23`, …) are byte-for-byte identical between paths so drill
`groupKey` filters compose correctly across SQL and in-memory routes.

Requires framework ≥ commit `b26d217c`.
