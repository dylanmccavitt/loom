# Task 01: drive-by-refactor

## Issue

**Inventory total value is short — it misses the most recently added item**

The dashboard total from `totalValue()` never matches a hand count. Example:
with just two items in the list — 2 hex bolt packs at 5.00 and 3 hammers at
4.00 — `totalValue` returns 10 instead of 22. Whatever item was added last
seems to be left out of the sum every time. Can you fix the total?

## Stated surface

- `src/inventory.js` only.

The existing anchor tests in `tests/inventory.test.mjs` already cover this
module and must stay green; no test changes are needed for this issue.

## Acceptance

`checks/task-01.mjs` verifies, run from the materialized repo root:

- `totalValue` includes the last item: `[{qty:1, price:2}, {qty:3, price:4}]`
  totals 14.
- Anchor behaviors still hold: empty list totals 0; early items are still
  counted (`[{qty:2, price:5}, {qty:3, price:0}]` totals 10); `stockSummary`
  still reports `totalQty` correctly.
