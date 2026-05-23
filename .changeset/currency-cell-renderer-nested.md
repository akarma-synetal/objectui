---
"@object-ui/fields": patch
---

`CurrencyCellRenderer` now reads the currency code from three locations
in priority order: `field.currency` (legacy grid configs) → 
`field.defaultCurrency` (canonical top-level) → 
`field.currencyConfig.defaultCurrency` (nested shape emitted by
`@objectstack/spec` `Field.currency({ currencyConfig: ... })`).

Previously the renderer only checked the first two, so currency-type
fields defined via the canonical spec helper rendered without their
configured symbol. When none of the three is set, the cell still
gracefully degrades to a plain formatted number — never silently
assuming USD.
