---
"@object-ui/plugin-detail": minor
---

**Phase P.1 — Collapse empty Related-list cards to header-only.**

Previously each empty related list rendered a full Card with a 200px+
"暂无相关记录" empty-state block (header + 32px icon + label +
optional CTA). With 5-10 related objects mostly empty (common on
fresh records), the Related tab became a wall of empty cards
spanning 1500+ vertical pixels.

Now: when a related list has zero records (and isn't loading), the
CardContent is skipped entirely. The header row shows the title +
`(0)` badge + an inline italic "暂无相关记录" hint + the `+ 新建`
button (downgraded to ghost variant). A 200px empty card becomes a
40px row.

Lists with data are unchanged.
