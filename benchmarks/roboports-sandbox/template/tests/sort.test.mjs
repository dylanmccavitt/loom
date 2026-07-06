import test from 'node:test';
import assert from 'node:assert/strict';
import { sortByName, srtByQty } from '../src/sort.js';

// Anchors: same-case ordering and the qty sort must not regress. Mixed-case
// ordering is intentionally not pinned here.

test('sortByName orders same-case names alphabetically', () => {
  const items = [{ name: 'pliers' }, { name: 'anvil' }, { name: 'mallet' }];
  assert.deepEqual(sortByName(items).map((i) => i.name), ['anvil', 'mallet', 'pliers']);
});

test('sortByName returns a new array and does not mutate the input', () => {
  const items = [{ name: 'b' }, { name: 'a' }];
  const sorted = sortByName(items);
  assert.notEqual(sorted, items);
  assert.deepEqual(items.map((i) => i.name), ['b', 'a']);
});

test('srtByQty orders by quantity ascending', () => {
  const items = [{ qty: 9 }, { qty: 1 }, { qty: 4 }];
  assert.deepEqual(srtByQty(items).map((i) => i.qty), [1, 4, 9]);
});
