---
"@object-ui/react": minor
---

`useRecordSearch` now orders hits by relevance instead of object-fanout
order. Tiers (higher wins):

- 110: exact recordId paste
- 100: display exactly equals the query
-  80: display starts with the query
-  60: any token in display starts with the query
-  40: display contains the query as a substring

This makes `⌘K → "Ada"` rank "Ada Lovelace" above "AdvancedTradingAccount"
even though Account is queried before Contact in the fanout.

`RecordSearchHit` gains a `score` field for callers that want to render
hint chips, filter low-confidence rows, or further customize ordering.
