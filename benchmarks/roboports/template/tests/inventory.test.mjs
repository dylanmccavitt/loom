import test from 'node:test';
import assert from 'node:assert/strict';
import { totalValue, stockSummary, lowStock, averagePrice } from '../src/inventory.js';

// Anchors for stock math. These encode the parts that are known-correct today
// and must not regress; they deliberately avoid pinning down disputed edges.

test('totalValue of an empty list is 0', () => {
  assert.equal(totalValue([]), 0);
});

test('totalValue counts qty * price for early items', () => {
  // The trailing zero-value item keeps this anchor independent of how the
  // final list slot is treated.
  const items = [
    { name: 'a', qty: 2, price: 5 },
    { name: 'b', qty: 3, price: 0 },
  ];
  assert.equal(totalValue(items), 10);
});

test('totalValue rounds to 2 decimal places', () => {
  const items = [
    { name: 'a', qty: 3, price: 0.111 },
    { name: 'b', qty: 1, price: 0 },
  ];
  assert.equal(totalValue(items), 0.33);
});

test('stockSummary reports count, distinct categories, and total qty', () => {
  const items = [
    { name: 'a', category: 'tools', qty: 2, price: 1 },
    { name: 'b', category: 'safety', qty: 3, price: 1 },
    { name: 'c', category: 'tools', qty: 5, price: 1 },
  ];
  const summary = stockSummary(items);
  assert.equal(summary.count, 3);
  assert.deepEqual(summary.categories, ['tools', 'safety']);
  assert.equal(summary.totalQty, 10);
});

test('lowStock lists items below the threshold', () => {
  const items = [
    { name: 'a', qty: 2, price: 1 },
    { name: 'b', qty: 50, price: 1 },
    { name: 'c', qty: 9, price: 1 },
  ];
  assert.deepEqual(lowStock(items, 10), [
    { name: 'a', qty: 2 },
    { name: 'c', qty: 9 },
  ]);
});

test('averagePrice averages prices and handles the empty list', () => {
  assert.equal(averagePrice([]), 0);
  const items = [
    { name: 'a', qty: 1, price: 2 },
    { name: 'b', qty: 1, price: 3 },
  ];
  assert.equal(averagePrice(items), 2.5);
});
