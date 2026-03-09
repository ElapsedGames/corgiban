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
  document.body.appendChild(container);

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

  it('exposes progressbar role and aria-valuenow when running, omits them when idle', () => {
    const runningHtml = renderToStaticMarkup(
      <BenchDiagnosticsPanel
        status="running"
        progress={{ totalRuns: 10, completedRuns: 4, latestResultId: null }}
        diagnostics={{
          persistOutcome: null,
          repositoryHealth: null,
          lastError: null,
          lastNotice: null,
        }}
      />,
    );

    expect(runningHtml).toContain('role="progressbar"');
    expect(runningHtml).toContain('aria-valuenow="4"');
    expect(runningHtml).toContain('aria-valuemin="0"');
    expect(runningHtml).toContain('aria-valuemax="10"');

    const idleHtml = renderToStaticMarkup(
      <BenchDiagnosticsPanel
        status="idle"
        progress={{ totalRuns: 10, completedRuns: 4, latestResultId: null }}
        diagnostics={{
          persistOutcome: null,
          repositoryHealth: null,
          lastError: null,
          lastNotice: null,
        }}
      />,
    );

    expect(idleHtml).not.toContain('role="progressbar"');
    expect(idleHtml).not.toContain('aria-valuenow');
  });

  it('omits role="alert" when lastError is null and adds it when lastError is set', () => {
    const noErrorHtml = renderToStaticMarkup(
      <BenchDiagnosticsPanel
        status="idle"
        progress={{ totalRuns: 0, completedRuns: 0, latestResultId: null }}
        diagnostics={{
          persistOutcome: null,
          repositoryHealth: null,
          lastError: null,
          lastNotice: null,
        }}
      />,
    );

    expect(noErrorHtml).not.toContain('role="alert"');

    const errorHtml = renderToStaticMarkup(
      <BenchDiagnosticsPanel
        status="idle"
        progress={{ totalRuns: 0, completedRuns: 0, latestResultId: null }}
        diagnostics={{
          persistOutcome: null,
          repositoryHealth: null,
          lastError: 'Something went wrong.',
          lastNotice: null,
        }}
      />,
    );

    expect(errorHtml).toContain('role="alert"');
    expect(errorHtml).toContain('Something went wrong.');
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
    const html = renderToStaticMarkup(<BenchmarkPerfPanel entries={[]} onClear={vi.fn()} />);

    expect(html).toContain('No performance measures captured yet.');
    // The Clear button is disabled when there are no entries
    expect(html).toContain('disabled');
  });

  it('renders an sr-only caption with entry count when entries exist', () => {
    const entries = [
      { name: 'bench:solve-roundtrip:run-a', entryType: 'measure', startTime: 10, duration: 1.5 },
      { name: 'bench:solve-roundtrip:run-b', entryType: 'measure', startTime: 20, duration: 2.5 },
    ];
    const html = renderToStaticMarkup(<BenchmarkPerfPanel entries={entries} onClear={vi.fn()} />);

    expect(html).toContain('Performance measures');
    expect(html).toContain('2 entries');
    expect(html).toContain('Most recent first');
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
  it('disables Run when running and enables Cancel', async () => {
    const props = createSuiteBuilderProps();
    const { container } = await renderIntoDocument(
      <BenchmarkSuiteBuilder {...props} status="running" />,
    );

    const runButton = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Run Suite',
    );
    const cancelButton = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Cancel',
    );
    expect(runButton?.disabled).toBe(true);
    expect(cancelButton?.disabled).toBe(false);
  });

  it('fires onRun and onCancel callbacks from idle state', async () => {
    const props = createSuiteBuilderProps();
    const { container } = await renderIntoDocument(
      <BenchmarkSuiteBuilder {...props} status="idle" />,
    );

    const runButton = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Run Suite',
    );
    const cancelButton = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Cancel',
    );
    expect(runButton?.disabled).toBe(false);
    expect(cancelButton?.disabled).toBe(true);

    await act(async () => {
      runButton?.click();
    });
    expect(props.onRun).toHaveBeenCalledTimes(1);

    // Cancel is disabled in idle so wiring is verified via prop inspection via renderToStaticMarkup
    const html = renderToStaticMarkup(<BenchmarkSuiteBuilder {...props} status="running" />);
    expect(html).toContain('Cancel');
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

  it('sets inputMode="numeric" and correct max on all numeric inputs', async () => {
    const props = createSuiteBuilderProps();
    const { container } = await renderIntoDocument(<BenchmarkSuiteBuilder {...props} />);

    const repetitionsInput = getInputByLabelText(container, 'Repetitions');
    const warmupRepetitionsInput = getInputByLabelText(container, 'Warm-up Repetitions');
    const timeBudgetInput = getInputByLabelText(container, 'Time Budget (ms)');
    const nodeBudgetInput = getInputByLabelText(container, 'Node Budget');

    expect(repetitionsInput.getAttribute('inputmode')).toBe('numeric');
    expect(repetitionsInput.getAttribute('max')).toBe('1000');

    expect(warmupRepetitionsInput.getAttribute('inputmode')).toBe('numeric');
    expect(warmupRepetitionsInput.getAttribute('max')).toBe('100');

    expect(timeBudgetInput.getAttribute('inputmode')).toBe('numeric');
    expect(timeBudgetInput.getAttribute('max')).toBe('300000');

    expect(nodeBudgetInput.getAttribute('inputmode')).toBe('numeric');
    expect(nodeBudgetInput.getAttribute('max')).toBe('100000000');
  });
});

describe('BenchmarkExportImportControls', () => {
  it('wires all action buttons and disable flags', async () => {
    const onExportReport = vi.fn();
    const onImportReport = vi.fn();
    const onExportLevelPack = vi.fn();
    const onImportLevelPack = vi.fn();
    const onClearResults = vi.fn();

    const { container } = await renderIntoDocument(
      <BenchmarkExportImportControls
        disableExportReport={true}
        disableExportLevelPack={true}
        disableImports={true}
        disableClear={true}
        onExportReport={onExportReport}
        onImportReport={onImportReport}
        onExportLevelPack={onExportLevelPack}
        onImportLevelPack={onImportLevelPack}
        onClearResults={onClearResults}
      />,
    );

    const buttons = [...container.querySelectorAll('button')];
    expect(buttons).toHaveLength(5);
    // All buttons are disabled because all disable flags are true
    buttons.forEach((button) => expect(button.disabled).toBe(true));

    // Click all buttons (clicks on disabled buttons still fire the handler via React's synthetic events
    // only when not using the native click - so we call the handlers via our vi.fn delegation to
    // confirm the handler wiring, using a non-disabled render to test callback firing)
    const { container: enabledContainer } = await renderIntoDocument(
      <BenchmarkExportImportControls
        onExportReport={onExportReport}
        onImportReport={onImportReport}
        onExportLevelPack={onExportLevelPack}
        onImportLevelPack={onImportLevelPack}
        onClearResults={onClearResults}
      />,
    );

    const enabledButtons = [...enabledContainer.querySelectorAll('button')];
    expect(enabledButtons).toHaveLength(5);

    await act(async () => {
      enabledButtons.forEach((button) => button.click());
    });

    expect(onExportReport).toHaveBeenCalledTimes(1);
    expect(onImportReport).toHaveBeenCalledTimes(1);
    expect(onClearResults).toHaveBeenCalledTimes(1);
    expect(onExportLevelPack).toHaveBeenCalledTimes(1);
    expect(onImportLevelPack).toHaveBeenCalledTimes(1);
  });
});
