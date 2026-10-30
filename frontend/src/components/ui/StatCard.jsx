import { cn } from '../../lib/cn';
import { trackPointer } from '../../lib/pointer';

const ICON_TONES = {
  primary: 'bg-primary-soft text-primary-soft-fg',
  success: 'bg-success-soft text-success-soft-fg',
  warning: 'bg-warning-soft text-warning-soft-fg',
  info:    'bg-info-soft text-info-soft-fg',
  neutral: 'bg-surface-muted text-fg-muted',
};

export function StatCard({ label, value, hint, icon: Icon, tone = 'neutral' }) {
  return (
    <div onPointerMove={trackPointer} className="fx-tile rounded-xl border border-border bg-surface p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-fg-muted">{label}</p>
        {Icon && (
          <span className={cn('fx-tile-icon flex size-8 items-center justify-center rounded-lg', ICON_TONES[tone])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="fx-tile-value tabular mt-3 text-[28px] leading-none font-semibold tracking-tight text-fg">{value}</p>
      {hint && <p className="mt-2 text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}
