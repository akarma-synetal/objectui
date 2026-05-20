---
'@object-ui/types': minor
'@object-ui/plugin-detail': minor
---

`record:highlights` renderer normalizes rich field items.

`RecordHighlightsComponentProps.fields` is now `Array<string | { name, label?, icon?, type? }>`. The renderer normalizes both forms before passing to `HeaderHighlight`, so schemas can attach per-instance label/icon overrides without editing the underlying object metadata. FLS and `redactFields` still apply on the normalized list.
