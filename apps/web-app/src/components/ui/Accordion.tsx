import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Disclosure section. Ported from the design system.
 *
 * The source manages open state internally via `type="single" | "multiple"`. Here
 * it is a prop, because the inspector persists which sections are open across node
 * selections — internal state would reset on every click. The chevron rotation is
 * driven by `data-open`, exactly as in the source.
 */
export interface AccordionItemProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function AccordionItem({ title, isOpen, onToggle, children }: AccordionItemProps) {
  return (
    <div className="ds-accordion-item">
      <button
        type="button"
        className="ds-accordion-trigger"
        data-open={isOpen}
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        {title}
        <ChevronDown aria-hidden />
      </button>
      {isOpen && <div className="ds-accordion-content">{children}</div>}
    </div>
  );
}
