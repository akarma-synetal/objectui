---
"@object-ui/plugin-grid": patch
"@object-ui/plugin-gantt": patch
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

**plugin-grid:** column summary footer now formats values using the
column's type metadata. Currency columns render `Sum: $1,760,000.00`
instead of bare `Sum: 1,760,000`; percent columns honor `0–1` vs
`0–100` value ranges; avg uses two fraction digits. `useColumnSummary`
accepts an optional `fieldMetadata` map (typically `objectSchema.fields`)
so per-field `type`, `currency`, `defaultCurrency`, `precision` are
respected.

**plugin-gantt:** added safe-fallback `useGanttTranslation` hook. All
hardcoded toolbar `aria-label`s and the `Task Name` / `Start` / `End` /
`Today` column-header strings now flow through `t('gantt.*')`. A new
`gantt.*` section is exported from the en/zh/ja/ko/de/fr/es/pt/ru/ar
locales.

**app-shell:** `ReportView` no longer hardcodes the `Edit` button label
or the `Loading report…` fallback — they now use `common.edit` and
`common.loading`.

**i18n:** added top-level `gantt` section (with English fallbacks in
non-en/zh locales) and the `common.addToFavorites` /
`common.removeFromFavorites` keys across all ten built-in locales so
the `builtInLocales` parity tests pass.
