// Date-range presets for report filters

const iso = (d) => d.toLocaleDateString('en-CA');

// Preset → { from, to } (YYYY-MM-DD, local time); 'all' → empty (all time)
export function presetRange(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case 'all':          return { from: '', to: '' }; // no dates = all time, like the old sheet
    case 'last_month':   return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'last_90':      return { from: iso(new Date(y, m, now.getDate() - 89)), to: iso(now) };
    case 'this_quarter': return { from: iso(new Date(y, Math.floor(m / 3) * 3, 1)), to: iso(now) };
    case 'this_year':    return { from: iso(new Date(y, 0, 1)), to: iso(now) };
    default:             return { from: iso(new Date(y, m, 1)), to: iso(now) }; // this_month
  }
}
