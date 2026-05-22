---
'@object-ui/components': patch
---

fix(empty): render `action` schema via `SchemaRenderer` instead of leaking the raw object

The `empty` renderer was spreading the schema's `action` prop straight onto
`DataEmptyState`, which renders `{action}` as a child. That worked for React
nodes but blew up on production builds when the docs site fed it a schema
shape like `action: { type: 'button', label: 'Create', variant: 'default' }`
(error: "Objects are not valid as a React child").

The renderer now passes `schema.action` through `SchemaRenderer` to turn it
into a real React element, and explicitly strips `action`/`icon` from the
spread so schema-shaped objects don't reach DOM attributes.
