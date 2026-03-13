// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPlayableExactLevelKey } from '../../levels/playableIdentity';
import type { PlayableEntry } from '../../levels/temporaryLevelCatalog';
import { buildBenchHref, buildPlayHref } from '../../navigation/handoffLinks';
import { useLabOrchestration, type LabOrchestrationState } from '../useLabOrchestration';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const testState = vi.hoisted(() => ({
  latest: null as LabOrchestrationState | null,
  navigate: vi.fn(),
  upsertSessionPlayableEntry: vi.fn(),
}));

vi.mock('@remix-run/react', () => ({
  useNavigate: () => testState.navigate,
}));

vi.mock('../../levels/temporaryLevelCatalog', () => ({
  upsertSessionPlayableEntry: testState.upsertSessionPlayableEntry,
}));

vi.mock('../useLabOwnedPorts', () => ({
  useLabOwnedPorts: () => ({
    solverPortRef: { current: null },
    benchmarkPortRef: { current: null },
  }),
}));

vi.mock('../labKeyboard', () => ({
  subscribeLabKeyboardControls: () => () => undefined,
}));

const mountedRoots: Root[] = [];
const EDITED_LEVEL_INPUT = ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'].join('\n');

function HookHarness({ initialPlayable }: { initialPlayable?: PlayableEntry }) {
  testState.latest = useLabOrchestration(initialPlayable);
  return null;
}

async function renderHarness(initialPlayable?: PlayableEntry) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<HookHarness initialPlayable={initialPlayable} />);
  });

  return { root };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useLabOrchestration publishing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    testState.latest = null;
    testState.navigate.mockReset();
    testState.upsertSessionPlayableEntry.mockReset();
    testState.upsertSessionPlayableEntry.mockImplementation(
      ({ ref, originRef, collectionRef, collectionIndex, level }) => ({
        ref: ref ?? 'temp:lab-session-1',
        source:
          originRef || collectionRef || typeof collectionIndex === 'number'
            ? {
                kind: 'session' as const,
                ...(originRef ? { originRef } : {}),
                ...(collectionRef ? { collectionRef } : {}),
                ...(typeof collectionIndex === 'number' ? { collectionIndex } : {}),
              }
            : { kind: 'session' as const },
        level,
      }),
    );
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }

    document.body.innerHTML = '';
  });

  it('does not publish session entries on mount or after parse-only commits', async () => {
    await renderHarness();

    expect(testState.upsertSessionPlayableEntry).not.toHaveBeenCalled();

    await act(async () => {
      testState.latest?.setInput(EDITED_LEVEL_INPUT);
    });
    await act(async () => {
      testState.latest?.applyParse();
    });
    await flushPromises();

    expect(testState.upsertSessionPlayableEntry).not.toHaveBeenCalled();
  });

  it('publishes only on explicit handoff actions and reuses the same session ref after edits', async () => {
    const builtinPlayable: PlayableEntry = {
      ref: 'builtin:lab-builtin',
      source: { kind: 'builtin' },
      level: {
        id: 'lab-builtin',
        name: 'Builtin Lab Level',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
      },
    };

    await renderHarness(builtinPlayable);

    await act(async () => {
      testState.latest?.openInPlay();
    });

    expect(testState.upsertSessionPlayableEntry).toHaveBeenCalledTimes(1);
    expect(testState.upsertSessionPlayableEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        ref: undefined,
        originRef: 'builtin:lab-builtin',
        level: expect.objectContaining({
          ...builtinPlayable.level,
          knownSolution: null,
        }),
      }),
    );
    expect(testState.navigate).toHaveBeenCalledWith(
      buildPlayHref({
        levelRef: 'temp:lab-session-1',
        levelId: 'lab-builtin',
        exactLevelKey: createPlayableExactLevelKey({
          ...builtinPlayable.level,
          knownSolution: null,
        }),
      }),
    );

    await act(async () => {
      testState.latest?.setInput(EDITED_LEVEL_INPUT);
    });
    await act(async () => {
      testState.latest?.applyParse();
    });
    await flushPromises();

    expect(testState.upsertSessionPlayableEntry).toHaveBeenCalledTimes(1);

    await act(async () => {
      testState.latest?.sendToBench();
    });

    expect(testState.upsertSessionPlayableEntry).toHaveBeenCalledTimes(2);
    expect(testState.upsertSessionPlayableEntry).toHaveBeenLastCalledWith({
      ref: 'temp:lab-session-1',
      originRef: 'builtin:lab-builtin',
      collectionRef: undefined,
      collectionIndex: undefined,
      level: {
        id: 'lab-level',
        name: 'Lab Level',
        rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
        knownSolution: null,
      },
    });
    expect(testState.navigate).toHaveBeenLastCalledWith(
      buildBenchHref({
        levelRef: 'temp:lab-session-1',
        levelId: 'lab-level',
        exactLevelKey: createPlayableExactLevelKey({
          id: 'lab-level',
          name: 'Lab Level',
          rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
          knownSolution: null,
        }),
      }),
    );
  });

  it('preserves imported pack collection metadata when republishing an edited session entry', async () => {
    const packedPlayable: PlayableEntry = {
      ref: 'temp:packed-entry-2',
      source: {
        kind: 'session',
        originRef: 'builtin:lab-pack-base',
        collectionRef: 'collection:bench-pack-1',
        collectionIndex: 1,
      },
      level: {
        id: 'lab-pack-base',
        name: 'Packed Lab Level',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
      },
    };

    await renderHarness(packedPlayable);

    await act(async () => {
      testState.latest?.setInput(EDITED_LEVEL_INPUT);
    });
    await act(async () => {
      testState.latest?.applyParse();
    });
    await flushPromises();

    await act(async () => {
      testState.latest?.openInPlay();
    });

    expect(testState.upsertSessionPlayableEntry).toHaveBeenCalledWith({
      ref: 'temp:packed-entry-2',
      originRef: 'builtin:lab-pack-base',
      collectionRef: 'collection:bench-pack-1',
      collectionIndex: 1,
      level: {
        id: 'lab-level',
        name: 'Lab Level',
        rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
        knownSolution: null,
      },
    });
    expect(testState.navigate).toHaveBeenLastCalledWith(
      buildPlayHref({
        levelRef: 'temp:packed-entry-2',
        levelId: 'lab-level',
        exactLevelKey: createPlayableExactLevelKey({
          id: 'lab-level',
          name: 'Lab Level',
          rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
          knownSolution: null,
        }),
      }),
    );
  });
});
