import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadWasmKernel } from '../wasmLoader';

describe('loadWasmKernel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns null when fetch is unavailable', async () => {
    await expect(
      loadWasmKernel('/kernel.wasm', { fetchImpl: null as unknown as typeof fetch }),
    ).resolves.toBeNull();
  });

  it('throws when response is not ok', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(new Uint8Array([]), {
          status: 404,
        }),
    );

    await expect(loadWasmKernel('/missing.wasm', { fetchImpl })).rejects.toThrow('Failed to fetch');
  });

  it('uses instantiateStreaming when available', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(new Uint8Array([0, 1, 2]), {
          status: 200,
        }),
    );

    const streamedModule = {
      instance: { kind: 'stream-instance' },
      module: { kind: 'stream-module' },
    };

    const instantiateStreaming = vi.fn(async () => streamedModule);
    const instantiate = vi.fn(async () => ({
      instance: { kind: 'array-instance' },
      module: { kind: 'array-module' },
    }));
    const compile = vi.fn(async () => ({ kind: 'compiled-module' }));
    vi.stubGlobal('WebAssembly', {
      instantiateStreaming,
      instantiate,
      compile,
    });

    const imports = {
      env: {
        memoryBase: 0,
      },
    };
    const result = await loadWasmKernel('/kernel.wasm', { fetchImpl, imports });

    expect(fetchImpl).toHaveBeenCalledWith('/kernel.wasm');
    expect(instantiateStreaming).toHaveBeenCalledTimes(1);
    expect(instantiateStreaming).toHaveBeenCalledWith(expect.any(Response), imports);
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
    expect(result).toEqual(streamedModule);
  });

  it('falls back to array-buffer instantiate when streaming instantiate fails', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(new Uint8Array([0, 1, 2]), {
          status: 200,
        }),
    );

    const instantiateStreaming = vi.fn(async () => {
      throw new Error('streaming not supported');
    });
    const instantiatedModule = {
      instance: { kind: 'array-instance' },
      module: { kind: 'array-module' },
    };
    const instantiate = vi.fn(async () => instantiatedModule);
    const compile = vi.fn(async () => ({ kind: 'compiled-module' }));
    vi.stubGlobal('WebAssembly', {
      instantiateStreaming,
      instantiate,
      compile,
    });

    const result = await loadWasmKernel('/kernel.wasm', {
      fetchImpl,
      imports: { env: { debug: true } },
    });

    expect(instantiateStreaming).toHaveBeenCalledTimes(1);
    expect(instantiate).toHaveBeenCalledTimes(1);
    expect(compile).not.toHaveBeenCalled();
    expect(result).toEqual(instantiatedModule);
  });

  it('uses compile fallback when instantiate returns only an instance', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(new Uint8Array([0, 1, 2]), {
          status: 200,
        }),
    );

    const instantiate = vi.fn(async () => ({ kind: 'instance-only' }));
    const compile = vi.fn(async () => ({ kind: 'compiled-module' }));
    vi.stubGlobal('WebAssembly', {
      instantiate,
      compile,
    });

    const result = await loadWasmKernel('/kernel.wasm', { fetchImpl });

    expect(instantiate).toHaveBeenCalledTimes(1);
    expect(compile).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      instance: { kind: 'instance-only' },
      module: { kind: 'compiled-module' },
    });
  });

  it('returns null when WebAssembly APIs are unavailable', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(new Uint8Array([0, 1, 2]), {
          status: 200,
        }),
    );
    vi.stubGlobal('WebAssembly', undefined as unknown);

    await expect(loadWasmKernel('/kernel.wasm', { fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
