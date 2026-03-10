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
  document.body.appendChild(container);

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
  // Reset inline overflow styles so scroll-lock tests start from a clean slate.
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
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

  it('wraps Tab from the dialog container to the first focusable element', async () => {
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

    const dialog = getDialog(container);
    const closeButton = getButtonByAriaLabel(container, 'Close dialog');

    await act(async () => {
      dialog.focus();
    });

    const event = dispatchKeyDown(dialog, { key: 'Tab' });

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton);
  });

  it('wraps Shift+Tab from the dialog container to the last focusable element', async () => {
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

    const dialog = getDialog(container);
    const exportButton = getButtonByText(container, 'Export');

    await act(async () => {
      dialog.focus();
    });

    const event = dispatchKeyDown(dialog, { key: 'Tab', shiftKey: true });

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

  it('sets overflow:hidden on both body and html when opened', async () => {
    await renderIntoDocument(<Dialog open={true} title="Scroll test" onClose={() => {}} />);

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('restores body and html overflow to the previous values when closed', async () => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'scroll';

    const dialogContainer = document.createElement('div');
    document.body.appendChild(dialogContainer);
    const dialogRoot = createRoot(dialogContainer);
    mountedRoots.push(dialogRoot);

    await act(async () => {
      dialogRoot.render(<Dialog open={true} title="Scroll test" onClose={() => {}} />);
    });

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    await act(async () => {
      dialogRoot.render(<Dialog open={false} title="Scroll test" onClose={() => {}} />);
    });

    expect(document.body.style.overflow).toBe('auto');
    expect(document.documentElement.style.overflow).toBe('scroll');
  });

  it('keeps scroll lock active while a second dialog is still open', async () => {
    const containerA = document.createElement('div');
    document.body.appendChild(containerA);
    const rootA = createRoot(containerA);
    mountedRoots.push(rootA);

    const containerB = document.createElement('div');
    document.body.appendChild(containerB);
    const rootB = createRoot(containerB);
    mountedRoots.push(rootB);

    // Open both dialogs.
    await act(async () => {
      rootA.render(<Dialog open={true} title="Dialog A" onClose={() => {}} />);
      rootB.render(<Dialog open={true} title="Dialog B" onClose={() => {}} />);
    });

    expect(document.body.style.overflow).toBe('hidden');

    // Close only the first dialog -- scroll must stay locked.
    await act(async () => {
      rootA.render(<Dialog open={false} title="Dialog A" onClose={() => {}} />);
    });

    expect(document.body.style.overflow).toBe('hidden');

    // Close the second dialog -- scroll lock should now be released.
    await act(async () => {
      rootB.render(<Dialog open={false} title="Dialog B" onClose={() => {}} />);
    });

    expect(document.body.style.overflow).toBe('');
  });

  it('restores focus to the trigger element when the dialog closes', async () => {
    // Render a trigger button outside the dialog container.
    const triggerContainer = document.createElement('div');
    document.body.appendChild(triggerContainer);
    const triggerRoot = createRoot(triggerContainer);
    mountedRoots.push(triggerRoot);

    await act(async () => {
      triggerRoot.render(<button type="button">Open dialog</button>);
    });

    const triggerButton = triggerContainer.querySelector('button') as HTMLButtonElement;
    await act(async () => {
      triggerButton.focus();
    });
    expect(document.activeElement).toBe(triggerButton);

    // Open the dialog -- focus moves into the dialog.
    const dialogContainer = document.createElement('div');
    document.body.appendChild(dialogContainer);
    const dialogRoot = createRoot(dialogContainer);
    mountedRoots.push(dialogRoot);

    await act(async () => {
      dialogRoot.render(<Dialog open={true} title="Export" onClose={() => {}} />);
    });

    // Focus should now be inside the dialog.
    expect(document.activeElement).not.toBe(triggerButton);

    // Close the dialog by re-rendering with open=false.
    await act(async () => {
      dialogRoot.render(<Dialog open={false} title="Export" onClose={() => {}} />);
    });

    // Focus must be restored to the trigger button (WCAG 2.4.3).
    expect(document.activeElement).toBe(triggerButton);
  });
});
