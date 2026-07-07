import test from 'node:test';
import assert from 'node:assert/strict';
import { bulkDiscount } from '../src/discount.js';

// Anchors: behavior clearly above and below the bulk threshold. The exact
// threshold boundary is intentionally not pinned here.

test('bulkDiscount applies 10% above the threshold', () => {
  assert.equal(bulkDiscount(11, 10), 99);
});

test('bulkDiscount charges full price for small orders', () => {
  assert.equal(bulkDiscount(9, 10), 90);
  assert.equal(bulkDiscount(1, 4.5), 4.5);
});

test('bulkDiscount rounds to 2 decimal places', () => {
  assert.equal(bulkDiscount(11, 0.33), 3.27);
});

test('bulkDiscount of zero units is zero', () => {
  assert.equal(bulkDiscount(0, 12.5), 0);
});
