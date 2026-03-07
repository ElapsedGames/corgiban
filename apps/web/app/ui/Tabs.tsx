import type { KeyboardEvent } from 'react';

export type TabItem = {
  id: string;
  label: string;
  disabled?: boolean;
};

export type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
};

export function Tabs({ items, value, onChange, ariaLabel, className }: TabsProps) {
  const containerClasses = [
    'inline-flex items-center gap-1 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-1',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // ARIA tabs pattern: arrow keys navigate between tabs (roving tabIndex).
  // Only enabled (non-disabled) tabs are reachable via arrow keys.
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    const enabled = items.map((item, i) => ({ item, i })).filter(({ item }) => !item.disabled);

    const enabledIndex = enabled.findIndex(({ i }) => i === currentIndex);
    if (enabledIndex === -1) return;

    let nextEnabledIndex: number | null = null;

    if (event.key === 'ArrowRight') {
      nextEnabledIndex = (enabledIndex + 1) % enabled.length;
    } else if (event.key === 'ArrowLeft') {
      nextEnabledIndex = (enabledIndex - 1 + enabled.length) % enabled.length;
    } else if (event.key === 'Home') {
      nextEnabledIndex = 0;
    } else if (event.key === 'End') {
      nextEnabledIndex = enabled.length - 1;
    }

    if (nextEnabledIndex !== null) {
      event.preventDefault();
      const target = enabled[nextEnabledIndex];
      onChange(target.item.id);
      // Move DOM focus to the newly selected tab button.
      const tabEl = document.getElementById(`tab-${target.item.id}`);
      tabEl?.focus();
    }
  }

  return (
    <div role="tablist" aria-label={ariaLabel} className={containerClasses}>
      {items.map((item, index) => {
        const selected = item.id === value;
        const tabClasses = [
          'rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]',
          selected
            ? 'bg-[color:var(--color-accent)] text-white'
            : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]',
          item.disabled ? 'cursor-not-allowed opacity-50' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className={tabClasses}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
