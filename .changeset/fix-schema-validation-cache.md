---
'@object-ui/react': patch
---

fix(react): preserve `data-obj-schema-invalid` flag across re-renders

`SchemaRenderer` runs a post-mount `forceUpdate` to pick up lazy plugin
registrations. The dev-mode validator was deduping via a `WeakSet` that
always returned `valid: true` on the second call, which stripped the
`data-obj-schema-invalid` attribute on the immediate re-render. The
result and the "warn-once" tracking are now stored separately: a
`WeakMap` caches the validation outcome (so the visual flag is stable),
while a `WeakSet` continues to dedupe `console.warn` output.
