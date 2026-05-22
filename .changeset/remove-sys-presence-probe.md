---
"@object-ui/app-shell": patch
---

Remove dead `sys_presence` REST probes from `RecordDetailView` and `AppHeader`. Real-time
presence does not belong in a regular REST collection — the feature is being redesigned
behind a transport-level `<PresenceProvider>` (see ROADMAP). This change removes the
probe (and associated state / unused UI mounts) so the browser no longer makes silently
swallowed 404 requests on every record open / app navigation. UI surface area is
unchanged for end users (the previous code never rendered viewers when the probe failed).
