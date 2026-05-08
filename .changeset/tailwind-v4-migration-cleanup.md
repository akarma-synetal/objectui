---
"@object-ui/components": patch
"@object-ui/fields": patch
"@object-ui/plugin-chatbot": patch
"@object-ui/plugin-designer": patch
"@object-ui/plugin-kanban": patch
"@object-ui/plugin-timeline": patch
"@object-ui/plugin-workflow": patch
"@object-ui/runner": patch
---

fix: complete Tailwind v3→v4 migration cleanup

- Rename deprecated `flex-shrink-0` → `shrink-0` and `flex-grow-N` →
  `grow-N` (Tailwind v4 dropped the long-form aliases). Affects
  data-table, fields/index, FileField, ChatbotEnhanced,
  FloatingChatbotPanel, ProcessDesigner, HistoryPanel, KanbanEnhanced,
  KanbanImpl, plugin-timeline index, FlowDesigner, LayoutRenderer.
- Replace `theme(spacing.4)` inside arbitrary-value `[calc(...)]` with
  literal `1rem` in sidebar.tsx — `theme()` is deprecated in v4.
- Remove obsolete v3-escape CSS overrides from index.css and
  sidebar-fixes.css. The component source now uses native v4 stacked
  data variants (`group-data-[state=collapsed]:group-data-[collapsible=icon]:w-(--sidebar-width-icon)`)
  which Tailwind v4 emits correctly without the manual overrides.
  Only the bespoke `.sidebar-menu-button-icon-mode*` rules are kept.
