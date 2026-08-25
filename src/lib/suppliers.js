// Supplier balance is derived from the transaction ledger — never edited directly.
// Positive balance = HiKids owes the supplier; payments/reversals reduce it.
export const supplierBalance = (txs = []) =>
  (txs || []).reduce((s, t) => s + (Number(t?.amount) || 0), 0);

// Group all transactions by supplier_id into a { [id]: balance } map.
export const balancesBySupplier = (txs = []) => {
  const map = {};
  for (const t of txs || []) {
    const id = t?.supplier_id;
    if (!id) continue;
    map[id] = (map[id] || 0) + (Number(t?.amount) || 0);
  }
  return map;
};