import type { LabelHTMLAttributes, ReactNode } from 'react';

/** Form control label. Ported from the design system. */
export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children?: ReactNode;
}

export function Label({ className = '', children, ...props }: LabelProps) {
  return (
    <label className={['ds-label', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </label>
  );
}
