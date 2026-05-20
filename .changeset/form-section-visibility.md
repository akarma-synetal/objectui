---
'@object-ui/plugin-form': patch
---

ModalForm / SplitForm / WizardForm now honor field-level `visibleOn` (CEL
expression on inline fields) and `visible_on` (object schema mirror) inside
their section-mode rendering. Previously only flat-field forms via ObjectForm
respected the expression; section-mode dropped it so conditional fields
always rendered.
