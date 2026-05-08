---
'@object-ui/core': patch
'@object-ui/react': patch
'@object-ui/components': patch
'@object-ui/app-shell': patch
'@object-ui/plugin-detail': patch
'@object-ui/plugin-kanban': patch
'@object-ui/plugin-calendar': patch
'@object-ui/console': patch
---

Fix compatibility with the framework's normalized Expression envelope format.

`@objectstack/spec` now emits predicate (`visible` / `enabled`) and template
(`titleFormat`) fields as `{ dialect, source }` envelopes instead of bare
strings. The previous implementation assumed strings and crashed the record
detail view (`TypeError: titleFormat.replace is not a function`) and printed
`Failed to evaluate expression: ${[object Object]}` for every action visibility
predicate.

- `@object-ui/core`: `ExpressionEvaluator.evaluate` / `evaluateCondition` now
  unwrap Expression envelopes transparently.
- `@object-ui/react`: new `toPredicateInput()` helper to safely normalize
  `boolean | string | Expression` predicate inputs into the `${expr}` form
  expected by `useCondition`.
- `@object-ui/components`: `action-bar`, `action-button`, `action-group`,
  `action-icon`, `action-menu` renderers use `toPredicateInput()` instead of
  template-literal interpolation that produced `${[object Object]}`.
- `@object-ui/plugin-detail`, `@object-ui/plugin-kanban`,
  `@object-ui/plugin-calendar`, `@object-ui/app-shell`,
  `@object-ui/console`: title-format helpers accept both legacy strings and
  the new `{ source }` envelope.

All changes are backward-compatible — legacy bare strings continue to work.
