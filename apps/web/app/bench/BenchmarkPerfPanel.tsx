import { useId } from 'react';

import { Button } from '../ui/Button';
import type { BenchPerfEntry } from '../state/benchSlice';

export type BenchmarkPerfPanelProps = {
  entries: BenchPerfEntry[];
  onClear: () => void;
};

export function BenchmarkPerfPanel({ entries, onClear }: BenchmarkPerfPanelProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-app-lg border border-border bg-panel p-5 shadow-lg"
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-lg font-semibold">
            Performance
          </h2>
          <p className="text-sm text-muted">
            Observed benchmark performance measures ({entries.length}).
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={entries.length === 0}>
          Clear
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-app-md border border-dashed border-border px-3 py-4 text-sm text-muted">
          No performance measures captured yet.
        </p>
      ) : (
        <div className="max-h-60 overflow-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">
              Performance measures, {entries.length} {entries.length === 1 ? 'entry' : 'entries'}.
              Most recent first.
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-2 py-2">
                  Name
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  Duration (<abbr title="milliseconds">ms</abbr>)
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  Start (<abbr title="milliseconds">ms</abbr>)
                </th>
              </tr>
            </thead>
            <tbody>
              {[...entries].reverse().map((entry, index) => (
                <tr key={`${entry.name}-${entry.startTime}-${index}`}>
                  <td className="px-2 py-2">{entry.name}</td>
                  <td className="px-2 py-2 text-right">{entry.duration.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right">{entry.startTime.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
