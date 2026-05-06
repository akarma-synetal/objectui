---
"@object-ui/types": patch
"@object-ui/components": patch
"@object-ui/fields": patch
"@object-ui/plugin-form": patch
---

Mobile UX round 3 — Form: sticky save bar, fullscreen long-text editor, and auto-stepper for long forms on small viewports.

**`@object-ui/types`** — `ObjectFormSchema.mobile` (new) lets a single form opt into all three behaviours:

```ts
{
  type: 'object-form',
  objectName: 'leads',
  mode: 'create',
  mobile: {
    stickyActions: true,        // pin Submit/Cancel to bottom on phones
    stepper: 'auto',            // long forms render one field per step
    stepperMinFields: 8,        // …but only past this many fields
    stepperFieldsPerStep: 1,    // … (default 1)
    fullscreenLongText: true,   // textarea fields get an "expand" affordance
  },
}
```

`FormSchema.mobileStickyActions` (new) is the lower-level escape hatch — applied automatically when `mobile.stickyActions` is set on `ObjectFormSchema`.

**`@object-ui/plugin-form`** — `ObjectForm` now:
- propagates `mobile.fullscreenLongText` to every textarea/markdown/html field as `mobile_fullscreen: true`,
- sets `mobileStickyActions` on the inner form schema and adds `pb-20` padding so content isn't covered by the fixed bar,
- when `mobile.stepper === true` (or `'auto'` + `useIsMobile()` + > `stepperMinFields` fields), routes the flat field list through the existing `WizardForm` with synthetic single-field "steps" — keeping per-step validation and the existing `Next`/`Back`/`Submit` flow.

**`@object-ui/components`** — the registered `form` renderer adds:
- a `mobileStickyActions` opt-in that turns the action row into a `position: sticky; bottom: 0` bar on small viewports, and
- an inline `FullscreenTextarea` wrapper used when no field-package widget is registered, providing the same expand-button + edit-dialog UX so the feature works even in lighter setups.

**`@object-ui/fields`** — `TextAreaField` ships the actual fullscreen UX: a top-right `Maximize2` button opens a near-fullscreen `Dialog` containing a full-height `Textarea` with a draft-then-commit save model (Cancel reverts).

All three behaviours are off by default — existing forms render unchanged.
