// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Tabs } from '../Tabs';

const items = [
  { id: 'alpha', label: 'Alpha' },
  { id: 'beta', label: 'Beta' },
  { id: 'gamma', label: 'Gamma', disabled: true },
];

describe('Tabs', () => {
  it('renders tablist with aria-label and correct ARIA roles', () => {
    const html = renderToStaticMarkup(
      <Tabs items={items} value="alpha" onChange={() => {}} ariaLabel="Test tabs" />,
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Test tabs"');
    expect(html).toContain('role="tab"');
  });

  it('marks the selected tab with aria-selected="true" and non-selected with aria-selected="false"', () => {
    const html = renderToStaticMarkup(
      <Tabs items={items} value="beta" onChange={() => {}} ariaLabel="Test tabs" />,
    );

    // beta is selected
    expect(html).toContain('id="tab-beta" aria-selected="true"');
    // alpha is not selected
    expect(html).toContain('id="tab-alpha" aria-selected="false"');
  });

  it('sets tabIndex=0 on selected tab and tabIndex=-1 on others', () => {
    const html = renderToStaticMarkup(
      <Tabs items={items} value="alpha" onChange={() => {}} ariaLabel="Test tabs" />,
    );

    const tabIndexZeroCount = (html.match(/tabindex="0"/g) ?? []).length;
    const tabIndexMinusOneCount = (html.match(/tabindex="-1"/g) ?? []).length;
    expect(tabIndexZeroCount).toBe(1);
    // beta and gamma are non-selected (2 tabs)
    expect(tabIndexMinusOneCount).toBe(2);
  });

  it('wires aria-controls to the corresponding panel id', () => {
    const html = renderToStaticMarkup(
      <Tabs items={items} value="alpha" onChange={() => {}} ariaLabel="Test tabs" />,
    );

    expect(html).toContain('aria-controls="panel-alpha"');
    expect(html).toContain('aria-controls="panel-beta"');
    expect(html).toContain('aria-controls="panel-gamma"');
  });

  it('marks disabled tab with disabled attribute', () => {
    const html = renderToStaticMarkup(
      <Tabs items={items} value="alpha" onChange={() => {}} ariaLabel="Test tabs" />,
    );

    // disabled button - in static markup the disabled attribute appears without value
    const gammaFragment = html.slice(html.indexOf('id="tab-gamma"'));
    expect(gammaFragment).toMatch(/disabled/);
  });

  it('calls onChange when a tab onClick fires', () => {
    const onChange = vi.fn();
    const element = Tabs({ items, value: 'alpha', onChange, ariaLabel: 'Test tabs' });

    const tablistChildren = element.props.children as React.ReactElement[];
    const betaTab = tablistChildren.find(
      (child: React.ReactElement) => child.props.id === 'tab-beta',
    );
    expect(betaTab).toBeDefined();

    betaTab!.props.onClick();
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('beta');
  });

  describe('keyboard navigation (onKeyDown handler)', () => {
    // document.getElementById is available in jsdom; elements not yet mounted return null,
    // so tabEl?.focus() is a safe no-op - no stub needed.

    function makeEvent(key: string): React.KeyboardEvent<HTMLButtonElement> {
      return {
        key,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLButtonElement>;
    }

    function getTabButton(
      tabId: string,
      value: string,
      onChange: (id: string) => void,
    ): React.ReactElement {
      const element = Tabs({ items, value, onChange, ariaLabel: 'Test tabs' });
      const tablistChildren = element.props.children as React.ReactElement[];
      const tab = tablistChildren.find(
        (child: React.ReactElement) => child.props.id === `tab-${tabId}`,
      );
      if (!tab) throw new Error(`Tab ${tabId} not found`);
      return tab;
    }

    it('ArrowRight from alpha calls onChange with beta (next enabled)', () => {
      const onChange = vi.fn();
      const alphaTab = getTabButton('alpha', 'alpha', onChange);
      alphaTab.props.onKeyDown(makeEvent('ArrowRight'));
      expect(onChange).toHaveBeenCalledWith('beta');
    });

    it('ArrowLeft from alpha wraps to beta (last enabled, gamma is disabled)', () => {
      const onChange = vi.fn();
      const alphaTab = getTabButton('alpha', 'alpha', onChange);
      alphaTab.props.onKeyDown(makeEvent('ArrowLeft'));
      // enabled = [alpha(0), beta(1)]; from index 0, ArrowLeft wraps to index 1 => beta
      expect(onChange).toHaveBeenCalledWith('beta');
    });

    it('ArrowRight from beta wraps to alpha (first enabled)', () => {
      const onChange = vi.fn();
      const betaTab = getTabButton('beta', 'beta', onChange);
      betaTab.props.onKeyDown(makeEvent('ArrowRight'));
      expect(onChange).toHaveBeenCalledWith('alpha');
    });

    it('Home moves to alpha (first enabled)', () => {
      const onChange = vi.fn();
      const betaTab = getTabButton('beta', 'beta', onChange);
      betaTab.props.onKeyDown(makeEvent('Home'));
      expect(onChange).toHaveBeenCalledWith('alpha');
    });

    it('End moves to beta (last enabled, gamma is disabled)', () => {
      const onChange = vi.fn();
      const alphaTab = getTabButton('alpha', 'alpha', onChange);
      alphaTab.props.onKeyDown(makeEvent('End'));
      expect(onChange).toHaveBeenCalledWith('beta');
    });

    it('ignores non-navigation keys without calling onChange', () => {
      const onChange = vi.fn();
      const alphaTab = getTabButton('alpha', 'alpha', onChange);
      alphaTab.props.onKeyDown(makeEvent('Enter'));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('calls preventDefault on navigation keys', () => {
      const onChange = vi.fn();
      const alphaTab = getTabButton('alpha', 'alpha', onChange);
      const event = makeEvent('ArrowRight');
      alphaTab.props.onKeyDown(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });
  });
});
