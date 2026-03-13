import { afterEach, describe, expect, it, vi } from 'vitest';

function installRouteMocks() {
  vi.doMock('../../play/PlayPage', () => ({
    PlayPage: () => <div>play-page-stub</div>,
  }));

  vi.doMock('../../ports/solverPort.client', () => ({
    createSolverPort: vi.fn(),
  }));

  vi.doMock('../../ports/solverPort', () => ({
    createNoopSolverPort: vi.fn(),
  }));

  vi.doMock('../../state', () => ({
    createAppStore: vi.fn(),
  }));

  vi.doMock('../../state/mutableDependencies', () => ({
    createMutableSolverPort: vi.fn(),
  }));
}

async function importPlayRouteWithDocument(documentValue: Document | undefined) {
  vi.resetModules();
  installRouteMocks();

  if (documentValue === undefined) {
    vi.stubGlobal('document', undefined as never);
  } else {
    vi.stubGlobal('document', documentValue);
  }

  return import('../play');
}

describe('PlayRoute import modes', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('imports successfully when the module is evaluated without a document global', async () => {
    const module = await importPlayRouteWithDocument(undefined);

    expect(typeof module.default).toBe('function');
    expect(typeof module.ErrorBoundary).toBe('function');
  });

  it('imports successfully when the module is evaluated with a document global', async () => {
    const module = await importPlayRouteWithDocument({} as Document);

    expect(typeof module.default).toBe('function');
    expect(typeof module.ErrorBoundary).toBe('function');
  });
});
