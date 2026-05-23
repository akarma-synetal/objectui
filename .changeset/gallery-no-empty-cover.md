---
"@object-ui/plugin-list": patch
---

Gallery cards no longer render a giant gradient letter placeholder when
the configured `coverField` has no populated values anywhere in the
dataset. Previously, simply declaring `gallery.coverField` would force
the cover area on even when every record's image was null/empty, producing
oversized 200×200 "C" / "A" letter blocks that dwarfed the actual card
content (the Contact and Account card views in the CRM example were the
most visible offenders).

The configured-but-empty state now matches the unconfigured state:
collapse the cover area, render a compact title-plus-fields card.
When at least one record in the dataset has a cover image, the cover
area still renders for all cards so heights stay consistent.
