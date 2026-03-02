import type { ReactNode } from 'react';

import { Button, type ButtonProps } from './Button';

export type IconButtonProps = Omit<ButtonProps, 'children'> & {
  icon: ReactNode;
  label: string;
};

export function IconButton({
  icon,
  label,
  className,
  size = 'sm',
  variant = 'ghost',
  ...props
}: IconButtonProps) {
  const classes = ['h-9 w-9 p-0', className].filter(Boolean).join(' ');

  return (
    <Button aria-label={label} variant={variant} size={size} className={classes} {...props}>
      {icon}
    </Button>
  );
}
