import type { HTMLAttributes, ReactNode } from 'react';

/**
 * 20px-tall pill for status, counts and metadata. Ported from the design system.
 *
 * `success` and `warning` are local additions — see `styles/ds/extensions.css` and
 * ADR 0003. They follow the system's destructive pattern: a 10% tint, coloured text.
 */
export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'ghost'
  | 'link'
  | 'success'
  | 'warning';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children?: ReactNode;
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={['ds-badge', className].filter(Boolean).join(' ')}
      data-variant={variant}
      {...props}
    >
      {children}
    </span>
  );
}
