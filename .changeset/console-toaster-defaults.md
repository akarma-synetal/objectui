---
'@object-ui/app-shell': patch
---

feat(app-shell): better default toast UX in ConsoleToaster

`ConsoleToaster` now ships UX-positive defaults that match the Linear
/ Notion pattern users expect from an enterprise console:

- `position="top-right"` — keeps the user's primary work area (centre
  + bottom) unobstructed.
- `closeButton` — every toast has an explicit X so users can dismiss
  rather than wait the duration out.
- `richColors` — type-aware coloured backgrounds (success / error /
  warning / info) so the kind of message is legible at a glance.
- `expand` — toast stack expands on hover so users can read multiple
  recent toasts without dismissing.
- `visibleToasts={4}` — prevents the corner from being overrun.
- `duration: 4000` — long enough to read + click an `Undo` action.

All of these are still overridable via `<ConsoleToaster …>` props.
