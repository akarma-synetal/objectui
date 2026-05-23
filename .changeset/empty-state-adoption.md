---
"@object-ui/components": minor
"@object-ui/plugin-list": patch
"@object-ui/plugin-kanban": patch
"@object-ui/plugin-dashboard": patch
---

`DataEmptyState` (re-exported as `EmptyState`) is now the canonical
platform primitive for "no records / no data" states. Two new props
keep it flexible enough to absorb the hand-rolled variants that lived
in `plugin-list`, `plugin-kanban`, and `plugin-dashboard`:

- `showIcon?: boolean` — drops the icon container entirely. Used by the
  kanban board-level empty banner, which is a status banner rather than
  a true empty-state.
- `iconWrapperClassName?: string` — overrides the default muted rounded
  square. Pass `""` to render the icon raw (used by `ListView`'s grid
  empty state, which uses a large standalone glyph).

Adopters:

- `plugin-list` (`ListView` grid empty-state) — preserves the existing
  large icon, title, message, add-record button and `data-testid`s,
  but delegates the structural markup to `DataEmptyState`.
- `plugin-kanban` (board-level "all columns empty" banner) — keeps the
  dashed border + `role="status"` / `aria-live="polite"` semantics.
- `plugin-dashboard` (`PivotTable` zero-rows branch) — keeps the
  custom 4-quad SVG icon and `pivot-empty-state` test id.

No public-API change for consumers; the older inline markup is gone
but the rendered output, translation keys, and test hooks are
preserved.
