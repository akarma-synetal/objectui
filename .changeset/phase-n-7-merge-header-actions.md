---
"@object-ui/plugin-detail": minor
---

Phase N (continued): merge custom record_header actions into `page:header`
instead of emitting a sibling `record:quick_actions` node. This fixes a
visual collision on objects (contact, account, ...) that author custom
record_header actions: previously the floating quick-actions bar
(`-mt-12` overlay) collided with the system Edit/Share/Delete cluster
already rendered by `page:header`. Now all action buttons live on a single
header row.

`buildDefaultHeader` accepts an optional `actions` array; `buildDefaultActions`
remains exported as a sub-builder for authors who explicitly want the
floating quick-action bar via a slot override.
