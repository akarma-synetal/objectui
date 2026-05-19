---
'@object-ui/plugin-report': minor
'@object-ui/components': patch
'@object-ui/i18n': patch
---

Improve report editor panel usability based on real-user browser testing:

- **Wider config panel** — the report editor now defaults to a `--config-panel-width`
  of 440px (up from 280px), driven by a new optional `style` prop on
  `ConfigPanelRenderer`. Long field labels, report titles, type labels, and filter
  rows no longer truncate to "Account Na" / "kup" / "ct" / 1-character widths.
- **Disambiguated "Columns" sections** — for `summary` and `matrix` reports the
  measure list is now labelled **"Values / 度量"** (pivot-style vocabulary) instead
  of "Columns", which previously clashed with the matrix's pivot column axis
  (also called "Columns / 列"). The two sections used to be indistinguishable.
  New i18n key `report.editor.values` / `valuesHint` is shipped for all 10
  locales (en, zh, ar, de, es, fr, ja, ko, pt, ru).
- **Reordered sections for matrix/summary** — the editor now surfaces *Rows*
  and *Columns* (the pivot axes) **before** *Values*, mirroring how a business
  user thinks about a pivot table.
- **Per-row aggregate/format headers** — each column row in `ColumnsEditor` now
  shows small "Aggregate" / "Format" labels above the respective selects, and
  the row uses a 2-line layout so the label input has its own line. The cramped
  3-dropdowns-side-by-side layout at 10px font is gone.
- **Searchable field picker** — the "Add columns" list now has a search box,
  a `filtered / total` counter, an empty-state message, and a scrollable bordered
  container. New i18n keys: `report.editor.searchFields`,
  `report.editor.noMatchingFields`.
