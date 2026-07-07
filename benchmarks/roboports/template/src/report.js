// Reporting views over the inventory. Currently only a flat per-item listing
// ordered by category; aggregated views are on the roadmap.

import { getItems } from './api.js';

export function reportByCategory(items = getItems()) {
  return items
    .slice()
    .sort((a, b) => {
      if (a.category === b.category) return 0;
      return a.category < b.category ? -1 : 1;
    })
    .map((item) => ({
      category: item.category,
      name: item.name,
      qty: item.qty,
      lineValue: Math.round(item.qty * item.price * 100) / 100,
    }));
}
