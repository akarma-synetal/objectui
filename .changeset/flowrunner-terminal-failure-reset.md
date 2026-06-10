---
"@object-ui/app-shell": patch
---

FlowRunner: close the runner when a resume ends in a terminal flow failure.

The engine consumes a run's suspension before executing downstream nodes
(resume-once semantics), so a resume whose `AutomationResult` is
`success: false` can never be retried — the old behavior left the dialog open
and a second Submit hit "No suspended run". Transport-level failures (network
/ 5xx) still keep the dialog open for retry.
