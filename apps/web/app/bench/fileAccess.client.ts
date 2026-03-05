import { MAX_IMPORT_BYTES } from '@corgiban/shared';

type WritableFileStreamLike = {
  write: (data: Blob | string) => Promise<void>;
  close: () => Promise<void>;
};

type SaveFileHandleLike = {
  createWritable: () => Promise<WritableFileStreamLike>;
};

type OpenFileLike = {
  text: () => Promise<string>;
  size?: number;
};

type OpenFileHandleLike = {
  getFile: () => Promise<OpenFileLike>;
};

type SaveFilePicker = (options: {
  suggestedName?: string;
  types?: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<SaveFileHandleLike>;

type OpenFilePicker = (options: {
  multiple?: boolean;
  types?: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<OpenFileHandleLike[]>;

type AnchorLike = {
  href: string;
  download: string;
  click: () => void;
};

export type FileAccessApis = {
  showSaveFilePicker?: SaveFilePicker;
  showOpenFilePicker?: OpenFilePicker;
  createBlob?: (parts: BlobPart[], options?: BlobPropertyBag) => Blob;
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
  createAnchor?: () => AnchorLike;
  openTextWithInput?: (accept: string[]) => Promise<string>;
  scheduleRevoke?: (fn: () => void) => void;
};

export type ExportTextFileRequest = {
  suggestedName: string;
  content: string;
  mimeType?: string;
};

export type ImportTextFileRequest = {
  acceptMimeTypes?: string[];
};

export type FileExportMethod = 'file-system-access' | 'anchor-download';
export type FileImportMethod = 'file-system-access' | 'file-input';

const DEFAULT_MIME_TYPE = 'application/json';
const FILE_PICKER_DISMISS_TIMEOUT_MS = 30_000;

function buildTooLargeFileError(fileSize: number): Error {
  const maxMb = (MAX_IMPORT_BYTES / 1024 / 1024).toFixed(1);
  const fileMb = (fileSize / 1024 / 1024).toFixed(1);
  return new Error(`File too large (${fileMb} MB). Maximum is ${maxMb} MB.`);
}

function defaultApis(): FileAccessApis {
  return {
    showSaveFilePicker: (globalThis as unknown as { showSaveFilePicker?: SaveFilePicker })
      .showSaveFilePicker,
    showOpenFilePicker: (globalThis as unknown as { showOpenFilePicker?: OpenFilePicker })
      .showOpenFilePicker,
    createBlob: (parts, options) => new Blob(parts, options),
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    createAnchor: () => document.createElement('a'),
    openTextWithInput: (accept) => {
      return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        const host = globalThis as unknown as {
          addEventListener?: (event: 'focus', listener: () => void) => void;
          removeEventListener?: (event: 'focus', listener: () => void) => void;
        };

        let settled = false;
        let removed = false;
        let dismissTimeout: ReturnType<typeof setTimeout> | null = null;

        const cleanup = () => {
          if (dismissTimeout !== null) {
            clearTimeout(dismissTimeout);
            dismissTimeout = null;
          }
          if (typeof host.removeEventListener === 'function') {
            host.removeEventListener('focus', handleFocusReturn);
          }
          if (!removed) {
            removed = true;
            try {
              document.body.removeChild(input);
            } catch {
              // Ignore duplicate removals from browser-specific picker behavior.
            }
          }
        };

        const resolveOnce = (content: string) => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve(content);
        };

        const rejectOnce = (error: Error) => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          reject(error);
        };

        const rejectNoSelection = () => {
          rejectOnce(new Error('No file selected.'));
        };

        const handleFocusReturn = () => {
          setTimeout(() => {
            if (settled) {
              return;
            }
            if (!input.files?.[0]) {
              rejectNoSelection();
            }
          }, 0);
        };

        input.type = 'file';
        input.accept = accept.join(',');
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) {
            rejectNoSelection();
            return;
          }

          if (file.size > MAX_IMPORT_BYTES) {
            rejectOnce(buildTooLargeFileError(file.size));
            return;
          }

          const reader = new FileReader();
          reader.onerror = () => {
            rejectOnce(new Error('Failed to read file input.'));
          };
          reader.onload = () => {
            resolveOnce(typeof reader.result === 'string' ? reader.result : '');
          };
          reader.readAsText(file);
        };

        input.oncancel = () => {
          rejectNoSelection();
        };

        if (typeof host.addEventListener === 'function') {
          host.addEventListener('focus', handleFocusReturn);
        }
        dismissTimeout = setTimeout(() => {
          if (!settled && !input.files?.[0]) {
            rejectNoSelection();
          }
        }, FILE_PICKER_DISMISS_TIMEOUT_MS);

        input.click();
      });
    },
    scheduleRevoke: (fn) => setTimeout(fn, 0),
  };
}

function resolveApis(overrides?: FileAccessApis): FileAccessApis {
  return {
    ...defaultApis(),
    ...overrides,
  };
}

export function supportsSaveFilePicker(apis?: FileAccessApis): boolean {
  return typeof resolveApis(apis).showSaveFilePicker === 'function';
}

export function supportsOpenFilePicker(apis?: FileAccessApis): boolean {
  return typeof resolveApis(apis).showOpenFilePicker === 'function';
}

export async function exportTextFile(
  request: ExportTextFileRequest,
  apis?: FileAccessApis,
): Promise<FileExportMethod> {
  const resolvedApis = resolveApis(apis);
  const mimeType = request.mimeType ?? DEFAULT_MIME_TYPE;

  if (typeof resolvedApis.showSaveFilePicker === 'function') {
    const handle = await resolvedApis.showSaveFilePicker({
      suggestedName: request.suggestedName,
      types: [
        {
          description: 'JSON',
          accept: {
            [mimeType]: ['.json'],
          },
        },
      ],
    });

    const writable = await handle.createWritable();
    await writable.write(request.content);
    await writable.close();
    return 'file-system-access';
  }

  if (
    typeof resolvedApis.createBlob !== 'function' ||
    typeof resolvedApis.createObjectUrl !== 'function' ||
    typeof resolvedApis.revokeObjectUrl !== 'function' ||
    typeof resolvedApis.createAnchor !== 'function'
  ) {
    throw new Error('Anchor download fallback is unavailable in this environment.');
  }

  const blob = resolvedApis.createBlob([request.content], { type: mimeType });
  const url = resolvedApis.createObjectUrl(blob);
  const anchor = resolvedApis.createAnchor();

  let revoked = false;
  const doRevoke = () => {
    if (!revoked) {
      revoked = true;
      resolvedApis.revokeObjectUrl!(url);
    }
  };

  try {
    anchor.href = url;
    anchor.download = request.suggestedName;
    anchor.click();
    (resolvedApis.scheduleRevoke ?? ((fn) => setTimeout(fn, 0)))(doRevoke);
  } catch (error) {
    doRevoke();
    throw error;
  }

  return 'anchor-download';
}

export async function importTextFile(
  request: ImportTextFileRequest = {},
  apis?: FileAccessApis,
): Promise<{ content: string; method: FileImportMethod }> {
  const resolvedApis = resolveApis(apis);
  const acceptMimeTypes = request.acceptMimeTypes ?? [
    DEFAULT_MIME_TYPE,
    'application/octet-stream',
  ];

  if (typeof resolvedApis.showOpenFilePicker === 'function') {
    const handles = await resolvedApis.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: 'JSON',
          accept: {
            'application/json': ['.json'],
          },
        },
      ],
    });

    const handle = handles[0];
    if (!handle) {
      throw new Error('No file selected.');
    }

    const file = await handle.getFile();
    if (typeof file.size === 'number' && file.size > MAX_IMPORT_BYTES) {
      throw buildTooLargeFileError(file.size);
    }
    return { content: await file.text(), method: 'file-system-access' };
  }

  if (typeof resolvedApis.openTextWithInput !== 'function') {
    throw new Error('File input fallback is unavailable in this environment.');
  }

  return {
    content: await resolvedApis.openTextWithInput(acceptMimeTypes),
    method: 'file-input',
  };
}
