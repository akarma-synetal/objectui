---
'@object-ui/plugin-detail': patch
---

feat(plugin-detail): suppress Related tab when Reference Rail is auto-emitted

When `buildDefaultPageSchema` decides to emit the Reference Rail (≥ 2
related lists), the duplicate `Related` tab is now suppressed by
default. The same data appeared in both places before, which is
visually noisy and risks confusing users when one surface refreshes
out-of-step with the other.

Behavior matches HubSpot / Microsoft Dynamics: the rail is the single
source of truth for related-list snapshots, and each rail card now
exposes a `View all` link that deep-links into the child object's
filtered list view. Authors can opt back into both surfaces via the
new `hideRelatedTab: false` option.

The change is gated on the same `≥ 2` heuristic that emits the rail,
so single-related-list pages keep the inline Related tab (where the
rail wouldn't have helped anyway).
