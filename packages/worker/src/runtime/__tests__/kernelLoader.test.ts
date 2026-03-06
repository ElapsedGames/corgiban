import { afterEach, describe, expect, it, vi } from 'vitest';

type KernelUrlHost = typeof globalThis & {
  __corgibanSolverKernelUrls?: {
    reachabilityUrl?: string;
    hashingUrl?: string;
    assignmentUrl?: string;
  };
};

async function importKernelLoaderWithMock(
  implementation: (url: string) => Promise<unknown> = async () => null,
) {
  const loadWasmKernel = vi.fn(implementation);
  vi.doMock('@corgiban/solver-kernels', () => ({
    loadWasmKernel,
  }));

  const module = await import('../kernelLoader');

  return {
    ...module,
    loadWasmKernel,
  };
}

describe('kernelLoader', () => {
  afterEach(() => {
    const host = globalThis as KernelUrlHost;
    delete host.__corgibanSolverKernelUrls;
    vi.doUnmock('@corgiban/solver-kernels');
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('resolves when no kernel URLs are configured', async () => {
    const { preloadSolverKernels, loadWasmKernel } = await importKernelLoaderWithMock();

    await expect(preloadSolverKernels()).resolves.toBeUndefined();
    expect(loadWasmKernel).not.toHaveBeenCalled();
  });

  it('loads only unique non-empty kernel URLs', async () => {
    const host = globalThis as KernelUrlHost;
    host.__corgibanSolverKernelUrls = {
      reachabilityUrl: '/kernels/reachability.wasm',
      hashingUrl: '/kernels/reachability.wasm',
      assignmentUrl: '/kernels/assignment.wasm',
    };

    const { preloadSolverKernels, loadWasmKernel } = await importKernelLoaderWithMock();

    await preloadSolverKernels();

    expect(loadWasmKernel).toHaveBeenCalledTimes(2);
    expect(loadWasmKernel).toHaveBeenCalledWith('/kernels/reachability.wasm');
    expect(loadWasmKernel).toHaveBeenCalledWith('/kernels/assignment.wasm');
  });

  it('treats kernel loading failures as best-effort and keeps resolving', async () => {
    const host = globalThis as KernelUrlHost;
    host.__corgibanSolverKernelUrls = {
      reachabilityUrl: '/kernels/reachability.wasm',
      assignmentUrl: '/kernels/assignment.wasm',
    };

    const { preloadSolverKernels, loadWasmKernel } = await importKernelLoaderWithMock(
      async (url) => {
        if (url.endsWith('assignment.wasm')) {
          throw new Error('load failed');
        }
        return null;
      },
    );

    await expect(preloadSolverKernels()).resolves.toBeUndefined();
    expect(loadWasmKernel).toHaveBeenCalledTimes(2);
  });

  it('memoizes preload work and reuses the same promise', async () => {
    const host = globalThis as KernelUrlHost;
    host.__corgibanSolverKernelUrls = {
      reachabilityUrl: '/kernels/reachability.wasm',
    };

    let resolveLoad: () => void = () => {};
    const pendingLoad = new Promise<void>((resolve) => {
      resolveLoad = () => resolve();
    });

    const { preloadSolverKernels, loadWasmKernel } = await importKernelLoaderWithMock(
      async () => pendingLoad,
    );

    const first = preloadSolverKernels();
    const second = preloadSolverKernels();

    expect(second).toBe(first);
    expect(loadWasmKernel).toHaveBeenCalledTimes(1);

    resolveLoad();
    await expect(first).resolves.toBeUndefined();
  });
});
