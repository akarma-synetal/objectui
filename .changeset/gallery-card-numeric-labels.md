---
"@object-ui/plugin-list": minor
---

Gallery cards now prefix numeric / currency / percent fields with their
translated field label.

The card layout in `ObjectGallery` previously dropped every label,
relying on each cell renderer to be self-describing. That works for
status badges, phone links, email links, and dates — but for bare
numbers a row like `5,000,000 / 250` gives the user no clue whether
those are revenue, headcount, pipeline value, or close-date.

We now auto-prepend a small muted field label for the low-semantic
renderer types (`number`, `currency`, `percent`, `integer`, `decimal`).
Self-describing types are unchanged. The label is routed through the
i18n field-label dictionary so authored objects with translated labels
render consistently with the detail page.
