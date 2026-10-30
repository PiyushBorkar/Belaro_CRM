import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../../lib/cn';
import { trackPointer } from '../../lib/pointer';

/*
 * Small, dependency-free charts for the dashboard. Single-series, so one hue
 * (--primary, validated against both surfaces) and no legend; every bar carries
 * its value as a direct label and a hover tooltip (title).
 */

// KPI tile with change vs the previous period
export function KpiTile({ label, value, previous, format = (v) => v, icon: Icon, higherIsBetter = true }) {
  const hasPrev = previous !== undefined && previous !== null;
  const delta = hasPrev && previous !== 0 ? ((value - previous) / previous) * 100 : null;
  const up = delta > 0;
  const good = delta === null || delta === 0 ? null : up === higherIsBetter;

  return (
    <div onPointerMove={trackPointer} className="fx-tile rounded-xl border border-border bg-surface p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-fg-muted">{label}</p>
        {Icon && <Icon className="fx-tile-icon size-4 text-fg-subtle" />}
      </div>
      <p className="fx-tile-value tabular mt-3 text-[26px] leading-none font-semibold tracking-tight text-fg">{format(value ?? 0)}</p>
      {hasPrev && (
        <p className="mt-2.5 flex items-center gap-1 text-xs text-fg-subtle">
          {delta === null || delta === 0 ? (
            <Minus className="size-3.5" />
          ) : (
            <span className={cn('inline-flex items-center gap-0.5 font-medium', good ? 'text-success' : 'text-danger')}>
              {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(delta).toFixed(0)}%
            </span>
          )}
          <span>vs {format(previous)} previous period</span>
        </p>
      )}
    </div>
  );
}

// Funnel: each milestone as a bar sized against the first row
export function FunnelChart({ rows }) {
  const top = rows[0]?.count || 0;

  return (
    <ol className="space-y-2.5">
      {rows.map((r, i) => {
        const width = top ? Math.max((r.count / top) * 100, r.count ? 2 : 0) : 0;
        return (
          <li key={r.key} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 sm:grid-cols-[10rem_1fr_7rem]">
            <span className="truncate text-[13px] text-fg-muted">{r.label}</span>
            <div className="group relative h-6 rounded-md bg-surface-sunken" title={`${r.label}: ${r.count} (${r.pct_of_total}% of customers)`}>
              <div className="h-full rounded-md bg-primary transition-[width] duration-500 group-hover:opacity-85" style={{ width: `${width}%` }} />
            </div>
            <span className="tabular text-right text-[13px]">
              <span className="font-semibold text-fg">{r.count}</span>
              {i > 0 && <span className="ml-1.5 text-xs text-fg-subtle">{r.pct_of_prev}%</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// Count per category as thin horizontal bars, sized against the largest
export function BarList({ rows, onSelect }) {
  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.key}>
          <button
            type="button"
            onClick={onSelect ? () => onSelect(r) : undefined}
            disabled={!onSelect || !r.count}
            title={`${r.label}: ${r.count}`}
            className="group grid w-full grid-cols-[1fr_2.5rem] items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors enabled:cursor-pointer enabled:hover:bg-surface-muted"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px] text-fg-muted">{r.label}</span>
              <span className="mt-1 block h-1.5 rounded-full bg-surface-sunken">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
              </span>
            </span>
            <span className="tabular text-right text-[13px] font-semibold text-fg">{r.count}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
