// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Direction } from '@corgiban/shared';

import { SequenceInput, type SequenceApplyResult } from '../SequenceInput';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];

function findInput(container: HTMLElement): HTMLInputElement {
  const label = Array.from(container.querySelectorAll('label')).find(
    (element) => element.textContent?.trim() === 'Sequence input',
  );
  if (!(label instanceof HTMLLabelElement)) {
    throw new Error('Sequence input label not found.');
  }

  const input = container.ownerDocument.getElementById(label.htmlFor);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Sequence input field not found.');
  }

  return input;
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (element) => element.textContent?.trim() === label,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button "${label}" not found.`);
  }

  return button;
}

function findForm(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector('form');
  if (!(form instanceof HTMLFormElement)) {
    throw new Error('Sequence form not found.');
  }

  return form;
}

function getLiveMessage(container: HTMLElement): HTMLParagraphElement | null {
  const message = container.querySelector('[aria-live]');
  return message instanceof HTMLParagraphElement ? message : null;
}

async function renderSequenceInput(
  onApplySequence: (directions: Direction[]) => SequenceApplyResult = () => ({
    applied: 1,
    stoppedAt: null,
  }),
) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<SequenceInput onApplySequence={onApplySequence} />);
  });

  return container;
}

async function setInputValue(container: HTMLElement, value: string) {
  const input = findInput(container);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function createApplySequenceSpy(result: SequenceApplyResult) {
  return vi.fn((directions: Direction[]): SequenceApplyResult => {
    void directions;
    return result;
  });
}

async function submitForm(container: HTMLElement) {
  const form = findForm(container);
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

describe('SequenceInput', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
  });

  it('renders the labelled input, submit button, and hint text with no status message initially', async () => {
    const container = await renderSequenceInput();

    expect(findInput(container).placeholder).toBe('UDLR sequence');
    expect(findButton(container, 'Apply Moves')).toBeTruthy();
    expect(container.textContent).toContain(
      'Whitespace is ignored. Invalid characters are rejected.',
    );
    expect(getLiveMessage(container)).toBeNull();
  });

  it('parses lowercase input, ignores whitespace, and submits uppercase directions', async () => {
    const onApplySequence = createApplySequenceSpy({
      applied: 4,
      stoppedAt: null,
    });
    const container = await renderSequenceInput(onApplySequence);

    await setInputValue(container, ' u d \n l\tR ');
    await submitForm(container);

    expect(onApplySequence).toHaveBeenCalledTimes(1);
    expect(onApplySequence).toHaveBeenCalledWith(['U', 'D', 'L', 'R']);
    expect(getLiveMessage(container)?.textContent).toBe('Applied 4 moves.');
  });

  it('submits through the Apply Moves button click path', async () => {
    const onApplySequence = createApplySequenceSpy({
      applied: 1,
      stoppedAt: null,
    });
    const container = await renderSequenceInput(onApplySequence);

    await setInputValue(container, 'R');
    await act(async () => {
      findButton(container, 'Apply Moves').click();
    });

    expect(onApplySequence).toHaveBeenCalledTimes(1);
    expect(onApplySequence).toHaveBeenCalledWith(['R']);
    expect(getLiveMessage(container)?.textContent).toBe('Applied 1 moves.');
  });

  it('rejects invalid characters and does not call the apply handler', async () => {
    const onApplySequence = createApplySequenceSpy({
      applied: 1,
      stoppedAt: null,
    });
    const container = await renderSequenceInput(onApplySequence);

    await setInputValue(container, 'UDx');
    await submitForm(container);

    expect(onApplySequence).not.toHaveBeenCalled();
    expect(getLiveMessage(container)?.textContent).toBe('Invalid character "x".');
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('rejects submissions that contain only whitespace', async () => {
    const onApplySequence = createApplySequenceSpy({
      applied: 1,
      stoppedAt: null,
    });
    const container = await renderSequenceInput(onApplySequence);

    await setInputValue(container, '  \n\t  ');
    await submitForm(container);

    expect(onApplySequence).not.toHaveBeenCalled();
    expect(getLiveMessage(container)?.textContent).toBe('Enter a UDLR sequence to apply.');
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('surfaces a no-moves-applied result as an assertive error', async () => {
    const onApplySequence = createApplySequenceSpy({
      applied: 0,
      stoppedAt: null,
    });
    const container = await renderSequenceInput(onApplySequence);

    await setInputValue(container, 'L');
    await submitForm(container);

    expect(onApplySequence).toHaveBeenCalledWith(['L']);
    expect(getLiveMessage(container)?.textContent).toBe('No moves applied.');
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('reports the stopped step for partial application results', async () => {
    const onApplySequence = createApplySequenceSpy({
      applied: 2,
      stoppedAt: 2,
    });
    const container = await renderSequenceInput(onApplySequence);

    await setInputValue(container, 'U D L');
    await submitForm(container);

    expect(onApplySequence).toHaveBeenCalledWith(['U', 'D', 'L']);
    expect(getLiveMessage(container)?.textContent).toBe('Stopped at step 3 of 3.');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('renders success messages politely when all moves apply', async () => {
    const container = await renderSequenceInput(() => ({
      applied: 3,
      stoppedAt: null,
    }));

    await setInputValue(container, 'UDL');
    await submitForm(container);

    const message = getLiveMessage(container);
    expect(message?.textContent).toBe('Applied 3 moves.');
    expect(message?.getAttribute('aria-live')).toBe('polite');
    expect(message?.getAttribute('role')).toBeNull();
  });

  it('replaces an earlier error with a later success message', async () => {
    const onApplySequence = createApplySequenceSpy({
      applied: 2,
      stoppedAt: null,
    });
    const container = await renderSequenceInput(onApplySequence);

    await setInputValue(container, 'bad!');
    await submitForm(container);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();

    await setInputValue(container, 'LR');
    await submitForm(container);

    const message = getLiveMessage(container);
    expect(onApplySequence).toHaveBeenCalledTimes(1);
    expect(message?.textContent).toBe('Applied 2 moves.');
    expect(message?.getAttribute('role')).toBeNull();
  });

  it('replaces an earlier success with a later validation error', async () => {
    const onApplySequence = createApplySequenceSpy({
      applied: 1,
      stoppedAt: null,
    });
    const container = await renderSequenceInput(onApplySequence);

    await setInputValue(container, 'U');
    await submitForm(container);
    expect(getLiveMessage(container)?.textContent).toBe('Applied 1 moves.');

    await setInputValue(container, 'U?');
    await submitForm(container);

    expect(onApplySequence).toHaveBeenCalledTimes(1);
    expect(getLiveMessage(container)?.textContent).toBe('Invalid character "?".');
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
});
