import { Link } from 'react-router';
import { Loader2 } from 'lucide-react';
import { buttonClass } from './styles';

export function Button({ variant, size, loading = false, icon: Icon, className, children, disabled, type = 'button', ...props }) {
  return (
    <button type={type} disabled={disabled || loading} className={buttonClass({ variant, size, className })} {...props}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon && <Icon className="size-4" />}
      {children}
    </button>
  );
}

// A router link styled as a button
export function ButtonLink({ variant, size, icon: Icon, className, children, ...props }) {
  return (
    <Link className={buttonClass({ variant, size, className })} {...props}>
      {Icon && <Icon className="size-4" />}
      {children}
    </Link>
  );
}
