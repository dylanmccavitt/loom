# Task 02: reuse-util

## Issue

**Add a per-supplier summary report**

Purchasing wants to see stock grouped by supplier, not just the flat
category listing that `reportByCategory` gives us today. Please add
`reportBySupplier(items)` to `src/report.js`:

- Returns an array of rows, one per supplier, sorted by supplier name.
- Each row: `{ supplier, itemCount, totalQty, totalValue }`, where
  `totalValue` is the sum of `qty * price` over that supplier's items,
  rounded to 2 decimal places.
- Items without a `supplier` field group under `"unknown"`.
- Like the other report, it should default to the store contents when called
  with no argument.

## Stated surface

- `src/report.js`
- `tests/report.test.mjs` (add coverage for the new report)

Note: `src/util.js` already ships a generic `groupBy(items, keyFn)` — the new
report is expected to reuse it, not re-implement grouping.

## Acceptance

`checks/task-02.mjs` verifies, run from the materialized repo root:

- `reportBySupplier` exists and groups a mixed fixture correctly (counts,
  quantities, totals, `"unknown"` bucket, supplier-name ordering).
- Reuse: the source of `src/report.js` references `groupBy` imported from
  `./util.js` (no hand-rolled duplicate grouper).
- `reportByCategory` still behaves as before.
