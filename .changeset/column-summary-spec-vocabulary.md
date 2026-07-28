---
"@object-ui/plugin-grid": minor
"@object-ui/types": minor
"@object-ui/react": minor
---

feat(grid): compute all eleven spec column summary aggregations (#2890)

`ColumnSummarySchema` accepts eleven aggregation names; `useColumnSummary` computed
five. The other six — `none`, `count_empty`, `count_filled`, `count_unique`,
`percent_empty`, `percent_filled` — passed validation at authoring time and then
rendered a blank footer cell, with no error raised on either side.

The computation now splits into two families. Count and percent read *raw* cell
values, before the numeric parse, so they work on text, select and lookup columns and
a value that does not parse as a number still counts as a filled row; a cell is empty
when it is `null`, `undefined`, `""` or an empty array. `sum`/`avg`/`min`/`max` keep
the existing numeric parse and column formatting.

Two behavior changes follow from the enum carrying both `count` and `count_filled`,
which cannot mean the same thing:

- `count` is now every row; `count_filled` is the non-empty variant. Only a column
  whose values are all empty renders differently than before.
- a zero count renders `Empty: 0` instead of collapsing to a blank cell.

Column currency/percent formatting is gated to the numeric family, so `count_unique`
on a currency column reads `Unique: 3` and not `$3.00`. `none` and unrecognized names
skip the entry entirely, so a view whose columns all opt out renders no footer row.

`ListColumnSchema`'s objectui-local `{ type, field }` arm now takes its vocabulary
from `SpecColumnSummarySchema` by reference — it was stuck at the same five names,
which left the per-column `field` override unavailable for the six new aggregations.

A parity test asserts the renderer's supported set equals the spec enum in both
directions: a spec name the renderer omits is the bug above, and a renderer name the
spec omits would be local dialect (Commandment #0).

**Removed:** `useColumnSummary` from `@object-ui/react`. It was a second, unrelated
hook of the same name with no callers — a different API, a comment claiming it
implemented spec v2.0.7, and a `distinct` aggregation that is not in the spec
vocabulary at all (the spec calls it `count_unique`). Use `useColumnSummary` from
`@object-ui/plugin-grid`, which implements the spec enum.
