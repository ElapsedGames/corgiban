import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Button } from '../../ui/Button';
import { SidePanel } from '../SidePanel';

const noop = () => undefined;

const baseProps = {
  levelName: 'Test Level',
  levelId: 'test-level-001',
  stats: { moves: 0, pushes: 0 },
  moves: [],
  isSolved: false,
  labHref: '/lab?levelId=test-level-001',
  benchHref: '/bench?levelId=test-level-001',
  canGoToPreviousLevel: false,
  onPreviousLevel: noop,
  onRestart: noop,
  onUndo: noop,
  onNextLevel: noop,
};

type ButtonElement = ReactElement<{
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'tonal' | 'ghost' | 'destructive';
}>;

function collectButtons(node: unknown, results: ButtonElement[] = []) {
  if (!node) {
    return results;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectButtons(child, results));
    return results;
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    if (node.type === Button) {
      results.push(node as ButtonElement);
    }
    collectButtons(node.props?.children, results);
  }
  return results;
}

function getButtonByLabel(buttons: ButtonElement[], label: string) {
  return buttons.find((button) => button.props.children === label);
}

describe('SidePanel', () => {
  it('renders a named role=group for game controls', () => {
    const html = renderToStaticMarkup(<SidePanel {...baseProps} />);

    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Game controls"');
    expect(html).toContain('grid grid-cols-2 gap-2');
    expect(html.match(/w-full/g)).toHaveLength(4);
  });

  it('shows the solved badge when isSolved is true', () => {
    const html = renderToStaticMarkup(<SidePanel {...baseProps} isSolved={true} />);

    expect(html).toContain('Solved');
    expect(html).toContain('bg-success');
  });

  it('always shows previous-level button and disables it when the previous level is unavailable', () => {
    const withoutPrev = renderToStaticMarkup(<SidePanel {...baseProps} />);
    expect(withoutPrev).toContain('Previous');
    expect(withoutPrev).toMatch(/<button[^>]*disabled=""[^>]*>Previous<\/button>/);

    const withPrev = renderToStaticMarkup(<SidePanel {...baseProps} canGoToPreviousLevel={true} />);
    expect(withPrev).toContain('Previous');
    expect(withPrev).toMatch(/<button[^>]*>Previous<\/button>/);
    expect(withPrev).not.toMatch(/<button[^>]*disabled=""[^>]*>Previous<\/button>/);
  });

  it('uses standardized labels for level navigation controls', () => {
    const html = renderToStaticMarkup(<SidePanel {...baseProps} />);

    expect(html).toContain('Previous');
    expect(html).toContain('Next Level');
  });

  it('uses tonal restart styling and promotes next level only after the puzzle is solved', () => {
    const idleButtons = collectButtons(SidePanel({ ...baseProps, isSolved: false }));
    const solvedButtons = collectButtons(SidePanel({ ...baseProps, isSolved: true }));

    expect(getButtonByLabel(idleButtons, 'Restart')?.props.variant).toBe('tonal');
    expect(getButtonByLabel(idleButtons, 'Next Level')?.props.variant).toBe('secondary');
    expect(getButtonByLabel(solvedButtons, 'Next Level')?.props.variant).toBe('primary');
  });

  it('truncates long level names with a title tooltip', () => {
    const longName = 'A Very Long Level Name That Would Overflow The Sidebar';
    const html = renderToStaticMarkup(<SidePanel {...baseProps} levelName={longName} />);

    expect(html).toContain(`title="${longName}"`);
    expect(html).toContain('truncate');
  });

  it('keeps metadata and history desktop-only while leaving the control grid visible', () => {
    const html = renderToStaticMarkup(<SidePanel {...baseProps} />);

    expect(html).toContain('hidden items-start justify-between gap-3 lg:flex');
    expect(html).toContain('hidden grid-cols-2 gap-3 text-sm lg:grid');
    expect(html).toContain('<div class="hidden lg:block">');
    expect(html).toContain('aria-label="Game controls"');
  });

  it('renders direct handoff links to lab and bench for the current level', () => {
    const html = renderToStaticMarkup(<SidePanel {...baseProps} />);

    expect(html).toContain('href="/lab?levelId=test-level-001"');
    expect(html).toContain('Open in Lab');
    expect(html).toContain('href="/bench?levelId=test-level-001"');
    expect(html).toContain('Send to Bench');
  });
});
