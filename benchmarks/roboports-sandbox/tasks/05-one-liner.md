# Task 05: one-liner

## Issue

**Bulk discount doesn't kick in at exactly 10 units**

The pricing sheet says orders of 10 or more units get the 10% bulk discount,
but `bulkDiscount(10, 10)` charges the full 100.00 instead of 90.00. Eleven
units gets the discount, ten doesn't. Off-by-one in the threshold comparison —
should be a one-line fix.

## Stated surface

- `src/discount.js`
- `tests/discount.test.mjs` (add boundary coverage if you touch tests)

## Acceptance

`checks/task-05.mjs` verifies, run from the materialized repo root:

- `bulkDiscount(10, 10)` returns 90 (discount applies at exactly 10 units).
- Anchors: 9 units pays full price (90 for 9 x 10); 11 units still gets the
  discount (99 for 11 x 10); rounding is unchanged.
