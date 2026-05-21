---
"@object-ui/plugin-detail": minor
---

feat(detail): record:path chevron stepper + record:highlights surface refresh (Phase E)

- `record:path` now renders Salesforce Lightning-style chevron segments
  (clip-path arrows + overlap) with a primary glow on the current step
  and a check mark on completed steps. On mobile (`<sm`) it falls back
  to a horizontally-scrollable pill row that keeps the same semantics
  but never overflows the viewport.
- `record:highlights` surface drops the dashed border in favour of a
  solid `bg-muted/40` card with a softer border, so the highlights
  strip reads as a continuous extension of the header chip above it
  rather than a separate framed widget.
