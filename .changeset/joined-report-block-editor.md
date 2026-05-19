---
'@object-ui/plugin-report': minor
'@object-ui/i18n': patch
---

feat(plugin-report): joined-report block editor

`type: 'joined'` reports were a black hole in the editor — the type
selector exposed them but no UI knew how to edit the `blocks` array,
so users could neither create nor modify joined reports without
hand-editing JSON.

This change adds a `Blocks` section to the report editor, visible only
when `type === 'joined'`. Each block renders as a collapsible card with
its own name (required + unique-validated), label, description, block
type, object override, and reuses the existing `ColumnsEditor`,
`GroupingsBuilder`, `SpecFilterAdapter`, and `ChartConfig` builders so
every block behaves like a mini standalone report — matching the
runtime contract of `JoinedReportRenderer`.

Block-level validation is surfaced in the main `ValidationBanner`:
empty blocks array, missing or duplicate block names, and blocks
without columns all become editor-time errors so saves stay safe.

The non-joined sections (Columns / Rows / Columns axis / Filters /
Chart) are hidden when `type === 'joined'` since they live per-block
in the spec.

New exports from `@object-ui/plugin-report`:
- `JoinedBlocksEditor` — standalone component for embedding the
  block editor anywhere.
- `validateJoinedBlocks` — pure helper returning translated
  problem strings, suitable for custom validation banners.
- `ColumnsEditor`, `GroupingsBuilder`, `ChartConfig`,
  `SpecFilterAdapter`, `normalizeColumns` are now exported so
  downstream consumers can build their own report-editor surfaces.

i18n: added `report.editor.blocks*` / `report.editor.addBlock` /
`report.editor.removeBlock` / `report.editor.blockName*` /
`report.editor.blockLabel*` / `report.editor.blockDescription*` /
`report.editor.validationJoinedNeedsBlocks` /
`report.editor.validationBlockNameRequired` /
`report.editor.validationBlockNameDuplicate` /
`report.editor.validationBlockNeedsColumns` to en + zh.
