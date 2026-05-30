---
'@object-ui/app-shell': minor
---

Add the External Datasource Federation Studio surface (ADR-0015 P5)

Federated datasources (`schemaMode !== 'managed'`) now get a dedicated
panel inside their Studio Preview tab, so connecting a mature external
database and registering its tables as ObjectStack objects is a
point-and-click flow instead of a CLI-only one. The panel pairs with the
framework backend shipped in objectstack-ai/framework#1390
(`registerExternalDatasourceRoutes` → `/api/v1/datasources/:name/external/*`).

ObjectStack is metadata-driven: `datasource` is a metadata type, so it is
browsed and edited through the standard metadata-admin engine
(`metadata:resource`) reached from the Studio app's left-side menu —
**not** a hand-written page. The Studio app (framework
`packages/platform-objects/src/apps/studio.app.ts`, Integration group)
gains a `Datasources` nav item pointing at
`metadata:resource?type=datasource`; the federation panel is contributed
to that standard surface via `registerMetadataPreview('datasource', …)`.

**`@object-ui/app-shell` — `views/metadata-admin/external/`**

- `api.ts` — a thin, typed REST client over the four federation routes
  (`tables`, `tables/:remote/draft`, `refresh-catalog`, `validate`) plus an
  `importObjectDraft` helper that PUTs a generated draft to `/meta/object`.
  All calls go through `createAuthenticatedFetch()` (Bearer + `X-Tenant-ID`
  + `Accept-Language`). A `503 external_service_unavailable` reply is mapped
  to a typed `ExternalServiceUnavailableError` so the UI shows a friendly
  "federation not enabled on this server" hint. Contract types are inlined
  (they were added in framework 7.3; objectui pins `@objectstack/spec`
  `^7.2.1`).
- `SchemaBrowser` — lists remote tables (allowedSchemas-filtered server-side)
  with a text filter, on-demand Refresh (never a timer — warehouse
  introspection is expensive), and a per-table Import action.
- `ImportObjectDialog` — generates an Object draft, surfaces the
  type-compat matrix's `// REVIEW:` columns and the generated `*.object.ts`
  source, then imports it as a real object. Never mutates the remote schema.
- `ValidationPanel` — runs validation on demand and renders per-object
  structured schema diffs (missing column, type mismatch, …). Doubles as an
  on-demand drift view.
- `ExternalDatasourcePanel` — Tables / Validation tabs plus a header strip
  with "Refresh catalog" and the snapshot timestamp.
- `DatasourcePreview` — registered via `registerMetadataPreview('datasource', …)`,
  it renders the panel automatically inside the standard resource edit
  page's Preview tab when the saved datasource is federated
  (`schemaMode !== 'managed'`), keyed off the item name. This is the only
  wiring needed: no bespoke page, no extra route, no `@object-ui/app-shell`
  surface to re-export — the metadata-admin engine + left-side nav own the
  navigation. Federated datasources are read-only code artifacts (the
  `datasource` type forbids runtime create), which the standard list view
  already reflects (no "Create" button).

Out of scope (blocked on backend follow-ups): the connection wizard
(driver/credentials/secrets — belongs in System Settings) and a push-based
drift inbox (needs an event feed). The framework exposes no
test-connection, secrets, or drift-feed routes yet.
