import { extendTailwindMerge } from 'tailwind-merge';

// Our design tokens (global.css) add these utility groups; teach tailwind-merge
// about them so e.g. `text-fg-muted` and `text-sm` are not treated as conflicts.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: ['canvas', 'surface', 'surface-muted', 'surface-sunken', 'overlay', 'fg', 'fg-muted', 'fg-subtle', 'border', 'border-strong',
        'primary', 'primary-hover', 'primary-fg', 'primary-soft', 'primary-soft-fg', 'ring',
        'success', 'success-soft', 'success-soft-fg', 'warning', 'warning-soft', 'warning-soft-fg',
        'danger', 'danger-hover', 'danger-soft', 'danger-soft-fg', 'info', 'info-soft', 'info-soft-fg'],
    },
  },
});

// Joins class names, skipping falsy values; later classes win over earlier conflicting ones:
// cn('h-9 px-3', 'h-10 px-9') → 'h-10 px-9'
export function cn(...classes) {
  return twMerge(classes.filter(Boolean).join(' '));
}
