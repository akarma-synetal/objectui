---
'@object-ui/components': patch
---

PageTabsRenderer auto-count now descends into accordion (`properties.items`) and sums counts when a tab contains multiple `record:related_list` widgets — matches Salesforce "Related" tab semantics. Previously only the first list was probed (or none, if wrapped in an accordion).
