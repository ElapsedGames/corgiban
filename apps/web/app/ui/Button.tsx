import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-app-md border font-semibold motion-safe:transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border-accent-strong bg-accent text-accent-contrast shadow-sm hover:border-accent hover:bg-accent-strong hover:shadow-md',
  secondary: 'border-border-action bg-panel text-fg shadow-sm hover:border-accent hover:bg-bg',
  tonal:
    'border-accent-border bg-accent-surface text-accent hover:border-accent hover:bg-accent/15',
  ghost: 'border-transparent bg-transparent text-fg hover:bg-border/70',
  destructive:
    'border-error bg-error text-white shadow-sm hover:border-error-text hover:bg-error-text hover:shadow-md',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  const classes = [baseClasses, variantClasses[variant], sizeClasses[size], className]
    .filter(Boolean)
    .join(' ');

  return <button ref={ref} type={type} className={classes} {...props} />;
});
