import test from 'node:test';
import assert from 'node:assert/strict';
import { reportByCategory } from '../src/report.js';

test('reportByCategory returns one row per item ordered by category', () => {
  const items = [
    { name: 'goggles', category: 'safety', supplier: 'ShieldWorks', qty: 4, price: 6.25 },
    { name: 'hammer', category: 'tools', supplier: 'Acme Supply', qty: 1, price: 14.5 },
    { name: 'bolts', category: 'fasteners', supplier: 'Acme Supply', qty: 10, price: 0.12 },
  ];
  const rows = reportByCategory(items);
  assert.deepEqual(rows, [
    { category: 'fasteners', name: 'bolts', qty: 10, lineValue: 1.2 },
    { category: 'safety', name: 'goggles', qty: 4, lineValue: 25 },
    { category: 'tools', name: 'hammer', qty: 1, lineValue: 14.5 },
  ]);
});

test('reportByCategory does not mutate its input', () => {
  const items = [
    { name: 'b', category: 'z', qty: 1, price: 1 },
    { name: 'a', category: 'a', qty: 1, price: 1 },
  ];
  reportByCategory(items);
  assert.deepEqual(items.map((i) => i.name), ['b', 'a']);
});
