---
"@object-ui/app-shell": minor
---

Flow designer ↔ automation engine alignment + run history panel.

- **Palette/type-picker:** replace the BPMN `parallel_gateway` / `join_gateway`
  (and `boundary_event` in the picker) with the structured `parallel` and
  `try_catch` constructs the engine actually executes (ADR-0031 keeps the BPMN
  gateway types as import/export interop only — they have no executor, so
  flows authored with them failed at runtime with `NO_EXECUTOR`). Legacy
  gateway nodes still render for imported flows.
- **Runs panel:** new `FlowRunsPanel` fetches `GET /api/v1/automation/{name}/runs`
  and surfaces run status / duration / per-node step logs in the FlowPreview
  side panel (Variables / Debug / Runs), degrading quietly when the engine is
  offline.
- **Simulator:** structured containers (`parallel`, `try_catch`) pass through
  honestly as unsupported instead of faking their semantics.
