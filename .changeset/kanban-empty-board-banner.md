---
"@object-ui/plugin-kanban": minor
---

`KanbanBoard` collapses redundant per-column "No cards" placeholders into
a single board-level empty banner when **every** column is empty and the
board has more than one column. Individual columns keep their dashed
placeholder when they're the only empty column (so the asymmetry between
"this lane has zero cards" and "the whole board is empty" stays
readable). New internal prop `suppressEmptyPlaceholder` on the column
view; not part of the public API.
