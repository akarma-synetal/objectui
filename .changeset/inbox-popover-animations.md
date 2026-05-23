---
'@object-ui/app-shell': patch
---

feat(app-shell): notification center animation polish

InboxPopover now animates every signal that matters for "noticing":

- Bell button **bounces once** when total pressure increases (new
  notification or approval arrives). Tracks previous total via a ref
  so the very first render — when the server-side counts hydrate —
  does not trigger a spurious bounce.
- Bell badge **zooms in** on every count change (re-keyed on
  `totalBadge` so each transition is an independent animation).
- Per-tab counter badges (Notifications / Approvals) get the same
  zoom-in treatment on count change.
- Notification list rows **fade + slide in from top** with a small
  staggered delay (capped at 6×20ms so a full list never feels
  laggy).
- Activity rows mirror the same fade/slide pattern.
- Empty states (`You're all caught up`, `No recent activity`, `No
  pending approvals`) fade in instead of popping in.
- The unread dot (•) is now always rendered but fades its opacity
  when `is_read` flips, instead of disappearing instantly — gives a
  smooth "marked read" affordance.

All animations are wrapped in `motion-safe:` utility variants so
users with `prefers-reduced-motion` see the previous (instant) UI.
No new dependencies; reuses `tailwindcss-animate` utilities already
present in the design system.
