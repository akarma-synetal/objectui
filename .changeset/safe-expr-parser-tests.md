---
'@object-ui/core': patch
---

test(core): comprehensive security + correctness tests for SafeExpressionParser

Add a ~50-case suite covering literals, operators, ternary, property
access, calls/arrows, and a full security section (blocks
`constructor` / `__proto__` / `prototype` / `__defineGetter__` /
`__defineSetter__`, denies `eval` / `Function` / `window` / `process`,
rejects assignment syntax). No production code changes.
