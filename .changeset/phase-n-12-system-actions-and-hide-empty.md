---
"@object-ui/react": minor
"@object-ui/components": minor
"@object-ui/app-shell": minor
"@object-ui/plugin-detail": minor
---

Phase N.1 + N.2: visual polish for record detail pages.

**N.1 — System actions on full Lightning pages.** `PageHeaderRenderer`
now merges `headerSystemActions` from `RecordContext` with authored
actions (authored wins on name/id collision), so full custom pages
(lead, opportunity, ...) once again show 编辑 / 分享 / 删除 alongside
their authored actions. `sys_share` and `sys_delete` now use the
`outline` variant instead of `destructive` to read better in
multi-button clusters.

**N.2 — Hide empty fields by default in synth detail pages.**
`record:details` defaults `section.hideEmpty` to `true` so synthesized
pages don't render label graveyards on first load. The "显示 N 个空字段"
reveal toggle is preserved as the user-facing escape hatch. Authors can
opt back into showing every field by setting `hideEmpty: false` on the
section schema.
