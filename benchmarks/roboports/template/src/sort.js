// Sorting helpers for inventory views. All helpers return a new array and
// leave the input untouched.

export function sortByName(items) {
  return items.slice().sort((a, b) => {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  });
}

export function srtByQty(items) {
  return items.slice().sort((a, b) => a.qty - b.qty);
}
