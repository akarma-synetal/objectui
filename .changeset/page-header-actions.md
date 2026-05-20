---
'@object-ui/layout': minor
'@object-ui/plugin-detail': patch
---

feat(page-header): first-class `actions` property on page:header

PageHeader now accepts an `actions: ActionDef[]` (or string[]) property
and renders the toolbar inline in the header's right-aligned action slot.
Removes the need for authors to declare a sibling `record:quick_actions`
node and the `-mt-12` visual offset hack to pair the toolbar with the
title. The hack still applies for legacy schemas using the sibling form
(via location:'record_header'); the new in-header rendering opts out via
an `inline: true` flag automatically set by PageHeader.
