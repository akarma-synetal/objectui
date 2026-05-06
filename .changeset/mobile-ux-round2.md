---
"@object-ui/plugin-kanban": patch
"@object-ui/plugin-calendar": patch
"@object-ui/plugin-timeline": patch
---

fix(mobile): round 2 — kanban readability, calendar default view, timeline dot clipping

**Kanban**
- Remove `font-mono` from card titles, descriptions, column headers, and empty-state labels — CRM cards no longer render in a monospace font.
- Constrain column body height (`max-h-full min-h-0` + `h-full` on the layout root) so `ScrollArea` activates and cards don't bleed past the viewport bottom.
- Opportunistically derive `description` (e.g. `$60K · Acme Corp · @owner`) and up to two `badges` (priority/severity/industry/rating) in `ObjectKanban` when the schema/source omits them, giving mobile cards more context at a glance.

**Calendar**
- `ObjectCalendar` previously hardcoded `view={schema.defaultView ?? 'month'}`, making the view-selector dropdown a no-op.  Wire the `view` state through to the `<Calendar>` prop so user selection is respected.
- On mobile (viewport < 768 px) coerce `day` defaults to `month` via a synchronous lazy initialiser and a resize/orientation effect — avoids the useless 24-hour empty-hour grid for date-only events.

**Timeline**
- Add `ml-3` to the `<Timeline>` `<ol>` so the `absolute -left-3` marker dots are no longer clipped at the scroll-container edge.
