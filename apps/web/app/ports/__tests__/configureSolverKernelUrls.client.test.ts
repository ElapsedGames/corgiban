import { describe, expect, it } from 'vitest';

import { applySolverKernelUrls, readSolverKernelUrls } from '../configureSolverKernelUrls.client';

const locationHost = {
  location: {
    origin: 'https://corgiban.test',
  },
};

describe('configureSolverKernelUrls.client', () => {
  it('returns null when no kernel URLs are configured', () => {
    expect(readSolverKernelUrls({}, locationHost)).toBeNull();
    expect(
      readSolverKernelUrls(
        {
          VITE_SOLVER_KERNEL_REACHABILITY_URL: '   ',
          VITE_SOLVER_KERNEL_HASHING_URL: '',
        },
        locationHost,
      ),
    ).toBeNull();
  });

  it('accepts absolute URLs and app-root-relative paths, then normalizes them to absolute URLs', () => {
    expect(
      readSolverKernelUrls(
        {
          VITE_SOLVER_KERNEL_REACHABILITY_URL:
            ' https://cdn.example.com/kernels/reachability.wasm ',
          VITE_SOLVER_KERNEL_HASHING_URL: '/kernels/hashing.wasm?rev=1',
          VITE_SOLVER_KERNEL_ASSIGNMENT_URL: 'https://static.example.com/kernels/assignment.wasm',
        },
        locationHost,
      ),
    ).toEqual({
      reachabilityUrl: 'https://cdn.example.com/kernels/reachability.wasm',
      hashingUrl: 'https://corgiban.test/kernels/hashing.wasm?rev=1',
      assignmentUrl: 'https://static.example.com/kernels/assignment.wasm',
    });
  });

  it('rejects plain relative kernel URLs with a readable error', () => {
    expect(() =>
      readSolverKernelUrls(
        {
          VITE_SOLVER_KERNEL_REACHABILITY_URL: 'kernels/reachability.wasm',
        },
        locationHost,
      ),
    ).toThrowError(
      'Invalid VITE_SOLVER_KERNEL_REACHABILITY_URL: expected an absolute URL or an app-root-relative path starting with "/". Received "kernels/reachability.wasm".',
    );
  });

  it('ignores non-string environment values instead of treating them as configured URLs', () => {
    expect(
      readSolverKernelUrls(
        {
          VITE_SOLVER_KERNEL_REACHABILITY_URL: 123,
          VITE_SOLVER_KERNEL_HASHING_URL: false,
          VITE_SOLVER_KERNEL_ASSIGNMENT_URL: null,
        },
        locationHost,
      ),
    ).toBeNull();
  });

  it('trims location.origin before resolving app-root-relative kernel URLs', () => {
    expect(
      readSolverKernelUrls(
        {
          VITE_SOLVER_KERNEL_HASHING_URL: '/kernels/hashing.wasm',
        },
        {
          location: {
            origin: ' https://corgiban.test ',
          },
        },
      ),
    ).toEqual({
      reachabilityUrl: undefined,
      hashingUrl: 'https://corgiban.test/kernels/hashing.wasm',
      assignmentUrl: undefined,
    });
  });

  it('rejects app-root-relative URLs when location.origin is unavailable', () => {
    expect(() =>
      readSolverKernelUrls(
        {
          VITE_SOLVER_KERNEL_REACHABILITY_URL: '/kernels/reachability.wasm',
        },
        {
          location: {
            origin: '   ',
          },
        },
      ),
    ).toThrowError(
      'Cannot normalize VITE_SOLVER_KERNEL_REACHABILITY_URL without a location.origin; use an absolute URL instead.',
    );
  });

  it('writes normalized kernel URLs onto the worker global shape', () => {
    const host = {
      location: {
        origin: 'https://corgiban.test',
      },
    } as {
      __corgibanSolverKernelUrls?: Record<string, string | undefined>;
      location: {
        origin: string;
      };
    };

    const applied = applySolverKernelUrls(host, {
      VITE_SOLVER_KERNEL_REACHABILITY_URL: '/kernels/reachability.wasm',
    });

    expect(applied).toEqual({
      reachabilityUrl: 'https://corgiban.test/kernels/reachability.wasm',
      hashingUrl: undefined,
      assignmentUrl: undefined,
    });
    expect(host.__corgibanSolverKernelUrls).toEqual(applied);
  });

  it('clears any previous kernel configuration when no URLs are configured', () => {
    const host = {
      __corgibanSolverKernelUrls: {
        reachabilityUrl: 'https://corgiban.test/kernels/reachability.wasm',
      },
      location: {
        origin: 'https://corgiban.test',
      },
    };

    expect(applySolverKernelUrls(host, {})).toBeNull();
    expect(host.__corgibanSolverKernelUrls).toBeUndefined();
  });
});
