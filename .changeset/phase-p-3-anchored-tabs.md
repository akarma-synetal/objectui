---
"@object-ui/components": minor
---

Phase P.3: anchor `page:tabs` 'line' variant with a proper underline rail.

The Shadcn Tabs primitive defaults to a pill-card look (bg-muted,
rounded, white-on-active). On long record-detail pages this strip
floats unmoored — users scroll past it without realising it's a
section anchor.

`PageTabsRenderer` now applies an underline-style treatment to the
default 'line' variant: the `TabsList` gets a bottom border, and each
`TabsTrigger` renders as a transparent button with a 2px primary-color
underline when active. 'card' and 'pill' variants are unchanged.
