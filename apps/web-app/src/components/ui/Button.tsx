import { cloneElement, isValidElement } from 'react';
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

/**
 * Primary interactive control. Ported from the design system.
 *
 * **Deviation.** The source implements `asChild` with Radix `Slot`. That would add
 * `@radix-ui/react-slot` as a dependency for a single call site, so it is hand-rolled
 * with `cloneElement` here. The merge order matches Slot's: the child's own props win
 * over the ones passed to `Button`, and `className` is concatenated rather than
 * replaced. Unlike Slot, this does not compose event handlers — nothing needs it yet,
 * and silently dropping one would be worse than not offering it.
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
  /**
   * Render the styling onto the child element instead of emitting a `<button>`.
   * Use it when the control is semantically something else — an `<a>` that has to
   * look like a button. The child must be a single element.
   */
  asChild?: boolean;
  children?: ReactNode;
}

/** Props the design system drives its button styling from. */
interface DsButtonProps {
  className?: string;
  'data-variant'?: ButtonVariant;
  'data-size'?: ButtonSize;
}

export function Button({
  variant = 'default',
  size = 'default',
  className = '',
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  const dsClassName = ['ds-btn', className].filter(Boolean).join(' ');

  if (asChild) {
    if (!isValidElement<DsButtonProps>(children)) {
      throw new Error('Button: asChild expects a single React element as its child.');
    }
    const child = children as ReactElement<DsButtonProps>;
    return cloneElement(child, {
      ...props,
      ...child.props,
      className: [dsClassName, child.props.className].filter(Boolean).join(' '),
      'data-variant': variant,
      'data-size': size,
    });
  }

  return (
    <button className={dsClassName} data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  );
}
