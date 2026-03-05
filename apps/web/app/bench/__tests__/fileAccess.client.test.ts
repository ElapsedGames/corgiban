import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_IMPORT_BYTES } from '@corgiban/shared';

import {
  exportTextFile,
  importTextFile,
  supportsOpenFilePicker,
  supportsSaveFilePicker,
} from '../fileAccess.client';

describe('fileAccess.client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports File System Access API support from injected APIs', () => {
    expect(supportsSaveFilePicker({})).toBe(false);
    expect(supportsSaveFilePicker({ showSaveFilePicker: vi.fn() })).toBe(true);
    expect(supportsOpenFilePicker({})).toBe(false);
    expect(supportsOpenFilePicker({ showOpenFilePicker: vi.fn() })).toBe(true);
  });

  it('passes suggested name and mime type to showSaveFilePicker', async () => {
    const showSaveFilePicker = vi.fn(async () => ({
      createWritable: async () => ({
        write: async () => undefined,
        close: async () => undefined,
      }),
    }));

    await expect(
      exportTextFile(
        {
          suggestedName: 'report.bench.json',
          content: '{"ok":true}',
          mimeType: 'application/vnd.test+json',
        },
        { showSaveFilePicker },
      ),
    ).resolves.toBe('file-system-access');

    expect(showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: 'report.bench.json',
      types: [
        {
          description: 'JSON',
          accept: {
            'application/vnd.test+json': ['.json'],
          },
        },
      ],
    });
  });

  it('throws when anchor fallback APIs are unavailable', async () => {
    await expect(
      exportTextFile(
        {
          suggestedName: 'report.json',
          content: '{}',
        },
        {
          showSaveFilePicker: undefined,
          createBlob: undefined,
          createObjectUrl: undefined,
          revokeObjectUrl: undefined,
          createAnchor: undefined,
        },
      ),
    ).rejects.toThrow('Anchor download fallback is unavailable');
  });

  it('always revokes object URL in anchor fallback even if click throws', async () => {
    const revokeObjectUrl = vi.fn();

    await expect(
      exportTextFile(
        {
          suggestedName: 'report.json',
          content: '{}',
        },
        {
          showSaveFilePicker: undefined,
          createBlob: (parts, options) => new Blob(parts, options),
          createObjectUrl: () => 'blob:temp',
          revokeObjectUrl,
          createAnchor: () =>
            ({
              href: '',
              download: '',
              click: () => {
                throw new Error('click failed');
              },
            }) as { href: string; download: string; click: () => void },
        },
      ),
    ).rejects.toThrow('click failed');

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:temp');
  });

  it('uses anchor fallback when file-system-access save picker is unavailable', async () => {
    const createObjectUrl = vi.fn(() => 'blob:ok');
    const revokeObjectUrl = vi.fn();
    const click = vi.fn();
    const anchor = { href: '', download: '', click };

    await expect(
      exportTextFile(
        {
          suggestedName: 'report.json',
          content: '{"ok":true}',
        },
        {
          showSaveFilePicker: undefined,
          createBlob: (parts, options) => new Blob(parts, options),
          createObjectUrl,
          revokeObjectUrl,
          createAnchor: () => anchor,
          scheduleRevoke: (fn) => fn(),
        },
      ),
    ).resolves.toBe('anchor-download');

    expect(anchor.href).toBe('blob:ok');
    expect(anchor.download).toBe('report.json');
    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:ok');
  });

  it('uses default global anchor fallback APIs when no overrides are provided', async () => {
    const click = vi.fn();
    const anchor = { href: '', download: '', click };
    const createObjectURL = vi.fn(() => 'blob:default');
    const revokeObjectURL = vi.fn();

    vi.stubGlobal('showSaveFilePicker', undefined);
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    });
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'a') {
          return anchor;
        }
        throw new Error(`Unexpected element tag ${tag}`);
      },
    });
    vi.stubGlobal('setTimeout', (fn: () => void, _delay?: number) => fn());

    await expect(
      exportTextFile({
        suggestedName: 'default.json',
        content: '{"default":true}',
      }),
    ).resolves.toBe('anchor-download');

    expect(anchor.href).toBe('blob:default');
    expect(anchor.download).toBe('default.json');
    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:default');
  });

  it('throws when file picker returns no selected handle', async () => {
    await expect(
      importTextFile(
        {},
        {
          showOpenFilePicker: vi.fn(async () => []),
        },
      ),
    ).rejects.toThrow('No file selected.');
  });

  it('throws when file input fallback is unavailable', async () => {
    await expect(
      importTextFile(
        {},
        {
          showOpenFilePicker: undefined,
          openTextWithInput: undefined,
        },
      ),
    ).rejects.toThrow('File input fallback is unavailable');
  });

  it('passes acceptMimeTypes to file-input fallback helper', async () => {
    const openTextWithInput = vi.fn(async () => '{"kind":"input"}');
    const result = await importTextFile(
      {
        acceptMimeTypes: ['application/json', 'text/plain'],
      },
      {
        showOpenFilePicker: undefined,
        openTextWithInput,
      },
    );

    expect(openTextWithInput).toHaveBeenCalledWith(['application/json', 'text/plain']);
    expect(result).toEqual({
      content: '{"kind":"input"}',
      method: 'file-input',
    });
  });

  it('imports text using the File System Access picker when available', async () => {
    await expect(
      importTextFile(
        {},
        {
          showOpenFilePicker: vi.fn(async () => [
            {
              getFile: async () => ({
                text: async () => '{"via":"picker"}',
              }),
            },
          ]),
        },
      ),
    ).resolves.toEqual({
      content: '{"via":"picker"}',
      method: 'file-system-access',
    });
  });

  it('uses default file-input fallback and resolves loaded text', async () => {
    const appendChild = vi.fn();
    const removeChild = vi.fn();
    const input = {
      type: '',
      accept: '',
      style: { display: '' },
      files: [{ name: 'data.json' }],
      onchange: null as null | (() => void),
      click() {
        this.onchange?.();
      },
    };

    class FileReaderMock {
      result: string | null = null;
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;

      readAsText(_file: unknown) {
        this.result = '{"from":"reader"}';
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
        appendChild,
        removeChild,
      },
    });
    vi.stubGlobal('FileReader', FileReaderMock);

    await expect(importTextFile()).resolves.toEqual({
      content: '{"from":"reader"}',
      method: 'file-input',
    });

    expect(input.type).toBe('file');
    expect(input.accept).toContain('application/json');
    expect(appendChild).toHaveBeenCalledWith(input);
    expect(removeChild).toHaveBeenCalledWith(input);
  });

  it('rejects default file-input fallback when no file is selected', async () => {
    const removeChild = vi.fn();
    const input = {
      type: '',
      accept: '',
      style: { display: '' },
      files: [] as unknown[],
      onchange: null as null | (() => void),
      click() {
        this.onchange?.();
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

    await expect(importTextFile()).rejects.toThrow('No file selected.');
    expect(removeChild).toHaveBeenCalledWith(input);
  });

  it('rejects default file-input fallback when file reading fails', async () => {
    const removeChild = vi.fn();
    const input = {
      type: '',
      accept: '',
      style: { display: '' },
      files: [{ name: 'bad.json' }],
      onchange: null as null | (() => void),
      click() {
        this.onchange?.();
      },
    };

    class FileReaderMock {
      result: string | null = null;
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;

      readAsText(_file: unknown) {
        this.onerror?.();
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

    await expect(importTextFile()).rejects.toThrow('Failed to read file input.');
    expect(removeChild).toHaveBeenCalledWith(input);
  });

  it('resolves empty content when default file-input reader returns a non-string result', async () => {
    const removeChild = vi.fn();
    const input = {
      type: '',
      accept: '',
      style: { display: '' },
      files: [{ name: 'binary.bin' }],
      onchange: null as null | (() => void),
      click() {
        this.onchange?.();
      },
    };

    class FileReaderMock {
      result: string | ArrayBuffer | null = null;
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;

      readAsText(_file: unknown) {
        this.result = new ArrayBuffer(8);
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

    await expect(importTextFile()).resolves.toEqual({
      content: '',
      method: 'file-input',
    });
    expect(removeChild).toHaveBeenCalledWith(input);
  });

  it('rejects file-input fallback when file exceeds size limit', async () => {
    const removeChild = vi.fn();
    const input = {
      type: '',
      accept: '',
      style: { display: '' },
      files: [{ name: 'huge.json', size: MAX_IMPORT_BYTES + 1 }],
      onchange: null as null | (() => void),
      click() {
        this.onchange?.();
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

    await expect(importTextFile()).rejects.toThrow(/too large/);
    expect(removeChild).toHaveBeenCalledWith(input);
  });

  it('rejects FSA picker path when file exceeds size limit', async () => {
    await expect(
      importTextFile(
        {},
        {
          showOpenFilePicker: vi.fn(async () => [
            {
              getFile: async () => ({
                text: async () => '{"big":true}',
                size: MAX_IMPORT_BYTES + 1,
              }),
            },
          ]),
        },
      ),
    ).rejects.toThrow(/too large/);
  });

  it('cleans up input element when cancel event fires', async () => {
    const removeChild = vi.fn();
    const input = {
      type: '',
      accept: '',
      style: { display: '' },
      files: [] as unknown[],
      onchange: null as null | (() => void),
      oncancel: null as null | (() => void),
      click() {
        this.oncancel?.();
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

    await expect(importTextFile()).rejects.toThrow();
    expect(removeChild).toHaveBeenCalledWith(input);
  });

  it('cleans up input element when picker closes without change/cancel and focus returns', async () => {
    const removeChild = vi.fn();
    const input = {
      type: '',
      accept: '',
      style: { display: '' },
      files: [] as unknown[],
      onchange: null as null | (() => void),
      oncancel: null as null | (() => void),
      click() {
        // Simulate a browser path where neither onchange nor oncancel fires.
      },
    };

    let focusListener: (() => void) | null = null;
    const removeFocusListener = vi.fn();
    let timeoutId = 0;
    const scheduledTimeouts = new Map<number, () => void>();

    vi.stubGlobal('addEventListener', (event: string, listener: () => void) => {
      if (event === 'focus') {
        focusListener = listener;
      }
    });
    vi.stubGlobal('removeEventListener', (event: string, listener: () => void) => {
      if (event === 'focus' && focusListener === listener) {
        focusListener = null;
        removeFocusListener();
      }
    });
    vi.stubGlobal('setTimeout', ((fn: () => void, delay?: number) => {
      timeoutId += 1;
      const nextId = timeoutId;
      if ((delay ?? 0) === 0) {
        fn();
      } else {
        scheduledTimeouts.set(nextId, fn);
      }
      return nextId;
    }) as unknown as typeof setTimeout);
    vi.stubGlobal('clearTimeout', ((id: number) => {
      scheduledTimeouts.delete(id);
    }) as unknown as typeof clearTimeout);
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
    expect(focusListener).not.toBeNull();

    if (!focusListener) {
      throw new Error('Expected a focus listener to be registered.');
    }
    (focusListener as () => void)();

    await expect(importPromise).rejects.toThrow('No file selected.');
    expect(removeChild).toHaveBeenCalledWith(input);
    expect(removeFocusListener).toHaveBeenCalledTimes(1);
  });

  it('ignores focus-return no-selection checks after a file load has already resolved', async () => {
    const removeChild = vi.fn();
    const input = {
      type: '',
      accept: '',
      style: { display: '' },
      files: [] as Array<{ name: string; size: number }>,
      onchange: null as null | (() => void),
      oncancel: null as null | (() => void),
      click() {
        // Triggered by importTextFile. Selection is simulated explicitly below.
      },
    };

    class FileReaderMock {
      result: string | null = null;
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;

      readAsText(_file: unknown) {
        this.result = '{"from":"resolved-before-focus-check"}';
        this.onload?.();
      }
    }

    let focusListener: (() => void) | null = null;
    let timeoutId = 0;
    const queuedTimeouts = new Map<number, () => void>();

    vi.stubGlobal('addEventListener', (event: string, listener: () => void) => {
      if (event === 'focus') {
        focusListener = listener;
      }
    });
    vi.stubGlobal('removeEventListener', vi.fn());
    vi.stubGlobal('setTimeout', ((fn: () => void) => {
      timeoutId += 1;
      queuedTimeouts.set(timeoutId, fn);
      return timeoutId;
    }) as unknown as typeof setTimeout);
    vi.stubGlobal('clearTimeout', ((id: number) => {
      queuedTimeouts.delete(id);
    }) as unknown as typeof clearTimeout);
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
    if (!focusListener) {
      throw new Error('Expected focus listener to be registered.');
    }

    const triggerFocusReturn = focusListener as () => void;
    triggerFocusReturn();
    input.files = [{ name: 'resolved.json', size: 8 }];
    input.onchange?.();

    await expect(importPromise).resolves.toEqual({
      content: '{"from":"resolved-before-focus-check"}',
      method: 'file-input',
    });

    for (const callback of queuedTimeouts.values()) {
      callback();
    }
    expect(removeChild).toHaveBeenCalledWith(input);
  });

  it('rejects when dismiss timeout fires before selection', async () => {
    const removeChild = vi.fn();
    const input = {
      type: '',
      accept: '',
      style: { display: '' },
      files: [] as unknown[],
      onchange: null as null | (() => void),
      oncancel: null as null | (() => void),
      click() {
        // Simulate no picker events.
      },
    };

    let timeoutId = 0;
    const queuedTimeouts = new Map<number, () => void>();

    vi.stubGlobal('showOpenFilePicker', undefined);
    vi.stubGlobal('addEventListener', undefined);
    vi.stubGlobal('removeEventListener', undefined);
    vi.stubGlobal('setTimeout', ((fn: () => void) => {
      timeoutId += 1;
      queuedTimeouts.set(timeoutId, fn);
      return timeoutId;
    }) as unknown as typeof setTimeout);
    vi.stubGlobal('clearTimeout', ((id: number) => {
      queuedTimeouts.delete(id);
    }) as unknown as typeof clearTimeout);
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
    const dismissTimeout = [...queuedTimeouts.values()].at(-1);
    if (!dismissTimeout) {
      throw new Error('Expected dismiss timeout callback.');
    }
    dismissTimeout();

    await expect(importPromise).rejects.toThrow('No file selected.');
    expect(removeChild).toHaveBeenCalledWith(input);
  });
});
