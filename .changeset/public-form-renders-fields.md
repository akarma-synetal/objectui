---
"@object-ui/plugin-form": patch
---

Fix EmbeddableForm rendering no inputs on the public-form path. When the
caller passes a `fields: string[]` list (e.g. the response from
`GET /api/v1/forms/:slug`) the inner `ObjectForm` now receives a
read-only wrapper of the data source — preserving `getObjectSchema()`
so it can materialise widgets, while neutralising mutating ops so all
backend writes still go through `EmbeddableForm.handleSubmit` (and its
consent / honeypot / min-fill / redirect / payload-sanitisation gates).
