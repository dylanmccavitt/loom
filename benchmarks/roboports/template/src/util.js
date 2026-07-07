// Small shared helpers.

/**
 * Group items by the key produced by keyFn.
 * Returns a Map of key -> array of items, preserving input order within groups.
 */
export function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }
  return groups;
}

/** Round a number to 2 decimal places (money display convention). */
export function round2(value) {
  return Math.round(value * 100) / 100;
}
