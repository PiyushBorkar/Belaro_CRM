import { CalendarRange } from 'lucide-react';
import { presetRange } from '../../lib/dateRanges';
import { Input, Select } from '../ui';

const PRESETS = {
  all: 'All time',
  this_month: 'This month',
  last_month: 'Last month',
  last_90: 'Last 90 days',
  this_quarter: 'This quarter',
  this_year: 'This year',
  custom: 'Custom range',
};

/** value: { preset, from, to } */
export function DateRangePicker({ value, onChange }) {
  function pickPreset(preset) {
    onChange(preset === 'custom' ? { ...value, preset } : { preset, ...presetRange(preset) });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-40">
        <Select value={value.preset} onChange={(e) => pickPreset(e.target.value)} aria-label="Date range">
          {Object.entries(PRESETS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </div>
      {value.preset === 'custom' ? (
        <div className="flex items-center gap-2">
          <Input type="date" value={value.from} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })} aria-label="From" className="w-38" />
          <span className="text-fg-subtle">–</span>
          <Input type="date" value={value.to} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value })} aria-label="To" className="w-38" />
        </div>
      ) : value.preset === 'all' ? null : (
        <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <CalendarRange className="size-3.5" />
          {new Date(value.from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {new Date(value.to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      )}
    </div>
  );
}
