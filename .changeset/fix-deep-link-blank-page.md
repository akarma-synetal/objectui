---
"@object-ui/react": minor
"@object-ui/app-shell": minor
---

Fix silent blank page on shorthand record deep-links.

Three related fixes that all addressed the same UX: a user follows a URL
shaped `/{object}/{recordId}` and sees a completely blank content area.

1. **`useNavigationOverlay` produced the broken URL itself.** When
   middle-click / Cmd-click opened a gallery card in a new tab and no
   `onNavigate` was provided, the hook built `/{object}/{id}` — a URL
   shape that does not match any route in the console route table. The
   builder now emits the canonical `/{object}/record/{id}`.

2. **Shorthand redirect for externally shared links.** Even with the
   producer fixed, links pasted from email / Slack / older builds
   still use the shorthand. The console now intercepts
   `/{:objectName}/:maybeRecordId` and, when the second segment looks
   like a record id (URL-safe slug ≥ 6 chars, not a reserved keyword),
   redirects to `/{objectName}/record/{recordId}` preserving query and
   hash.

3. **Visible 404 fallback.** Routes that match nothing at all now
   render an explicit "Page not found" empty state with a "Go back"
   action instead of leaving the content area blank. Silent failures
   are now visible failures.
