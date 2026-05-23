---
"@object-ui/plugin-kanban": patch
"@object-ui/plugin-detail": patch
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

CRM UX polish pass — calmer enterprise look across detail + kanban.

- **plugin-kanban**: column headers now use a 2px muted accent stripe with
  neutral foreground titles + a quiet grey count pill instead of full
  rainbow gradient + colored title + colored count. Pipeline boards
  (Opportunity, Case, Task, Lead) look like Salesforce/Linear instead of
  a toy. WIP-limit overflow remains destructive-red so urgency stays loud.
- **plugin-detail (`record:reference_rail`)**: new `hideEmpty` prop
  (default true) collapses entries whose total === 0 into a single
  `+ N empty (Quotes · Products …)` chip at the bottom of the rail.
  Removes the 4–7 "No records" stack that dominated the aside.
- **plugin-detail (`record:path`)**: completed stages now render with an
  emerald-tinted background + bold green check instead of low-contrast
  `bg-muted text-muted-foreground` (which read as "light grey on white"
  and was borderline unreadable).
- **app-shell (`RecordDetailView`)**: record-not-found short-circuit.
  Previously a stale/missing recordId still rendered the page chrome
  (rail, discussion, breadcrumb with the raw id), making invalid links
  look like a partially broken page. Now renders a clean centered
  `Empty` state with database icon + i18n'd "Record not found" copy.
- **i18n**: added `detail.showEmptyRelated_{one,other}` and
  `empty.recordNotFound{,Description}` keys (en + zh).
