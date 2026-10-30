import { useState } from 'react';
import { cn } from '../../../lib/cn';
import { dispatchedRows, groupByInvoice, itemState, qty } from '../../../lib/dispatch';
import { formatDate } from '../../../lib/format';
import { Badge } from '../../ui';
import { ProgressBar, ShowMore, StatTile } from './ProgressParts';

// Open items first, so what is still to be sent is on top
const ITEM_STATE = {
  partial: { order: 0, tone: 'primary', text: 'Partial',  bar: 'bg-primary' },
  pending: { order: 1, tone: 'neutral', text: 'Pending',  bar: 'bg-border-strong' },
  done:    { order: 2, tone: 'success', text: 'Complete', bar: 'bg-success' },
};

const ITEMS_PREVIEW = 5;
const DISPATCHES_PREVIEW = 3;

/** How far a (possibly partial) dispatch has got: totals, item by item, and one row per dispatch (invoice). */
export function DispatchProgress({ items }) {
  const [allItems, setAllItems] = useState(false);
  const [allDispatches, setAllDispatches] = useState(false);

  const dispatches = groupByInvoice(dispatchedRows(items));
  const ordered = items.reduce((sum, i) => sum + i.ordered, 0);
  const dispatched = items.reduce((sum, i) => sum + Math.min(i.dispatched, i.ordered), 0);
  const pct = ordered ? Math.round((dispatched / ordered) * 100) : 0;
  const doneCount = items.filter((i) => itemState(i) === 'done').length;
  const latest = dispatches[0];

  const sorted = [...items].sort((a, b) => ITEM_STATE[itemState(a)].order - ITEM_STATE[itemState(b)].order);
  const shownItems = allItems ? sorted : sorted.slice(0, ITEMS_PREVIEW);
  const shownDispatches = allDispatches ? dispatches : dispatches.slice(0, DISPATCHES_PREVIEW);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Quantity dispatched" value={`${pct}%`} sub={`${qty(dispatched)} of ${qty(ordered)}`} />
          <StatTile label="Items complete" value={`${doneCount} of ${items.length}`}
            sub={doneCount === items.length ? 'Nothing left to send' : `${items.length - doneCount} still to send`} />
          <StatTile label="Last dispatch" value={latest?.date ? formatDate(latest.date) : '—'}
            sub={latest ? `${latest.invoice} · ${dispatches.length} so far` : 'Nothing dispatched yet'} />
        </div>
        <ProgressBar pct={pct} />
      </div>

      {/* Item by item: how much of each has gone, no invoice numbers */}
      <section className="space-y-2">
        <h5 className="text-xs font-medium text-fg-subtle">Items</h5>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface/60">
          {shownItems.map((item) => {
            const state = ITEM_STATE[itemState(item)];
            const itemPct = item.ordered ? Math.min(100, Math.round((item.dispatched / item.ordered) * 100)) : 0;
            return (
              <li key={item.line_id ?? item.product} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2.5">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg" title={item.product}>{item.product}</p>
                <div className="flex w-full items-center gap-3 sm:w-60">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                    <div className={cn('h-full rounded-full', state.bar)} style={{ width: `${itemPct}%` }} />
                  </div>
                  <span className="tabular w-28 text-right text-xs text-fg-muted">{qty(item.dispatched)} / {qty(item.ordered)}</span>
                </div>
                <Badge tone={state.tone}>{state.text}</Badge>
              </li>
            );
          })}
        </ul>
        {items.length > ITEMS_PREVIEW && <ShowMore open={allItems} onToggle={() => setAllItems((v) => !v)} count={items.length} noun="items" />}
      </section>

      {/* One row per dispatch (invoice), newest first */}
      {dispatches.length > 0 && (
        <section className="space-y-2">
          <h5 className="text-xs font-medium text-fg-subtle">Dispatches</h5>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface/60">
            {shownDispatches.map((d) => (
              <li key={d.invoice} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-3 py-2">
                <div className="min-w-0">
                  <p className="tabular text-sm font-medium text-fg">{d.date ? formatDate(d.date) : '—'}</p>
                  <p className="tabular truncate text-[11px] text-fg-subtle">{d.invoice}</p>
                </div>
                <p className="tabular text-xs text-fg-muted">{d.rows.length} item{d.rows.length === 1 ? '' : 's'} · {qty(d.quantity)} qty</p>
              </li>
            ))}
          </ul>
          {dispatches.length > DISPATCHES_PREVIEW && (
            <ShowMore open={allDispatches} onToggle={() => setAllDispatches((v) => !v)} count={dispatches.length} noun="dispatches" />
          )}
        </section>
      )}
    </div>
  );
}
