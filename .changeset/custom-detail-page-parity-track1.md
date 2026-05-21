---
'@object-ui/app-shell': minor
'@object-ui/plugin-detail': minor
'@object-ui/components': minor
'@object-ui/i18n': patch
---

feat(detail): close the gap between Page-assigned and default record detail pages (Track 1)

Custom Lightning-style record detail pages (assigned via `assignedPage` /
`Page` schemas) used to feel meaningfully poorer than the auto-generated
default detail view. They were missing cross-cutting affordances and
shipped with English-only tab labels and heavy bordered section cards
even when the host locale was Chinese. Track 1 closes the visible gap:

- **app-shell `RecordDetailView`**: the `assignedPage` branch now wears
  the same chrome as the default branch — lifecycle managed-by badge
  and presence avatars in the top-right, `MetadataPanel` debug panel,
  `ActionConfirmDialog` / `ActionParamDialog`, and an auto-appended
  `RecordChatterPanel` at the bottom of the page. Authors opt out of
  the auto-discussion with `assignedPage.disableDiscussion = true`.
- **plugin-detail `record:details`**: defaults to `inlineEdit: true` so
  fields are click-to-edit just like the default page, and synthesises
  sections with `showBorder: false` by default so a Lightning page
  doesn't double-wrap every block in a heavy Card.
- **components `page:tabs` / `page:accordion`**: well-known English
  labels (Details / Related / Activity / History / Notes / Files /
  Tasks / Events / Attachments / Chatter / Discussion / Comments /
  Overview / Summary) auto-translate to Chinese (`zh-CN` / `zh-TW`)
  via a built-in dictionary keyed off `document.documentElement.lang`.
  Authors supplying explicit localised labels (string or
  `{ default, zh-CN, ... }`) are not affected.
- **i18n provider**: applies the initial language to
  `document.documentElement.lang` on mount (i18next does not fire
  `languageChanged` for the bootstrap language), so locale-aware
  renderers downstream see the right value from the first render.
