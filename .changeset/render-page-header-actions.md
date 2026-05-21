---
"@object-ui/components": patch
---

fix(components): render `page:header.actions` on custom detail pages

`PageHeaderRenderer` previously read `title`, `subtitle`, `breadcrumb`,
`showStar`, `showCopyId` but never the `actions` array. Authored
Lightning record pages embed action buttons directly on
`page:header` (e.g. Lead → "Convert Lead", Opportunity → "Clone
Opportunity"); these buttons silently disappeared.

The renderer now reads `schema.actions ?? schema.properties?.actions`,
filters by `locations.includes('record_header')` (default-include when
absent), evaluates `visible` / `hidden` predicates (boolean, string,
or `{ dialect, source }` shapes) against the live record via
`ExpressionEvaluator`, and dispatches clicks through the
`ActionProvider`'s shared runner — so `confirmText`, `successMessage`,
`refreshAfter`, `flow`, navigation and modal handlers all fire.

The `data-page-actions-slot` portal target is preserved as a fallback
when no actions are declared in schema.
