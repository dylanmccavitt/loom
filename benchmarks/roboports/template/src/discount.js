// Pricing helpers. Per the pricing sheet, bulk orders of 10 or more units get
// a 10% discount; smaller orders pay full price.

export function bulkDiscount(qty, unitPrice) {
  const gross = qty * unitPrice;
  if (qty > 10) {
    return Math.round(gross * 0.9 * 100) / 100;
  }
  return Math.round(gross * 100) / 100;
}
