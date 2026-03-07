// @vitest-environment jsdom

import { act, useLayoutEffect, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dialog } from '../Dialog';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];

function DisableDialogButtonsOnMount() {
  useLayoutEffect(() => {
    document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button').forEach((button) => {
      button.disabled = true;
      button.tabIndex = -1;
    });
  }, []);

  return null;
}

async function renderIntoDocument(element: ReactElement) {
  const container = document.createElement('div');
  document.body.append(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(element);
  });

  return { container };
}

function getDialog(container: HTMLElement) {
  const dialog = container.querySelector('[role="dialog"]');
  expect(dialog).toBeInstanceOf(HTMLDivElement);
  return dialog as HTMLDivElement;
}

function getButtonByAriaLabel(container: HTMLElement, label: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(button).toBeInstanceOf(HTMLButtonElement);
  return button as HTMLButtonElement;
}

function getButtonByText(container: HTMLElement, text: string) {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  expect(button).toBeInstanceOf(HTMLButtonElement);
  return button as HTMLButtonElement;
}

function dispatchKeyDown(target: HTMLElement, options: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...options,
  });

  target.dispatchEvent(event);
  return event;
}

afterEach(async () => {
  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop();
    await act(async () => {
      root?.unmount();
    });
  }

  document.body.innerHTML = '';
});

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(<Dialog open={false} title="Test" onClose={() => {}} />);

    expect(html).toBe('');
  });

  it('renders role=dialog with aria-modal when open', () => {
    const html = renderToStaticMarkup(<Dialog open={true} title="Export" onClose={() => {}} />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it('sets aria-labelledby pointing to the title element', () => {
    const html = renderToStaticMarkup(
      <Dialog open={true} title="Export level pack" onClose={() => {}} />,
    );

    // Both the dialog div and the h2 must share the same id.
    const labelledById = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(labelledById).toBeDefined();
    expect(html).toContain(`id="${labelledById}"`);
    expect(html).toContain('Export level pack');
  });

  it('sets aria-describedby when description is provided', () => {
    const html = renderToStaticMarkup(
      <Dialog
        open={true}
        title="Export"
        description="Prepare a shareable bundle."
        onClose={() => {}}
      />,
    );

    const describedById = html.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(describedById).toBeDefined();
    expect(html).toContain(`id="${describedById}"`);
    expect(html).toContain('Prepare a shareable bundle.');
  });

  it('omits aria-describedby when no description is provided', () => {
    const html = renderToStaticMarkup(<Dialog open={true} title="Export" onClose={() => {}} />);

    expect(html).not.toContain('aria-describedby=');
  });

  it('renders a close button with aria-label="Close dialog"', () => {
    const html = renderToStaticMarkup(<Dialog open={true} title="Export" onClose={() => {}} />);

    expect(html).toContain('aria-label="Close dialog"');
  });

  it('renders tabIndex=-1 on dialog container to allow programmatic focus', () => {
    const html = renderToStaticMarkup(<Dialog open={true} title="Export" onClose={() => {}} />);

    expect(html).toContain('tabindex="-1"');
  });

  it('renders actions slot when provided', () => {
    const html = renderToStaticMarkup(
      <Dialog
        open={true}
        title="Confirm"
        onClose={() => {}}
        actions={<button type="button">Confirm</button>}
      />,
    );

    expect(html).toContain('Confirm');
  });

  it('renders children slot content', () => {
    const html = renderToStaticMarkup(
      <Dialog open={true} title="Info" onClose={() => {}}>
        <p>Dialog body text.</p>
      </Dialog>,
    );

    expect(html).toContain('Dialog body text.');
  });

  it('moves focus to the first focusable control when opened', async () => {
    const { container } = await renderIntoDocument(
      <Dialog open={true} title="Export" onClose={() => {}} />,
    );

    const closeButton = getButtonByAriaLabel(container, 'Close dialog');
    expect(document.activeElement).toBe(closeButton);
  });

  it('wraps Tab from the last focusable element back to the start of the dialog', async () => {
    const { container } = await renderIntoDocument(
      <Dialog
        open={true}
        title="Export"
        onClose={() => {}}
        actions={
          <>
            <button type="button">Cancel</button>
            <button type="button">Export</button>
          </>
        }
      >
        <label>
          Name
          <input type="text" />
        </label>
      </Dialog>,
    );

    const closeButton = getButtonByAriaLabel(container, 'Close dialog');
    const exportButton = getButtonByText(container, 'Export');

    await act(async () => {
      exportButton.focus();
    });

    const event = dispatchKeyDown(exportButton, { key: 'Tab' });

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton);
  });

  it('wraps Shift+Tab from the first focusable element to the end of the dialog', async () => {
    const { container } = await renderIntoDocument(
      <Dialog
        open={true}
        title="Export"
        onClose={() => {}}
        actions={
          <>
            <button type="button">Cancel</button>
            <button type="button">Export</button>
          </>
        }
      >
        <label>
          Name
          <input type="text" />
        </label>
      </Dialog>,
    );

    const closeButton = getButtonByAriaLabel(container, 'Close dialog');
    const exportButton = getButtonByText(container, 'Export');

    await act(async () => {
      closeButton.focus();
    });

    const event = dispatchKeyDown(closeButton, { key: 'Tab', shiftKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(exportButton);
  });

  it('keeps focus on the dialog container when no focusable descendants remain', async () => {
    const { container } = await renderIntoDocument(
      <Dialog open={true} title="Notice" onClose={() => {}}>
        <DisableDialogButtonsOnMount />
      </Dialog>,
    );

    const dialog = getDialog(container);
    expect(document.activeElement).toBe(dialog);

    const event = dispatchKeyDown(dialog, { key: 'Tab' });

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog);
  });

  it('calls onClose when Escape is pressed inside the dialog', async () => {
    const onClose = vi.fn();
    const { container } = await renderIntoDocument(
      <Dialog open={true} title="Export" onClose={onClose} />,
    );

    const dialog = getDialog(container);
    dispatchKeyDown(dialog, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
