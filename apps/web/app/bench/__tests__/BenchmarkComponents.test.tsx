// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { act, isValidElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BenchDiagnosticsPanel } from '../BenchDiagnosticsPanel';
import { BenchmarkExportImportControls } from '../BenchmarkExportImportControls';
import { BenchmarkPerfPanel } from '../BenchmarkPerfPanel';
import { BenchmarkSuiteBuilder } from '../BenchmarkSuiteBuilder';
import { Button } from '../../ui/Button';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

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
      warmupRepetitions: 1,
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
    onSetWarmupRepetitions: vi.fn(),
    onSetTimeBudgetMs: vi.fn(),
    onSetNodeBudget: vi.fn(),
    onRun: vi.fn(),
    onCancel: vi.fn(),
  };
}

const mountedRoots: Root[] = [];

async function renderIntoDocument(element: ReactElement) {
  const container = document.createElement('div');
  document.body.append(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(element);
  });

  return { container };
}

function getInputByLabelText(container: HTMLElement, labelText: string): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((candidate) =>
    candidate.textContent?.includes(labelText),
  );
  expect(label).toBeTruthy();

  const control = label?.control ?? label?.querySelector('input, textarea, select');
  expect(control instanceof HTMLInputElement).toBe(true);

  return control as HTMLInputElement;
}

function getButtonByText(container: HTMLElement, buttonText: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === buttonText,
  );
  expect(button).toBeTruthy();
  return button as HTMLButtonElement;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  expect(valueSetter).toBeTypeOf('function');

  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

afterEach(async () => {
  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop();
    await act(async () => {
      root?.unmount();
    });
  }

  document.body.innerHTML = '';
});

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
        diagnostics={{
          persistOutcome: 'granted',
          repositoryHealth: 'durable',
          lastError: null,
          lastNotice: null,
        }}
      />,
    );

    expect(html).toContain(label);
    expect(html).toContain('Execution status');
    expect(html).toContain('Execution progress');
    expect(html).toContain('Latest execution result');
    expect(html).toContain('Storage persistence');
    expect(html).toContain('Persistence durability');
    expect(html).toContain('2/5');
    expect(html).toContain('result-2');
    expect(html).toContain('granted');
    expect(html).toContain('durable');
  });

  it('renders fallback values and error message', () => {
    const html = renderToStaticMarkup(
      <BenchDiagnosticsPanel
        status="idle"
        progress={{ totalRuns: 0, completedRuns: 0, latestResultId: null }}
        diagnostics={{
          persistOutcome: null,
          repositoryHealth: null,
          lastError: 'Something failed.',
          lastNotice: null,
        }}
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
          repositoryHealth: 'durable',
          lastError: null,
          lastNotice: 'Imported 2 levels. 1 unrecognized ID was skipped.',
        }}
      />,
    );

    expect(html).toContain('Imported 2 levels. 1 unrecognized ID was skipped.');
  });

  it('explains sticky memory fallback separately from execution completion', () => {
    const html = renderToStaticMarkup(
      <BenchDiagnosticsPanel
        status="completed"
        progress={{ totalRuns: 2, completedRuns: 2, latestResultId: 'result-2' }}
        diagnostics={{
          persistOutcome: 'granted',
          repositoryHealth: 'memory-fallback',
          lastError: null,
          lastNotice: null,
        }}
      />,
    );

    expect(html).toContain('Completed');
    expect(html).toContain('memory-fallback (sticky until reload)');
    expect(html).toContain(
      'Sticky memory-fallback means execution can still complete while durable persistence is degraded.',
    );
    expect(html).toContain('Results stay in memory for the current page session until reload.');
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

  it('renders newest entries first and wires clear callback', async () => {
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

    const { container } = await renderIntoDocument(
      <BenchmarkPerfPanel entries={entries} onClear={onClear} />,
    );

    const rowNames = [...container.querySelectorAll('tbody tr td:first-child')].map((cell) =>
      cell.textContent?.trim(),
    );
    expect(rowNames).toEqual(['bench:solve-roundtrip:new', 'bench:solve-roundtrip:old']);
    expect(container.textContent).toContain('2.40');
    expect(container.textContent).toContain('20.00');

    const clearButton = getButtonByText(container, 'Clear');
    expect(clearButton.disabled).toBe(false);

    await act(async () => {
      clearButton.click();
    });

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

  it('wires checkbox and numeric-input handlers', async () => {
    const props = createSuiteBuilderProps();
    const { container } = await renderIntoDocument(<BenchmarkSuiteBuilder {...props} />);

    const classicLevelInput = getInputByLabelText(container, 'Classic 001');
    const bfsPushInput = getInputByLabelText(container, 'BFS Push');
    const idaStarInput = getInputByLabelText(container, 'IDA* Push');

    await act(async () => {
      classicLevelInput.click();
      bfsPushInput.click();
    });

    expect(props.onToggleLevel).toHaveBeenCalledWith('classic-001');
    expect(props.onToggleAlgorithm).toHaveBeenCalledWith('bfsPush');
    expect(idaStarInput.disabled).toBe(true);

    const repetitionsInput = getInputByLabelText(container, 'Repetitions');
    const warmupRepetitionsInput = getInputByLabelText(container, 'Warm-up Repetitions');
    const timeBudgetInput = getInputByLabelText(container, 'Time Budget (ms)');
    const nodeBudgetInput = getInputByLabelText(container, 'Node Budget');

    await act(async () => {
      setInputValue(repetitionsInput, '4');
      setInputValue(warmupRepetitionsInput, '3');
      setInputValue(timeBudgetInput, '2500');
      setInputValue(nodeBudgetInput, '12000');
    });

    expect(props.onSetRepetitions).toHaveBeenCalledWith(4);
    expect(props.onSetWarmupRepetitions).toHaveBeenCalledWith(3);
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
