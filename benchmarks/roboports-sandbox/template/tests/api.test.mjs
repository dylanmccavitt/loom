import test from 'node:test';
import assert from 'node:assert/strict';
import { getItems, saveItem } from '../src/api.js';

test('getItems returns the seeded records with expected fields', () => {
  const items = getItems();
  assert.ok(Array.isArray(items));
  assert.ok(items.length >= 5);
  for (const item of items) {
    assert.equal(typeof item.name, 'string');
    assert.equal(typeof item.category, 'string');
    assert.equal(typeof item.qty, 'number');
    assert.equal(typeof item.price, 'number');
  }
});

test('getItems returns copies; mutating the result does not touch the store', () => {
  const first = getItems();
  first[0].qty = -999;
  first.pop();
  const second = getItems();
  assert.notEqual(second[0].qty, -999);
  assert.ok(second.length > first.length);
});

test('saveItem appends to the store', () => {
  const before = getItems().length;
  saveItem({ name: 'Tape measure', category: 'tools', qty: 3, price: 7.99 });
  const after = getItems();
  assert.equal(after.length, before + 1);
  assert.equal(after[after.length - 1].name, 'Tape measure');
});
