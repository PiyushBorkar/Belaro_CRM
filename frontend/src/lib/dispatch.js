// Dispatch data synced from the ERP (Project.dispatch_items): order lines, each with the quantities
// dispatched so far (one row per ERP invoice line, identified by sale_id). Installation is entered per row.

export const qty = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** "done" (fully dispatched), "partial" or "pending" (nothing sent yet). */
export const itemState = (item) => (item.dispatched > 0 && item.dispatched >= item.ordered ? 'done' : item.dispatched > 0 ? 'partial' : 'pending');

/** Every dispatched row of the order, with its product. */
export const dispatchedRows = (items = []) =>
  items.flatMap((item) => (item.dispatches ?? []).map((row) => ({ ...row, product: item.product })));

/** Rows grouped per dispatch (ERP invoice): { invoice, date, rows, quantity }, newest first. */
export function groupByInvoice(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const group = groups.get(row.invoice) ?? { invoice: row.invoice, date: row.date, rows: [], quantity: 0 };
    group.rows.push(row);
    group.quantity += row.quantity;
    if ((row.date ?? '') > (group.date ?? '')) group.date = row.date;
    groups.set(row.invoice, group);
  });
  return [...groups.values()].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.invoice.localeCompare(a.invoice));
}
