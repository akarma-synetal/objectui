---
"@object-ui/components": patch
"@object-ui/app-shell": patch
"@object-ui/cli": patch
---

fix: convert Tailwind v3 `[--var]` arbitrary value syntax to v4 `(--var)`

Shadcn `Sidebar`, `Calendar`, `Chart`, `Popover`, `Tooltip`, `HoverCard`,
`Menubar`, `Select`, `Dropdown`, `Context-Menu`, and `AppSidebar` used the
Tailwind v3 syntax `w-[--sidebar-width]`, `origin-[--radix-...]`, etc.
Tailwind v4 no longer interprets the bare `--xxx` inside arbitrary values
as `var(--xxx)`, so the rule emits empty CSS — the sidebar collapses to
0 width and overlays the main content, dropdown/popover positions fall
back to the wrong origin, and the calendar cells lose their fixed size.

Replaced all such occurrences with the v4 CSS-variable shorthand
`w-(--sidebar-width)`, `origin-(--radix-...)`, etc. Existing
`[calc(var(--xxx)*-1)]` arbitrary expressions are unaffected.
