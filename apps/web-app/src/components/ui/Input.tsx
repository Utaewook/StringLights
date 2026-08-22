import type { InputHTMLAttributes } from 'react';

/** Single-line text field. Ported from the design system. */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className = '', invalid = false, ...props }: InputProps) {
  return (
    <input
      className={['ds-input', className].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}
