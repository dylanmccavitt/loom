# Task 04: migration-cut

## Issue

**Rename `getItems()` to `listItems()`**

We're standardizing the internal store accessors on `list*` naming
(`listItems`, and later `listSuppliers` etc.). Rename `getItems` in
`src/api.js` to `listItems` and update every call site. This is internal API
with no external consumers, so cut it clean: no deprecation alias, no
re-export shim, no back-compat wrapper — after this change the identifier
`getItems` should not exist anywhere in the codebase.

## Stated surface

- `src/api.js`
- `src/report.js` (call site)
- `src/inventory.js` (call site)
- `tests/api.test.mjs` (test anchors reference the accessor by name)

## Acceptance

`checks/task-04.mjs` verifies, run from the materialized repo root:

- `src/api.js` exports a working `listItems` and no longer exports `getItems`.
- No `getItems` identifier remains anywhere under `src/`.
- Call sites still work: `reportByCategory()` and `totalValue()` (no-arg,
  store-backed) still function.
