import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import { IconButton } from './IconButton';

const FOCUSABLE_SELECTOR = [
  'button',
  '[href]',
  'input',
  'select',
  'textarea',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      if (element.tabIndex < 0) {
        return false;
      }

      if (element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') {
        return false;
      }

      if (element instanceof HTMLInputElement && element.type === 'hidden') {
        return false;
      }

      return !element.hasAttribute('inert');
    },
  );
}

// Module-level state tracks how many dialogs are currently open so the scroll
// lock is only removed when the last dialog closes (prevents a race when two
// dialogs are open simultaneously).
let openDialogCount = 0;
let savedBodyOverflow = '';
let savedHtmlOverflow = '';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  // Track the element that had focus before the dialog opened so we can
  // restore it when the dialog closes (WCAG 2.4.3 / APG modal pattern).
  const triggerRef = useRef<Element | null>(null);

  // Move focus into the dialog when it opens so screen readers and keyboard
  // users land inside the modal immediately. Save the pre-open active element
  // so focus can be restored when the dialog closes.
  useEffect(() => {
    if (!open) return;
    // Capture the element that currently has focus before we move away from it.
    triggerRef.current = document.activeElement;
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Focus the first focusable element; fall back to the dialog container itself.
    const focusable = getFocusableElements(dialog)[0];
    (focusable ?? dialog).focus();
    return () => {
      // Restore focus to the trigger when the dialog unmounts (i.e. closes).
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
      triggerRef.current = null;
    };
  }, [open]);

  // Lock body scroll while the dialog is open so the background page does not
  // scroll behind the modal overlay (standard modal UX / WCAG 2.1 2.1.2).
  // Both <body> and <html> are locked because iOS Safari ignores overflow:hidden
  // on <body> alone and requires it on the root element.
  // A module-level counter prevents a race when multiple dialogs are open at
  // the same time: the lock is only released when the last open dialog closes.
  useEffect(() => {
    if (!open) return;
    openDialogCount += 1;
    if (openDialogCount === 1) {
      savedBodyOverflow = document.body.style.overflow;
      savedHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
    return () => {
      openDialogCount -= 1;
      if (openDialogCount === 0) {
        document.body.style.overflow = savedBodyOverflow;
        document.documentElement.style.overflow = savedHtmlOverflow;
      }
    };
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const dialog = event.currentTarget;
    const focusable = getFocusableElements(dialog);

    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    const activeElement = dialog.ownerDocument.activeElement;

    if (event.shiftKey) {
      if (activeElement === firstFocusable || activeElement === dialog) {
        event.preventDefault();
        lastFocusable.focus();
      }
      return;
    }

    if (activeElement === lastFocusable || activeElement === dialog) {
      event.preventDefault();
      firstFocusable.focus();
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-lg rounded-app-lg border border-border bg-panel p-6 text-fg shadow-xl focus:outline-none"
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-muted">
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
        <div className="mt-4 text-sm text-fg">{children}</div>
        {actions ? <div className="mt-6 flex justify-end gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
