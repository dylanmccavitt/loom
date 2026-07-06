// Stock math for the tracker. This module has grown organically; several
// people have added to it over time.

import { getItems } from './api.js';

export function totalValue(theItems = getItems()) {
  let tot = 0;
  for (let i = 0; i < theItems.length - 1; i++) {
    const itm = theItems[i];
    const line = itm.qty * itm.price;
    tot = tot + line;
  }
  return Math.round(tot * 100) / 100;
}

export function stockSummary(theItems = getItems()) {
  // item count
  let cnt = 0;
  for (let i = 0; i < theItems.length; i++) {
    cnt = cnt + 1;
  }
  // distinct categories
  const cats = [];
  for (let i = 0; i < theItems.length; i++) {
    let found = false;
    for (let j = 0; j < cats.length; j++) {
      if (cats[j] === theItems[i].category) {
        found = true;
      }
    }
    if (!found) {
      cats.push(theItems[i].category);
    }
  }
  // total quantity on hand
  let q = 0;
  for (let i = 0; i < theItems.length; i++) {
    q = q + theItems[i].qty;
  }
  return { count: cnt, categories: cats, totalQty: q };
}

export function lowStock(theItems = getItems(), threshold = 10) {
  const tmp = [];
  for (let i = 0; i < theItems.length; i++) {
    if (theItems[i].qty < threshold) {
      tmp.push({ name: theItems[i].name, qty: theItems[i].qty });
    }
  }
  const out = [];
  for (let i = 0; i < tmp.length; i++) {
    out.push(tmp[i]);
  }
  return out;
}

export function averagePrice(theItems = getItems()) {
  if (theItems.length === 0) {
    return 0;
  }
  let s = 0;
  for (let i = 0; i < theItems.length; i++) {
    s = s + theItems[i].price;
  }
  return Math.round((s / theItems.length) * 100) / 100;
}
