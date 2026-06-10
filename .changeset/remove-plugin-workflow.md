---
"@object-ui/types": major
---

**Breaking:** remove `@object-ui/plugin-workflow` and its schema types.

The package's designers (`WorkflowDesigner`, `FlowDesigner`, `AutomationBuilder`,
`ApprovalProcess`, `AutomationRunHistory`) authored BPMN-style / standalone-workflow
shapes the ObjectStack automation engine does not execute (ADR-0020, ADR-0031), and
nothing in the console, runner, or examples consumed them.

Removed from `@object-ui/types`: `WorkflowSchema`, `WorkflowDesignerSchema`,
`ApprovalProcessSchema`, `WorkflowInstanceSchema`, `FlowDesignerSchema` and the
related `Workflow*` / `Flow*` helper types (formerly `./workflow`).

**Migration:** author flows in the Studio's metadata-admin flow designer
(`@object-ui/app-shell` → `FlowCanvas`), whose node palette is driven by the
engine's published action registry (`GET /api/v1/automation/actions`). Run
history is available in the same view via the Runs panel; approval UI ships
with the framework's `plugin-approvals`.
