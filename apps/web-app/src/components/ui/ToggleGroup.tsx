import type { ReactNode } from 'react';

/**
 * Single-select toggle group. Ported from the design system.
 *
 * The source is a Radix wrapper supporting both `single` and `multiple` selection.
 * Only `single` is ported — nothing in this app multi-selects yet. Add `multiple`
 * when something does.
 */
export interface ToggleGroupItem<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Accessible name, for when `label` alone does not read as one. */
  title?: string;
}

export interface ToggleGroupProps<T extends string | number> {
  items: readonly ToggleGroupItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm';
  className?: string;
  'aria-label'?: string;
}

export function ToggleGroup<T extends string | number>({
  items,
  value,
  onValueChange,
  variant = 'default',
  size = 'default',
  className = '',
  ...props
}: ToggleGroupProps<T>) {
  return (
    <div
      className={['ds-toggle-group', className].filter(Boolean).join(' ')}
      data-variant={variant}
      role="group"
      {...props}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className="ds-toggle"
          data-size={size}
          data-state={item.value === value ? 'on' : 'off'}
          aria-pressed={item.value === value}
          title={item.title}
          onClick={() => onValueChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
