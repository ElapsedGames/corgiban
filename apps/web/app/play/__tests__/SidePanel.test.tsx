import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { SidePanel } from '../SidePanel';

const noop = () => undefined;

const baseProps = {
  levelName: 'Test Level',
  levelId: 'test-level-001',
  stats: { moves: 0, pushes: 0 },
  moves: [],
  isSolved: false,
  canGoToPreviousLevel: false,
  onPreviousLevel: noop,
  onRestart: noop,
  onUndo: noop,
  onNextLevel: noop,
};

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
    expect(html).toContain('emerald');
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

  it('truncates long level names with a title tooltip', () => {
    const longName = 'A Very Long Level Name That Would Overflow The Sidebar';
    const html = renderToStaticMarkup(<SidePanel {...baseProps} levelName={longName} />);

    expect(html).toContain(`title="${longName}"`);
    expect(html).toContain('truncate');
  });
});
