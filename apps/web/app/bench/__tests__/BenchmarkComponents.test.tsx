import type { ReactElement } from 'react';
import { isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { BenchDiagnosticsPanel } from '../BenchDiagnosticsPanel';
import { BenchmarkExportImportControls } from '../BenchmarkExportImportControls';
import { BenchmarkPerfPanel } from '../BenchmarkPerfPanel';
import { BenchmarkSuiteBuilder } from '../BenchmarkSuiteBuilder';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';

function collectByType(node: unknown, targetType: unknown, matches: ReactElement[] = []) {
  if (!node) {
    return matches;
  }

  if (Array.isArray(node)) {
    node.forEach((child) => collectByType(child, targetType, matches));
    return matches;
  }

  if (!isValidElement<{ children?: unknown }>(node)) {
    return matches;
  }

  if (node.type === targetType) {
    matches.push(node);
  }

  collectByType(node.props?.children, targetType, matches);
  return matches;
}

function createSuiteBuilderProps() {
  return {
    suite: {
      levelIds: ['classic-001'],
      algorithmIds: ['bfsPush' as const],
      repetitions: 2,
      timeBudgetMs: 1000,
      nodeBudget: 500,
    },
    status: 'idle' as const,
    availableLevels: [
      { id: 'classic-001', name: 'Classic 001' },
      { id: 'classic-002', name: 'Classic 002' },
    ],
    availableAlgorithms: [
      { id: 'bfsPush' as const, label: 'BFS Push' },
      { id: 'idaStarPush' as const, label: 'IDA* Push', disabled: true },
    ],
    onToggleLevel: vi.fn(),
    onToggleAlgorithm: vi.fn(),
    onSetRepetitions: vi.fn(),
    onSetTimeBudgetMs: vi.fn(),
    onSetNodeBudget: vi.fn(),
    onRun: vi.fn(),
    onCancel: vi.fn(),
  };
}

describe('BenchDiagnosticsPanel', () => {
  it.each([
    ['idle', 'Idle'],
    ['running', 'Running'],
    ['cancelling', 'Cancelling'],
    ['completed', 'Completed'],
    ['cancelled', 'Cancelled'],
    ['failed', 'Failed'],
  ] as const)('renders %s status label', (status, label) => {
    const html = renderToStaticMarkup(
      <BenchDiagnosticsPanel
        status={status}
        progress={{ totalRuns: 5, completedRuns: 2, latestResultId: 'result-2' }}
        diagnostics={{ persistOutcome: 'granted', lastError: null, lastNotice: null }}
      />,
    );

    expect(html).toContain(label);
    expect(html).toContain('2/5');
    expect(html).toContain('result-2');
    expect(html).toContain('granted');
  });

  it('renders fallback values and error message', () => {
    const html = renderToStaticMarkup(
      <BenchDiagnosticsPanel
        status="idle"
        progress={{ totalRuns: 0, completedRuns: 0, latestResultId: null }}
        diagnostics={{ persistOutcome: null, lastError: 'Something failed.', lastNotice: null }}
      />,
    );

    expect(html).toContain('None');
    expect(html).toContain('pending');
    expect(html).toContain('Something failed.');
  });

  it('renders non-error notices for partial import outcomes', () => {
    const html = renderToStaticMarkup(
      <BenchDiagnosticsPanel
        status="idle"
        progress={{ totalRuns: 0, completedRuns: 0, latestResultId: null }}
        diagnostics={{
          persistOutcome: 'granted',
          lastError: null,
          lastNotice: 'Imported 2 levels. 1 unrecognized ID was skipped.',
        }}
      />,
    );

    expect(html).toContain('Imported 2 levels. 1 unrecognized ID was skipped.');
  });
});

describe('BenchmarkPerfPanel', () => {
  it('shows empty state and disables clear when no entries exist', () => {
    const element = BenchmarkPerfPanel({ entries: [], onClear: vi.fn() });
    const buttons = collectByType(element, 'button');

    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.props.disabled).toBe(true);
    expect(renderToStaticMarkup(element)).toContain('No performance measures captured yet.');
  });

  it('renders newest entries first and wires clear callback', () => {
    const onClear = vi.fn();
    const entries = [
      {
        name: 'bench:solve-roundtrip:old',
        entryType: 'measure',
        startTime: 10,
        duration: 1.2,
      },
      {
        name: 'bench:solve-roundtrip:new',
        entryType: 'measure',
        startTime: 20,
        duration: 2.4,
      },
    ];

    const element = BenchmarkPerfPanel({ entries, onClear });
    const html = renderToStaticMarkup(element);
    expect(html.indexOf('bench:solve-roundtrip:new')).toBeLessThan(
      html.indexOf('bench:solve-roundtrip:old'),
    );
    expect(html).toContain('2.40');
    expect(html).toContain('20.00');

    const buttons = collectByType(element, 'button');
    expect(buttons[0]?.props.disabled).toBe(false);
    buttons[0]?.props.onClick?.();
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe('BenchmarkSuiteBuilder', () => {
  it('wires run/cancel callbacks and disabled states from status', () => {
    const props = createSuiteBuilderProps();
    const runningElement = BenchmarkSuiteBuilder({
      ...props,
      status: 'running',
    });

    const buttons = collectByType(runningElement, Button);
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.props.disabled).toBe(true);
    expect(buttons[1]?.props.disabled).toBe(false);

    buttons[0]?.props.onClick?.();
    buttons[1]?.props.onClick?.();
    expect(props.onRun).toHaveBeenCalledTimes(1);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('wires checkbox and numeric-input handlers', () => {
    const props = createSuiteBuilderProps();
    const element = BenchmarkSuiteBuilder(props);

    const nativeInputs = collectByType(element, 'input');
    const levelInputs = nativeInputs.filter((input) => input.props.type === 'checkbox');
    expect(levelInputs).toHaveLength(4);

    levelInputs[0]?.props.onChange?.();
    levelInputs[2]?.props.onChange?.();
    expect(props.onToggleLevel).toHaveBeenCalledWith('classic-001');
    expect(props.onToggleAlgorithm).toHaveBeenCalledWith('bfsPush');
    expect(levelInputs[3]?.props.disabled).toBe(true);

    const budgetInputs = collectByType(element, Input);
    expect(budgetInputs).toHaveLength(3);

    budgetInputs[0]?.props.onChange?.({ target: { value: '4' } });
    budgetInputs[1]?.props.onChange?.({ target: { value: '2500' } });
    budgetInputs[2]?.props.onChange?.({ target: { value: '12000' } });

    expect(props.onSetRepetitions).toHaveBeenCalledWith(4);
    expect(props.onSetTimeBudgetMs).toHaveBeenCalledWith(2500);
    expect(props.onSetNodeBudget).toHaveBeenCalledWith(12000);
  });
});

describe('BenchmarkExportImportControls', () => {
  it('wires all action buttons and disable flags', () => {
    const onExportReport = vi.fn();
    const onImportReport = vi.fn();
    const onExportLevelPack = vi.fn();
    const onImportLevelPack = vi.fn();
    const onClearResults = vi.fn();

    const element = BenchmarkExportImportControls({
      disableExportReport: true,
      disableExportLevelPack: true,
      disableImports: true,
      disableClear: true,
      onExportReport,
      onImportReport,
      onExportLevelPack,
      onImportLevelPack,
      onClearResults,
    });

    const buttons = collectByType(element, Button);
    expect(buttons).toHaveLength(5);
    // Export Report, Import Report, Clear Results, Export Level Pack, Import Level Pack
    expect(buttons[0]?.props.disabled).toBe(true); // disableExportReport
    expect(buttons[1]?.props.disabled).toBe(true); // disableImports
    expect(buttons[2]?.props.disabled).toBe(true); // disableClear
    expect(buttons[3]?.props.disabled).toBe(true); // disableExportLevelPack
    expect(buttons[4]?.props.disabled).toBe(true); // disableImports

    buttons.forEach((button) => button.props.onClick?.());
    expect(onExportReport).toHaveBeenCalledTimes(1);
    expect(onImportReport).toHaveBeenCalledTimes(1);
    expect(onClearResults).toHaveBeenCalledTimes(1);
    expect(onExportLevelPack).toHaveBeenCalledTimes(1);
    expect(onImportLevelPack).toHaveBeenCalledTimes(1);
  });
});
