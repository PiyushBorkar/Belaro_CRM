// Small building blocks shared by the Dispatch and Installation panels

export function StatTile({ label, value, sub }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2.5">
      <p className="text-xs text-fg-subtle">{label}</p>
      <p className="tabular mt-0.5 text-base font-semibold text-fg">{value}</p>
      <p className="tabular truncate text-[11px] text-fg-subtle" title={sub}>{sub}</p>
    </div>
  );
}

export function ProgressBar({ pct }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-success to-primary transition-all duration-700" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ShowMore({ open, onToggle, count, noun }) {
  return (
    <button type="button" onClick={onToggle} className="text-xs font-medium text-primary hover:underline">
      {open ? 'Show less' : `Show all ${count} ${noun}`}
    </button>
  );
}
