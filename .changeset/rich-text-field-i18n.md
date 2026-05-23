---
"@object-ui/fields": patch
"@object-ui/i18n": patch
---

`RichTextField` now translates its inline hints (`Format: markdown`,
`Rich text editor (basic)`, `Enter text...`) instead of hardcoding
English. Adds `fields.richText.*` keys to the en / zh locale packs.
