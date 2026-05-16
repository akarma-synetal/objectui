---
'@object-ui/i18n': minor
'@object-ui/console': patch
---

Add `transformSpecTranslations` / `isSpecTranslationData` helpers to
`@object-ui/i18n` so apps no longer need to maintain their own copy of the
`@objectstack/spec` `TranslationData` → flat namespace transform.

The new transform preserves **every** `_`-prefixed object scope by
convention (`_views`, `_actions`, `_sections`, `_notifications`, `_errors`,
`_options`, plus anything added in future spec versions), which fixes a
class of silent-failure regressions where new spec scopes were dropped
during transformation — leaving e.g. list-view labels to fall back to the
untranslated source string.

`@object-ui/console`'s `loadLanguage.ts` is rewritten to delegate to the
shared helper.
