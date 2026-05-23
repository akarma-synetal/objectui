---
'@object-ui/layout': patch
---

feat(layout): smoother sidebar transitions

`SidebarNav` now animates the previously-instant state changes:

- Active-state colour swap on `SidebarMenuButton` /
  `SidebarMenuSubButton` is wrapped in `transition-colors duration-150`
  so navigating between rows glides rather than snaps.
- `CollapsibleContent` (group children) fades + slides in / out when
  the parent group is expanded/collapsed (chevron already rotated;
  the children now match).

All animations are gated on `motion-safe:` so users with
`prefers-reduced-motion` see the original instant UI.
