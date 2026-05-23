---
"@object-ui/app-shell": patch
---

security: force DOMPurify to `^3.4.5` via pnpm override

Resolves 8 moderate-severity GHSA advisories against the transitive
`dompurify@3.2.7` pulled in by `monaco-editor`. Vulnerabilities covered:

- SAFE_FOR_TEMPLATES bypass in RETURN_DOM mode
- FORBID_TAGS bypassed by function-based ADD_TAGS predicate
- Prototype Pollution to XSS via CUSTOM_ELEMENT_HANDLING fallback
- ADD_TAGS function-form short-circuit bypass of FORBID_TAGS
- ADD_ATTR predicate skipping URI validation
- USE_PROFILES prototype pollution enabling event handlers
- mutation-XSS via Re-Contextualization
- Generic XSS vector

No API changes; override is transparent to consumers.
