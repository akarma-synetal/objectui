---
'@object-ui/components': patch
'@object-ui/plugin-detail': patch
'@object-ui/react': patch
---

Three platform-wide detail polish items.

**Tighter page rhythm**
- Outer `PageRenderer` padding `p-4 md:p-6 lg:p-8` → `p-3 md:p-4 lg:p-6`
  and outer body wrap `space-y-8` → `space-y-6` so list / detail / home
  pages share the same edge rhythm. Cuts ~16px of edge slack on lg.

**Highlights KPI treatment**
- `HeaderHighlight` now renders numeric / currency / percent / decimal
  values as KPI numbers (`text-xl md:text-2xl font-semibold tabular-nums`)
  instead of the uniform `text-sm font-semibold`, so amount / probability
  / count fields read as headline stats — Salesforce-style key facts.

**Discussion footer upgrade**
- `RecordActivityTimeline` now uses `RichTextCommentInput` (bold / italic /
  list / code, `@`-mention autocomplete, preview toggle, Send) instead of
  a bare `<textarea>`.
- `DiscussionContext` gains an optional `mentionSuggestions` array that
  hosts can wire (e.g. team member directory). Falls back to free-text
  `@mention` when omitted.
- `RecordChatterPanel` threads `mentionSuggestions` through both inline
  and sidebar positions.
