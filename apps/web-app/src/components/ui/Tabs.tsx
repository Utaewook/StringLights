import { useState, type ReactNode } from 'react';

/**
 * Tabbed section switcher. `default` is a muted pill track; `line` is an underline.
 * Ported from the design system.
 *
 * One deviation: the source always renders `.ds-tabs-content`, which carries `flex: 1`.
 * This app uses Tabs as a segmented control with no panel below it, and an empty
 * flex-grown div stretches the sidebar section. The content div is therefore rendered
 * only when there is something to put in it.
 */
export interface TabItem<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  content?: ReactNode;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  variant?: 'default' | 'line';
  className?: string;
  children?: ReactNode;
}

export function Tabs<T extends string = string>({
  tabs,
  value,
  defaultValue,
  onValueChange,
  variant = 'default',
  className = '',
  children,
}: TabsProps<T>) {
  const [internal, setInternal] = useState<T | undefined>(defaultValue ?? tabs[0]?.value);
  const current = value === undefined ? internal : value;
  const active = tabs.find((t) => t.value === current);
  const content = children ?? active?.content;

  return (
    <div className={['ds-tabs', className].filter(Boolean).join(' ')}>
      <div className="ds-tabs-list" data-variant={variant} role="tablist">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            className="ds-tabs-trigger"
            data-active={current === t.value}
            aria-selected={current === t.value}
            onClick={() => {
              if (value === undefined) setInternal(t.value);
              onValueChange?.(t.value);
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {content ? (
        <div className="ds-tabs-content" role="tabpanel">
          {content}
        </div>
      ) : null}
    </div>
  );
}
