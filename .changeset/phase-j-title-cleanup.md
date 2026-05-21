---
'@object-ui/components': patch
---

fix(components): strip dangling separators from interpolated record titles

`page:header` now post-processes the result of interpolating a record's
`titleFormat` through `cleanupTitleSeparators` so a missing field in the
template doesn't leave a trailing/leading connector.

Example: with `titleFormat: '{contract_number} - {name}'` and a contract
whose `name` is empty, the header was rendering `CTR-0001 -` (with a
dangling hyphen). It now renders `CTR-0001`. Also handles a missing
middle field (`A -  - B` → `A - B`) and collapses whitespace runs.

Supports hyphen / em-dash / en-dash / middle-dot / colon / slash / pipe
connectors. Idempotent. Exported as `cleanupTitleSeparators` from the
containers module; covered by 10 new unit tests.
