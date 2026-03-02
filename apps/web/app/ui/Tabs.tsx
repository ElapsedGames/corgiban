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

  return (
    <div role="tablist" aria-label={ariaLabel} className={containerClasses}>
      {items.map((item) => {
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
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
