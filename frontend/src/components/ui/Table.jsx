import { cn } from '../../lib/cn';

export function Table({ className, children }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)}>{children}</table>
    </div>
  );
}

export function THead({ children }) {
  return (
    <thead className="border-b border-border bg-surface-muted/60">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({ className, children }) {
  return <th className={cn('h-10 px-4 text-left text-xs font-medium whitespace-nowrap text-fg-muted', className)}>{children}</th>;
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function TR({ className, onClick, children }) {
  return (
    <tr onClick={onClick} className={cn('transition-colors', onClick && 'cursor-pointer hover:bg-surface-muted/70', className)}>
      {children}
    </tr>
  );
}

export function TD({ className, children, ...props }) {
  return <td className={cn('h-14 px-4 whitespace-nowrap text-fg-muted', className)} {...props}>{children}</td>;
}
