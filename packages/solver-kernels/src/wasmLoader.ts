type WebAssemblyLike = {
  instantiateStreaming?: (
    source: Response,
    imports?: Record<string, unknown>,
  ) => Promise<{
    instance: unknown;
    module: unknown;
  }>;
  instantiate: (
    source: ArrayBuffer,
    imports?: Record<string, unknown>,
  ) => Promise<
    | {
        instance: unknown;
        module: unknown;
      }
    | unknown
  >;
  compile: (source: ArrayBuffer) => Promise<unknown>;
};

export type WasmKernelModule = {
  instance: unknown;
  module: unknown;
};

export type LoadWasmKernelOptions = {
  imports?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
};

function resolveWebAssembly(): WebAssemblyLike | null {
  const value = (globalThis as { WebAssembly?: WebAssemblyLike }).WebAssembly;
  if (!value || typeof value.instantiate !== 'function' || typeof value.compile !== 'function') {
    return null;
  }
  return value;
}

export async function loadWasmKernel(
  url: string,
  options: LoadWasmKernelOptions = {},
): Promise<WasmKernelModule | null> {
  const fetchImpl = Object.prototype.hasOwnProperty.call(options, 'fetchImpl')
    ? options.fetchImpl
    : globalThis.fetch;
  const wasm = resolveWebAssembly();
  if (typeof fetchImpl !== 'function' || !wasm) {
    return null;
  }

  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch WASM kernel (${response.status}).`);
  }

  const imports = options.imports ?? {};

  if (typeof wasm.instantiateStreaming === 'function') {
    try {
      const streamed = await wasm.instantiateStreaming(response.clone(), imports);
      return {
        instance: streamed.instance,
        module: streamed.module,
      };
    } catch {
      // Fall through to ArrayBuffer instantiation for non-streamable responses.
    }
  }

  const bytes = await response.arrayBuffer();
  const instantiated = await wasm.instantiate(bytes, imports);
  if (instantiated && typeof instantiated === 'object' && 'instance' in instantiated) {
    const withModule = instantiated as { instance: unknown; module: unknown };
    return {
      instance: withModule.instance,
      module: withModule.module,
    };
  }

  const module = await wasm.compile(bytes);
  return {
    instance: instantiated,
    module,
  };
}
