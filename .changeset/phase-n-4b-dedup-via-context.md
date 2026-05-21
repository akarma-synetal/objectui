---
"@object-ui/react": minor
"@object-ui/plugin-detail": minor
"@object-ui/app-shell": minor
---

Phase N.4b: highlight↔body dedup now works for hand-authored Lightning
pages too.

Adds a small `HighlightFieldsContext` registry. `record:highlights`
registers the field names it currently surfaces; `record:details` unions
that live set into its `hideFieldNames` filter so a field shown in the
highlight strip is never duplicated in the section grid below.

Previously the dedup only fired for synth-generated pages (via the
`hideFields` prop passed by `buildDefaultPageSchema`). Custom Lightning
pages (e.g. opportunity) showed `所属客户` both in the strip and in the
body. The registry-based approach covers both code paths uniformly with
no schema author work required.

The registry uses `useSyncExternalStore` so adding/removing highlights
notifies consumers without triggering the provider value identity to
change — avoiding the update-loop that a naive context implementation
would cause.

`RecordDetailView` mounts `<HighlightFieldsProvider>` once per record
page so the two renderers share state.
