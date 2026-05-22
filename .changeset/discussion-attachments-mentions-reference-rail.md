---
'@object-ui/components': patch
'@object-ui/plugin-detail': patch
'@object-ui/react': patch
'@object-ui/app-shell': patch
---

feat(platform): Discussion attachments + @mention directory + Reference Rail aside

- **Discussion attachments** — `RichTextCommentInput` now accepts an `extraSlot`
  and a `canSubmitEmpty` flag so hosts can mount the existing
  `CommentAttachment` composer beneath the editor without forking the toolbar.
  `RecordActivityTimeline` plumbs the attachments through
  `DiscussionContext.onUploadAttachments` and submits attachment-only comments.
- **@mention directory** — `DiscussionContext` gains a `mentionSuggestions`
  field; `RecordDetailView` populates it from the host `sys_user` collection so
  `@` autocomplete in the composer now resolves against real users.
- **Reference Rail** — New `record:reference_rail` renderer + a dedicated
  `aside` region emitted by `buildDefaultPageSchema` whenever a record has
  ≥ 2 related lists. The rail surfaces a Salesforce/HubSpot-style snapshot
  of related collections (count badge + top 3 records) on `xl+` viewports.
- **Layout** — `PageRenderer`'s structured-layout `<aside>` wrappers now honor
  `aside.className`, letting schemas attach responsive utilities like
  `hidden xl:flex` to the rail region.
