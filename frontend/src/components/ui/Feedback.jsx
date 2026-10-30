import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/cn';

const TONES = {
  neutral: 'bg-surface-muted text-fg-muted ring-border',
  primary: 'bg-primary-soft text-primary-soft-fg ring-primary/20',
  success: 'bg-success-soft text-success-soft-fg ring-success/20',
  warning: 'bg-warning-soft text-warning-soft-fg ring-warning/20',
  danger:  'bg-danger-soft text-danger-soft-fg ring-danger/20',
  info:    'bg-info-soft text-info-soft-fg ring-info/20',
};

const DOTS = {
  neutral: 'bg-fg-subtle',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger:  'bg-danger',
  info:    'bg-info',
};

export function Badge({ tone = 'neutral', dot = false, className, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONES[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  );
}

const ALERT_ICONS = { danger: AlertCircle, success: CheckCircle2, warning: TriangleAlert, info: Info };

export function Alert({ tone = 'danger', title, className, children }) {
  const Icon = ALERT_ICONS[tone] ?? Info;

  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-2.5 rounded-lg px-3.5 py-3 text-[13px] ring-1 ring-inset', TONES[tone], className)}>
      <Icon className="mt-px size-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={cn('size-5 animate-spin text-primary', className)} />;
}

export function PageSpinner() {
  return (
    <div className="flex justify-center py-24">
      <Spinner className="size-6" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-surface-muted text-fg-subtle ring-1 ring-inset ring-border">
          <Icon className="size-5" />
        </div>
      )}
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-sunken', className)} />;
}
