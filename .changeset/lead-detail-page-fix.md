---
"@object-ui/components": patch
"@object-ui/layout": patch
---

fix(detail): clean up record page rendering

- Drop `ai:chat_window` from the protocol-component placeholder list. The
  floating chat overlay (plugin-chatbot) is the canonical AI entry point;
  inline page schemas that still reference `ai:chat_window` now surface
  as an explicit "Unknown component type" so the misconfiguration is
  fixed at the source instead of silently leaking a placeholder card.
- `page:header` now resolves `{field.path}` tokens in `title` / `description`
  against the current record context (matching the behaviour of the
  alternative `containers.tsx` renderer). Without this, schemas like
  `title: "{first_name} {last_name}"` rendered the literal template.
- `containers.tsx` `PageHeaderRenderer`: also read from `schema.properties.*`
  as a fallback so both inlined and raw-bag schema shapes are supported.
