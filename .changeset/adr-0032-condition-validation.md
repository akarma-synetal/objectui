---
"@object-ui/app-shell": minor
---

ADR-0032: author-time condition validation in the flow inspectors.

Flow node and edge condition editors now flag a malformed predicate **as you
type** — most importantly the `{record.x}` template-brace-in-CEL mistake (#1491),
which `{…}` parses as a CEL map literal and silently fails — with the same
corrective message the build and the `validate_expression` agent tool emit.
Client-side check for now (no CEL parser in the browser); swaps to
`@objectstack/formula`'s shared `validateExpression` once it is published.
