type SolverKernelUrlConfig = {
  reachabilityUrl?: string;
  hashingUrl?: string;
  assignmentUrl?: string;
};

type SolverKernelUrlEnv = {
  VITE_SOLVER_KERNEL_REACHABILITY_URL?: unknown;
  VITE_SOLVER_KERNEL_HASHING_URL?: unknown;
  VITE_SOLVER_KERNEL_ASSIGNMENT_URL?: unknown;
};

type SolverKernelUrlLocationHost = {
  location?: {
    origin?: unknown;
  };
};

type SolverKernelUrlHost = SolverKernelUrlLocationHost & {
  __corgibanSolverKernelUrls?: SolverKernelUrlConfig;
};

function readDefaultEnv(): SolverKernelUrlEnv {
  return (import.meta.env ?? {}) as SolverKernelUrlEnv;
}

function readLocationOrigin(host: SolverKernelUrlLocationHost): string | null {
  const origin = host.location?.origin;
  if (typeof origin !== 'string') {
    return null;
  }

  const trimmedOrigin = origin.trim();
  return trimmedOrigin.length > 0 ? trimmedOrigin : null;
}

function isAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isAppRootRelativePath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

function normalizeUrl(
  value: unknown,
  envKey: keyof SolverKernelUrlEnv,
  locationOrigin: string | null,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (isAbsoluteUrl(trimmed)) {
    return new URL(trimmed).href;
  }

  if (isAppRootRelativePath(trimmed)) {
    if (locationOrigin === null) {
      throw new Error(
        `Cannot normalize ${envKey} without a location.origin; use an absolute URL instead.`,
      );
    }

    return new URL(trimmed, locationOrigin).href;
  }

  throw new Error(
    `Invalid ${envKey}: expected an absolute URL or an app-root-relative path starting with "/". Received "${trimmed}".`,
  );
}

export function readSolverKernelUrls(
  env: SolverKernelUrlEnv = readDefaultEnv(),
  host: SolverKernelUrlLocationHost = globalThis as SolverKernelUrlLocationHost,
): SolverKernelUrlConfig | null {
  const locationOrigin = readLocationOrigin(host);
  const config: SolverKernelUrlConfig = {
    reachabilityUrl: normalizeUrl(
      env.VITE_SOLVER_KERNEL_REACHABILITY_URL,
      'VITE_SOLVER_KERNEL_REACHABILITY_URL',
      locationOrigin,
    ),
    hashingUrl: normalizeUrl(
      env.VITE_SOLVER_KERNEL_HASHING_URL,
      'VITE_SOLVER_KERNEL_HASHING_URL',
      locationOrigin,
    ),
    assignmentUrl: normalizeUrl(
      env.VITE_SOLVER_KERNEL_ASSIGNMENT_URL,
      'VITE_SOLVER_KERNEL_ASSIGNMENT_URL',
      locationOrigin,
    ),
  };

  return Object.values(config).some((value) => value !== undefined) ? config : null;
}

export function applySolverKernelUrls(
  host: SolverKernelUrlHost,
  env: SolverKernelUrlEnv = readDefaultEnv(),
): SolverKernelUrlConfig | null {
  const config = readSolverKernelUrls(env, host);
  if (config) {
    host.__corgibanSolverKernelUrls = config;
    return config;
  }

  delete host.__corgibanSolverKernelUrls;
  return null;
}

applySolverKernelUrls(globalThis as SolverKernelUrlHost);
