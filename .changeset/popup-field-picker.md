---
'@object-ui/plugin-report': minor
'@object-ui/i18n': patch
---

feat(plugin-report): replace inline column picker with a popup field picker

The columns section now opens a Dialog-based multi-select picker (`FieldPickerDialog`)
instead of rendering the unselected field list inline. The popup supports search,
batched multi-selection (commit several fields in one click), per-field type badges,
cancel-discards-pending semantics, and is fully i18n'd. Also fixes a latent
`ReferenceError: normalizeColumns is not defined` that crashed the editor whenever
the chart section was expanded.
