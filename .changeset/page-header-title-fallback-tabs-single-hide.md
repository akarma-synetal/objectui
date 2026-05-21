---
"@object-ui/components": minor
---

feat(page:header,page:tabs): title fallback + single-tab strip auto-hide (Phase G slice 3 polish)

- `page:header.resolvedTitle` now honors `objectSchema.titleFormat`
  (e.g. `{first_name} {last_name}`) and falls back through `name →
  full_name → title → subject → display_name → label` before degrading
  to `${objectLabel} ${idPrefix}`. Mirrors `DetailView.resolveDisplayTitle`
  so default and synthesized record pages produce identical titles.
- `page:tabs` hides the tab strip entirely when there's only one tab
  (a single labelled pill is visual clutter, not an affordance).
  Authors can opt back in with `properties.alwaysShowStrip: true`.
  Single-tab content margin tightens from `mt-3` to `mt-0` to remove
  the now-empty top space.
