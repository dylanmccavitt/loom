// Public surface of the inventory tracker. Raw store access (src/api.js)
// stays internal; consumers read via reports/stock math and write via intake.

export { totalValue, stockSummary, lowStock, averagePrice } from './inventory.js';
export { reportByCategory } from './report.js';
export { sortByName, srtByQty } from './sort.js';
export { bulkDiscount } from './discount.js';
export { addItem } from './intake.js';
export { groupBy, round2 } from './util.js';
