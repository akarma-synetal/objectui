---
'@object-ui/plugin-detail': minor
'@object-ui/app-shell': patch
---

End-to-end @-mention notifications.

`@object-ui/plugin-detail` now exports `extractMentions(text, suggestions)`
— a small utility that resolves `@<label>` tokens in a comment body to
user ids, using the same suggestion list that drives the in-editor
dropdown. Handles labels with spaces ("@QA Test"), CJK ("@王小明"),
longest-match disambiguation ("Anna Lee" wins over "Anna"), and ignores
unknown @-tokens. 9 unit tests.

`@object-ui/app-shell` `RecordDetailView` now:

1. Serializes the resolved mention ids into `sys_comment.mentions`
   (previously hard-coded `'[]'`, so servers had no idea who was being
   pinged).
2. Fan-outs a `sys_notification` row per mentioned recipient
   (self-mentions are filtered as noise) with the canonical bell-inbox
   shape: `type: 'mention'`, `recipient_id`, `actor_name`, `title`,
   `body` preview (≤140 chars), `source_object`/`source_id`/
   `source_comment_id`, `is_read: false`, `created_at`.

The notification write tolerates 404 silently, so deployments without
a notification collection degrade to the previous behavior (mention
text + highlight, no inbox row). Spec-compliant servers that emit
notifications via their own sys_comment after-create hook can ignore
the client-side write — the bell de-dupes by id at the polling layer.
