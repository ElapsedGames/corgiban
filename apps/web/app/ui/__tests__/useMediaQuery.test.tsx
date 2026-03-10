// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getMaxWidthMediaQuery } from '../responsive';
import { readMediaQueryMatch, useMediaQuery } from '../useMediaQuery';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

type MockMediaQueryList = MediaQueryList & {
  matches: boolean;
  emitChange: (matches: boolean) => void;
  listenerCount: () => number;
};

const mountedRoots: Root[] = [];

const hookState: { current: boolean | null } = {
  current: null,
};

const mediaQueryLists = new Map<string, MockMediaQueryList>();

function createMockMediaQueryList(query: string, matches: boolean): MockMediaQueryList {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const queryList = {
    matches,
    media: query,
    onchange: null as ((this: MediaQueryList, event: MediaQueryListEvent) => void) | null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject | null) => {
      if (typeof listener === 'function') {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      }
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject | null) => {
      if (typeof listener === 'function') {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      }
    },
    addListener: (
      listener: ((this: MediaQueryList, event: MediaQueryListEvent) => void) | null,
    ) => {
      if (!listener) {
        return;
      }
      listeners.add(listener);
    },
    removeListener: (
      listener: ((this: MediaQueryList, event: MediaQueryListEvent) => void) | null,
    ) => {
      if (!listener) {
        return;
      }
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
    emitChange: (nextMatches) => {
      queryList.matches = nextMatches;
      const event = { matches: nextMatches, media: query } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
    listenerCount: () => listeners.size,
  } as MockMediaQueryList;

  return queryList;
}

function getOrCreateMediaQueryList(query: string): MockMediaQueryList {
  const existing = mediaQueryLists.get(query);
  if (existing) {
    return existing;
  }

  const created = createMockMediaQueryList(query, false);
  mediaQueryLists.set(query, created);
  return created;
}

function seedMediaQuery(query: string, matches: boolean): MockMediaQueryList {
  const mediaQueryList = createMockMediaQueryList(query, matches);
  mediaQueryLists.set(query, mediaQueryList);
  return mediaQueryList;
}

function seedLegacyMediaQuery(query: string, matches: boolean): MockMediaQueryList {
  const mediaQueryList = createMockMediaQueryList(query, matches);
  mediaQueryList.addEventListener = undefined as unknown as MediaQueryList['addEventListener'];
  mediaQueryList.removeEventListener =
    undefined as unknown as MediaQueryList['removeEventListener'];
  mediaQueryLists.set(query, mediaQueryList);
  return mediaQueryList;
}

function MediaQueryHarness({ query }: { query: string }) {
  hookState.current = useMediaQuery(query);
  return null;
}

async function renderHarness(query: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<MediaQueryHarness query={query} />);
  });

  return root;
}

describe('useMediaQuery', () => {
  const query = getMaxWidthMediaQuery('lg');

  beforeEach(() => {
    document.body.innerHTML = '';
    hookState.current = null;
    mediaQueryLists.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((requestedQuery: string) => getOrCreateMediaQueryList(requestedQuery)),
    });
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
  });

  it('reads the current media query match after mount', async () => {
    seedMediaQuery(query, true);

    await renderHarness(query);

    expect(hookState.current).toBe(true);
  });

  it('reads a provided matchMedia result without relying on window.matchMedia', () => {
    const matchMedia = vi.fn((requestedQuery: string) =>
      createMockMediaQueryList(requestedQuery, requestedQuery === query),
    );

    expect(readMediaQueryMatch(query, matchMedia)).toBe(true);
    expect(readMediaQueryMatch('(min-width: 1280px)', matchMedia)).toBe(false);
  });

  it('falls back to false when no matchMedia implementation is available', () => {
    expect(readMediaQueryMatch(query, null)).toBe(false);
  });

  it('updates when the media query match changes', async () => {
    const mediaQueryList = seedMediaQuery(query, false);

    await renderHarness(query);
    expect(hookState.current).toBe(false);

    await act(async () => {
      mediaQueryList.emitChange(true);
    });

    expect(hookState.current).toBe(true);
  });

  it('removes the change listener on unmount', async () => {
    const mediaQueryList = seedMediaQuery(query, false);
    const root = await renderHarness(query);

    expect(mediaQueryList.listenerCount()).toBe(1);

    await act(async () => {
      root.unmount();
    });

    expect(mediaQueryList.listenerCount()).toBe(0);
  });

  it('falls back to false when window.matchMedia is unavailable', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });

    await renderHarness(query);

    expect(hookState.current).toBe(false);
  });

  it('uses addListener and removeListener when modern listener APIs are unavailable', async () => {
    const legacyQuery = getMaxWidthMediaQuery('md');
    const mediaQueryList = seedLegacyMediaQuery(legacyQuery, true);
    const root = await renderHarness(legacyQuery);

    expect(hookState.current).toBe(true);
    expect(mediaQueryList.listenerCount()).toBe(1);

    await act(async () => {
      mediaQueryList.emitChange(false);
    });

    expect(hookState.current).toBe(false);

    await act(async () => {
      root.unmount();
    });

    expect(mediaQueryList.listenerCount()).toBe(0);
  });

  it('switches subscriptions when the query prop changes', async () => {
    const firstQuery = getMaxWidthMediaQuery('md');
    const secondQuery = getMaxWidthMediaQuery('lg');
    const firstList = seedMediaQuery(firstQuery, false);
    const secondList = seedMediaQuery(secondQuery, true);
    const container = document.createElement('div');
    document.body.appendChild(container);

    const root = createRoot(container);
    mountedRoots.push(root);

    await act(async () => {
      root.render(<MediaQueryHarness query={firstQuery} />);
    });

    expect(firstList.listenerCount()).toBe(1);
    expect(hookState.current).toBe(false);

    await act(async () => {
      root.render(<MediaQueryHarness query={secondQuery} />);
    });

    expect(firstList.listenerCount()).toBe(0);
    expect(secondList.listenerCount()).toBe(1);
    expect(hookState.current).toBe(true);
  });
});
