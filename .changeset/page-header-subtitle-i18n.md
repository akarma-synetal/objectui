---
"@object-ui/components": minor
---

`page:header` subtitle and title-format interpolation now translates
enum field values through the i18n option-label dictionary.

A schema like `subtitle: "{industry} · {type}"` previously rendered the
raw enum values (`"technology · customer"`) regardless of locale or
authored option labels. The interpolator now looks up the current
record's `objectSchema.fields` and routes each token through
`useSafeFieldLabel().fieldOptionLabel(...)`, so the same template
renders as `"科技 · 正式客户"` in zh-CN and `"Technology · Customer"`
in en — without authors having to write per-locale subtitle templates.

The change is transparent for tokens that resolve to non-enum field
values; only fields with an `options` array are remapped.
