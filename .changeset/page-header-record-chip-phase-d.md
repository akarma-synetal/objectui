---
'@object-ui/components': minor
'@object-ui/layout': patch
---

feat(page:header): record-aware chip + dedupe registrations (Phase D)

The `page:header` schema renderer is the visual anchor of every custom
record detail page (lead, opportunity, future account/contact/case).
Before this change it had two problems that bled into every custom
page across the product:

1. **Quadruple registration**: `@object-ui/layout` registered both
   `page-header` and `page:header`, and `@object-ui/components`
   independently registered `page:header` (and `page:section`).
   Whichever package loaded last won the unqualified `page:header`
   lookup — visually unstable.
2. **Bare `<h1>`** with no record affordances (no icon, ★ favourite,
   copy-id, edit, ⋯ menu) — every custom page shipped a thinner header
   than the default detail view it was meant to supersede.

This commit:

- Removes the `@object-ui/layout` `page:header` registration. The
  layout package keeps the legacy kebab-cased `page-header` alias only.
  The canonical renderer now lives in `@object-ui/components` and is
  always the one resolved.
- Upgrades `PageHeaderRenderer` to render a `<RecordTitleChip>` when
  wrapped in a `RecordContext`. The chip mirrors the default detail
  header: title (resolved from `data.name` / `data.title` /
  `data.display_name`, or an interpolated `schema.title`), a favourite
  star, the object label, and a copy-record-id button. Authors opt out
  via `recordChrome: false` or hide individual affordances with
  `showStar: false` / `showCopyId: false`.
- Extracts the chip into a new shared `RecordTitleChip` component in
  `@object-ui/components/custom`. It carries an inline zh-CN/zh-TW
  dictionary for star/copy tooltips so it stays i18n-correct without
  pulling in a translation dependency.
- Fixes `interpolate()` so a `{account}`-style token that resolves to
  a related-record object renders as empty instead of
  `"[object Object]"`. Authors who want a field of the related record
  should use a deeper path (`{account.name}`).

Verified at 1440×900 on `lead_detail` and `opportunity_detail`:
both pages now show the same chip with star + copy-id and the
opportunity highlights strip looks coherent with the chip above it.
