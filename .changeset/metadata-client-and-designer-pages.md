---
"@object-ui/data-objectstack": minor
"@object-ui/plugin-designer": minor
---

Add visual editing for object & field metadata in the Setup app.

**`@object-ui/data-objectstack`** — new `MetadataClient` class. A thin,
auth-friendly wrapper over the framework's `/api/v1/meta/*` REST
endpoints (list / get / save / reset / history), with first-class
support for `If-Match` (optimistic concurrency), `X-Actor` (audit
attribution), environment-scoped paths
(`/environments/:id/meta/*`), and 404-as-null semantics. Use
`new MetadataClient({ baseUrl })` or `client.withEnvironment(id)` to
target a specific environment.

**`@object-ui/plugin-designer`** — two new route-ready pages that
together close the "Data Model" management loop in the Setup app:

- `MetadataObjectsPage` — lists every object schema (via
  `MetadataClient.list('object')`), renders the existing
  `ObjectManager`, and persists edits/deletes through PUT/DELETE on
  the metadata REST surface. Honours `allowRuntimeCreate` and
  surfaces server errors verbatim.
- `MetadataFieldsPage` — for a single object, loads the parent
  schema, projects `fields` into the existing `FieldDesigner`, and
  on save merges the edited field map back into the object before
  issuing a single PUT. Preserves unknown per-field attributes so
  nothing the designer doesn't render is dropped.

Both pages take either a pre-built `MetadataClient` or a
`MetadataClientConfig`; neither imposes a routing convention on the
host app — they can be mounted anywhere (e.g.
`/apps/setup/_meta/object` and `/apps/setup/_meta/object/:name/fields`).

These additions do not modify the underlying `ObjectManager` /
`FieldDesigner` components, which remain pure controlled-input
components usable in non-REST contexts.
