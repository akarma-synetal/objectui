---
"@object-ui/console": minor
"@object-ui/i18n": minor
---

ADR-0044 send-back-for-revision in the approvals inbox (framework #1744/#1769). Approvers get a "Send back" action (violet, with its own dialog) that ends the round as `returned` and unlocks the record; the submitter sees a revision panel on the returned request — edit-record link, optional comment, Resubmit (opens round N+1) and Recall (abandons the revision). New `returned` status badge/filter, Round-N chips (list + drawer), timeline rendering for `revise`/`resubmit` actions, `approvalsApi.sendBack/resubmit`, and ten-locale `approvalsInbox` strings.
