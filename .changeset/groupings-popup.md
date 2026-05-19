---
'@object-ui/plugin-report': minor
'@object-ui/i18n': patch
---

feat(plugin-report): popup picker for groupings + section-aware test ids

The matrix/summary "Group by" (rows) and "Columns axis" (cols) sections now
share the same searchable popup picker as the columns section, with a
commit-on-select single-pick mode wired through `FieldPickerDialog`.

- Per-row field buttons display the human-readable field label and open a
  dialog scoped to swap that single field (already-used fields filtered out)
- "Add grouping" trigger uses the same dialog
- `GroupingsBuilder` accepts a `testIdPrefix` prop; ReportConfigPanel passes
  `rows-grouping` and `cols-grouping` so both instances no longer share the
  ambiguous `grouping-field-0` testid
- Bigger row spacing (h-7 / text-xs) — the old `text-[10px]` was unreadable

`FieldPickerDialog` gains:
- `commitOnSelect`: hides the Confirm/Cancel footer; clicking a row commits
  + closes immediately (intended for `singleSelect` flows)
- `trigger`: custom trigger element override (used by the per-row field button)
