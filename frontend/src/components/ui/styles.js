import { cn } from '../../lib/cn';

// Class recipes shared by components that render different elements
// (e.g. a <button> and a router <Link> that must look identical).

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors ' +
  'cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none ' +
  'focus-visible:ring-4 focus-visible:ring-ring';

const BUTTON_VARIANTS = {
  primary:   'bg-primary text-primary-fg shadow-glow hover:bg-primary-hover',
  secondary: 'bg-surface text-fg border border-border shadow-xs hover:bg-surface-muted',
  ghost:     'text-fg-muted hover:bg-surface-muted hover:text-fg',
  danger:    'bg-danger text-on-color shadow-xs hover:bg-danger-hover',
  'danger-ghost': 'text-danger hover:bg-danger-soft',
  link:      'text-primary hover:text-primary-hover px-0! h-auto!',
};

const BUTTON_SIZES = {
  sm:   'h-8 px-3 text-xs',
  md:   'h-9 px-3.5 text-sm',
  lg:   'h-10 px-4 text-sm',
  icon: 'h-9 w-9',
  'icon-sm': 'h-8 w-8',
};

export function buttonClass({ variant = 'primary', size = 'md', className } = {}) {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);
}

export const controlClass =
  'w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg shadow-xs outline-none transition ' +
  'placeholder:text-fg-subtle hover:border-border-strong focus:border-primary focus:ring-4 focus:ring-ring ' +
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-subtle aria-invalid:border-danger';
