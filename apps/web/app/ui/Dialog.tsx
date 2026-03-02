import { useId } from 'react';
import type { ReactNode } from 'react';

import { IconButton } from './IconButton';

export type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  actions?: ReactNode;
};

export function Dialog({ open, title, description, onClose, children, actions }: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative w-full max-w-lg rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-6 text-[color:var(--color-fg)] shadow-xl"
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-[color:var(--color-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton
            icon={<span aria-hidden="true">x</span>}
            label="Close dialog"
            onClick={onClose}
          />
        </div>
        <div className="mt-4 text-sm text-[color:var(--color-fg)]">{children}</div>
        {actions ? <div className="mt-6 flex justify-end gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
