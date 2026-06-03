---
'@object-ui/app-shell': patch
---

Flow designer: start a new flow with a trigger, and stop the edge "+" overlapping branch labels

Two more dogfooding fixes for the Studio flow designer:

- **Empty flow → Start node.** An empty editable flow's "Add node" inserted a
  generic `task` node; it now seeds a `start` (trigger) node — the canonical
  entry point every flow needs — so the canvas opens on the trigger and the
  author builds forward from there.
- **Edge insert handle no longer collides with the branch label.** The "insert
  node" `+` button and the branch/condition label pill were both centered on the
  edge midpoint, so on a labeled edge (`approve`, `if …`) the `+` sat on top of
  the label. The `+` now slides to the right of the label when one is present
  (unlabeled edges keep the centered `+`).

Verified in-browser: labeled edges show the label and a clear, separate insert
handle; `tsc --noEmit` clean.
