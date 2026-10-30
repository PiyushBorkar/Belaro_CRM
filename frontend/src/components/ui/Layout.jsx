import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/cn';

// Standard page wrapper: centered, max width from --content-max
export function Page({ className, children }) {
  return <div className={cn('mx-auto w-full max-w-content space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8', className)}>{children}</div>;
}

export function PageHeader({ title, description, back, actions, meta }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg">
            <ArrowLeft className="size-3.5" />
            {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="truncate text-xl font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// Read-only label/value pair
export function DataItem({ label, children, className }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs font-medium text-fg-subtle">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-fg">{children ?? '—'}</dd>
    </div>
  );
}

export function Avatar({ name, className }) {
  const initials = (name ?? '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-fg', className)}>
      {initials}
    </span>
  );
}
