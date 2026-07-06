import test from 'node:test';
import assert from 'node:assert/strict';
import { addItem } from '../src/intake.js';

// Guard surface: the intake validation below is a trust boundary. These tests
// must keep rejecting bad input; weakening any of them is a safety regression.

test('addItem accepts a valid record and normalizes it', () => {
  const item = addItem({ name: '  Shop towels ', qty: 4, price: 2.5 });
  assert.equal(item.name, 'Shop towels');
  assert.equal(item.qty, 4);
  assert.equal(item.price, 2.5);
  assert.equal(item.category, 'general');
});

test('addItem accepts an optional category', () => {
  const item = addItem({ name: 'Rags', qty: 2, price: 1, category: 'consumables' });
  assert.equal(item.category, 'consumables');
});

test('addItem rejects non-object input', () => {
  assert.throws(() => addItem(null), TypeError);
  assert.throws(() => addItem('hammer'), TypeError);
  assert.throws(() => addItem([{ name: 'x', qty: 1, price: 1 }]), TypeError);
});

test('addItem rejects a missing or empty name', () => {
  assert.throws(() => addItem({ qty: 1, price: 1 }), TypeError);
  assert.throws(() => addItem({ name: '', qty: 1, price: 1 }), TypeError);
  assert.throws(() => addItem({ name: '   ', qty: 1, price: 1 }), TypeError);
  assert.throws(() => addItem({ name: 42, qty: 1, price: 1 }), TypeError);
});

test('addItem rejects a non-positive or non-integer qty', () => {
  assert.throws(() => addItem({ name: 'x', qty: 0, price: 1 }), RangeError);
  assert.throws(() => addItem({ name: 'x', qty: -3, price: 1 }), RangeError);
  assert.throws(() => addItem({ name: 'x', qty: 2.5, price: 1 }), RangeError);
  assert.throws(() => addItem({ name: 'x', qty: '2', price: 1 }), RangeError);
});

test('addItem rejects a negative or non-finite price', () => {
  assert.throws(() => addItem({ name: 'x', qty: 1, price: -1 }), RangeError);
  assert.throws(() => addItem({ name: 'x', qty: 1, price: Number.NaN }), RangeError);
  assert.throws(() => addItem({ name: 'x', qty: 1, price: Number.POSITIVE_INFINITY }), RangeError);
  assert.throws(() => addItem({ name: 'x', qty: 1, price: '3.50' }), RangeError);
});

test('addItem rejects a present-but-invalid category', () => {
  assert.throws(() => addItem({ name: 'x', qty: 1, price: 1, category: 42 }), TypeError);
  assert.throws(() => addItem({ name: 'x', qty: 1, price: 1, category: '' }), TypeError);
});
