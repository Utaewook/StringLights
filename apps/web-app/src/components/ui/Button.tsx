import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Primary interactive control. Ported from the design system.
 *
 * The source also supports `asChild`, which is not ported — nothing in this app renders
 * a button as another element yet. Add it when something does.
 */
export type ButtonVariant =
  | 'default'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'link';

export type ButtonSize =
  | 'default'
  | 'xs'
  | 'sm'
  | 'lg'
  | 'icon'
  | 'icon-xs'
  | 'icon-sm'
  | 'icon-lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

export function Button({
  variant = 'default',
  size = 'default',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={['ds-btn', className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  );
}
