import { loadWasmKernel } from '@corgiban/solver-kernels';

type KernelConfig = {
  reachabilityUrl?: string;
  hashingUrl?: string;
  assignmentUrl?: string;
};

type KernelUrlHost = {
  __corgibanSolverKernelUrls?: KernelConfig;
};

let preloadPromise: Promise<void> | null = null;

function readKernelUrls(): string[] {
  const host = globalThis as unknown as KernelUrlHost;
  const urls = host.__corgibanSolverKernelUrls;
  if (!urls) {
    return [];
  }

  return [urls.reachabilityUrl, urls.hashingUrl, urls.assignmentUrl]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .filter((value, index, all) => all.indexOf(value) === index);
}

export function preloadSolverKernels(): Promise<void> {
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = (async () => {
    const urls = readKernelUrls();
    if (urls.length === 0) {
      return;
    }

    await Promise.all(
      urls.map(async (url) => {
        try {
          await loadWasmKernel(url);
        } catch {
          // Kernel loading is best-effort; the TS baseline remains the fallback path.
        }
      }),
    );
  })();

  return preloadPromise;
}
