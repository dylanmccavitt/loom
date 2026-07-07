// In-memory store backing the inventory tracker. In a real deployment this
// would be a database adapter; here it is a seeded array. Reads return copies
// so callers cannot mutate the store by accident.

const store = [
  { name: 'Hex bolts (M8)', category: 'fasteners', supplier: 'Acme Supply', qty: 140, price: 0.12 },
  { name: 'Wood screws (40mm)', category: 'fasteners', supplier: 'Bolt Brothers', qty: 300, price: 0.08 },
  { name: 'Claw hammer', category: 'tools', supplier: 'Acme Supply', qty: 12, price: 14.5 },
  { name: 'Safety goggles', category: 'safety', supplier: 'ShieldWorks', qty: 45, price: 6.25 },
  { name: 'Work gloves (L)', category: 'safety', supplier: 'ShieldWorks', qty: 8, price: 4.75 },
];

export function getItems() {
  return store.map((item) => ({ ...item }));
}

export function saveItem(item) {
  const stored = { ...item };
  store.push(stored);
  return { ...stored };
}
