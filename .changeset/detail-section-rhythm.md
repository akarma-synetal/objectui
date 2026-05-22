---
"@object-ui/plugin-detail": patch
"@object-ui/components": patch
---

Tighten record-detail visual rhythm. Section card titles were rendering at
Shadcn's default `text-2xl` which dominated the page; the related-list
accordion in flush mode dropped all per-item borders so the collapsed
"Quotes / Products / Open Tasks" triggers stacked with zero visual
separation.

- `@object-ui/plugin-detail` `DetailSection`: override the `CardTitle`
  className to `text-base font-semibold tracking-tight`, slim down
  `CardHeader` padding (`py-3 px-4 sm:py-4 sm:px-6`) and `CardContent`
  vertical padding so titles + content read as a single tight block
  rather than a billboard. Demoted the section description from `text-sm
  mt-1.5` to `text-xs mt-1` for the same reason.
- `@object-ui/components` `PageAccordionRenderer`: in the default
  `flush` variant restore a subtle `border-b last:border-b-0` divider
  between accordion items so collapsed siblings get a separator, and
  style the trigger as `text-sm font-semibold tracking-tight
  hover:no-underline` (Shadcn's hover-underline default looks busy on
  CRM-style related-list lists).
