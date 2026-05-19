---
'@object-ui/app-shell': patch
---

ReportView no longer caps the report content at `max-w-5xl` (1024px). Reports now use the full available content width, matching DashboardView behavior. Matrix and grid reports in particular benefit from the additional horizontal real estate.
