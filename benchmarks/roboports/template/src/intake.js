// Validated write path for new inventory items. All writes MUST go through
// addItem so malformed records never reach the store.

import { saveItem } from './api.js';

export function addItem(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('addItem: input must be an object');
  }
  const { name, qty, price, category } = input;
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new TypeError('addItem: name must be a non-empty string');
  }
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new RangeError('addItem: qty must be a positive integer');
  }
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    throw new RangeError('addItem: price must be a finite non-negative number');
  }
  if (category !== undefined && (typeof category !== 'string' || category.trim().length === 0)) {
    throw new TypeError('addItem: category, when present, must be a non-empty string');
  }
  const item = {
    name: name.trim(),
    qty,
    price,
    category: category === undefined ? 'general' : category.trim(),
  };
  return saveItem(item);
}
