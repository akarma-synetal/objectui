---
"@object-ui/app-shell": minor
"@object-ui/i18n": patch
---

Cmd-K now shows recently viewed records in its empty state, sourced
from the existing cloud-synced `sys_user_preference` adapter (already
wired by `RecentItemsProvider` + `useTrackRouteAsRecent` +
`RecordDetailView`). Multi-device by construction: open a record on
laptop, see it in `⌘K → Recently viewed` on phone.

- Group renders only when input is empty (no competition with search).
- Limited to the 5 most recent record-type entries.
- New i18n key `console.commandPalette.recentRecords` (en + zh seeded;
  other locales fall back to `defaultValue: "Recently viewed"`).
