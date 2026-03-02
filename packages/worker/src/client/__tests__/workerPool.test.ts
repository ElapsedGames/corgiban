import { describe, expect, it } from 'vitest';

import { WorkerPool } from '../workerPool.client';

function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;
  const promise = new Promise<T>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

describe('WorkerPool', () => {
  it('runs one task at a time per worker', async () => {
    const events: string[] = [];
    const pool = new WorkerPool(() => ({ id: 'worker-1' }), 1);

    const first = createDeferred<void>();
    const second = createDeferred<void>();
    const secondStarted = createDeferred<void>();

    const firstTask = pool.enqueue({
      runId: 'run-1',
      run: async (worker) => {
        events.push(`start-${worker.id}-1`);
        await first.promise;
        events.push(`end-${worker.id}-1`);
      },
    });

    const secondTask = pool.enqueue({
      runId: 'run-2',
      run: async (worker) => {
        events.push(`start-${worker.id}-2`);
        secondStarted.resolve();
        await second.promise;
        events.push(`end-${worker.id}-2`);
      },
    });

    await Promise.resolve();
    expect(events).toEqual(['start-worker-1-1']);

    first.resolve();
    await firstTask;
    await secondStarted.promise;

    expect(events).toEqual(['start-worker-1-1', 'end-worker-1-1', 'start-worker-1-2']);

    second.resolve();
    await secondTask;

    expect(events).toEqual([
      'start-worker-1-1',
      'end-worker-1-1',
      'start-worker-1-2',
      'end-worker-1-2',
    ]);
  });

  it('runs tasks concurrently across multiple workers', async () => {
    let counter = 0;
    const pool = new WorkerPool(() => ({ id: `worker-${(counter += 1)}` }), 2);

    const first = createDeferred<void>();
    const second = createDeferred<void>();
    const events: string[] = [];

    const firstTask = pool.enqueue({
      runId: 'run-1',
      run: async (worker) => {
        events.push(`start-${worker.id}-1`);
        await first.promise;
        events.push(`end-${worker.id}-1`);
      },
    });

    const secondTask = pool.enqueue({
      runId: 'run-2',
      run: async (worker) => {
        events.push(`start-${worker.id}-2`);
        await second.promise;
        events.push(`end-${worker.id}-2`);
      },
    });

    await Promise.resolve();
    expect(events).toHaveLength(2);
    const workerIds = events.map((event) => {
      const parts = event.split('-');
      return `${parts[1]}-${parts[2]}`;
    });
    expect(new Set(workerIds).size).toBe(2);

    first.resolve();
    second.resolve();

    await Promise.all([firstTask, secondTask]);

    expect(events).toHaveLength(4);
  });

  it('rejects synchronous run throws and frees the worker slot', async () => {
    const events: string[] = [];
    const pool = new WorkerPool(() => ({ id: 'worker-1' }), 1);

    const first = pool.enqueue({
      runId: 'run-1',
      run: (worker) => {
        events.push(`start-${worker.id}-1`);
        throw new Error('Boom.');
      },
    });

    const second = pool.enqueue({
      runId: 'run-2',
      run: async (worker) => {
        events.push(`start-${worker.id}-2`);
        return 'ok';
      },
    });

    await expect(first).rejects.toThrow('Boom.');
    await expect(second).resolves.toBe('ok');

    expect(events).toEqual(['start-worker-1-1', 'start-worker-1-2']);
  });

  it('cancels queued tasks by runId', async () => {
    const events: string[] = [];
    const pool = new WorkerPool(() => ({ id: 'worker-1' }), 1);

    const first = createDeferred<void>();

    const firstTask = pool.enqueue({
      runId: 'run-1',
      run: async (worker) => {
        events.push(`start-${worker.id}-1`);
        await first.promise;
        events.push(`end-${worker.id}-1`);
      },
    });

    const secondTask = pool.enqueue({
      runId: 'run-2',
      run: async (worker) => {
        events.push(`start-${worker.id}-2`);
      },
    });
    const rejection = secondTask.catch((error) => error);

    expect(pool.cancel('run-2')).toBe(true);

    const error = await rejection;
    if (!(error instanceof Error)) {
      throw new Error('Expected an Error instance.');
    }
    expect(error.message).toContain('cancelled');

    first.resolve();
    await firstTask;

    expect(events).toEqual(['start-worker-1-1', 'end-worker-1-1']);
  });

  it('returns false when cancelling a running task', async () => {
    const pool = new WorkerPool(() => ({ id: 'worker-1' }), 1);
    const gate = createDeferred<void>();

    const task = pool.enqueue({
      runId: 'run-1',
      run: async () => {
        await gate.promise;
      },
    });

    expect(pool.cancel('run-1')).toBe(false);

    gate.resolve();
    await task;
  });

  it('rejects queued and active tasks on dispose', async () => {
    const pool = new WorkerPool(() => ({ id: 'worker-1' }), 1);
    const gate = createDeferred<void>();

    const active = pool.enqueue({
      runId: 'run-active',
      run: async () => {
        await gate.promise;
      },
    });

    const pending = pool.enqueue({
      runId: 'run-queued',
      run: async () => undefined,
    });

    pool.dispose('Disposed for test.');

    await expect(pending).rejects.toThrow('Disposed for test.');
    await expect(active).rejects.toThrow('Disposed for test.');

    gate.resolve();
  });

  it('disposes all workers when dispose is called', () => {
    let counter = 0;
    const disposed: string[] = [];
    const pool = new WorkerPool(
      () => ({ id: `worker-${(counter += 1)}` }),
      2,
      (worker) => {
        disposed.push(worker.id);
      },
    );

    pool.dispose();

    expect(disposed).toEqual(['worker-1', 'worker-2']);
  });

  it('rejects enqueue after dispose', async () => {
    const pool = new WorkerPool(() => ({ id: 'worker-1' }), 1);

    pool.dispose();

    await expect(
      pool.enqueue({
        runId: 'run-after-dispose',
        run: async () => undefined,
      }),
    ).rejects.toThrow('disposed');
  });
});
