---
'@object-ui/i18n': patch
---

i18n: native translations for the report editor (`report.editor.*`) in 8 locales — ar, de, es, fr, ja, ko, pt, ru. Previously these locales had the English placeholder strings copy-pasted from `en.ts` and the newer `blocks*`, `addCondition`, `opContains`, `formatCurrency` etc. keys were missing entirely (so the report editor surfaced raw key names in those languages). All locales now carry the full key set with locale-appropriate copy.
