---
'@object-ui/react': minor
---

feat(react): dev-mode schema validation in SchemaRenderer

`SchemaRenderer` now runs the canonical `validateSchema` from
`@object-ui/core` on every schema object it renders (deduped per-object
via a WeakSet so re-renders don't re-log). Errors are surfaced via a
single grouped `console.warn` that includes the offending JSON path,
and the host element receives `data-obj-schema-invalid="true"` so apps
can hook a visual cue (e.g. red outline) via CSS.

The entire pass is gated on `process.env.NODE_ENV !== 'production'`
and is a no-op in production builds — zero runtime cost shipped to
users.
