import { afterEach, describe, expect, it, vi } from 'vitest';

import { importTextFile } from '../fileAccess.client';

describe('fileAccess.client settled guards', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores duplicate successful onchange callbacks after settle', async () => {
    const removeChild = vi.fn();
    const input = {
      type: '',
      accept: '',
      style: { display: '' },
      files: [{ name: 'first.json' }],
      onchange: null as null | (() => void),
      click() {
        // No-op. Selection is triggered manually by the test.
      },
    };

    class FileReaderMock {
      result: string | null = null;
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;

      readAsText(_file: unknown) {
        this.result = '{"ok":true}';
        this.onload?.();
      }
    }

    vi.stubGlobal('showOpenFilePicker', undefined);
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'input') {
          return input;
        }
        throw new Error(`Unexpected element tag ${tag}`);
      },
      body: {
        appendChild: vi.fn(),
        removeChild,
      },
    });
    vi.stubGlobal('FileReader', FileReaderMock);

    const importPromise = importTextFile();
    input.onchange?.();

    await expect(importPromise).resolves.toEqual({
      content: '{"ok":true}',
      method: 'file-input',
    });

    // Trigger another resolve attempt after the promise has already settled.
    input.onchange?.();
    expect(removeChild).toHaveBeenCalledTimes(1);
  });

  it('ignores duplicate cancel callbacks after rejection settles', async () => {
    const removeChild = vi.fn();
    const input = {
      type: '',
      accept: '',
      style: { display: '' },
      files: [] as unknown[],
      onchange: null as null | (() => void),
      oncancel: null as null | (() => void),
      click() {
        // No-op. Cancellation is triggered manually by the test.
      },
    };

    vi.stubGlobal('showOpenFilePicker', undefined);
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'input') {
          return input;
        }
        throw new Error(`Unexpected element tag ${tag}`);
      },
      body: {
        appendChild: vi.fn(),
        removeChild,
      },
    });
    vi.stubGlobal('FileReader', class {});

    const importPromise = importTextFile();
    input.oncancel?.();
    await expect(importPromise).rejects.toThrow('No file selected.');

    // Trigger a second rejection attempt after settle.
    input.oncancel?.();
    expect(removeChild).toHaveBeenCalledTimes(1);
  });
});
