---
"@object-ui/plugin-detail": minor
---

**Phase O.1 — Cap detail body grid at 2 columns for denser, more legible layout.**

The auto-layout previously emitted **3 columns** for sections with 11+
fields, which on typical desktop widths produced very sparse rows
(label/value cells filled ~30% of each column, lots of whitespace).
Capped the inferred maximum at 2 columns so paired fields read as
cleanly-aligned label/value pairs.

Authors who explicitly set `section.columns: 3` retain the 3-column
layout — only the auto-inference default changed.
