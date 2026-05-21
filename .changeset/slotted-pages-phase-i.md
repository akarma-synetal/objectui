---
'@object-ui/types': minor
'@object-ui/react': minor
'@object-ui/plugin-detail': minor
'@object-ui/app-shell': minor
---

feat(detail): slotted record pages (Track 3 Phase I)

Introduce `kind: "slotted"` record pages that override one or more
named slots while letting the default-page synthesizer fill in the
rest. Authors no longer need to re-author the entire page just to
customize the header or one tab.

**Slot menu (v1):**
- `header` — replaces `page:header`
- `actions` — replaces the `record:quick_actions` action bar
- `highlights` — replaces the chips + chevron path strip
- `details` — replaces the Details tab body (other tabs stay synthesized)
- `tabs` — replaces the entire `page:tabs` node (wins over `details`)
- `discussion` — replaces the inline `record:discussion` footer

Each slot is a full replacement at the slot boundary. To compose
default + custom, call the corresponding `buildDefault*` sub-builder
(now exported from `@object-ui/plugin-detail`):
`buildDefaultHeader`, `buildDefaultActions`, `buildDefaultHighlights`,
`buildDefaultDetails`, `buildDefaultTabs`, `buildDefaultDiscussion`.

**Author shape:**
```ts
{
  type: 'record',
  object: 'account',
  kind: 'slotted',
  slots: {
    header: { type: 'page:header', properties: { ... } },
  },
}
```

**API changes:**
- `PageSchema` (in `@object-ui/types`): adds `kind?: 'full' | 'slotted'`
  (default `'full'`) and `slots?: PageSlotMap`.
- `usePageAssignment` (in `@object-ui/react`): result now exposes a
  `slots` field populated when the matched page has `kind === 'slotted'`.
  Existing `page` field is unchanged for full pages.
- `buildDefaultPageSchema` (in `@object-ui/plugin-detail`): accepts an
  `options.slots` map that overrides individual regions at synthesis time.
