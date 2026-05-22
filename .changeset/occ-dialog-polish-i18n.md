---
'@object-ui/plugin-detail': minor
'@object-ui/i18n': minor
---

Polish the ConcurrentUpdateDialog and add i18n.

- Internationalise all dialog strings (title, body, button labels, "your edit" / "current value" headings, audit-trail line) through `useDetailTranslation`. Locale strings added to `@object-ui/i18n` for English and Chinese.
- Replace the plain dialog header with an amber warning badge + `AlertTriangle` icon to communicate that this is a conflict, not a routine confirmation.
- Visually differentiate the two value blocks: amber tint for the user's pending edit, sky tint for the server's current value. Both wrap long values cleanly.
- Surface audit provenance for the racer's write (`updated_at`, plus `updated_by_name`/`updated_by_label` when supplied). Opaque ID-looking `updated_by` tokens are suppressed.
- Re-prioritise the action buttons: **Reload latest** is now the primary/recommended action (autofocused), **Overwrite anyway** is rendered as a destructive-outline button so the dangerous path requires deliberate intent, and **Cancel** falls back to a ghost variant.
