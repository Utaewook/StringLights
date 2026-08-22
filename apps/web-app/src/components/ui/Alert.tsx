import type { ReactNode } from 'react';

/**
 * Inline, persistent message tied to the surrounding content.
 * Ported from the design system.
 *
 * `warning` is a local addition — see `styles/ds/extensions.css` and ADR 0003.
 */
export type AlertVariant = 'default' | 'destructive' | 'warning';

export interface AlertProps {
  variant?: AlertVariant;
  icon?: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Alert({
  variant = 'default',
  icon,
  title,
  action,
  className = '',
  children,
}: AlertProps) {
  return (
    <div
      className={['ds-alert', className].filter(Boolean).join(' ')}
      data-variant={variant}
      role="alert"
    >
      {icon}
      {title ? <div className="ds-alert-title">{title}</div> : null}
      {children ? <div className="ds-alert-description">{children}</div> : null}
      {action ? <div className="ds-alert-action">{action}</div> : null}
    </div>
  );
}
