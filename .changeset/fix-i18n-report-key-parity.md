---
"@object-ui/i18n": patch
---

fix(i18n): add missing top-level `report` key to ar/de/es/fr/ja/ko/pt/ru locales

The i18n parity test (`all locales have the same top-level keys`) was failing
because the `report` key existed only in `en` and `zh`. The other built-in
locales now include the same `report` block (English fallback strings) so the
CI parity check passes again.
