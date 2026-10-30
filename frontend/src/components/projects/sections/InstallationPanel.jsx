import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { dispatchedRows, groupByInvoice, qty } from '../../../lib/dispatch';
import { formatDate, toDateInput } from '../../../lib/format';
import { useUpdateInstallations } from '../../../services/queries';
import { Alert, Badge, Button, Input } from '../../ui';
import { ProgressBar, ShowMore, StatTile } from './ProgressParts';

const DISPATCHES_PREVIEW = 5;

/**
 * Installation, item by item: one date per dispatched quantity, grouped per dispatch (invoice) the way
 * goods arrive on site. Installation is complete (backend: Project::refreshInstallationDate) once
 * everything is dispatched and every dispatched quantity has an installation date; then the order can be closed.
 */
export function InstallationPanel({ project, editable }) {
  const items = project.dispatch_items ?? [];
  const mutation = useUpdateInstallations(project.id);

  // Saved dates by sale_id, and unsaved edits on top ('' = cleared)
  const saved = useMemo(
    () => Object.fromEntries((project.installations ?? []).map((i) => [i.erp_sale_id, toDateInput(i.installed_on)])),
    [project.installations],
  );
  const [draft, setDraft] = useState({});
  const [bulk, setBulk] = useState({});
  const [allDispatches, setAllDispatches] = useState(false);

  const rows = dispatchedRows(items);
  const dateOf = (saleId) => draft[saleId] ?? saved[saleId] ?? '';
  const isInstalled = (row) => !!dateOf(row.sale_id);

  // Dispatches still to install first (oldest first: that is what is on site), then the finished ones
  const groups = groupByInvoice(rows)
    .map((g) => ({ ...g, installed: g.rows.filter(isInstalled).length }))
    .sort((a, b) => {
      const aDone = a.installed === a.rows.length;
      const bDone = b.installed === b.rows.length;
      if (aDone !== bDone) return aDone ? 1 : -1;
      return aDone ? (b.date ?? '').localeCompare(a.date ?? '') : (a.date ?? '').localeCompare(b.date ?? '');
    });
  const [open, setOpen] = useState(() => new Set(groups.filter((g) => g.installed < g.rows.length).slice(0, 1).map((g) => g.invoice)));

  const changes = Object.keys(draft).filter((saleId) => draft[saleId] !== (saved[saleId] ?? ''));
  const ordered = items.reduce((sum, i) => sum + i.ordered, 0);
  const dispatchedQty = rows.reduce((sum, r) => sum + r.quantity, 0);
  const installedQty = rows.filter(isInstalled).reduce((sum, r) => sum + r.quantity, 0);
  const pct = ordered ? Math.round((installedQty / ordered) * 100) : 0;
  const installedRows = rows.filter(isInstalled).length;

  const setDate = (saleId, value) => setDraft((d) => ({ ...d, [saleId]: value }));
  const toggle = (invoice) => setOpen((s) => { const next = new Set(s); next.has(invoice) ? next.delete(invoice) : next.add(invoice); return next; });

  function applyToDispatch(group) {
    const date = bulk[group.invoice];
    if (!date) return;
    setDraft((d) => ({ ...d, ...Object.fromEntries(group.rows.filter((r) => !isInstalled(r)).map((r) => [r.sale_id, date])) }));
  }

  function save() {
    const entries = changes.map((saleId) => ({ sale_id: Number(saleId), installed_on: draft[saleId] || null }));
    mutation.mutate({ entries }, { onSuccess: () => { setDraft({}); setBulk({}); } });
  }

  const errors = mutation.error?.errors ? [...new Set(Object.values(mutation.error.errors).flat())] : [];

  if (!rows.length) {
    return <p className="rounded-xl border border-dashed border-border-strong p-6 text-center text-[13px] text-fg-muted">Nothing dispatched yet.</p>;
  }

  return (
    <div className="space-y-5">
      {project.installation_date && (
        <Alert tone="success" title={`Installation complete on ${formatDate(project.installation_date)}`}>
          {project.closed_on
            ? `Everything is dispatched and installed. The order was closed on ${formatDate(project.closed_on)}.`
            : 'Everything is dispatched and installed. Last step: close the order.'}
        </Alert>
      )}

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Quantity installed" value={`${pct}%`} sub={`${qty(installedQty)} of ${qty(ordered)} ordered`} />
          <StatTile label="Dispatched items installed" value={`${installedRows} of ${rows.length}`}
            sub={installedRows === rows.length ? 'Everything on site is installed' : `${rows.length - installedRows} waiting on site`} />
          <StatTile label="Dispatched so far" value={qty(dispatchedQty)} sub={project.dispatch_status === 'dispatched' ? 'Fully dispatched' : 'More to come from the factory'} />
        </div>
        <ProgressBar pct={pct} />
      </div>

      <section className="space-y-2">
        <h5 className="text-xs font-medium text-fg-subtle">By dispatch</h5>
        <ul className="space-y-2">
          {(allDispatches ? groups : groups.slice(0, DISPATCHES_PREVIEW)).map((group) => {
            const isOpen = open.has(group.invoice);
            const complete = group.installed === group.rows.length;
            const lastInstalled = complete ? group.rows.map((r) => dateOf(r.sale_id)).sort().at(-1) : null;
            return (
              <li key={group.invoice} className={cn('rounded-xl border bg-surface/60', complete ? 'border-success/30' : 'border-border')}>
                <button type="button" onClick={() => toggle(group.invoice)} aria-expanded={isOpen}
                  className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-left">
                  <div className="min-w-0">
                    <p className="tabular text-sm font-medium text-fg">Dispatched {group.date ? formatDate(group.date) : '—'}</p>
                    <p className="tabular truncate text-[11px] text-fg-subtle">
                      {group.invoice} · {group.rows.length} item{group.rows.length === 1 ? '' : 's'} · {qty(group.quantity)} qty
                    </p>
                  </div>
                  <span className="flex items-center gap-2">
                    {complete
                      ? <Badge tone="success"><CheckCircle2 className="size-3" />Installed {lastInstalled ? formatDate(lastInstalled) : ''}</Badge>
                      : <Badge tone={group.installed ? 'primary' : 'neutral'}>{group.installed} of {group.rows.length} installed</Badge>}
                    <ChevronDown className={cn('size-4 text-fg-subtle transition', isOpen && 'rotate-180')} />
                  </span>
                </button>

                {isOpen && (
                  <div className="space-y-3 border-t border-border px-3 py-3">
                    {editable && !complete && (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-sunken/60 px-3 py-2">
                        <span className="text-xs text-fg-muted">Installed all remaining on</span>
                        <Input type="date" className="tabular h-8 w-40" value={bulk[group.invoice] ?? ''}
                          onChange={(e) => setBulk((b) => ({ ...b, [group.invoice]: e.target.value }))} aria-label={`Installation date for all remaining items of ${group.invoice}`} />
                        <Button size="sm" variant="secondary" onClick={() => applyToDispatch(group)} disabled={!bulk[group.invoice]}>Apply</Button>
                      </div>
                    )}
                    <ul className="divide-y divide-border">
                      {group.rows.map((row) => (
                        <li key={row.sale_id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2">
                          <p className="min-w-0 flex-1 truncate text-sm text-fg" title={row.product}>{row.product}</p>
                          <span className="tabular w-20 text-right text-xs text-fg-muted">{qty(row.quantity)} qty</span>
                          {editable ? (
                            <Input type="date" className={cn('tabular h-8 w-40', draft[row.sale_id] !== undefined && draft[row.sale_id] !== (saved[row.sale_id] ?? '') && 'ring-2 ring-primary-soft')}
                              value={dateOf(row.sale_id)}
                              onChange={(e) => setDate(row.sale_id, e.target.value)} aria-label={`Installation date for ${row.product}`} />
                          ) : (
                            <span className="tabular w-40 text-right text-xs text-fg-muted">{dateOf(row.sale_id) ? formatDate(dateOf(row.sale_id)) : 'Not installed'}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {groups.length > DISPATCHES_PREVIEW && (
          <ShowMore open={allDispatches} onToggle={() => setAllDispatches((v) => !v)} count={groups.length} noun="dispatches" />
        )}
      </section>

      {errors.length > 0 && <Alert>{errors.join(' ')}</Alert>}
      {mutation.error && !errors.length && <Alert>{mutation.error.message}</Alert>}

      {editable && changes.length > 0 && (
        <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-surface px-4 py-3 shadow-lg">
          <p className="text-[13px] font-medium text-fg">{changes.length} unsaved change{changes.length === 1 ? '' : 's'}</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setDraft({}); mutation.reset(); }} disabled={mutation.isPending}>Discard</Button>
            <Button size="sm" onClick={save} loading={mutation.isPending}>Save installation dates</Button>
          </div>
        </div>
      )}
    </div>
  );
}
